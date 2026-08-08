# Jimeng Blender uploader evidence

Source inspected on 2026-08-06:

`D:\IDM\jimeng_blender_uploader-windows-cn-1.0.0\jimeng_blender_uploader`

This is evidence from the supplied Blender add-on, not a claim that Jimeng directly parses Three.js scenes.

## Visual behavior

- `README.md` lines 7-8: export uses Blender Workbench; scenes without user materials become a clean white-model preview, while authored colors or textures switch to material preview.
- `viewport_render.py` lines 20-22: Blender default material values are base color `(0.8, 0.8, 0.8, 1)`, roughness `0.5`, and metallic `0`.
- `viewport_render.py` lines 90-130: image/procedural textures, custom shader nodes, non-default base color, metallic, roughness, alpha, emission, or diffuse color make the scene a material preview.
- `viewport_render.py` lines 148-153: the entire scene switches to material preview when any visible rendered mesh has such a material.
- `viewport_render.py` lines 367-380: export uses `BLENDER_WORKBENCH`; white model uses `SINGLE` color `(0.78, 0.78, 0.78)`, `STUDIO` light, and X-ray off.
- The add-on does not set `background_type`, `background_color`, World color, or film transparency anywhere. Background color is therefore inherited from Blender state rather than required by the Jimeng exporter.

The Three.js profile uses `#c7c7c7`, the nearest 8-bit representation of `0.78`, as its deterministic white-model color.

## Video protocol

- `README.md` lines 38-40 and `dcc_config.py` lines 19-34: fallback protocol supports 360p, 480p, 720p, 1080p, or origin; default is 720p; frame rate is 24 fps.
- `dcc_config.py` lines 20-28 and 36-50: H.264 MP4, maximum 200 MiB, maximum 30 seconds, and 44-720 frames.
- `viewport_render.py` lines 253-284: ffmpeg output uses libx264, CRF 20, `yuv420p`, TV range, `avc1`, and fast start; dimensions are forced even.
- `README.md` line 40: fixed resolution choices preserve the source aspect ratio by scaling the short edge.

## Translation boundary

Treat these as two layers:

1. Source-backed constraints: neutral single-color model, Studio-style lighting, no X-ray, 24 fps, frame and encoding limits.
2. Three.js implementation choices: `MeshStandardMaterial`, neutral light rig, neutral background color, fixed-frame GSAP seeking, and browser/frame-sequence capture. These are equivalent implementation strategies, not fields mandated by the Blender add-on.
