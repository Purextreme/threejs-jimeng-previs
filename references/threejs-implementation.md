# Three.js implementation patterns

## Project contract

Create `jimeng-previs.config.json` at the project root:

```json
{
  "profile": "jimeng-white-model-v1",
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
    "maxBytes": 209715200
  },
  "sourceFiles": ["src/main.js"]
}
```

`frameStart` and `frameEnd` are inclusive. A 1-120 range contains 120 frames.

## Shared white material

```js
import * as THREE from 'three'

export const jimengWhiteMaterial = new THREE.MeshStandardMaterial({
  name: 'JimengWhiteModel',
  color: 0xc7c7c7,
  roughness: 0.5,
  metalness: 0,
  opacity: 1,
  transparent: false,
  emissive: 0x000000,
  emissiveIntensity: 0,
})

export function applyJimengWhiteModel(root) {
  root.traverse((object) => {
    if (!object.isMesh) return
    object.userData.jimengOriginalMaterial ??= object.material
    object.material = jimengWhiteMaterial
  })
}
```

Call `applyJimengWhiteModel(gltf.scene)` inside every successful GLTF load callback. Reapply it when meshes are added dynamically. If skinned or vertex-animated content fails with a shared material in the installed Three.js version, clone the same numeric profile only for the affected mesh and retain its required flags.

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

export function renderFrame(frame) {
  controls.enabled = false
  shot.time((frame - frameStart) / FPS, false)
  camera.lookAt(target)
  renderer.render(scene, camera)
}
```

Do not call `shot.play()` for deterministic capture. Seek the same timeline from each requested frame.

## H.264 conversion

For a PNG sequence named `frame_0001.png`, use an equivalent ffmpeg command:

```powershell
ffmpeg -framerate 24 -start_number 1 -i frame_%04d.png -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -color_range tv -tag:v avc1 -movflags +faststart preview.mp4
```

Validate the result with `scripts/validate-video.ps1`.
