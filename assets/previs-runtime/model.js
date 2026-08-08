import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { applyJimengWhiteModel, createJimengWhiteMaterial } from './white-model.js'

function finiteVector(vector) {
  return [vector.x, vector.y, vector.z].every(Number.isFinite)
}

export function getPrevisBounds(root) {
  if (!root?.isObject3D) throw new Error('Bounds root must be a Three.js Object3D')
  root.updateWorldMatrix(true, true)
  const bounds = new THREE.Box3().setFromObject(root)
  if (bounds.isEmpty() || !finiteVector(bounds.min) || !finiteVector(bounds.max)) {
    throw new Error('Model bounds are empty or contain non-finite values')
  }
  const size = bounds.getSize(new THREE.Vector3())
  if (!finiteVector(size) || Math.max(size.x, size.y, size.z) <= 0) {
    throw new Error('Model bounds must have a finite, non-zero size')
  }
  return bounds
}

export async function loadPrevisModel(url, options = {}) {
  const {
    loader = new GLTFLoader(),
    parent = null,
    material = createJimengWhiteMaterial(),
    whiteModel = true,
    castShadow = true,
    receiveShadow = true,
    normalize = false,
    targetSize = 2,
    center = false,
    ground = false,
    groundY = 0,
    onProgress,
    motionRoot = new THREE.Group(),
    modelRoot = new THREE.Group(),
  } = options

  if (parent != null && !parent.isObject3D) throw new Error('parent must be null or a Three.js Object3D')
  if (!loader || typeof loader.loadAsync !== 'function') throw new Error('loader must provide loadAsync(url, onProgress)')
  if (center !== false && center !== true && center !== 'xz') {
    throw new Error("center must be false, true, or 'xz'")
  }
  if (normalize && (!Number.isFinite(targetSize) || targetSize <= 0)) {
    throw new Error('targetSize must be a finite number greater than zero')
  }

  const gltf = await loader.loadAsync(url, onProgress)
  if (!gltf?.scene?.isObject3D) throw new Error('Loaded glTF does not contain a valid scene')

  motionRoot.name ||= 'PrevisMotionRoot'
  modelRoot.name ||= 'PrevisModelRoot'
  motionRoot.add(modelRoot)
  modelRoot.add(gltf.scene)

  if (whiteModel) applyJimengWhiteModel(gltf.scene, { material, castShadow, receiveShadow })

  const originalBounds = getPrevisBounds(modelRoot).clone()
  const originalSize = originalBounds.getSize(new THREE.Vector3())
  const scale = normalize ? targetSize / Math.max(originalSize.x, originalSize.y, originalSize.z) : 1
  modelRoot.scale.setScalar(scale)
  modelRoot.updateMatrixWorld(true)

  let adjustedBounds = getPrevisBounds(modelRoot)
  const offset = new THREE.Vector3()
  if (center) {
    const centerPoint = adjustedBounds.getCenter(new THREE.Vector3())
    offset.x -= centerPoint.x
    offset.z -= centerPoint.z
    if (center === true) offset.y -= centerPoint.y
  }
  modelRoot.position.add(offset)
  modelRoot.updateMatrixWorld(true)

  if (ground) {
    adjustedBounds = getPrevisBounds(modelRoot)
    modelRoot.position.y += groundY - adjustedBounds.min.y
    modelRoot.updateMatrixWorld(true)
  }

  const bounds = getPrevisBounds(modelRoot).clone()
  if (parent) parent.add(motionRoot)

  return {
    gltf,
    scene: gltf.scene,
    animations: gltf.animations ?? [],
    motionRoot,
    modelRoot,
    material: whiteModel ? material : null,
    originalBounds,
    bounds,
    originalSize,
    size: bounds.getSize(new THREE.Vector3()),
    scale,
  }
}
