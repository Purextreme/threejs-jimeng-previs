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

function isFiniteVector3(value) {
  return value?.isVector3 && [value.x, value.y, value.z].every(Number.isFinite)
}

export function createCameraRig(options = {}) {
  const {
    camera,
    position,
    target = [0, 0, 0],
    targetOffset = [0, 0, 0],
    mode = position === undefined ? 'orbit' : 'direct',
    orbitAngle = 0,
    distance = 10,
    height = 0,
    truck = 0,
    roll = 0,
  } = options

  if (!camera?.isCamera) throw new Error('camera must be a Three.js Camera')
  if (!['direct', 'orbit'].includes(mode)) throw new Error("mode must be 'direct' or 'orbit'")

  let activeMode = mode
  let targetSource = null
  const cameraPosition = new THREE.Vector3()
  const targetPosition = new THREE.Vector3()
  const resolvedTarget = new THREE.Vector3()
  const resolvedOffset = new THREE.Vector3()
  const lookTarget = new THREE.Vector3()
  const state = { orbitAngle, distance, height, truck, roll }

  copyVector3(cameraPosition, position ?? camera.position, 'position')
  copyVector3(resolvedOffset, targetOffset, 'targetOffset')

  function assignTarget(value) {
    if (typeof value === 'function' || value?.isObject3D) targetSource = value
    else {
      copyVector3(targetPosition, value, 'target')
      targetSource = null
    }
  }

  function useOrbit() {
    activeMode = 'orbit'
    return api
  }

  const api = {
    camera,
    position: cameraPosition,
    targetPosition,
    targetOffset: resolvedOffset,
    state,
    get mode() { return activeMode },
    get roll() { return state.roll },
    set roll(value) { state.roll = Number(value) },
    get target() { return targetSource ?? targetPosition },
    setPosition(value) { copyVector3(cameraPosition, value, 'position'); activeMode = 'direct'; return api },
    useDirectPosition(value = camera.position) {
      copyVector3(cameraPosition, value, 'position')
      activeMode = 'direct'
      return api
    },
    useOrbit,
    setTarget(value) { assignTarget(value); return api },
    setTargetOffset(value) { copyVector3(resolvedOffset, value, 'targetOffset'); return api },
    setOrbitAngle(value) { state.orbitAngle = Number(value); return useOrbit() },
    orbit(delta) { state.orbitAngle += Number(delta); return useOrbit() },
    setDistance(value) { state.distance = Number(value); return useOrbit() },
    dolly(delta) { state.distance += Number(delta); return useOrbit() },
    setHeight(value) { state.height = Number(value); return useOrbit() },
    crane(delta) { state.height += Number(delta); return useOrbit() },
    setTruck(value) { state.truck = Number(value); return useOrbit() },
    truck(delta) { state.truck += Number(delta); return useOrbit() },
    setRoll(value) { state.roll = Number(value); return api },
    getTargetPosition(result = new THREE.Vector3()) {
      if (targetSource === null) resolvedTarget.copy(targetPosition)
      else copyVector3(resolvedTarget, targetSource, 'target')
      return result.copy(resolvedTarget).add(resolvedOffset)
    },
    update() {
      if (!Number.isFinite(state.roll)) throw new Error('Camera rig roll must be a finite number')
      if (!isFiniteVector3(cameraPosition) || !isFiniteVector3(targetPosition) || !isFiniteVector3(resolvedOffset)) {
        throw new Error('Camera rig position, targetPosition, and targetOffset must contain finite numbers')
      }

      api.getTargetPosition(lookTarget)
      if (!isFiniteVector3(lookTarget)) throw new Error('Camera rig resolved target must contain finite numbers')

      if (activeMode === 'orbit') {
        if (![state.orbitAngle, state.distance, state.height, state.truck].every(Number.isFinite)) {
          throw new Error('Camera rig orbit state must contain finite numbers')
        }
        if (state.distance <= 0) throw new Error('Camera rig distance must be greater than zero')

        const sine = Math.sin(state.orbitAngle)
        const cosine = Math.cos(state.orbitAngle)
        cameraPosition.set(
          lookTarget.x + sine * state.distance + cosine * state.truck,
          lookTarget.y + state.height,
          lookTarget.z + cosine * state.distance - sine * state.truck,
        )
      }

      camera.position.copy(cameraPosition)
      camera.lookAt(lookTarget)
      if (state.roll !== 0) camera.rotateZ(state.roll)
      camera.updateMatrixWorld()
      return camera
    },
    getState() {
      return {
        ...state,
        mode: activeMode,
        target: api.getTargetPosition(new THREE.Vector3()).toArray(),
        position: cameraPosition.toArray(),
        cameraPosition: camera.position.toArray(),
        quaternion: camera.quaternion.toArray(),
      }
    },
  }

  assignTarget(target)
  return api
}
