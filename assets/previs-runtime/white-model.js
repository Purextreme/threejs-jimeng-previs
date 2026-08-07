import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

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
  return material
}

export function applyJimengWhiteModel(root, options = {}) {
  const {
    material = createJimengWhiteMaterial(),
    castShadow = true,
    receiveShadow = true,
  } = options

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

export function createJimengGLTFLoader(options = {}) {
  const {
    loader = new GLTFLoader(),
    parent = null,
    material = createJimengWhiteMaterial(),
    castShadow = true,
    receiveShadow = true,
  } = options

  async function load(url, onProgress) {
    const gltf = await loader.loadAsync(url, onProgress)
    applyJimengWhiteModel(gltf.scene, { material, castShadow, receiveShadow })
    if (parent) parent.add(gltf.scene)
    return gltf
  }

  return { loader, load, material }
}
