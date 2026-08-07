import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function parseArguments(argv) {
  const result = { positional: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (!value.startsWith('--')) {
      result.positional.push(value)
      continue
    }
    const key = value.slice(2)
    const next = argv[index + 1]
    if (next == null || next.startsWith('--')) result[key] = true
    else {
      result[key] = next
      index += 1
    }
  }
  return result
}

export function readProjectConfig(projectDir) {
  const configPath = path.join(projectDir, 'jimeng-previs.config.json')
  if (!fs.existsSync(configPath)) throw new Error(`Missing jimeng-previs.config.json: ${configPath}`)
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  return { config, configPath }
}

export async function importPlaywright(projectDir) {
  const candidates = [
    path.join(projectDir, 'node_modules', 'playwright-core', 'index.mjs'),
    path.join(projectDir, 'node_modules', 'playwright', 'index.mjs'),
  ]
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return import(pathToFileURL(candidate).href)
  }
  throw new Error('Missing browser driver. Run: npm install -D playwright-core')
}

export async function launchInstalledBrowser(chromium) {
  const attempts = [
    { channel: 'chrome', headless: true },
    { channel: 'msedge', headless: true },
  ]

  const localAppData = process.env.LOCALAPPDATA
  const programFiles = process.env.ProgramFiles
  const programFilesX86 = process.env['ProgramFiles(x86)']
  const executableCandidates = [
    localAppData && path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    programFiles && path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    programFilesX86 && path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    programFiles && path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    programFilesX86 && path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean)

  for (const executablePath of executableCandidates) {
    if (fs.existsSync(executablePath)) attempts.push({ executablePath, headless: true })
  }

  const failures = []
  for (const options of attempts) {
    try {
      return await chromium.launch(options)
    } catch (error) {
      failures.push(error.message.split('\n')[0])
    }
  }
  throw new Error(`Could not launch Chrome or Edge. ${failures.join(' | ')}`)
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => resolve(address.port))
    })
  })
}

export async function buildViteProject(projectDir) {
  const viteBin = path.join(projectDir, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteBin)) throw new Error('Missing local Vite. Run: npm install')
  await runProcess(process.execPath, [viteBin, 'build'], { cwd: projectDir })
}

export async function startStaticPreview(projectDir) {
  const distDir = path.join(projectDir, 'dist')
  const indexPath = path.join(distDir, 'index.html')
  if (!fs.existsSync(indexPath)) throw new Error(`Built index not found: ${indexPath}`)
  const port = await getAvailablePort()
  const url = `http://127.0.0.1:${port}/`
  const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  }
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', url).pathname)
      let filePath = path.resolve(distDir, pathname.replace(/^\/+/, ''))
      if (!filePath.startsWith(distDir + path.sep) && filePath !== distDir) {
        response.writeHead(403).end('Forbidden')
        return
      }
      if (filePath === distDir || (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory())) {
        filePath = path.join(filePath, 'index.html')
      }
      if (!fs.existsSync(filePath)) filePath = indexPath
      response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream' })
      fs.createReadStream(filePath).pipe(response)
    } catch (error) {
      response.writeHead(500).end(error.message)
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return {
    url,
    async stop() {
      await new Promise((resolve) => server.close(resolve))
    },
  }
}

export function resolveOutput(projectDir, value, fallback) {
  return path.resolve(projectDir, value || fallback)
}

export function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}
