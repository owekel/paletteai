import assert from 'node:assert/strict'
import { createModelCache, describeAnalysisError, VisionModelError, loadVisionImage } from '../src/services/vision/modelLifecycle'

let passed = 0
async function test(name: string, run: () => void | Promise<void>) {
  await run(); passed++; console.log(`✓ ${name}`)
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve))
const options = { label: 'Test model', timeoutMs: 1000 }

await test('Concurrent consumers share one successful model; release closes it only once', async () => {
  let loads = 0, closes = 0
  const model = { id: 1 }
  const cache = createModelCache(async () => { loads++; return model }, { ...options, dispose: () => closes++ })
  const [first, second] = await Promise.all([cache.get(), cache.get()])
  assert.equal(first, model); assert.equal(second, model); assert.equal(await cache.get(), model)
  assert.equal(loads, 1); assert.equal(closes, 0)
  cache.release(); cache.release()
  assert.equal(closes, 1)
  await cache.get(); assert.equal(loads, 2)
  cache.release(); assert.equal(closes, 2)
})

await test('Failed downloads and synchronous loader failures are retryable and sanitized', async () => {
  let calls = 0
  const cache = createModelCache(() => {
    calls++
    if (calls === 1) throw new Error('private raw error https://model.example/path')
    if (calls === 2) return Promise.reject(new Error('Offline'))
    return Promise.resolve('ready')
  }, options)
  await assert.rejects(cache.get(), error => error instanceof VisionModelError && error.kind === 'load')
  await assert.rejects(cache.get(), error => error instanceof VisionModelError && error.kind === 'load')
  assert.equal(await cache.get(), 'ready'); assert.equal(calls, 3)
  cache.release()
})

await test('A stuck model times out, retries immediately, and closes the old late result', async () => {
  const first = deferred<string>()
  let calls = 0
  const closed: string[] = []
  const cache = createModelCache(() => ++calls === 1 ? first.promise : Promise.resolve('new'), {
    ...options, timeoutMs: 10, dispose: model => closed.push(model),
  })
  await assert.rejects(cache.get(), error => error instanceof VisionModelError && error.kind === 'timeout')
  assert.equal(await cache.get(), 'new')
  first.resolve('old'); await flush()
  assert.deepEqual(closed, ['old'])
  assert.equal(await cache.get(), 'new'); assert.equal(calls, 2)
  cache.release(); assert.deepEqual(closed, ['old', 'new'])
})

await test('Reset rejects pending waiters and closes a model that arrives after reset', async () => {
  const source = deferred<string>()
  let stopped = false
  const closed: string[] = []
  const cache = createModelCache(signal => {
    signal.addEventListener('abort', () => { stopped = true })
    return source.promise
  }, { ...options, dispose: value => closed.push(value) })
  const pending = cache.get()
  await flush()
  const rejection = assert.rejects(pending, { name: 'AbortError' })
  cache.release()
  await rejection; assert.equal(stopped, true)
  source.resolve('late'); await flush()
  assert.deepEqual(closed, ['late'])
})

await test('An old failure after reset cannot evict the replacement model', async () => {
  const old = deferred<string>()
  let calls = 0
  const cache = createModelCache(() => ++calls === 1 ? old.promise : Promise.resolve('replacement'), options)
  const pending = cache.get(); await flush()
  const rejection = assert.rejects(pending, { name: 'AbortError' })
  cache.release(); await rejection
  assert.equal(await cache.get(), 'replacement')
  old.reject(new Error('late network error')); await flush()
  assert.equal(await cache.get(), 'replacement'); assert.equal(calls, 2)
  cache.release()
})

await test('Cancelling one consumer preserves another consumer and removes its abort listener', async () => {
  const source = deferred<string>(), abort = new AbortController()
  let removed = 0, loads = 0
  const remove = abort.signal.removeEventListener.bind(abort.signal)
  abort.signal.removeEventListener = (...args) => { removed++; remove(...args) }
  const cache = createModelCache(() => { loads++; return source.promise }, options)
  const cancelled = cache.get(abort.signal), active = cache.get()
  const rejection = assert.rejects(cancelled, { name: 'AbortError' })
  abort.abort(); await rejection
  source.resolve('shared')
  assert.equal(await active, 'shared'); assert.equal(await cache.get(), 'shared')
  assert.equal(loads, 1); assert.ok(removed > 0)
  cache.release()
})

await test('An already cancelled consumer starts no download', async () => {
  let loads = 0
  const cache = createModelCache(async () => { loads++; return 'unused' }, options)
  const abort = new AbortController(); abort.abort()
  await assert.rejects(cache.get(abort.signal), { name: 'AbortError' })
  assert.equal(loads, 0)
})

await test('Reset before the initialization microtask prevents the model from starting', async () => {
  let loads = 0
  const cache = createModelCache(async () => { loads++; return 'unused' }, options)
  const pending = cache.get()
  const rejection = assert.rejects(pending, { name: 'AbortError' })
  cache.release(); await rejection; await flush()
  assert.equal(loads, 0)
})

await test('Cleanup exceptions do not strand the cache or prevent a retry', async () => {
  let calls = 0
  const cache = createModelCache(async () => ++calls, { ...options, dispose: () => { throw new Error('Already closed') } })
  assert.equal(await cache.get(), 1)
  assert.doesNotThrow(() => cache.release())
  assert.equal(await cache.get(), 2)
  cache.release()
})

await test('User-facing download errors keep the same photo retryable and hide raw details', () => {
  for (const kind of ['load', 'timeout'] as const) {
    const message = describeAnalysisError(new VisionModelError(kind, 'https://internal.example/private'))
    assert.match(message, /same photo/)
    assert.doesNotMatch(message, /https|internal|private/)
  }
  assert.doesNotMatch(describeAnalysisError(new Error('secret debug info')), /secret|debug/)
})

await test('Cancelling image decode clears its handlers and source', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  let image: { onload: unknown; onerror: unknown; src: string } | undefined
  class FakeImage {
    onload = null; onerror = null; src = ''
    constructor() { image = this }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage })
  try {
    const abort = new AbortController()
    const pending = loadVisionImage('data:image/png;base64,photo', abort.signal)
    const rejection = assert.rejects(pending, { name: 'AbortError' })
    assert.equal(image?.src, 'data:image/png;base64,photo')
    abort.abort(); await rejection
    assert.equal(image?.src, ''); assert.equal(image?.onload, null); assert.equal(image?.onerror, null)
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'Image', descriptor)
    else Reflect.deleteProperty(globalThis, 'Image')
  }
})

console.log(`\n${passed} model lifecycle checks passed.`)
