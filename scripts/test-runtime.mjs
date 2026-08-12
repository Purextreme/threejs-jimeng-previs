#!/usr/bin/env node

import assert from 'node:assert/strict'
import * as THREE from 'three'
import { createCameraRig } from '../../src/jimeng-previs/camera-rig.js'
import { getPrevisBounds, loadPrevisModel } from '../../src/jimeng-previs/model.js'
import { createBox, createCapsule, createProductBlock } from '../../src/jimeng-previs/primitives.js'
import { createShot } from '../../src/jimeng-previs/shot.js'
import { createPrevisStage } from '../../src/jimeng-previs/stage.js'
import {
  applyJimengMarkerColor,
  createJimengMarkerMaterial,
  restoreOriginalMaterials,
} from '../../src/jimeng-previs/white-model.js'
import { assertCaptureDiagnostics, assertFrameMaterials, getPreviewMode } from './runtime-tools.mjs'

globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init = {}) { this.type = type; Object.assign(this, init) }
}

let gsap = null
try {
  const gsapModule = await import('gsap')
  gsap = gsapModule.default ?? gsapModule.gsap
} catch {
  console.warn('SKIP: GSAP is not installed; core runtime regressions will still run')
}

const EPSILON = 1e-6

function close(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${message}: expected ${expected}, got ${actual}`)
}

function snapshotCamera(camera) {
  return [
    ...camera.position.toArray(),
    ...camera.quaternion.toArray(),
  ].map((value) => Number(value.toFixed(9)))
}

function assertCameraLooksAt(camera, target, message) {
  const direction = camera.getWorldDirection(new THREE.Vector3())
  const expected = target.clone().sub(camera.getWorldPosition(new THREE.Vector3())).normalize()
  close(direction.dot(expected), 1, message)
}

function pad(buffer, fill = 0) {
  const padding = (4 - (buffer.length % 4)) % 4
  return padding === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(padding, fill)])
}

function createTriangleGlb(positions) {
  const values = new Float32Array(positions.flat())
  const binary = pad(Buffer.from(values.buffer, values.byteOffset, values.byteLength))
  const minimum = [0, 1, 2].map((axis) => Math.min(...positions.map((position) => position[axis])))
  const maximum = [0, 1, 2].map((axis) => Math.max(...positions.map((position) => position[axis])))
  const json = pad(Buffer.from(JSON.stringify({
    asset: { version: '2.0', generator: 'threejs-jimeng-previs regression' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 4 }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length, target: 34962 }],
    accessors: [{
      bufferView: 0,
      componentType: 5126,
      count: positions.length,
      type: 'VEC3',
      min: minimum,
      max: maximum,
    }],
  })), 0x20)
  const totalLength = 12 + 8 + json.length + 8 + binary.length
  const glb = Buffer.alloc(totalLength)
  glb.writeUInt32LE(0x46546c67, 0)
  glb.writeUInt32LE(2, 4)
  glb.writeUInt32LE(totalLength, 8)
  glb.writeUInt32LE(json.length, 12)
  glb.writeUInt32LE(0x4e4f534a, 16)
  json.copy(glb, 20)
  const binaryHeader = 20 + json.length
  glb.writeUInt32LE(binary.length, binaryHeader)
  glb.writeUInt32LE(0x004e4942, binaryHeader + 4)
  binary.copy(glb, binaryHeader + 8)
  return `data:model/gltf-binary;base64,${glb.toString('base64')}`
}

async function testCameraRig() {
  const directCamera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100)
  const directRig = createCameraRig({
    camera: directCamera,
    position: [8, 3, 6],
    target: new THREE.Vector3(0, 1, 0),
  })

  assert.equal(directRig.mode, 'direct')
  directRig.update()
  assert.deepEqual(directCamera.position.toArray(), [8, 3, 6], 'Direct position must remain authoritative')
  assertCameraLooksAt(directCamera, directRig.getTargetPosition(), 'Direct camera must look at its static target')

  directRig.position.set(6, 4, 5)
  directRig.targetPosition.set(1, 1.5, -1)
  directRig.update()
  assert.deepEqual(directCamera.position.toArray(), [6, 4, 5], 'Direct position edits must not be overwritten')
  assertCameraLooksAt(directCamera, directRig.getTargetPosition(), 'Direct target edits must update orientation')

  directRig.setRoll(0.12).update()
  const rolled = snapshotCamera(directCamera)
  directRig.update()
  assert.deepEqual(snapshotCamera(directCamera), rolled, 'Repeated lookAt plus roll updates must not accumulate')
  assertCameraLooksAt(directCamera, directRig.getTargetPosition(), 'Roll must preserve the look direction')

  const followedTarget = new THREE.Object3D()
  followedTarget.position.set(2, 1, 0)
  directRig.setTarget(followedTarget).setTargetOffset([0, 0.3, 0]).update()
  assert.deepEqual(directRig.getTargetPosition().toArray(), [2, 1.3, 0])
  assertCameraLooksAt(directCamera, directRig.getTargetPosition(), 'Object target plus offset must resolve in world space')

  followedTarget.position.set(3, 2, -1)
  directRig.targetOffset.y = 0.5
  directRig.update()
  assert.deepEqual(directCamera.position.toArray(), [6, 4, 5], 'Moving targets must not overwrite direct camera position')
  assert.deepEqual(directRig.getTargetPosition().toArray(), [3, 2.5, -1])
  assertCameraLooksAt(directCamera, directRig.getTargetPosition(), 'Direct camera must track a moving Object3D target')

  directRig.setDistance(7)
  assert.equal(directRig.mode, 'orbit', 'Orbit setters must select orbit mode')
  directRig.update()
  assert.notDeepEqual(directCamera.position.toArray(), [6, 4, 5], 'Orbit mode must compute camera position')
  directRig.useDirectPosition([4, 3, 7]).update()
  assert.equal(directRig.mode, 'direct')
  assert.deepEqual(directCamera.position.toArray(), [4, 3, 7], 'Direct mode must be explicitly restorable')

  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 100)
  const target = new THREE.Object3D()
  target.position.set(1, 2, 3)
  target.updateMatrixWorld(true)
  const rig = createCameraRig({ camera, target, orbitAngle: -0.5, distance: 8, height: 2, truck: 0.4 })

  assert.equal(rig.mode, 'orbit', 'A rig without an authored position must preserve orbit initialization')
  rig.update()
  const first = snapshotCamera(camera)
  rig.update()
  assert.deepEqual(snapshotCamera(camera), first, 'Repeated rig update must be deterministic')

  const originalDistance = camera.position.distanceTo(rig.getTargetPosition())
  rig.dolly(-2).orbit(0.4).crane(1).truck(-0.2).update()
  assert.ok(camera.position.distanceTo(rig.getTargetPosition()) < originalDistance, 'Dolly must reduce target distance')

  const beforeMove = camera.position.clone()
  target.position.x += 3
  target.updateMatrixWorld(true)
  rig.update()
  close(camera.position.x - beforeMove.x, 3, 'Camera must follow a moving target')

  assert.throws(
    () => createCameraRig({ camera: new THREE.PerspectiveCamera(), mode: 'automatic' }),
    /mode must be 'direct' or 'orbit'/,
  )

  const degenerateRig = createCameraRig({
    camera: new THREE.PerspectiveCamera(),
    position: [1, 2, 3],
    target: [1, 2, 3],
  })
  assert.throws(
    () => degenerateRig.update(),
    /position and resolved target must be more than .* units apart/,
    'Coincident camera and target positions must fail fast',
  )
  degenerateRig.targetPosition.z += 1e-7
  assert.throws(
    () => degenerateRig.update(),
    /position and resolved target must be more than .* units apart/,
    'Near-coincident camera and target positions must fail fast',
  )
  degenerateRig.targetPosition.set(1, 2, 2)
  assert.doesNotThrow(() => degenerateRig.update(), 'A corrected target must restore normal camera updates')
}

async function testShot() {
  if (!gsap) return

  const rangeTarget = new THREE.Object3D()
  const rangeRig = createCameraRig({ camera: new THREE.PerspectiveCamera(), target: [0, 0, 0] })
  const rangeShot = createShot({ gsap, frameStart: 10, frameEnd: 20 })
  const outOfRangeOperations = [
    ['move startFrame', () => rangeShot.move(rangeTarget, { to: [1, 0, 0], startFrame: 9, endFrame: 15 })],
    ['rotate endFrame', () => rangeShot.rotate(rangeTarget, { to: [0, 1, 0], startFrame: 15, endFrame: 21 })],
    ['orbit startFrame', () => rangeShot.orbit(rangeRig, { to: 0.5, startFrame: 9, endFrame: 20 })],
    ['dolly endFrame', () => rangeShot.dolly(rangeRig, { to: 8, startFrame: 10, endFrame: 21 })],
    ['to frame range', () => rangeShot.to(rangeTarget.scale, { x: 2 }, { startFrame: 9, endFrame: 21 })],
  ]
  for (const [label, operation] of outOfRangeOperations) {
    assert.throws(
      operation,
      /must stay within Shot range 10-20/,
      `${label} outside the Shot range must fail fast`,
    )
  }
  assert.equal(rangeShot.timeline.getChildren().length, 0, 'Rejected frame ranges must not add timeline operations')

  const directCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  const directRig = createCameraRig({ camera: directCamera, position: [8, 3, 8], target: [0, 1, 0] })
  const directShot = createShot({ gsap, frameStart: 1, frameEnd: 120 })
  directShot.to(directRig.position, { x: 3, y: 2, z: 5 }, {
    from: { x: 8, y: 3, z: 8 }, startFrame: 1, endFrame: 60, ease: 'none',
  })
  directShot.to(directRig.targetPosition, { x: 1.2, y: 0.8, z: 0 }, {
    from: { x: 0, y: 1, z: 0 }, startFrame: 30, endFrame: 80, ease: 'none',
  })
  directShot.to(directRig, { roll: 0.08 }, {
    from: { roll: 0 }, startFrame: 70, endFrame: 100, ease: 'none',
  })

  for (const frame of [1, 40, 60, 80, 100, 120]) {
    directShot.seek(frame)
    directRig.update()
    assert.equal(directRig.mode, 'direct')
    assertCameraLooksAt(directCamera, directRig.getTargetPosition(), `Frame ${frame} must preserve direct target attention`)
  }

  directShot.seek(40)
  directRig.update()
  const directFrame40 = directRig.getState()
  directShot.seek(1)
  directRig.update()
  directShot.seek(40)
  directRig.update()
  assert.deepEqual(directRig.getState(), directFrame40, 'Independent position and target paths must replay exactly')

  directShot.seek(100)
  directRig.update()
  const directHold = directRig.getState()
  directShot.seek(120)
  directRig.update()
  assert.deepEqual(directRig.getState(), directHold, 'Direct camera and target must hold after their last tweens')

  const helperRig = createCameraRig({ camera: new THREE.PerspectiveCamera(), position: [6, 2, 8], target: [0, 1, 0] })
  const helperShot = createShot({ gsap, frameStart: 1, frameEnd: 60 })
  helperShot.to(helperRig.position, { x: 5 }, {
    from: { x: 6 }, startFrame: 1, endFrame: 30, ease: 'none',
  })
  assert.throws(
    () => helperShot.orbit(helperRig, { from: 0, to: 0.5, startFrame: 31, endFrame: 60, ease: 'none' }),
    /shot\.orbit\(\) requires a Camera Rig already in orbit mode/,
    'Orbit helpers must reject an implicit Direct-to-Orbit mode change',
  )
  assert.throws(
    () => helperShot.dolly(helperRig, { from: 10, to: 7, startFrame: 31, endFrame: 60, ease: 'none' }),
    /shot\.dolly\(\) requires a Camera Rig already in orbit mode/,
    'Dolly helpers must reject an implicit Direct-to-Orbit mode change',
  )
  assert.equal(helperRig.mode, 'direct', 'Rejected orbit helpers must not mutate the rig mode')
  helperShot.seek(20)
  helperRig.update()
  const directHelperFrame20 = helperRig.getState()
  helperShot.seek(1)
  helperShot.seek(20)
  helperRig.update()
  assert.deepEqual(helperRig.getState(), directHelperFrame20, 'Rejected mode mixing must leave direct seeking repeatable')

  helperShot.clear()
  helperRig.useOrbit()
  helperShot.orbit(helperRig, { from: 0, to: 0.5, startFrame: 1, endFrame: 60, ease: 'none' })
  helperShot.dolly(helperRig, { from: 10, to: 7, startFrame: 1, endFrame: 60, ease: 'none' })
  assert.equal(helperRig.mode, 'orbit', 'Orbit helpers must preserve an explicitly selected orbit mode')
  helperShot.seek(60)
  helperRig.update()
  close(helperRig.state.orbitAngle, 0.5, 'Shot orbit helper compatibility')
  close(helperRig.state.distance, 7, 'Shot dolly helper compatibility')

  const product = new THREE.Object3D()
  product.position.set(-2, 1, 0)
  const trackedCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  const trackedRig = createCameraRig({ camera: trackedCamera, position: [8, 3, 7], target: product })
  const trackedShot = createShot({ gsap, frameStart: 1, frameEnd: 60 })
  trackedShot.move(product, { from: [-2, 1, 0], to: [2, 1, 0], startFrame: 1, endFrame: 60, ease: 'none' })
  trackedShot.to(trackedRig.position, { x: 5, y: 2.5, z: 5 }, {
    from: { x: 8, y: 3, z: 7 }, startFrame: 1, endFrame: 60, ease: 'none',
  })
  trackedShot.to(trackedRig.targetOffset, { x: 0, y: 0.3, z: 0 }, {
    from: { x: 0, y: 0, z: 0 }, startFrame: 30, endFrame: 60, ease: 'none',
  })

  for (const frame of [1, 30, 45, 60]) {
    trackedShot.seek(frame)
    trackedRig.update()
    assertCameraLooksAt(trackedCamera, trackedRig.getTargetPosition(), `Frame ${frame} must track the moving product`)
  }
  trackedShot.seek(60)
  trackedRig.update()
  assert.deepEqual(trackedRig.getTargetPosition().toArray(), [2, 1.3, 0], 'Animated offset must combine with Object3D tracking')

  const object = new THREE.Object3D()
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
  const rig = createCameraRig({ camera, distance: 10, height: 2 })
  const shot = createShot({ gsap, frameStart: 1, frameEnd: 120 })
  shot.move(object, { from: [0, 0, 0], to: [4, 2, -1], startFrame: 1, endFrame: 96, ease: 'none' })
  shot.rotate(object, { from: [0, 0, 0], to: [0, Math.PI, 0], startFrame: 1, endFrame: 96, ease: 'none' })
  shot.orbit(rig, { from: 0, to: Math.PI / 2, startFrame: 1, endFrame: 96, ease: 'none' })
  shot.dolly(rig, { from: 10, to: 6, startFrame: 1, endFrame: 96, ease: 'none' })

  for (const frame of [1, 31, 61, 90, 120]) {
    shot.seek(frame)
    rig.update()
    assert.ok(snapshotCamera(camera).every(Number.isFinite), `Frame ${frame} camera state must be finite`)
  }

  shot.seek(61)
  rig.update()
  const first = { position: object.position.toArray(), camera: snapshotCamera(camera) }
  shot.seek(1)
  shot.seek(61)
  rig.update()
  assert.deepEqual({ position: object.position.toArray(), camera: snapshotCamera(camera) }, first, 'Shot seek must be repeatable')

  shot.seek(96)
  rig.update()
  const holdStart = { position: object.position.toArray(), camera: snapshotCamera(camera) }
  shot.seek(120)
  rig.update()
  assert.deepEqual({ position: object.position.toArray(), camera: snapshotCamera(camera) }, holdStart, 'Frames after the last tween must hold')

  const chainedObject = new THREE.Object3D()
  const chainedRig = createCameraRig({ camera: new THREE.PerspectiveCamera(), orbitAngle: 0, distance: 10 })
  const chainedShot = createShot({ gsap, frameStart: 1, frameEnd: 60, defaultEase: 'none' })
  chainedShot.move(chainedObject, { to: [2, 0, 0], startFrame: 1, endFrame: 30 })
  chainedShot.rotate(chainedObject, { to: [0, 1, 0], startFrame: 1, endFrame: 30 })
  chainedShot.orbit(chainedRig, { to: 1, startFrame: 1, endFrame: 30 })
  chainedShot.dolly(chainedRig, { to: 8, startFrame: 1, endFrame: 30 })
  chainedShot.move(chainedObject, { to: [5, 0, 0], startFrame: 31, endFrame: 60 })
  chainedShot.rotate(chainedObject, { to: [0, 2, 0], startFrame: 31, endFrame: 60 })
  chainedShot.orbit(chainedRig, { to: 2, startFrame: 31, endFrame: 60 })
  chainedShot.dolly(chainedRig, { to: 6, startFrame: 31, endFrame: 60 })

  chainedShot.seek(60)
  close(chainedObject.position.x, 5, 'Chained move final value')
  close(chainedObject.rotation.y, 2, 'Chained rotate final value')
  close(chainedRig.state.orbitAngle, 2, 'Chained orbit final value')
  close(chainedRig.state.distance, 6, 'Chained dolly final value')
  chainedShot.seek(31)
  close(chainedObject.position.x, 2, 'Chained move must inherit the previous segment')
  close(chainedObject.rotation.y, 1, 'Chained rotate must inherit the previous segment')
  close(chainedRig.state.orbitAngle, 1, 'Chained orbit must inherit the previous segment')
  close(chainedRig.state.distance, 8, 'Chained dolly must inherit the previous segment')
  const chainedBoundary = {
    position: chainedObject.position.toArray(),
    rotationY: chainedObject.rotation.y,
    orbitAngle: chainedRig.state.orbitAngle,
    distance: chainedRig.state.distance,
  }
  chainedShot.seek(1)
  chainedShot.seek(31)
  assert.deepEqual({
    position: chainedObject.position.toArray(),
    rotationY: chainedObject.rotation.y,
    orbitAngle: chainedRig.state.orbitAngle,
    distance: chainedRig.state.distance,
  }, chainedBoundary, 'Chained segment boundary must be repeatable')
}

async function testModels() {
  const normalUrl = createTriangleGlb([[0, 0, 0], [2, 0, 0], [0, 1, 1]])
  const normal = await loadPrevisModel(normalUrl, { normalize: true, targetSize: 2 })
  close(Math.max(...normal.size.toArray()), 2, 'Normal GLB target size')
  close(normal.modelRoot.scale.x, normal.modelRoot.scale.y, 'Uniform scale x/y')
  close(normal.modelRoot.scale.y, normal.modelRoot.scale.z, 'Uniform scale y/z')

  assert.equal(normal.scene.children[0].material?.name, 'JimengWhiteModel')
  assert.equal(restoreOriginalMaterials(normal.scene), 1, 'Loaded model materials must remain restorable')

  const offsetUrl = createTriangleGlb([[10, 2, -3], [14, 2, -3], [10, 6, 1]])
  const preserved = await loadPrevisModel(offsetUrl, { normalize: true, targetSize: 4, ground: true })
  close(Math.max(...preserved.size.toArray()), 4, 'Offset GLB target size')
  close(preserved.bounds.min.y, 0, 'Ground contact')
  assert.ok(Math.abs(preserved.bounds.getCenter(new THREE.Vector3()).x) > 1, 'Centering must remain optional')
  assert.deepEqual(preserved.scene.position.toArray(), [0, 0, 0], 'Authored glTF scene pivot must not be mutated')

  const centered = await loadPrevisModel(offsetUrl, { normalize: true, targetSize: 2, center: 'xz', ground: true })
  const centeredPoint = centered.bounds.getCenter(new THREE.Vector3())
  close(centeredPoint.x, 0, 'Optional center x')
  close(centeredPoint.z, 0, 'Optional center z')
  close(centered.bounds.min.y, 0, 'Centered model ground contact')

  let invalidCenterLoaded = false
  await assert.rejects(
    loadPrevisModel('invalid-center.glb', {
      center: 'xyz',
      loader: { loadAsync: async () => { invalidCenterLoaded = true; return { scene: new THREE.Scene() } } },
    }),
    /center must be false, true, or 'xz'/,
    'Invalid center modes must fail fast',
  )
  assert.equal(invalidCenterLoaded, false, 'Invalid center modes must fail before loading')

  await assert.rejects(
    loadPrevisModel('empty.glb', { loader: { loadAsync: async () => ({ scene: new THREE.Scene() }) } }),
    /bounds are empty|non-zero size/,
    'Empty GLB bounds must fail validation',
  )
}

async function testStageAndPrimitives() {
  const scene = new THREE.Scene()
  const renderer = { shadowMap: { enabled: false } }
  const stage = createPrevisStage({ scene, renderer })
  assert.equal(stage.root.parent, scene)
  assert.equal(renderer.shadowMap.enabled, true, 'Stage must enable an explicitly supplied renderer shadow map')
  assert.ok(stage.ground?.receiveShadow)
  assert.ok(stage.keyLight?.castShadow)

  const box = createBox({ parent: stage.root, size: [2, 1, 3] })
  const product = createProductBlock({ parent: stage.root })
  const capsule = createCapsule({ parent: stage.root })
  assert.ok(box.isMesh && product.isMesh && capsule.isMesh)
  assert.ok(getPrevisBounds(stage.root).getSize(new THREE.Vector3()).length() > 0)
  stage.dispose()
  assert.equal(stage.root.parent, null)

  const shadowlessRenderer = { shadowMap: { enabled: false } }
  const shadowlessStage = createPrevisStage({ scene: new THREE.Scene(), renderer: shadowlessRenderer, shadows: false })
  assert.equal(shadowlessRenderer.shadowMap.enabled, false, 'A shadowless stage must not mutate renderer shadow state')
  shadowlessStage.dispose()
}

function testMarkerColorsAndCapturePolicy() {
  assert.throws(
    () => createJimengMarkerMaterial(),
    /Marker color is required and must be explicitly assigned from the user request or clear reference evidence/,
    'Objects must remain white when no marker color has explicit or reference-backed intent',
  )

  const customMarker = createJimengMarkerMaterial({ color: '#b34f5e' })
  assert.equal(customMarker.roughness, 0.5)
  assert.equal(customMarker.metalness, 0)
  assert.equal(customMarker.opacity, 1)
  assert.equal(customMarker.transparent, false)
  assert.equal(customMarker.emissive.getHex(), 0x000000)
  assert.equal(customMarker.emissiveIntensity, 0)
  assert.equal(customMarker.userData.jimengDisplayRole, 'marker-color')
  for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'envMap']) {
    assert.equal(customMarker[slot], null, `Marker material ${slot} must remain empty`)
  }

  assert.equal(customMarker.color.getHex(), 0xb34f5e, 'User marker color must remain exact')
  assert.throws(
    () => createJimengMarkerMaterial({ color: 'red' }),
    /Marker color must be/,
    'Marker colors must use an unambiguous basic color value',
  )

  const original = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const root = new THREE.Group()
  const markedMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), original)
  root.add(markedMesh)
  const applied = applyJimengMarkerColor(root, { color: '#b34f5e' })
  assert.equal(applied.meshCount, 1)
  assert.equal(markedMesh.material.color.getHex(), 0xb34f5e)
  assert.equal(restoreOriginalMaterials(root), 1)
  assert.equal(markedMesh.material, original, 'Marker preview must preserve original materials for restoration')

  const markerConfig = { materialPreview: { enabled: true } }
  const whiteConfig = { materialPreview: { enabled: false } }
  assert.equal(getPreviewMode(markerConfig), 'marker-colors')
  assert.equal(getPreviewMode(whiteConfig), 'white-model')
  assert.doesNotThrow(() => assertFrameMaterials(markerConfig, {
    allMeshesUseMarkerMaterials: true,
    allMeshesUseWhiteMaterial: false,
  }, 1), 'Declared marker colors must pass the focused capture assertion')
  assert.throws(() => assertFrameMaterials(whiteConfig, {
    allMeshesUseMarkerMaterials: true,
    allMeshesUseWhiteMaterial: false,
  }, 1), /outside the Jimeng white-model profile/, 'Undeclared colors must still fail white-model capture')
  assert.throws(() => assertFrameMaterials(markerConfig, {
    allMeshesUseMarkerMaterials: false,
    allMeshesUseWhiteMaterial: false,
  }, 1), /outside the Jimeng marker-color profile/, 'Marker mode must reject real material effects')

  const stableDiagnostics = {
    frame: 1,
    camera: [0, 2, 6],
    canvas: { width: 1280, height: 720 },
    replay: { frame: 1, camera: [0, 2, 6], canvas: { width: 1280, height: 720 } },
  }
  assert.doesNotThrow(() => assertCaptureDiagnostics(stableDiagnostics, 1, { width: 1280, height: 720 }))
  assert.throws(
    () => assertCaptureDiagnostics({ ...stableDiagnostics, replay: { ...stableDiagnostics.replay, camera: [0, 2, 5] } }, 1, { width: 1280, height: 720 }),
    /camera state changed/,
    'Capture must reject non-repeatable camera state',
  )
  assert.throws(
    () => assertCaptureDiagnostics({ ...stableDiagnostics, canvas: { width: 640, height: 360 } }, 1, { width: 1280, height: 720 }),
    /canvas must be 1280x720/,
    'Capture must reject the wrong rendered dimensions',
  )
}

await testCameraRig()
await testShot()
await testModels()
await testStageAndPrimitives()
testMarkerColorsAndCapturePolicy()
gsap?.ticker.sleep()
console.log(`PASS: camera, GLB, stage, primitive, marker-color capture policy, deterministic replay, and static hold regressions${gsap ? ', including GSAP Shot' : ''}`)
