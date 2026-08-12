import * as THREE from 'three'

export const JIMENG_WHITE_MODEL_PROFILE = Object.freeze({
  color: 0xc7c7c7,
  roughness: 0.5,
  metalness: 0,
  opacity: 1,
  transparent: false,
  emissive: 0x000000,
})

const TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
]

export function createJimengWhiteMaterial(overrides = {}) {
  const material = new THREE.MeshStandardMaterial({
    name: 'JimengWhiteModel',
    ...JIMENG_WHITE_MODEL_PROFILE,
    ...overrides,
  })

  for (const slot of TEXTURE_SLOTS) material[slot] = null
  material.emissiveIntensity = 0
  material.userData.jimengDisplayRole = 'white-model'
  return material
}

function normalizeMarkerColor(value) {
  if (value?.isColor) return value.clone()
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 0xffffff) {
    return new THREE.Color(value)
  }
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return new THREE.Color(value)
  throw new Error('Marker color must be a Three.js Color, a 0x000000-0xffffff integer, or a #rrggbb string')
}

export function createJimengMarkerMaterial(options) {
  const colorValue = options?.isColor || typeof options !== 'object'
    ? options
    : options.color
  if (colorValue == null) {
    throw new Error('Marker color is required and must be explicitly assigned from the user request or clear reference evidence')
  }
  const color = normalizeMarkerColor(colorValue)
  const material = createJimengWhiteMaterial({
    name: `JimengMarkerColor:${color.getHexString()}`,
    color,
  })
  material.userData.jimengDisplayRole = 'marker-color'
  return material
}

function applyDisplayMaterial(root, options) {
  const { material, castShadow = true, receiveShadow = true } = options
  if (!root?.isObject3D) throw new Error('Display-material root must be a Three.js Object3D')
  if (!material?.isMeshStandardMaterial) throw new Error('Display material must be a Three.js MeshStandardMaterial')

  let meshCount = 0
  root.traverse((object) => {
    if (!object.isMesh) return
    object.userData.jimengOriginalMaterial ??= object.material
    object.material = material
    object.castShadow = castShadow
    object.receiveShadow = receiveShadow
    meshCount += 1
  })

  return { material, meshCount }
}

export function applyJimengWhiteModel(root, options = {}) {
  const {
    material = createJimengWhiteMaterial(),
    castShadow = true,
    receiveShadow = true,
  } = options

  return applyDisplayMaterial(root, { material, castShadow, receiveShadow })
}

export function applyJimengMarkerColor(root, options = {}) {
  const {
    material = createJimengMarkerMaterial({ color: options.color }),
    castShadow = true,
    receiveShadow = true,
  } = options
  if (material.userData?.jimengDisplayRole !== 'marker-color') {
    throw new Error('applyJimengMarkerColor requires a material created by createJimengMarkerMaterial')
  }
  return applyDisplayMaterial(root, { material, castShadow, receiveShadow })
}

export function restoreOriginalMaterials(root) {
  let restored = 0
  root.traverse((object) => {
    if (!object.isMesh || object.userData.jimengOriginalMaterial == null) return
    object.material = object.userData.jimengOriginalMaterial
    delete object.userData.jimengOriginalMaterial
    restored += 1
  })
  return restored
}
