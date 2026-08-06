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
4. Create `jimeng-previs.config.json` at the project root from the reference example and keep it synchronized with actual behavior.
5. Preserve existing user work. Make only the changes required for the preview profile.

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

3. Inspect the preview in a real browser at the first, middle, and last frames. Confirm neutral white materials, readable form, no texture leakage, no clipping, no camera jump, and deterministic replay.
4. If an upload-ready MP4 exists, run:

   `& 'C:\Program Files\PowerShell\7\pwsh.exe' -NoProfile -File <skill-dir>\scripts\validate-video.ps1 -Path <video.mp4>`

5. Report checks separately: source contract, build, browser appearance, animation replay, and encoded-video properties. Never claim Jimeng acceptance without an actual upload; Three.js only produces the visual/video reference.

## Handle intentional exceptions

- If the user asks for colored materials or textures, label the output `material preview`, not `white model`, and record the exception in `jimeng-previs.config.json`.
- If live Jimeng protocol data differs from this profile, prefer the live protocol for encoding limits while keeping the white-model visual rules unless the user asks otherwise.
- If no capture/export pipeline exists, finish the interactive preview but clearly mark MP4 validation as pending.
