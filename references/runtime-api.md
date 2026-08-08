# Reusable previs runtime API

## Install

From any Vite Three.js project, run:

```powershell
node <skill-dir>\scripts\install-runtime.mjs <project-dir> --install
```

Use `--force` only after inspecting existing files under `src/jimeng-previs` and `scripts/jimeng-previs`. The installer owns those copied files; keep scene-specific code outside them.

## Connect a scene

```js
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import {
  applyJimengWhiteModel,
  createJimengPrevis,
  createJimengWhiteMaterial,
} from './jimeng-previs/index.js'

const canvas = document.querySelector('#scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 100)
const controls = new OrbitControls(camera, canvas)
const whiteMaterial = createJimengWhiteMaterial()

// Build or load scene content, then apply the shared material.
applyJimengWhiteModel(scene, { material: whiteMaterial })

const state = { cameraAngle: -0.6 }
const shot = gsap.timeline({ paused: true })
shot.to(state, { cameraAngle: 0.8, duration: 119 / 24, ease: 'power1.inOut' })

createJimengPrevis({
  renderer,
  scene,
  camera,
  canvas,
  controls,
  frameStart: 1,
  frameEnd: 120,
  fps: 24,
  resolution: { width: 1280, height: 720 },
  onFrame({ time }) {
    shot.time(time, false)
    camera.position.set(Math.sin(state.cameraAngle) * 10, 4, Math.cos(state.cameraAngle) * 10)
    camera.lookAt(0, 1.5, 0)
  },
})
```

The runtime publishes `window.__JIMENG_PREVIS__` for capture automation:

- `renderFrame(frame, { capture })`: seek and render an inclusive integer frame.
- `play()` and `pause()`: control interactive playback.
- `setInspection(enabled)`: toggle `OrbitControls` without changing the authored capture path.
- `snapshot()`: download the current canvas as PNG.
- `getState()`: return frame, camera, canvas, and white-material diagnostics.
- `ready`, `readyError`, and `whenReady`: expose the optional asynchronous asset-readiness gate.

Pass one promise or an array of promises as `ready`. The runtime publishes its API immediately but does not render, play, or allow capture until all promises resolve:

```js
const modelPromise = loadPrevisModel('./product.glb', { parent: scene })

createJimengPrevis({
  renderer,
  scene,
  camera,
  canvas,
  ready: modelPromise,
  onFrame({ frame, time }) {
    // Native Three.js remains valid here.
  },
})
```

## Reuse-first helpers

These modules are optional conveniences around repeated previs work. They expose their underlying Three.js objects and do not replace native APIs. The runtime maintains one current API; do not add adapters for superseded helpers.

### Camera rig

```js
const rig = createCameraRig({
  camera,
  position: [8, 3, 6],
  target: [0, 1, 0],
  roll: 0,
})

rig.position.set(6, 2.5, 5)
rig.targetPosition.set(0.8, 1.2, 0)
rig.update()
```

Prefer Position + Target + optional Roll for ordinary authored camera motion. `rig.position`, `rig.targetPosition`, and `rig.targetOffset` are public `Vector3` instances; `rig.roll` is a public numeric property. `update()` copies the authored position to the camera, resolves the target, calls `camera.lookAt()`, then applies Roll. `rig.camera` always exposes the original camera, and direct rotation, quaternion, matrix, or custom camera math remain valid escape hatches.

Passing an authored `position` selects `direct` mode. A rig created without `position` starts in `orbit` mode to support orbit-style initialization. Check `rig.mode`, switch explicitly with `useDirectPosition()` or `useOrbit()`, and use `setPosition()` when setting a new direct position. Orbit setters select orbit mode. Shot orbit/dolly helpers require the Rig to be in orbit mode already and fail without changing it; call `useOrbit()` before building an orbit-authored Shot.

Use one position-authoring mode per Camera Rig within a continuous Shot. For an ordinary complex path, animate Position + Target in direct mode. If a requested shot genuinely needs mixed or unusual math, use native Three.js or a project-local deterministic timeline instead of hiding mode changes inside helpers. `update()` fails fast when Camera Position and the resolved Target are coincident or less than `1e-6` scene units apart because `lookAt()` has no stable direction there.

Use an `Object3D` target to follow a moving product. Its world position is resolved every frame; animate `targetOffset` when the point of attention must move relative to that object:

```js
const rig = createCameraRig({
  camera,
  position: [8, 3, 6],
  target: product.motionRoot,
  targetOffset: [0, 0.3, 0],
})
```

`targetOffset` is always a world-space offset. It is added after resolving the Target's world position and does not rotate with a tracked `Object3D`. For an attention point that must follow local rotation, target a child `Object3D`/Target Marker or pass a target function that returns the desired world-space point. Do not add a `localTargetOffset` API.

Passing a `Vector3`, array, or vector-like value copies it into direct `targetPosition`. Calling `setTarget(Object3D)` selects object tracking; calling `setTarget(Vector3 | Array)` returns to direct target control. `getTargetPosition()` returns the resolved world-space target including offset.

Orbit, Dolly, Crane, and Truck remain convenience controls that calculate `rig.position` before the same Target + LookAt + Roll pipeline:

```js
const rig = createCameraRig({ camera, target: product.motionRoot, distance: 8, height: 2 })
rig.setOrbitAngle(0.5).setDistance(7).setHeight(2.5).update()
```

Use `setOrbitAngle`/`orbit`, `setDistance`/`dolly`, `setHeight`/`crane`, `setTruck`/`truck`, and `setRoll`. `rig.state` remains public for GSAP or custom math.

Mount a Rig-controlled camera directly under the Scene. If it is nested, its entire parent chain must have an identity world transform: zero translation and rotation, unit scale. The Rig resolves Targets and orbit positions in world space, then writes the authored position to parent-local `camera.position`; it does not perform world-to-local conversion. Uniformly scaled parents are not supported because they change the resulting world position and orbit distance. Use native Three.js or project-local deterministic coordinate conversion for a transformed Camera Group.

### Shot

`createShot` is a thin deterministic wrapper around a paused GSAP timeline. Frame ranges are inclusive, so frames 1-120 span `119 / 24` seconds. Every operation's `startFrame` and `endFrame` must stay within the Shot's inclusive `frameStart`-`frameEnd` range; out-of-range operations fail before changing the timeline.

```js
const shot = createShot({ gsap, frameStart: 1, frameEnd: 120 })
shot.move(product.motionRoot, { from: [0, 0, 0], to: [2, 0, 0], endFrame: 96 })
shot.to(rig.position, { x: 3, y: 2, z: 5 }, {
  from: { x: 8, y: 3, z: 8 },
  endFrame: 60,
})
shot.to(rig.targetPosition, { x: 1.2, y: 0.8, z: 0 }, {
  from: { x: 0, y: 1, z: 0 },
  startFrame: 30,
  endFrame: 80,
})

onFrame({ frame }) {
  shot.seek(frame)
  rig.update()
}
```

Pass the project's GSAP instance or an existing paused `timeline`; the runtime does not make GSAP a hidden dependency. Use `move`, `rotate`, `orbit`, and `dolly` for the most repeated operations. Use `shot.to()` for camera position, target position, target offset, Roll, or any other numeric target. Use `shot.timeline` for direct GSAP access, or skip the helper entirely for custom motion.

`shot.orbit()` and `shot.dolly()` never change `rig.mode`. Put the Rig in orbit mode before constructing these tweens. Do not schedule Direct-to-Orbit or Orbit-to-Direct mode changes inside one helper Shot; author the camera position directly or use custom deterministic code when a shot needs that behavior.

Omit `from` to continue from the state produced by an earlier timeline segment. Provide `from` only when the segment must begin from an explicit authored value.

### Stage and primitives

```js
const stage = createPrevisStage({ scene, renderer, ground: true })
const block = createProductBlock({ parent: stage.root, size: [3, 1.8, 1] })
```

`createPrevisStage` supplies a neutral charcoal background (`#303238`, not black), ground, HemisphereLight, key, fill, rim, and basic shadows. Pass `renderer` to let the Stage enable `renderer.shadowMap`; omit it when renderer state is managed elsewhere. The uploader does not mandate a background color, so override `background` whenever another neutral value separates the subject more clearly. Override or disable any other part through its options, add custom lights, or use `createStudioLighting` alone. Primitive helpers are intentionally limited to box, rounded box/product block, cylinder, plane, and capsule.

### Models

```js
const product = await loadPrevisModel('./product.glb', {
  parent: stage.root,
  normalize: true,
  targetSize: 2,
  center: 'xz',
  ground: true,
})
```

The result retains `gltf`, `scene`, `animations`, `motionRoot`, and `modelRoot`, plus validated bounds and uniform scale. Normalization, centering, and grounding move only the wrapper `modelRoot`; the authored glTF scene and its pivots remain intact. Use `center: false` for no centering, `center: 'xz'` for horizontal centering, or `center: true` for all-axis centering; other values fail before loading. These calculations assume the supplied parent and wrapper roots have identity transforms; apply custom parent transforms afterward. Animate `motionRoot` for shot motion. Pass a configured `GLTFLoader` through `options.loader` when needed; for unusual asset logic, load directly and connect its promise through `createJimengPrevis({ ready })`.

## Native escape hatch

Do not add a shared abstraction for one-off camera math. This remains fully supported:

```js
createJimengPrevis({
  renderer,
  scene,
  camera,
  canvas,
  onFrame({ time }) {
    const angle = -0.7 + time * 0.35
    camera.position.set(Math.sin(angle) * 9, 3 + Math.sin(time) * 0.2, Math.cos(angle) * 9)
    camera.lookAt(product.position)
  },
})
```

Custom code must remain repeatable for the same frame and must not bypass readiness, capture, white-model, or export rules.

## UI contract

Keep the transport consistent across projects: first frame, previous frame, play/pause, next frame, timeline scrubber, frame counter, fixed 24 fps badge, inspection mode, PNG snapshot, and deterministic MP4 export guidance. Keep project-specific parameters in a separate lil-gui panel or project UI; do not edit the shared transport for ordinary shot controls.

The MP4 button intentionally directs the user to `npm run export:jimeng`. Browsers cannot reliably produce the required deterministic H.264 MP4. The CLI seeks every authored frame, captures PNGs, and runs FFmpeg.

## Capture and export

Run:

```powershell
npm run capture:jimeng
npm run export:jimeng
npm run test:jimeng-runtime
```

`capture:jimeng` captures at least five evenly spaced frames and every `validation.criticalFrames` entry. `export:jimeng` captures the full inclusive frame range and writes the configured MP4. Pass `-- --force` only when replacing an existing MP4 is intentional.
