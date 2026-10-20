import assert from 'node:assert/strict'
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { createBrowserCaptureRuntime, describeCameraError } from '../src/services/capture/cameraRuntime'

let passed = 0
async function test(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`) }
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function flush() { await Promise.resolve(); await Promise.resolve() }

interface BrowserOptions {
  secure?: boolean
  facingMode?: string
  cameras?: number
  supportsFacingMode?: boolean
  permissionError?: string
  play?: () => Promise<void>
  enumerate?: () => Promise<MediaDeviceInfo[]>
}
async function withBrowser(options: BrowserOptions, run: (browser: ReturnType<typeof makeBrowser>) => Promise<void>) {
  const browser = makeBrowser(options)
  const originals = new Map(['navigator', 'document', 'isSecureContext'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]))
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browser.navigator })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: browser.document })
  Object.defineProperty(globalThis, 'isSecureContext', { configurable: true, value: options.secure ?? true })
  try { await run(browser) } finally {
    browser.abort.abort()
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}
function makeBrowser(options: BrowserOptions) {
  const state = { stops: 0, pauses: 0, loads: 0, closes: 0, enumerations: 0, requests: [] as MediaStreamConstraints[] }
  const abort = new AbortController(), loading = deferred<FaceLandmarker>()
  const model = { close: () => { state.closes++ }, detect: () => ({ faceLandmarks: [] }) } as unknown as FaceLandmarker
  const track = { readyState: 'live', stop() { state.stops++; this.readyState = 'ended' }, getSettings: () => ({ facingMode: options.facingMode }) }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const canvases: HTMLCanvasElement[] = []
  const document = { createElement: () => {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/jpeg;base64,frame' } as unknown as HTMLCanvasElement
    canvases.push(canvas)
    return canvas
  } }
  const video = { srcObject: null, videoWidth: 1280, videoHeight: 960, readyState: 2,
    play: options.play ?? (async () => {}), pause: () => { state.pauses++ } } as unknown as HTMLVideoElement
  const navigator = { mediaDevices: {
    getUserMedia: async (constraints: MediaStreamConstraints) => {
      state.requests.push(constraints)
      if (options.permissionError) throw new DOMException('Camera request failed', options.permissionError)
      return stream
    },
    getSupportedConstraints: () => ({ facingMode: options.supportsFacingMode ?? true }),
    enumerateDevices: async () => {
      state.enumerations++
      if (options.enumerate) return options.enumerate()
      return Array.from({ length: options.cameras ?? 1 }, () => ({ kind: 'videoinput' }))
    },
  } }
  const runtime = createBrowserCaptureRuntime(() => { state.loads++; return loading.promise })
  return { state, abort, loading, model, stream, video, canvases, document, navigator, runtime }
}

await test('Normal camera teardown releases tracks, the attached video, canvases and its guidance model once', async () => {
  await withBrowser({ facingMode: 'user' }, async b => {
    const source = await b.runtime.open(b.video, b.abort.signal)
    b.loading.resolve(b.model); await flush()
    assert.equal(source.capture(), 'data:image/jpeg;base64,frame')
    assert.equal(b.video.srcObject, b.stream)
    source.stop(); source.stop(); b.abort.abort()
    assert.equal(b.state.stops, 1); assert.equal(b.state.pauses, 1); assert.equal(b.state.closes, 1)
    assert.equal(b.video.srcObject, null)
    assert.ok(b.canvases.every(canvas => canvas.width === 0 && canvas.height === 0))
    assert.throws(() => source.capture(), /stopped/)
    await assert.rejects(source.sample(), /disconnected/)
  })
})

await test('Aborting a live session stops its camera and closes a guidance model that arrives afterward', async () => {
  await withBrowser({}, async b => {
    const source = await b.runtime.open(b.video, b.abort.signal)
    assert.equal((await source.sample()).analyzer, 'loading')
    b.abort.abort()
    assert.equal(b.state.stops, 1); assert.equal(b.video.srcObject, null)
    b.loading.resolve(b.model); await flush()
    assert.equal(b.state.closes, 1)
  })
})

await test('Cancellation while video playback opens releases the camera and prevents a model download', async () => {
  const playing = deferred<void>()
  await withBrowser({ play: () => playing.promise }, async b => {
    const pending = b.runtime.open(b.video, b.abort.signal)
    await flush(); b.abort.abort(); playing.resolve()
    await assert.rejects(pending)
    assert.equal(b.state.stops, 1); assert.equal(b.state.loads, 0); assert.equal(b.video.srcObject, null)
  })
})

await test('Cancellation during device discovery cannot publish a stale camera source', async () => {
  const devices = deferred<MediaDeviceInfo[]>()
  await withBrowser({ enumerate: () => devices.promise }, async b => {
    const pending = b.runtime.open(b.video, b.abort.signal)
    await flush(); b.abort.abort(); devices.resolve([])
    await assert.rejects(pending, { name: 'AbortError' })
    b.loading.resolve(b.model); await flush()
    assert.equal(b.state.stops, 1); assert.equal(b.state.closes, 1)
  })
})

await test('Front and rear requests remain optional preferences; mirroring follows the actual camera setting', async () => {
  for (const requested of ['user', 'environment'] as const) {
    await withBrowser({ facingMode: 'environment', cameras: 2 }, async b => {
      const source = await b.runtime.open(b.video, b.abort.signal, { facingMode: requested })
      assert.deepEqual(b.state.requests, [{ audio: false, video: {
        facingMode: { ideal: requested }, width: { ideal: 1280 }, height: { ideal: 960 },
      } }])
      assert.equal(source.facingMode, 'environment')
      assert.equal(source.canSwitchCamera, true)
      source.stop()
    })
  }
  await withBrowser({}, async b => {
    const source = await b.runtime.open(b.video, b.abort.signal)
    assert.equal(source.facingMode, undefined)
    assert.equal(source.canSwitchCamera, false)
    source.stop()
  })
})

await test('A single camera or missing facing-mode support hides switching; restricted enumeration preserves capture', async () => {
  for (const options of [
    { cameras: 1 }, { cameras: 2, supportsFacingMode: false },
    { enumerate: async () => { throw new DOMException('Blocked', 'NotAllowedError') } },
  ]) await withBrowser(options, async b => {
    const source = await b.runtime.open(b.video, b.abort.signal)
    assert.equal(source.canSwitchCamera, false)
    assert.equal(source.capture(), 'data:image/jpeg;base64,frame')
    source.stop()
  })
})

await test('Guidance model failure keeps the manual camera usable', async () => {
  await withBrowser({}, async b => {
    const source = await b.runtime.open(b.video, b.abort.signal)
    b.loading.reject(new Error('Offline')); await flush()
    assert.equal((await source.sample()).analyzer, 'unavailable')
    assert.equal(source.capture(), 'data:image/jpeg;base64,frame')
    source.stop()
  })
})

await test('Insecure and unsupported browsers fail before camera access with actionable recovery guidance', async () => {
  await withBrowser({ secure: false }, async b => {
    await assert.rejects(b.runtime.open(b.video, b.abort.signal), { name: 'InsecureContextError' })
    assert.equal(b.state.requests.length, 0)
    assert.match(describeCameraError({ name: 'InsecureContextError' }), /HTTPS/)
  })
  await withBrowser({}, async b => {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} })
    await assert.rejects(b.runtime.open(b.video, b.abort.signal), { name: 'NotSupportedError' })
    assert.match(describeCameraError({ name: 'NotSupportedError' }), /upload a photo/)
  })
})

await test('Permission and device errors retain their useful reason without starting guidance models', async () => {
  for (const [name, guidance] of [
    ['NotAllowedError', /browser settings/], ['PermissionDeniedError', /browser settings/],
    ['SecurityError', /directly in your browser/], ['NotFoundError', /find a camera/],
    ['NotReadableError', /another app/], ['OverconstrainedError', /requested settings/],
  ] as const) await withBrowser({ permissionError: name }, async b => {
    await assert.rejects(b.runtime.open(b.video, b.abort.signal), { name })
    assert.equal(b.state.loads, 0); assert.equal(b.video.srcObject, null)
    assert.match(describeCameraError({ name }), guidance)
  })
})

await test('An already cancelled camera attempt never asks for permission', async () => {
  await withBrowser({}, async b => {
    b.abort.abort()
    await assert.rejects(b.runtime.open(b.video, b.abort.signal), { name: 'AbortError' })
    assert.equal(b.state.requests.length, 0)
  })
})

console.log(`\n${passed} camera lifecycle checks passed.`)
