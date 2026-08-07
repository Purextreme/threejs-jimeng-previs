#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArguments, readProjectConfig, resolveOutput, runProcess } from './runtime-tools.mjs'

const args = parseArguments(process.argv.slice(2))
const projectDir = path.resolve(args.project || args.positional[0] || process.cwd())
const { config } = readProjectConfig(projectDir)
const frameStart = Number(config.frameStart)
const frameCount = Number(config.frameEnd) - frameStart + 1
const framesDir = resolveOutput(projectDir, args.frames, 'outputs/jimeng-previs-frames')
const outputPath = resolveOutput(projectDir, args.output, config.output?.path || 'outputs/jimeng-previs.mp4')

if (fs.existsSync(outputPath) && !args.force) {
  throw new Error(`Output already exists: ${outputPath}. Pass --force to replace it.`)
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true })

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
await runProcess(process.execPath, [
  path.join(scriptDir, 'capture-frames.mjs'),
  '--project', projectDir,
  '--output', framesDir,
  '--all',
], { cwd: projectDir })

const ffmpegArgs = [
  ...(args.force ? ['-y'] : ['-n']),
  '-framerate', '24',
  '-start_number', String(frameStart),
  '-i', path.join(framesDir, 'frame_%04d.png'),
  '-frames:v', String(frameCount),
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2:out_range=tv,format=yuv420p',
  '-c:v', 'libx264',
  '-preset', 'veryfast',
  '-crf', String(args.crf || 20),
  '-pix_fmt', 'yuv420p',
  '-color_range', 'tv',
  '-tag:v', 'avc1',
  '-movflags', '+faststart',
  outputPath,
]

await runProcess('ffmpeg', ffmpegArgs, { cwd: projectDir })
console.log(`PASS: exported Jimeng MP4 to ${outputPath}`)
