import './previs-runtime.css'

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

function createButton(role, label, title = label) {
  const button = document.createElement('button')
  button.type = 'button'
  button.dataset.role = role
  button.textContent = label
  button.title = title
  return button
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function materialIsWhiteModel(material) {
  const materials = Array.isArray(material) ? material : [material]
  return materials.length > 0 && materials.every((item) => {
    if (!item?.isMeshStandardMaterial) return false
    const color = item.color?.getHex?.()
    const mapsAreEmpty = [
      'map',
      'alphaMap',
      'aoMap',
      'bumpMap',
      'displacementMap',
      'emissiveMap',
      'envMap',
      'lightMap',
      'metalnessMap',
      'normalMap',
      'roughnessMap',
    ].every((slot) => item[slot] == null)

    return color === 0xc7c7c7
      && item.roughness === 0.5
      && item.metalness === 0
      && item.opacity === 1
      && item.transparent === false
      && mapsAreEmpty
  })
}

export function createJimengPrevis(options) {
  const {
    renderer,
    scene,
    camera,
    canvas = renderer?.domElement,
    controls = null,
    frameStart = 1,
    frameEnd = 120,
    fps = 24,
    resolution = { width: 1280, height: 720 },
    onFrame,
    onRender = null,
    mount = canvas?.parentElement,
    apiName = '__JIMENG_PREVIS__',
    exportCommand = 'npm run export:jimeng',
    ready = null,
  } = options ?? {}

  if (!renderer || !scene || !camera || !canvas) throw new Error('renderer, scene, camera, and canvas are required')
  if (typeof onFrame !== 'function') throw new Error('onFrame must be a function')
  if (!Number.isInteger(frameStart) || !Number.isInteger(frameEnd) || frameEnd < frameStart) {
    throw new Error('frameStart and frameEnd must be valid inclusive integers')
  }
  if (fps !== 24) throw new Error('Jimeng previs runtime requires 24 fps')

  const captureMode = new URLSearchParams(window.location.search).get('capture') === '1'
  const requestedFrame = Number(new URLSearchParams(window.location.search).get('frame'))
  let currentFrame = Number.isFinite(requestedFrame)
    ? clamp(Math.round(requestedFrame), frameStart, frameEnd)
    : frameStart
  let playing = false
  let inspection = false
  let playbackStartedAt = 0
  let playbackStartFrame = currentFrame
  let destroyed = false
  let toastTimer = null
  let runtimeReady = ready == null
  let readyError = null

  mount?.classList.add('jimeng-previs-host')
  document.documentElement.classList.toggle('jimeng-previs-capture', captureMode)

  const ui = document.createElement('div')
  ui.className = 'jimeng-previs-ui'
  ui.dataset.jimengCaptureHidden = ''

  const startButton = createButton('start', '⏮', '回到首帧')
  const previousButton = createButton('previous', '−1', '上一帧')
  const playButton = createButton('play', '▶ 播放', '播放或暂停')
  const nextButton = createButton('next', '+1', '下一帧')
  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(frameStart)
  range.max = String(frameEnd)
  range.step = '1'
  range.value = String(currentFrame)
  range.ariaLabel = '预演帧'
  const frameOutput = document.createElement('output')
  frameOutput.className = 'jimeng-previs-frame'
  const inspectButton = createButton('inspect', '自由观察', '切换自由观察相机')
  inspectButton.setAttribute('aria-pressed', 'false')
  const snapshotButton = createButton('snapshot', '截帧', '下载当前画布 PNG')
  const exportButton = createButton('export', '导出 MP4', '显示确定性 MP4 导出命令')
  const fpsBadge = document.createElement('span')
  fpsBadge.className = 'jimeng-previs-fps'
  fpsBadge.textContent = `${fps} FPS`

  ui.append(startButton, previousButton, playButton, nextButton, range, frameOutput, inspectButton, snapshotButton, exportButton, fpsBadge)
  mount?.append(ui)

  const toast = document.createElement('div')
  toast.className = 'jimeng-previs-toast'
  toast.dataset.jimengCaptureHidden = ''
  mount?.append(toast)

  function showToast(message, duration = 3200) {
    toast.textContent = message
    toast.dataset.visible = 'true'
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.dataset.visible = 'false' }, duration)
  }

  function resizeRenderer() {
    const width = captureMode ? resolution.width : Math.max(1, Math.round(canvas.clientWidth))
    const height = captureMode ? resolution.height : Math.max(1, Math.round(canvas.clientHeight))
    const pixelRatio = captureMode ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(pixelRatio)
    const expectedWidth = Math.round(width * pixelRatio)
    const expectedHeight = Math.round(height * pixelRatio)
    if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }

  function updateInterface() {
    range.value = String(currentFrame)
    const padWidth = String(frameEnd).length
    frameOutput.value = `${String(currentFrame).padStart(padWidth, '0')} / ${frameEnd}`
    playButton.textContent = playing ? 'Ⅱ 暂停' : '▶ 播放'
    inspectButton.setAttribute('aria-pressed', String(inspection))
  }

  function getState() {
    let visibleMeshes = 0
    let whiteModelMeshes = 0
    scene.traverse((object) => {
      if (!object.isMesh || !object.visible) return
      visibleMeshes += 1
      if (materialIsWhiteModel(object.material)) whiteModelMeshes += 1
    })

    return {
      ready: runtimeReady,
      readyError,
      frame: currentFrame,
      frameStart,
      frameEnd,
      fps,
      playing,
      inspection,
      captureMode,
      visibleMeshes,
      whiteModelMeshes,
      allMeshesUseWhiteMaterial: visibleMeshes > 0 && visibleMeshes === whiteModelMeshes,
      camera: camera.position.toArray().map((value) => Number(value.toFixed(4))),
      canvas: { width: canvas.width, height: canvas.height },
    }
  }

  function renderFrame(frame, renderOptions = {}) {
    if (!runtimeReady) {
      throw new Error(readyError ? `Jimeng previs failed to become ready: ${readyError}` : 'Jimeng previs is not ready')
    }
    const { capture = false } = renderOptions
    currentFrame = clamp(Math.round(frame), frameStart, frameEnd)
    const time = (currentFrame - frameStart) / fps
    onFrame({ frame: currentFrame, time, fps, capture })
    if (controls) controls.enabled = inspection && !playing && !capture
    resizeRenderer()
    if (onRender) onRender({ renderer, scene, camera, frame: currentFrame, time, capture })
    else renderer.render(scene, camera)
    updateInterface()
    return getState()
  }

  function pause() {
    playing = false
    if (controls) controls.enabled = inspection
    updateInterface()
  }

  function play() {
    if (!runtimeReady) throw new Error('Jimeng previs is not ready')
    if (currentFrame >= frameEnd) currentFrame = frameStart
    inspection = false
    playing = true
    if (controls) controls.enabled = false
    playbackStartFrame = currentFrame
    playbackStartedAt = performance.now()
    updateInterface()
  }

  function setInspection(enabled) {
    pause()
    inspection = Boolean(enabled)
    if (controls) controls.enabled = inspection
    if (!inspection) renderFrame(currentFrame)
    updateInterface()
  }

  function snapshot() {
    renderFrame(currentFrame, { capture: true })
    canvas.toBlob((blob) => {
      if (!blob) return showToast('截帧失败：画布没有返回 PNG 数据')
      downloadBlob(blob, `jimeng-frame-${String(currentFrame).padStart(4, '0')}.png`)
      showToast(`已下载第 ${currentFrame} 帧 PNG`)
    }, 'image/png')
  }

  async function showExportCommand() {
    try {
      await navigator.clipboard?.writeText(exportCommand)
      showToast(`最终 MP4 使用逐帧渲染，请在项目终端运行：${exportCommand}（已复制）`, 5200)
    } catch {
      showToast(`最终 MP4 使用逐帧渲染，请在项目终端运行：${exportCommand}`, 5200)
    }
    window.dispatchEvent(new CustomEvent('jimeng-previs-export-request', { detail: { command: exportCommand } }))
  }

  function animationLoop(now) {
    if (destroyed) return
    if (playing) {
      const elapsedFrames = Math.floor(((now - playbackStartedAt) / 1000) * fps)
      const nextFrame = playbackStartFrame + elapsedFrames
      if (nextFrame >= frameEnd) {
        renderFrame(frameEnd)
        pause()
      } else {
        renderFrame(nextFrame)
      }
    } else if (controls?.enabled) {
      resizeRenderer()
      controls.update()
      renderer.render(scene, camera)
    }
    requestAnimationFrame(animationLoop)
  }

  startButton.addEventListener('click', () => { pause(); renderFrame(frameStart) })
  previousButton.addEventListener('click', () => { pause(); renderFrame(currentFrame - 1) })
  playButton.addEventListener('click', () => { if (playing) pause(); else play() })
  nextButton.addEventListener('click', () => { pause(); renderFrame(currentFrame + 1) })
  range.addEventListener('input', () => { pause(); renderFrame(Number(range.value)) })
  inspectButton.addEventListener('click', () => setInspection(!inspection))
  snapshotButton.addEventListener('click', snapshot)
  exportButton.addEventListener('click', showExportCommand)
  const onResize = () => renderFrame(currentFrame, { capture: !inspection })
  window.addEventListener('resize', onResize)

  const api = {
    version: '1.2.1',
    get ready() { return runtimeReady },
    get readyError() { return readyError },
    whenReady: null,
    renderFrame,
    play,
    pause,
    setInspection,
    snapshot,
    getState,
    destroy() {
      destroyed = true
      pause()
      window.removeEventListener('resize', onResize)
      ui.remove()
      toast.remove()
      if (window[apiName] === api) delete window[apiName]
    },
  }

  window[apiName] = api
  function startRuntime() {
    if (destroyed) return api
    runtimeReady = true
    renderFrame(currentFrame, { capture: captureMode })
    requestAnimationFrame(animationLoop)
    return api
  }

  if (runtimeReady) {
    startRuntime()
    api.whenReady = Promise.resolve(api)
  } else {
    const pending = Array.isArray(ready) ? ready : [ready]
    api.whenReady = Promise.all(pending)
      .then(startRuntime)
      .catch((error) => {
        readyError = error instanceof Error ? error.message : String(error)
        console.error('Jimeng previs ready contract failed:', error)
        throw error
      })
  }
  return api
}
