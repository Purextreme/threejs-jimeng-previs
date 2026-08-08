function vectorVars(value) {
  if (!Array.isArray(value)) return value
  return { x: value[0], y: value[1], z: value[2] }
}

function requireOrbitRig(rig, helperName) {
  if (rig?.mode !== 'orbit' || !rig?.state) {
    throw new Error(`${helperName} requires a Camera Rig already in orbit mode; call rig.useOrbit() before building the shot`)
  }
  return rig
}

export function createShot(options = {}) {
  const {
    fps = 24,
    frameStart = 1,
    frameEnd = 120,
    gsap = null,
    timeline = gsap?.timeline({ paused: true }),
    defaultEase = 'power1.inOut',
  } = options

  if (fps !== 24) throw new Error('Jimeng shot helpers require 24 fps')
  if (!Number.isInteger(frameStart) || !Number.isInteger(frameEnd) || frameEnd < frameStart) {
    throw new Error('frameStart and frameEnd must be valid inclusive integers')
  }
  if (!timeline || ['to', 'fromTo', 'set', 'seek', 'clear'].some((method) => typeof timeline[method] !== 'function')) {
    throw new Error('createShot requires { gsap } or an existing GSAP timeline')
  }

  const frameTime = (frame) => (frame - frameStart) / fps

  function add(target, to, settings = {}) {
    if (!target || !to || Object.keys(to).length === 0) throw new Error('Shot operation requires a target and values')
    const startFrame = settings.startFrame ?? frameStart
    const endFrame = settings.endFrame ?? frameEnd
    if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame) || endFrame < startFrame) {
      throw new Error('Shot operation frames must be inclusive integers with endFrame >= startFrame')
    }
    if (startFrame < frameStart || endFrame > frameEnd) {
      throw new Error(`Shot operation frame range ${startFrame}-${endFrame} must stay within Shot range ${frameStart}-${frameEnd}`)
    }

    const startTime = frameTime(startFrame)
    const duration = frameTime(endFrame) - startTime
    if (duration === 0) timeline.set(target, to, startTime)
    else {
      const tween = { ...to, duration, ease: settings.ease ?? defaultEase }
      if (settings.from === undefined) timeline.to(target, tween, startTime)
      else timeline.fromTo(target, settings.from, { ...tween, immediateRender: false }, startTime)
    }
    return api
  }

  const api = {
    fps,
    frameStart,
    frameEnd,
    timeline,
    move(object, settings = {}) {
      return add(object?.position, vectorVars(settings.to), { ...settings, from: vectorVars(settings.from) })
    },
    rotate(object, settings = {}) {
      return add(object?.rotation, vectorVars(settings.to), { ...settings, from: vectorVars(settings.from) })
    },
    orbit(rig, settings = {}) {
      const orbitRig = requireOrbitRig(rig, 'shot.orbit()')
      return add(orbitRig.state, { orbitAngle: settings.to }, {
        ...settings,
        from: settings.from === undefined ? undefined : { orbitAngle: settings.from },
      })
    },
    dolly(rig, settings = {}) {
      const orbitRig = requireOrbitRig(rig, 'shot.dolly()')
      return add(orbitRig.state, { distance: settings.to }, {
        ...settings,
        from: settings.from === undefined ? undefined : { distance: settings.from },
      })
    },
    to(target, to, settings = {}) {
      return add(target, to, settings)
    },
    seek(frame) {
      const resolvedFrame = Math.min(frameEnd, Math.max(frameStart, Math.round(frame)))
      timeline.seek(frameTime(resolvedFrame))
      return resolvedFrame
    },
    clear() { timeline.clear(); return api },
  }

  return api
}
