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

## UI contract

Keep the transport consistent across projects: first frame, previous frame, play/pause, next frame, timeline scrubber, frame counter, fixed 24 fps badge, inspection mode, PNG snapshot, and deterministic MP4 export guidance. Keep project-specific parameters in a separate lil-gui panel or project UI; do not edit the shared transport for ordinary shot controls.

The MP4 button intentionally directs the user to `npm run export:jimeng`. Browsers cannot reliably produce the required deterministic H.264 MP4. The CLI seeks every authored frame, captures PNGs, and runs FFmpeg.

## GLB loading

Use `createJimengGLTFLoader({ parent, material })`. Its `load(url)` method applies the white profile before attaching the loaded scene to `parent`. Preserve the returned glTF object for animation mixers.

## Capture and export

Run:

```powershell
npm run capture:jimeng
npm run export:jimeng
```

`capture:jimeng` captures at least five evenly spaced frames and every `validation.criticalFrames` entry. `export:jimeng` captures the full inclusive frame range and writes the configured MP4. Pass `-- --force` only when replacing an existing MP4 is intentional.
