import * as THREE from 'three'
import { createJimengWhiteMaterial } from './white-model.js'

function addDirectionalLight(root, name, defaults, overrides = {}) {
  if (overrides === false) return null
  const settings = { ...defaults, ...overrides }
  const light = new THREE.DirectionalLight(settings.color, settings.intensity)
  light.name = name
  light.position.fromArray(settings.position)
  light.castShadow = Boolean(settings.castShadow)
  if (settings.shadowMapSize) light.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize)
  if (settings.shadowBounds) {
    Object.assign(light.shadow.camera, settings.shadowBounds)
    light.shadow.camera.updateProjectionMatrix()
  }
  root.add(light)
  return light
}

export function createStudioLighting(options = {}) {
  const {
    parent,
    hemisphere = {},
    key = {},
    fill = {},
    rim = {},
    shadows = true,
  } = options

  if (!parent?.isObject3D) throw new Error('createStudioLighting requires an Object3D parent')
  const root = new THREE.Group()
  root.name = 'JimengStudioLighting'
  parent.add(root)

  let hemisphereLight = null
  if (hemisphere !== false) {
    const settings = { skyColor: 0xffffff, groundColor: 0x404040, intensity: 1.5, ...hemisphere }
    hemisphereLight = new THREE.HemisphereLight(settings.skyColor, settings.groundColor, settings.intensity)
    hemisphereLight.name = 'JimengHemisphereLight'
    root.add(hemisphereLight)
  }

  const keyLight = addDirectionalLight(root, 'JimengKeyLight', {
    color: 0xffffff,
    intensity: 2.4,
    position: [4, 6, 5],
    castShadow: shadows,
    shadowMapSize: 2048,
    shadowBounds: { near: 0.1, far: 40, left: -10, right: 10, top: 10, bottom: -10 },
  }, key)
  const fillLight = addDirectionalLight(root, 'JimengFillLight', {
    color: 0xffffff,
    intensity: 0.8,
    position: [-4, 3, -3],
    castShadow: false,
  }, fill)
  const rimLight = addDirectionalLight(root, 'JimengRimLight', {
    color: 0xffffff,
    intensity: 0.9,
    position: [0, 5, -6],
    castShadow: false,
  }, rim)

  return { root, hemisphereLight, keyLight, fillLight, rimLight }
}

export function createPrevisStage(options = {}) {
  const {
    scene,
    background = 0x303238,
    ground = true,
    groundSize = 24,
    groundY = 0,
    groundMaterial = null,
    shadows = true,
    lighting = {},
  } = options

  if (!scene?.isScene) throw new Error('createPrevisStage requires a Three.js Scene')
  const previousBackground = scene.background
  const stageBackground = background === false ? null : background?.isColor ? background : new THREE.Color(background)
  if (stageBackground) scene.background = stageBackground

  const root = new THREE.Group()
  root.name = 'JimengPrevisStage'
  scene.add(root)

  let groundMesh = null
  let ownsGroundMaterial = false
  if (ground) {
    const geometry = new THREE.PlaneGeometry(groundSize, groundSize)
    const material = groundMaterial ?? createJimengWhiteMaterial()
    ownsGroundMaterial = groundMaterial == null
    groundMesh = new THREE.Mesh(geometry, material)
    groundMesh.name = 'JimengGround'
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.position.y = groundY
    groundMesh.receiveShadow = shadows
    root.add(groundMesh)
  }

  const lights = createStudioLighting({ parent: root, shadows, ...lighting })

  return {
    ...lights,
    root,
    lightingRoot: lights.root,
    ground: groundMesh,
    dispose() {
      root.removeFromParent()
      groundMesh?.geometry.dispose()
      if (ownsGroundMaterial) groundMesh?.material.dispose()
      if (scene.background === stageBackground) scene.background = previousBackground
    },
  }
}
