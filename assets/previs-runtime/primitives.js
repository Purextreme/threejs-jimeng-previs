import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createJimengWhiteMaterial } from './white-model.js'

function vector(value, fallback) {
  if (value == null) return fallback
  if (Array.isArray(value)) return value
  return [value.x, value.y, value.z]
}

function mesh(geometry, options = {}) {
  const material = options.material ?? createJimengWhiteMaterial()
  const result = new THREE.Mesh(geometry, material)
  result.name = options.name ?? ''
  result.position.fromArray(vector(options.position, [0, 0, 0]))
  result.rotation.fromArray([...vector(options.rotation, [0, 0, 0]), options.rotationOrder ?? 'XYZ'])
  result.castShadow = options.castShadow ?? true
  result.receiveShadow = options.receiveShadow ?? true
  if (options.parent) options.parent.add(result)
  return result
}

export function createBox(options = {}) {
  const [width, height, depth] = vector(options.size, [1, 1, 1])
  return mesh(new THREE.BoxGeometry(
    width,
    height,
    depth,
    options.widthSegments ?? 1,
    options.heightSegments ?? 1,
    options.depthSegments ?? 1,
  ), options)
}

export function createRoundedBox(options = {}) {
  const [width, height, depth] = vector(options.size, [1, 1, 1])
  return mesh(new RoundedBoxGeometry(width, height, depth, options.segments ?? 4, options.radius ?? 0.08), options)
}

export function createCylinder(options = {}) {
  const radius = options.radius ?? 0.5
  return mesh(new THREE.CylinderGeometry(
    options.radiusTop ?? radius,
    options.radiusBottom ?? radius,
    options.height ?? 1,
    options.radialSegments ?? 48,
    options.heightSegments ?? 1,
    options.openEnded ?? false,
  ), options)
}

export function createPlane(options = {}) {
  const [width, height] = Array.isArray(options.size) ? options.size : [options.width ?? 1, options.height ?? 1]
  return mesh(new THREE.PlaneGeometry(width, height, options.widthSegments ?? 1, options.heightSegments ?? 1), options)
}

export function createCapsule(options = {}) {
  return mesh(new THREE.CapsuleGeometry(
    options.radius ?? 0.5,
    options.length ?? 1,
    options.capSegments ?? 8,
    options.radialSegments ?? 16,
  ), options)
}

export function createProductBlock(options = {}) {
  return createRoundedBox({ name: 'ProductBlock', size: [2, 1.2, 0.8], radius: 0.12, ...options })
}
