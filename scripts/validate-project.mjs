#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const projectDir = path.resolve(process.argv[2] || process.cwd())
const errors = []
const warnings = []

function fail(message) {
  errors.push(message)
}

function warn(message) {
  warnings.push(message)
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} not found: ${filePath}`)
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`)
    return null
  }
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) fail(`${label} must be ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

function expectNumber(actual, expected, label, tolerance = 0) {
  if (typeof actual !== 'number' || Math.abs(actual - expected) > tolerance) {
    fail(`${label} must be ${expected}, got ${JSON.stringify(actual)}`)
  }
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

const packageJson = readJson(path.join(projectDir, 'package.json'), 'package.json')
const config = readJson(path.join(projectDir, 'jimeng-previs.config.json'), 'jimeng-previs.config.json')

if (packageJson) {
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
  if (!dependencies.three) fail('package.json must declare project-level dependency "three"')
  if (!dependencies['playwright-core'] && !dependencies.playwright) {
    fail('package.json must declare project-level dev dependency "playwright-core" or "playwright"')
  }
  if (!packageJson.scripts?.build) fail('package.json must define scripts.build')
  if (!packageJson.scripts?.['capture:jimeng']) fail('package.json must define scripts.capture:jimeng')
  if (!packageJson.scripts?.['export:jimeng']) fail('package.json must define scripts.export:jimeng')
}

if (config) {
  expectEqual(config.profile, 'jimeng-white-model-v1', 'profile')
  expectNumber(config.fps, 24, 'fps')

  expectEqual(config.runtime?.version, '1.3.2', 'runtime.version')
  if (typeof config.runtime?.path !== 'string' || !config.runtime.path.trim()) {
    fail('runtime.path must be a non-empty project-relative path')
  } else {
    const runtimeDir = path.resolve(projectDir, config.runtime.path)
    if (!runtimeDir.startsWith(projectDir + path.sep)) {
      fail(`runtime.path escapes the project directory: ${config.runtime.path}`)
    } else {
      const runtimeFiles = [
        'index.js',
        'previs-runtime.js',
        'previs-runtime.css',
        'white-model.js',
        'camera-rig.js',
        'model.js',
        'primitives.js',
        'shot.js',
        'stage.js',
      ]
      for (const filename of runtimeFiles) {
        if (!fs.existsSync(path.join(runtimeDir, filename))) fail(`runtime file not found: ${path.join(config.runtime.path, filename)}`)
      }
    }
  }

  if (!Number.isInteger(config.frameStart) || !Number.isInteger(config.frameEnd)) {
    fail('frameStart and frameEnd must be integers')
  } else {
    const frameCount = config.frameEnd - config.frameStart + 1
    if (frameCount < 44 || frameCount > 720) fail(`inclusive frame count must be 44-720, got ${frameCount}`)
  }

  const resolution = config.resolution || {}
  for (const key of ['width', 'height']) {
    const value = resolution[key]
    if (!Number.isInteger(value) || value < 2 || value % 2 !== 0) {
      fail(`resolution.${key} must be a positive even integer, got ${JSON.stringify(value)}`)
    }
  }
  if (!resolution.origin && Number.isInteger(resolution.width) && Number.isInteger(resolution.height)) {
    const shortEdge = Math.min(resolution.width, resolution.height)
    if (![360, 480, 720, 1080].includes(shortEdge)) {
      fail(`resolution short edge must be 360, 480, 720, or 1080 unless origin=true; got ${shortEdge}`)
    }
  }

  const white = config.whiteModel || {}
  expectEqual(String(white.color || '').toLowerCase(), '#c7c7c7', 'whiteModel.color')
  expectNumber(white.roughness, 0.5, 'whiteModel.roughness')
  expectNumber(white.metalness, 0, 'whiteModel.metalness')
  expectNumber(white.opacity, 1, 'whiteModel.opacity')
  expectEqual(white.transparent, false, 'whiteModel.transparent')
  expectEqual(white.textures, false, 'whiteModel.textures')
  expectEqual(String(white.emissive || '').toLowerCase(), '#000000', 'whiteModel.emissive')

  const materialPreview = config.materialPreview
  if (!materialPreview || typeof materialPreview !== 'object' || Array.isArray(materialPreview)) {
    fail('materialPreview must be an object')
  } else {
    if (typeof materialPreview.enabled !== 'boolean') fail('materialPreview.enabled must be a boolean')
    expectEqual(materialPreview.purpose, 'object-marking', 'materialPreview.purpose')
    if (!materialPreview.colors || typeof materialPreview.colors !== 'object' || Array.isArray(materialPreview.colors)) {
      fail('materialPreview.colors must be an object mapping object labels to #rrggbb colors')
    } else {
      for (const [label, color] of Object.entries(materialPreview.colors)) {
        if (!label.trim() || !isHexColor(color)) {
          fail(`materialPreview.colors entries must map non-empty labels to #rrggbb colors; got ${JSON.stringify(label)}: ${JSON.stringify(color)}`)
        }
      }
      if (materialPreview.enabled && Object.keys(materialPreview.colors).length === 0) {
        fail('materialPreview.colors must contain at least one explicitly requested object color when materialPreview.enabled is true')
      }
    }
  }

  expectEqual(config.lighting?.mode, 'studio-neutral', 'lighting.mode')
  if (typeof config.camera?.name !== 'string' || !config.camera.name.trim()) fail('camera.name must be a non-empty string')
  expectEqual(config.camera?.controlsDuringCapture, false, 'camera.controlsDuringCapture')

  expectEqual(String(config.output?.container || '').toLowerCase(), 'mp4', 'output.container')
  expectEqual(String(config.output?.codec || '').toLowerCase(), 'h264', 'output.codec')
  expectEqual(String(config.output?.pixelFormat || '').toLowerCase(), 'yuv420p', 'output.pixelFormat')
  if (!Number.isInteger(config.output?.maxBytes) || config.output.maxBytes > 209715200 || config.output.maxBytes <= 0) {
    fail(`output.maxBytes must be an integer from 1 through 209715200, got ${JSON.stringify(config.output?.maxBytes)}`)
  }
  if (typeof config.output?.path !== 'string' || !config.output.path.toLowerCase().endsWith('.mp4')) {
    fail('output.path must be a project-relative .mp4 path')
  }

  const minimumSamples = config.validation?.minimumAnimationSamples
  if (!Number.isInteger(minimumSamples) || minimumSamples < 5) {
    fail(`validation.minimumAnimationSamples must be an integer of at least 5, got ${JSON.stringify(minimumSamples)}`)
  }
  if (config.validation?.criticalFrames != null) {
    if (!Array.isArray(config.validation.criticalFrames) || config.validation.criticalFrames.some((frame) => !Number.isInteger(frame))) {
      fail('validation.criticalFrames must be an array of integer frames')
    } else if (config.validation.criticalFrames.some((frame) => frame < config.frameStart || frame > config.frameEnd)) {
      fail('validation.criticalFrames entries must stay inside the inclusive frame range')
    }
  }

  if (!Array.isArray(config.sourceFiles) || config.sourceFiles.length === 0) {
    fail('sourceFiles must list at least one implementation file')
  } else {
    let source = ''
    for (const relativeFile of config.sourceFiles) {
      const sourcePath = path.resolve(projectDir, relativeFile)
      if (!sourcePath.startsWith(projectDir + path.sep)) {
        fail(`sourceFiles entry escapes the project directory: ${relativeFile}`)
        continue
      }
      if (!fs.existsSync(sourcePath)) {
        fail(`sourceFiles entry not found: ${relativeFile}`)
        continue
      }
      source += `\n${fs.readFileSync(sourcePath, 'utf8')}`
    }

    if (source && !/from\s+['"]three['"]|require\(['"]three['"]\)/.test(source)) fail('sourceFiles must import three')
    if (source && !/PerspectiveCamera/.test(source)) fail('sourceFiles must create or reference PerspectiveCamera')
    if (source && !/MeshStandardMaterial/.test(source)) fail('sourceFiles must create or reference MeshStandardMaterial')
    if (source && !/(0x|#)c7c7c7/i.test(source)) fail('sourceFiles must contain the white-model color #c7c7c7 / 0xc7c7c7')
    if (source && !/createJimengPrevis/.test(source)) fail('sourceFiles must connect the shared createJimengPrevis runtime')
    if (source && /Mesh(Basic|Phong|Lambert|Toon|Physical|Matcap|Normal|Depth)Material/.test(source)) {
      warn('alternate mesh material constructors found; visually verify that every final render mesh is overridden')
    }
    if (source && !/GLTFLoader|loadPrevisModel/.test(source)) {
      warn('No GLB/glTF loader found; acceptable only when the project does not load GLB/glTF assets')
    }
    if (source && !/OrbitControls/.test(source)) warn('OrbitControls not found; acceptable when no interactive inspection is required')
  }
}

for (const message of warnings) console.warn(`WARN: ${message}`)
for (const message of errors) console.error(`ERROR: ${message}`)

if (errors.length > 0) {
  console.error(`FAIL: ${errors.length} error(s), ${warnings.length} warning(s)`)
  process.exit(1)
}

console.log(`PASS: Jimeng ${config?.materialPreview?.enabled ? 'marker-color preview' : 'white-model'} project contract is valid (${warnings.length} warning(s))`)
