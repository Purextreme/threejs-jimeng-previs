---
name: threejs-jimeng-previs
description: Build, adapt, and validate Three.js camera-animation previs projects for Jimeng/Dreamina/Seedance using a neutral Blender-Workbench-style white model and Jimeng-compatible video constraints. Use when Codex creates or reviews Three.js storyboards, product-animation blocking, camera moves, GLB-based previs, white-model previews, or H.264 MP4 exports intended as Jimeng video references.
---

# Three.js Jimeng Previs

Create camera-animation previews that communicate silhouette, scale, staging, timing, and camera motion without letting textures or stylized shading distract the video model.

## Establish the contract

1. Inspect the project, current Git status, package scripts, Three.js version, render path, camera ownership, animation clock, GLB loading, and capture/export path before editing.
2. Read [references/jimeng-blender-evidence.md](references/jimeng-blender-evidence.md) when the user asks why a rule exists or when updating the profile from a newer uploader.
3. Read [references/threejs-implementation.md](references/threejs-implementation.md) before implementing or reviewing a project.
4. Read [references/runtime-api.md](references/runtime-api.md) before adding or updating the shared playback UI, frame clock, visual capture, or MP4 export path.
5. Create `jimeng-previs.config.json` at the project root from the bundled example and keep it synchronized with actual behavior.
6. Preserve existing user work. Make only the changes required for the preview profile.

## Work in two approval stages

1. Build and review the scene/model blockout before authoring camera or object animation.
2. Before modeling, require at least one usable source: reference images or video, a GLB/glTF or other asset the current Three.js project can load, or an explicit brief for an unambiguous common object such as a laptop, cup, or mouse.
3. If the subject is unfamiliar, product-specific, branded, or visually ambiguous, ask for a reference instead of inventing its design. A single view may support an approximate blockout, but label unseen depth and hidden sides as inferred.
4. Establish the model contract from the source: main dimensions or proportions, component breakdown, intended pose, ground/contact relationship, local origin, and the pivots or independently moving parts needed later.
5. Capture and visually inspect the neutral blockout from the intended final view and any additional view needed to judge depth or attachment. Resolve model silhouette, scale, and component errors before animation. Do not treat a technically valid render as model approval.
6. Begin the animation stage only after the user accepts the blockout, unless the user explicitly asks to complete both stages in one pass. Keep model-local transforms separate from shot-level motion so animation changes do not damage the approved proportions or pivots.

## Reuse the previs runtime

- Install the bundled runtime instead of rewriting playback, frame stepping, inspection controls, snapshot, white-model override, GLB handling, capture, or MP4 export code:

  `node <skill-dir>/scripts/install-runtime.mjs <project-dir> --install`

- Inspect existing `src/jimeng-previs` files before passing `--force`; do not overwrite user-modified runtime files without reviewing the diff.
- Keep scene-specific geometry, lights, shot state, and GSAP timelines in project code. Connect them through `createJimengPrevis({ onFrame })`.
- Keep the final output frame rate fixed at 24 fps. Treat playback speed as a separate preview-only concern.
- Use the runtime extension boundary for project-specific controls. Do not fork the transport UI for ordinary scene parameters.
- Run `npm run capture:jimeng` for visual-validation frames and `npm run export:jimeng` for a deterministic H.264 MP4.

## Apply the white-model profile

- Override every visible render mesh, including meshes loaded later by `GLTFLoader`, with one shared `MeshStandardMaterial`.
- Set color to `#c7c7c7`, roughness to `0.5`, metalness to `0`, opacity to `1`, transparency to `false`, emissive to black, and all texture/map inputs to `null`.
- Preserve geometry, transforms, hierarchy, skinning, morph targets, visibility, and animation. Use a compatible white material for skinned or morphed meshes when the Three.js version requires flags.
- Keep original materials available for restoration; do not dispose user-owned materials during a temporary override.
- Use neutral studio-style lighting. Avoid colored lights, dramatic HDR environments, bloom, LUTs, fog, depth-of-field, motion blur, and texture-driven backgrounds unless the user explicitly requests a non-white-model variant.
- Use a neutral, uncluttered background with clear silhouette separation. Treat its exact color as an artistic project choice because the inspected Blender uploader does not force one.
- Keep X-ray and wireframe disabled for the final preview.

## Make camera motion deterministic

- Render through one explicit `PerspectiveCamera` unless the requested shot requires orthographic projection.
- Separate inspection controls from the shot camera. Disable `OrbitControls` during playback and capture so controls cannot mutate the authored path.
- Advance animation from frame time at 24 fps. Derive time as `(frame - frameStart) / 24`; do not make captured motion depend on variable browser delta time.
- Keep the subject in frame and avoid unintended near/far clipping throughout the whole range.
- Use GSAP only as an authoring convenience. Seek the timeline from deterministic frame time during capture.

## Meet the Jimeng video envelope

- Use 24 fps.
- Keep the inclusive frame count between 44 and 720 frames.
- Default to 1280 x 720. Also accept 360p, 480p, 1080p, or origin dimensions while preserving aspect ratio and using even dimensions.
- Deliver H.264 in an MP4 container with `yuv420p` pixel format and a file size no greater than 200 MiB.
- Treat a browser `MediaRecorder` WebM as an intermediate only; transcode or use a deterministic frame-sequence pipeline for the final MP4.

## Validate before handoff

1. Run the project's fastest relevant tests and `npm run build`.
2. Run:

   `node <skill-dir>/scripts/validate-project.mjs <project-dir>`

3. Run `npm run capture:jimeng`. For animation, capture at least five evenly distributed frames: first, 25%, 50%, 75%, and last. Add every configured critical frame and the frames immediately before and after each camera cut. For a still, capture at least one final-resolution frame.
   - Also add event-boundary frames when the brief specifies an empty opening, a fast entrance, a settle deadline, or a static end hold: immediately before/at/after first visibility, the settle frame, and the first and last frames of the hold.
4. Actually open and visually inspect the captured PNG files. A successful build, browser load, screenshot command, pixel heuristic, or diagnostics JSON never substitutes for visual inspection. Confirm:
   - every object remains a neutral white model with no texture or colored-material leakage;
   - silhouette, scale, depth, contact shadows, and important product features remain readable;
   - the subject remains framed with no clipping, camera penetration, sudden flip, jump, or unintended occlusion;
   - debug UI, grid, axes, safe-frame overlays, and inspection controls are absent from captured pixels;
   - repeated rendering of the same frame produces the same authored camera state.
   - any required blank opening is actually blank, and a required static hold has identical authored scene state from its first frame through the final frame. Pixel hashes may support the hold check, but still inspect both endpoints visually.
5. If any sampled frame is questionable, inspect additional neighboring frames, fix the project, recapture, and visually inspect again. Do not report visual validation as passed until this loop succeeds.
6. If an upload-ready MP4 exists, run:

   `& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File <skill-dir>\scripts\validate-video.ps1 -Path <video.mp4>`

7. Report checks separately: source contract, build, inspected frame numbers and visual findings, animation replay, and encoded-video properties. Never claim Jimeng acceptance without an actual upload; Three.js only produces the visual/video reference.

## Handle intentional exceptions

- If the user asks for colored materials or textures, label the output `material preview`, not `white model`, and record the exception in `jimeng-previs.config.json`.
- If live Jimeng protocol data differs from this profile, prefer the live protocol for encoding limits while keeping the white-model visual rules unless the user asks otherwise.
- If no capture/export pipeline exists, finish the interactive preview but clearly mark MP4 validation as pending.
