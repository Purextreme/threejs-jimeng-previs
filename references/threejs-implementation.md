# Three.js implementation patterns

Prefer the bundled previs runtime for new work. Keep the patterns below as the contract behind the runtime and as guidance when adapting an existing project that cannot accept the shared files.

## Project contract

Create `jimeng-previs.config.json` at the project root:

```json
{
  "profile": "jimeng-white-model-v1",
  "runtime": { "version": "1.0.0", "path": "src/jimeng-previs" },
  "fps": 24,
  "frameStart": 1,
  "frameEnd": 120,
  "resolution": { "width": 1280, "height": 720, "origin": false },
  "whiteModel": {
    "color": "#c7c7c7",
    "roughness": 0.5,
    "metalness": 0,
    "opacity": 1,
    "transparent": false,
    "textures": false,
    "emissive": "#000000"
  },
  "lighting": { "mode": "studio-neutral" },
  "camera": { "name": "PrevisCamera", "controlsDuringCapture": false },
  "output": {
    "container": "mp4",
    "codec": "h264",
    "pixelFormat": "yuv420p",
    "maxBytes": 209715200,
    "path": "outputs/jimeng-previs.mp4"
  },
  "validation": { "minimumAnimationSamples": 5 },
  "sourceFiles": ["src/main.js", "src/jimeng-previs/white-model.js"]
}
```

`frameStart` and `frameEnd` are inclusive. A 1-120 range contains 120 frames.

## Install the reusable runtime

Run:

`node <skill-dir>/scripts/install-runtime.mjs <project-dir> --install`

This copies versioned source into `src/jimeng-previs`, capture/export tools into `scripts/jimeng-previs`, and registers `capture:jimeng` and `export:jimeng` package scripts. It does not create a complete Vite project or replace scene code.

See [runtime-api.md](runtime-api.md) for the integration surface.

## Shared white material

Use `createJimengWhiteMaterial`, `applyJimengWhiteModel`, and `createJimengGLTFLoader` from the installed runtime. Reapply the profile when meshes are added dynamically. If skinned or vertex-animated content fails with a shared material in the installed Three.js version, clone the same numeric profile only for the affected mesh and retain its required flags.

## Neutral studio rig

```js
scene.background = new THREE.Color(0x303238)
scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.5))

const key = new THREE.DirectionalLight(0xffffff, 2.4)
key.position.set(4, 6, 5)
scene.add(key)

const fill = new THREE.DirectionalLight(0xffffff, 0.8)
fill.position.set(-4, 2, -3)
scene.add(fill)
```

Tune intensities for readable form, but keep all lights neutral and avoid a dramatic final-render look.

## Deterministic GSAP camera

```js
const FPS = 24
const shot = gsap.timeline({ paused: true })
shot.to(camera.position, { x: 3, y: 2, z: 5, duration: 2, ease: 'power2.inOut' })

function updateShot({ time }) {
  shot.time(time, false)
  camera.lookAt(target)
}
```

Pass `updateShot` as `createJimengPrevis({ onFrame: updateShot })`. Do not call `shot.play()` for deterministic capture. Seek the same timeline from each requested frame.

## Visual evidence

Use `npm run capture:jimeng` to create the minimum five animation samples plus configured critical frames. Open the PNG files and judge them visually; do not treat the JSON manifest as visual proof. Add `validation.criticalFrames` to the config for cuts, fastest moves, closest camera approaches, or poses with a high occlusion risk.

## H.264 conversion

Run `npm run export:jimeng` for the bundled deterministic frame-sequence path. Its FFmpeg invocation is equivalent to:

```powershell
ffmpeg -framerate 24 -start_number 1 -i frame_%04d.png -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -color_range tv -tag:v avc1 -movflags +faststart preview.mp4
```

Validate the result with `scripts/validate-video.ps1`.
