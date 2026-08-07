#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  buildViteProject,
  importPlaywright,
  launchInstalledBrowser,
  parseArguments,
  readProjectConfig,
  resolveOutput,
  startStaticPreview,
} from './runtime-tools.mjs'

function evenlySpacedFrames(frameStart, frameEnd, sampleCount) {
  if (sampleCount <= 1 || frameStart === frameEnd) return [frameStart]
  const values = []
  for (let index = 0; index < sampleCount; index += 1) {
    values.push(Math.round(frameStart + ((frameEnd - frameStart) * index) / (sampleCount - 1)))
  }
  return [...new Set(values)]
}

function parseFrames(value) {
  return String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter(Number.isInteger)
}

const args = parseArguments(process.argv.slice(2))
const projectDir = path.resolve(args.project || args.positional[0] || process.cwd())
const { config } = readProjectConfig(projectDir)
const frameStart = Number(config.frameStart)
const frameEnd = Number(config.frameEnd)
const resolution = config.resolution || { width: 1280, height: 720 }
const sampleCount = Math.max(5, Number(config.validation?.minimumAnimationSamples) || 5)
const criticalFrames = Array.isArray(config.validation?.criticalFrames) ? config.validation.criticalFrames : []
const requestedFrames = args.all
  ? Array.from({ length: frameEnd - frameStart + 1 }, (_, index) => frameStart + index)
  : args.frames
    ? parseFrames(args.frames)
    : [...evenlySpacedFrames(frameStart, frameEnd, sampleCount), ...criticalFrames]
const frames = [...new Set(requestedFrames)]
  .filter((frame) => frame >= frameStart && frame <= frameEnd)
  .sort((left, right) => left - right)

if (frames.length === 0) throw new Error('No valid frames were selected')
if (!Number.isInteger(resolution.width) || !Number.isInteger(resolution.height)) throw new Error('Invalid capture resolution')

const outputDir = resolveOutput(projectDir, args.output, 'validation/jimeng-previs')
fs.mkdirSync(outputDir, { recursive: true })

const { chromium } = await importPlaywright(projectDir)
if (!args.url) await buildViteProject(projectDir)
const server = args.url ? null : await startStaticPreview(projectDir)
const baseUrl = args.url || server.url
const browser = await launchInstalledBrowser(chromium)
const manifest = {
  generatedAt: new Date().toISOString(),
  projectDir,
  url: baseUrl,
  resolution,
  frameStart,
  frameEnd,
  fps: config.fps,
  frames: [],
}

try {
  const context = await browser.newContext({
    viewport: { width: resolution.width, height: resolution.height },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text())
  })

  const initialUrl = new URL(baseUrl)
  initialUrl.searchParams.set('capture', '1')
  initialUrl.searchParams.set('frame', String(frames[0]))
  await page.goto(initialUrl.href, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.__JIMENG_PREVIS__?.ready), null, { timeout: 20000 })
  await page.addStyleTag({ content: `
    html, body { width: 100% !important; height: 100% !important; margin: 0 !important; overflow: hidden !important; }
    body > * { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; }
    canvas { position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important; }
  ` })

  const canvas = page.locator(config.validation?.canvasSelector || 'canvas').first()
  await canvas.waitFor({ state: 'visible' })

  for (const frame of frames) {
    const diagnostics = await page.evaluate(async (requestedFrame) => {
      const api = window.__JIMENG_PREVIS__
      const state = api.renderFrame(requestedFrame, { capture: true })
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      return { ...state, replay: api.renderFrame(requestedFrame, { capture: true }) }
    }, frame)
    if (!diagnostics.allMeshesUseWhiteMaterial) {
      throw new Error(`Frame ${frame} contains a visible mesh outside the Jimeng white-model profile`)
    }
    const filename = `frame_${String(frame).padStart(4, '0')}.png`
    await canvas.screenshot({ path: path.join(outputDir, filename), type: 'png' })
    manifest.frames.push({ frame, filename, diagnostics })
    process.stdout.write(`Captured ${frame}/${frameEnd}\n`)
  }

  manifest.pageErrors = pageErrors
  if (pageErrors.length > 0) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`)
  fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await context.close()
} finally {
  await browser.close()
  await server?.stop()
}

console.log(`PASS: captured ${frames.length} frame(s) to ${outputDir}`)
