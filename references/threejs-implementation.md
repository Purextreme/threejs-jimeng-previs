# Three.js implementation patterns

Prefer the bundled previs runtime for new work. Keep the patterns below as the contract behind the runtime and as guidance when adapting an existing project that cannot accept the shared files.

## Project contract

Create `jimeng-previs.config.json` at the project root:

```json
{
  "profile": "jimeng-white-model-v1",
  "runtime": { "version": "1.2.2", "path": "src/jimeng-previs" },
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

## Two-stage scene authoring

Treat a previs as two separately reviewable stages: scene/model construction, then camera/object animation.

### Model-source gate

Start modeling only when at least one of these is available:

- reference images or video that show the required object or scene;
- a GLB/glTF or another asset supported by the project's loaders;
- a sufficiently explicit text brief for an ordinary, visually unambiguous object.

Do not infer a product-specific or unfamiliar design from its name alone. Ask for a usable reference when silhouette, proportions, component layout, attachment, or hidden depth would otherwise be guesswork. When only one view is available, state which unseen features are approximate.

Before building, record a lightweight model contract in project notes or code comments: component list, relative proportions or supplied dimensions, intended pose, contact/support relationships, local origin, up/front convention, and any independently moving components with their pivot locations. Keep the contract proportional and structural; white-model previs does not need a material, texture, or micro-detail inventory.

Build in two passes when the subject is more than a trivial primitive assembly:

1. Block out the dominant masses and silhouette with simple primitives or the supplied asset.
2. Add only the structural features needed for recognition, attachment, occlusion, or animation.

Render the blockout from the intended final camera and, when depth or attachment is unclear, one diagnostic three-quarter or orthographic view. Compare those captures to the reference and fix silhouette, scale, spacing, attachment, and ground contact before animation work begins.

### Animation-ready hierarchy

Place approved geometry below a stable model root and animate a separate shot-motion root. Add named child groups only where components actually move independently, and place their pivots deliberately. This keeps shot translation, rotation, and scale from corrupting model-local proportions or component offsets. Apply only the axes and degrees of freedom required by the current brief; do not turn a shot-specific constraint into a reusable default.

For imported assets, finish loading and normalization before enabling playback or capture. Prefer `GLTFLoader.loadAsync()` or an explicit `LoadingManager`, surface loader errors, and expose a ready promise/state that capture must await. Compute bounds with `Box3` after world matrices are current; reject empty or non-finite bounds, preserve aspect ratio with uniform scaling, and avoid automatic recentering when it would invalidate authored pivots, skinning, animation, or scene placement. Fit the review camera after the final bounds are known, not continuously during authored animation.

If a supplied glTF/GLB fails to load or has suspect structure, use the official Khronos glTF Validator when available. `gltf-transform inspect` is an optional diagnostic for scene contents, bounds, draw calls, and asset weight; do not add it as a required dependency or optimize/rewrite a user asset without a demonstrated need.

## Install the reusable runtime

Run:

`node <skill-dir>/scripts/install-runtime.mjs <project-dir> --install`

This copies versioned source into `src/jimeng-previs`, capture/export tools into `scripts/jimeng-previs`, and registers `capture:jimeng` and `export:jimeng` package scripts. It does not create a complete Vite project or replace scene code.

See [runtime-api.md](runtime-api.md) for the integration surface.

Prefer helpers for stable repeated patterns, not as a mandatory scene framework. Keep unusual camera math, object choreography, hierarchy, and art direction project-local. Every path, helper-based or native, must preserve the deterministic `onFrame({ frame, time })` contract and asset-readiness gate.

## Shared white material

Use `createJimengWhiteMaterial` and `applyJimengWhiteModel` for project-created meshes, and `loadPrevisModel` for GLB/glTF assets. Reapply the profile when meshes are added dynamically. If skinned or vertex-animated content fails with a shared material in the installed Three.js version, clone the same numeric profile only for the affected mesh and retain its required flags.

## Neutral studio rig

Prefer `createPrevisStage({ scene, renderer })` or `createStudioLighting({ parent })`. Passing the renderer lets the Stage enable its shadow map; omit it when the project owns renderer state. Use the explicit equivalent below only when a project needs a materially different rig:

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

`0x303238` is a neutral charcoal readability default, not a source-backed Jimeng requirement. The inspected uploader does not set the Blender background. Override it when needed for clear silhouette separation. Tune intensities for readable form, but keep all lights neutral and avoid a dramatic final-render look.

## Deterministic GSAP camera

Prefer independently authored Camera Position + Target Position + optional Roll for ordinary camera blocking. Use Orbit, Dolly, Truck, and Crane when those controls naturally describe the shot; they feed the same position-and-target pipeline. Direct GSAP and native math remain supported:

```js
const rig = createCameraRig({ camera, position: [8, 3, 8], target: [0, 1, 0] })
const shot = createShot({ gsap, frameStart: 1, frameEnd: 120 })
shot.to(rig.position, { x: 3, y: 2, z: 5 }, {
  from: { x: 8, y: 3, z: 8 },
  startFrame: 1,
  endFrame: 60,
})
shot.to(rig.targetPosition, { x: 1.2, y: 0.8, z: 0 }, {
  from: { x: 0, y: 1, z: 0 },
  startFrame: 30,
  endFrame: 80,
})

function updateShot({ frame }) {
  shot.seek(frame)
  rig.update()
}
```

Pass `updateShot` as `createJimengPrevis({ onFrame: updateShot })`. For an `Object3D` target, animate `rig.targetOffset` to move attention relative to the tracked object. `targetOffset` is world-space and does not rotate with the target. For a locally attached attention point, prefer a child `Object3D`/Target Marker or a target function that returns a world-space point; do not add a `localTargetOffset` API. Prefer target-based orientation over authored Euler rotation when visual attention must be maintained or transitioned. Do not call `shot.play()` for deterministic capture; seek the same timeline from each requested frame. Use direct `camera.rotation`, quaternion, matrix, or custom camera math whenever the Rig would distort the requested shot.

Keep every Shot operation's inclusive `startFrame`-`endFrame` range inside its parent Shot's `frameStart`-`frameEnd` range. Treat an out-of-range operation as an authoring error and fail before adding it to the timeline.

Choose one position-authoring mode per Camera Rig for a continuous Shot. Direct Position and orbit state are both valid, but their mode is selected before timeline construction rather than animated as hidden Shot state. Orbit/dolly Shot helpers require an already-orbit Rig. Use direct Position + Target or project-local deterministic math when one requested shot does not fit a single helper mode. Reject camera paths that place Camera Position at, or within `1e-6` scene units of, the resolved Target because `lookAt()` is degenerate there.

Mount a Rig-controlled camera directly under the Scene. If it must be nested, every ancestor must contribute an identity transform so the camera's parent world transform remains identity: zero translation and rotation, unit scale. The Rig resolves Targets and orbit positions in world space but writes the result to parent-local `camera.position`; it intentionally does not add hierarchy conversion. Uniform parent scale is therefore unsupported because it changes the authored position and orbit distance. For a transformed Camera Group, use native Three.js or project-local deterministic math with an explicit world-to-local conversion.

## Visual evidence

Use `npm run capture:jimeng` to create the minimum five animation samples plus configured critical frames. Open the PNG files and judge them visually; do not treat the JSON manifest as visual proof. Add `validation.criticalFrames` to the config for cuts, fastest moves, closest camera approaches, or poses with a high occlusion risk.

Uniform samples can miss short timing events. Add critical frames around first visibility and settling, plus both ends of any required static hold. When the opening must be empty, inspect frame 1. When the ending must be frozen, render the first and last hold frames and compare their authored scene state; matching PNG hashes are useful supporting evidence when the renderer is deterministic, but do not replace visual inspection.

## H.264 conversion

Run `npm run export:jimeng` for the bundled deterministic frame-sequence path. Its FFmpeg invocation is equivalent to:

```powershell
ffmpeg -framerate 24 -start_number 1 -i frame_%04d.png -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv,format=yuv420p" -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -color_range tv -tag:v avc1 -movflags +faststart preview.mp4
```

Validate the result with `scripts/validate-video.ps1`.
