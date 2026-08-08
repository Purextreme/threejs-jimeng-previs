import * as THREE from 'three'

function copyVector3(target, value, label) {
  const resolved = typeof value === 'function' ? value() : value
  if (resolved?.isObject3D) return resolved.getWorldPosition(target)
  if (resolved?.isVector3) return target.copy(resolved)
  if (Array.isArray(resolved) && resolved.length >= 3) return target.set(...resolved)
  if (resolved && ['x', 'y', 'z'].every((key) => Number.isFinite(resolved[key]))) {
    return target.set(resolved.x, resolved.y, resolved.z)
  }
  throw new Error(`${label} must be an Object3D, Vector3, [x, y, z], vector-like object, or function`)
}

export function createCameraRig(options = {}) {
  const {
    camera,
    target = [0, 0, 0],
    targetOffset = [0, 0, 0],
    orbitAngle = 0,
    distance = 10,
    height = 0,
    truck = 0,
    roll = 0,
  } = options

  if (!camera?.isCamera) throw new Error('camera must be a Three.js Camera')

  let targetSource = target
  const resolvedTarget = new THREE.Vector3()
  const resolvedOffset = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const state = { orbitAngle, distance, height, truck, roll }

  copyVector3(resolvedOffset, targetOffset, 'targetOffset')

  const api = {
    camera,
    state,
    get target() { return targetSource },
    setTarget(value) { targetSource = value; return api },
    setTargetOffset(value) { copyVector3(resolvedOffset, value, 'targetOffset'); return api },
    setOrbitAngle(value) { state.orbitAngle = Number(value); return api },
    orbit(delta) { state.orbitAngle += Number(delta); return api },
    setDistance(value) { state.distance = Number(value); return api },
    dolly(delta) { state.distance += Number(delta); return api },
    setHeight(value) { state.height = Number(value); return api },
    crane(delta) { state.height += Number(delta); return api },
    setTruck(value) { state.truck = Number(value); return api },
    truck(delta) { state.truck += Number(delta); return api },
    setRoll(value) { state.roll = Number(value); return api },
    getTargetPosition(result = new THREE.Vector3()) {
      copyVector3(resolvedTarget, targetSource, 'target')
      return result.copy(resolvedTarget).add(resolvedOffset)
    },
    update() {
      if (![state.orbitAngle, state.distance, state.height, state.truck, state.roll].every(Number.isFinite)) {
        throw new Error('Camera rig state must contain finite numbers')
      }
      if (state.distance <= 0) throw new Error('Camera rig distance must be greater than zero')

      api.getTargetPosition(lookTarget)
      const sine = Math.sin(state.orbitAngle)
      const cosine = Math.cos(state.orbitAngle)
      camera.position.set(
        lookTarget.x + sine * state.distance + cosine * state.truck,
        lookTarget.y + state.height,
        lookTarget.z + cosine * state.distance - sine * state.truck,
      )
      camera.lookAt(lookTarget)
      if (state.roll !== 0) camera.rotateZ(state.roll)
      camera.updateMatrixWorld()
      return camera
    },
    getState() {
      return {
        ...state,
        target: api.getTargetPosition(new THREE.Vector3()).toArray(),
        position: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
      }
    },
  }

  return api
}
