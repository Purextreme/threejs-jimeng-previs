#!/usr/bin/env node

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArguments, runProcess } from './runtime-tools.mjs'

const args = parseArguments(process.argv.slice(2))
const projectDir = path.resolve(args.project || args.positional[0] || process.cwd())
const packagePath = path.join(projectDir, 'package.json')
if (!fs.existsSync(packagePath)) throw new Error(`package.json not found: ${packagePath}`)

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const runtimeSource = path.join(skillDir, 'assets', 'previs-runtime')
const runtimeTarget = path.join(projectDir, 'src', 'jimeng-previs')
const toolsTarget = path.join(projectDir, 'scripts', 'jimeng-previs')
const configTarget = path.join(projectDir, 'jimeng-previs.config.json')
const defaultConfig = JSON.parse(fs.readFileSync(path.join(skillDir, 'assets', 'jimeng-previs.config.json'), 'utf8'))
const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
packageJson.scripts ??= {}
const projectRequire = createRequire(packagePath)
const declaredDependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }
const declaredPlaywright = Boolean(declaredDependencies['playwright-core'] || declaredDependencies.playwright)
const resolvablePlaywright = ['playwright-core', 'playwright'].some((name) => {
  try {
    projectRequire.resolve(name)
    return true
  } catch {
    return false
  }
})
const playwrightReady = declaredPlaywright && resolvablePlaywright
const managedScripts = {
  'capture:jimeng': 'node scripts/jimeng-previs/capture-frames.mjs',
  'export:jimeng': 'node scripts/jimeng-previs/export-video.mjs',
  'test:jimeng-runtime': 'node scripts/jimeng-previs/test-runtime.mjs',
}

if (fs.existsSync(runtimeTarget) && !args.force) {
  throw new Error(`Runtime already exists: ${runtimeTarget}. Inspect local changes, then pass --force to update managed files.`)
}
for (const [name, command] of Object.entries(managedScripts)) {
  if (packageJson.scripts[name] && packageJson.scripts[name] !== command && !args.force) {
    throw new Error(`package.json script ${name} already exists with a different command`)
  }
}

let projectConfig = defaultConfig
if (fs.existsSync(configTarget)) {
  projectConfig = JSON.parse(fs.readFileSync(configTarget, 'utf8'))
  if (projectConfig.runtime && projectConfig.runtime.version !== defaultConfig.runtime.version && !args.force) {
    throw new Error(`Config requests runtime ${projectConfig.runtime.version}; inspect it before updating to ${defaultConfig.runtime.version}`)
  }
  projectConfig.runtime = defaultConfig.runtime
  projectConfig.output ??= defaultConfig.output
  projectConfig.output.path ??= defaultConfig.output.path
  projectConfig.materialPreview ??= {}
  projectConfig.materialPreview.enabled ??= defaultConfig.materialPreview.enabled
  projectConfig.materialPreview.purpose = defaultConfig.materialPreview.purpose
  delete projectConfig.materialPreview.defaultColor
  projectConfig.materialPreview.colors ??= defaultConfig.materialPreview.colors
  projectConfig.validation ??= {}
  projectConfig.validation.minimumAnimationSamples = Math.max(
    5,
    Number(projectConfig.validation.minimumAnimationSamples) || 0,
  )
  projectConfig.sourceFiles = [...new Set([
    ...(Array.isArray(projectConfig.sourceFiles) ? projectConfig.sourceFiles : []),
    'src/jimeng-previs/white-model.js',
  ])]
}

fs.mkdirSync(runtimeTarget, { recursive: true })
fs.mkdirSync(toolsTarget, { recursive: true })
for (const entry of fs.readdirSync(runtimeSource, { withFileTypes: true })) {
  if (!entry.isFile()) continue
  fs.copyFileSync(path.join(runtimeSource, entry.name), path.join(runtimeTarget, entry.name))
}
for (const filename of ['capture-frames.mjs', 'export-video.mjs', 'runtime-tools.mjs', 'test-runtime.mjs']) {
  fs.copyFileSync(path.join(skillDir, 'scripts', filename), path.join(toolsTarget, filename))
}

for (const [name, command] of Object.entries(managedScripts)) {
  packageJson.scripts[name] = command
}
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')
fs.writeFileSync(configTarget, `${JSON.stringify(projectConfig, null, 2)}\n`, 'utf8')

if (args.install && !playwrightReady) {
  const npmCliCandidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  ].filter(Boolean)
  const npmCli = npmCliCandidates.find((candidate) => fs.existsSync(candidate))
  if (!npmCli) throw new Error('Could not locate npm-cli.js for dependency installation')
  await runProcess(process.execPath, [npmCli, 'install', '--save-dev', 'playwright-core'], { cwd: projectDir })
}

console.log(`PASS: installed Jimeng previs runtime in ${runtimeTarget}`)
if (args.install && playwrightReady) console.log('SKIP: project-level Playwright dependency is already available')
if (!args.install && playwrightReady) console.log('READY: project-level Playwright dependency is already available')
if (!args.install && !playwrightReady) console.log('NEXT: rerun with --install to add playwright-core')
