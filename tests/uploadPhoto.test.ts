import assert from 'node:assert/strict'
import { inspectPhotoBytes, readUploadPhoto, UPLOAD_LIMITS, validatePhotoFile } from '../src/services/uploadPhoto'

let passed = 0
async function test(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`) }
function png(width = 4000, height = 3000) {
  const data = new Uint8Array(45), view = new DataView(data.buffer)
  data.set([137, 80, 78, 71, 13, 10, 26, 10]); view.setUint32(8, 13)
  data.set([73, 72, 68, 82], 12); view.setUint32(16, width); view.setUint32(20, height)
  data.set([73, 69, 78, 68], 37)
  return data
}
function jpeg(width = 4000, height = 3000) {
  return new Uint8Array([255, 216, 255, 225, 0, 4, 0, 0, 255, 194, 0, 8, 8, height >> 8, height & 255, width >> 8, width & 255, 0, 255, 217])
}
function webp(kind: 'VP8X' | 'VP8 ' | 'VP8L', width = 4000, height = 3000) {
  const data = new Uint8Array(40), view = new DataView(data.buffer)
  data.set(new TextEncoder().encode('RIFF'), 0); data.set(new TextEncoder().encode('WEBP' + kind), 8)
  if (kind === 'VP8X') {
    data.set([width - 1 & 255, width - 1 >> 8 & 255, width - 1 >> 16 & 255], 24)
    data.set([height - 1 & 255, height - 1 >> 8 & 255, height - 1 >> 16 & 255], 27)
  } else if (kind === 'VP8 ') {
    data.set([157, 1, 42], 23); view.setUint16(26, width, true); view.setUint16(28, height, true)
  } else { data[20] = 47; view.setUint32(21, (width - 1) | (height - 1) << 14, true) }
  return data
}

await test('Only supported raster types enter upload; HEIC gets specific conversion guidance', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', '']) validatePhotoFile({ name: 'photo', type, size: 100 })
  for (const type of ['image/svg+xml', 'image/gif', 'text/html']) assert.throws(() => validatePhotoFile({ name: 'photo', type, size: 100 }), /not supported/)
  assert.throws(() => validatePhotoFile({ name: 'portrait.HEIC', type: '', size: 100 }), /Export it as a JPG/)
  assert.throws(() => validatePhotoFile({ name: 'photo', type: 'image/heif', size: 100 }), /Export it as a JPG/)
})
await test('Empty or oversized compressed files are rejected before reading', () => {
  assert.throws(() => validatePhotoFile({ name: 'photo.jpg', type: 'image/jpeg', size: 0 }), /couldn’t read/)
  assert.throws(() => validatePhotoFile({ name: 'photo.jpg', type: 'image/jpeg', size: UPLOAD_LIMITS.maximumBytes + 1 }), /too large/)
})
await test('PNG, progressive JPEG and all three WebP headers expose dimensions without decoding', () => {
  for (const bytes of [png(), jpeg(), webp('VP8X'), webp('VP8 '), webp('VP8L')]) {
    const result = inspectPhotoBytes(bytes)
    assert.equal(result.width, 4000); assert.equal(result.height, 3000)
  }
  assert.equal(inspectPhotoBytes(png(), 'image/png').format, 'image/png')
})
await test('Mismatched MIME, invalid/truncated files and animated images fail explicitly', () => {
  assert.throws(() => inspectPhotoBytes(png(), 'image/jpeg'), /do not match/)
  assert.throws(() => inspectPhotoBytes(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')), /couldn’t read/)
  assert.throws(() => inspectPhotoBytes(jpeg().subarray(0, 12)), /couldn’t read/)
  const animation = webp('VP8X'); animation[20] = 2
  assert.throws(() => inspectPhotoBytes(animation), /still photo/)
  const apng = png(); apng.set(new TextEncoder().encode('acTL'), 37)
  assert.throws(() => inspectPhotoBytes(apng), /still photo/)
})
await test('Compressed dimension bombs are rejected before allocation, while ordinary phone photos remain unchanged', () => {
  for (const bytes of [png(8193, 10), png(5000, 5000), jpeg(8192, 8192), webp('VP8X', 16384, 16384)]) assert.throws(() => inspectPhotoBytes(bytes), /too large/)
  assert.throws(() => inspectPhotoBytes(png(0, 3000)), /couldn’t read/)
  assert.equal(inspectPhotoBytes(png(4000, 3000)).width, 4000)
})

type Mode = 'normal' | 'read-error' | 'decode-error' | 'read-stall' | 'decode-stall' | 'decoded-too-large'
async function withBrowser(mode: Mode, run: (state: { file: File; aborts: number; revoked: number; clearedImages: number }) => Promise<void>) {
  const originalReader = Object.getOwnPropertyDescriptor(globalThis, 'FileReader')
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL
  const state = { file: { name: 'photo.jpg', type: 'image/jpeg', size: 100 } as File, aborts: 0, revoked: 0, clearedImages: 0 }
  class Reader {
    result: ArrayBuffer | string | null = null
    readyState = 0
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    readAsArrayBuffer() {
      this.readyState = 1
      if (mode === 'read-stall') return
      queueMicrotask(() => { this.readyState = 2; this.result = jpeg().buffer; if (mode === 'read-error') this.onerror?.(); else this.onload?.() })
    }
    readAsDataURL() { this.readyState = 1; queueMicrotask(() => { this.readyState = 2; this.result = 'data:image/jpeg;base64,original-photo-bytes'; this.onload?.() }) }
    abort() { state.aborts++; this.readyState = 2; this.onabort?.() }
  }
  class Image {
    // Swapped dimensions simulate the browser applying EXIF orientation.
    naturalWidth = mode === 'decoded-too-large' ? 9000 : 3000
    naturalHeight = 4000
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(value: string) {
      if (!value) { state.clearedImages++; return }
      if (mode === 'decode-stall') return
      queueMicrotask(() => mode === 'decode-error' ? this.onerror?.() : this.onload?.())
    }
  }
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: Reader })
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: Image })
  URL.createObjectURL = () => 'blob:upload-test'
  URL.revokeObjectURL = () => { state.revoked++ }
  try { await run(state) } finally {
    if (originalReader) Object.defineProperty(globalThis, 'FileReader', originalReader); else delete (globalThis as { FileReader?: unknown }).FileReader
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage); else delete (globalThis as { Image?: unknown }).Image
    URL.createObjectURL = create; URL.revokeObjectURL = revoke
  }
}
await test('Accepted original bytes and browser EXIF orientation are retained; temporary resources are released', async () => {
  await withBrowser('normal', async state => {
    assert.equal(await readUploadPhoto(state.file), 'data:image/jpeg;base64,original-photo-bytes')
    assert.equal(state.revoked, 1); assert.equal(state.clearedImages, 1)
  })
})
await test('Read and decode errors reject with recovery text; oversized decoded dimensions get a second check', async () => {
  for (const mode of ['read-error', 'decode-error', 'decoded-too-large'] as const) await withBrowser(mode, async state => {
    await assert.rejects(readUploadPhoto(state.file), mode === 'decoded-too-large' ? /too large/ : /couldn’t read/)
    assert.equal(state.revoked, mode === 'read-error' ? 0 : 1)
  })
})
await test('Cancellation prevents stale uploads and aborts pending reads on replacement or unmount', async () => {
  await withBrowser('read-stall', async state => {
    const abort = new AbortController(), pending = readUploadPhoto(state.file, abort.signal)
    abort.abort()
    await assert.rejects(pending, { name: 'AbortError' }); assert.equal(state.aborts, 1)
    await assert.rejects(readUploadPhoto(state.file, abort.signal), { name: 'AbortError' })
    assert.equal(state.aborts, 1)
  })
})
await test('Stalled decoding has a bounded deadline and releases its temporary image URL', async () => {
  await withBrowser('decode-stall', async state => {
    const set = globalThis.setTimeout, clear = globalThis.clearTimeout
    let expire!: () => void, cleared = false
    globalThis.setTimeout = ((callback: () => void) => { expire = callback; return 1 }) as unknown as typeof setTimeout
    globalThis.clearTimeout = (() => { cleared = true }) as typeof clearTimeout
    try {
      const pending = readUploadPhoto(state.file)
      await Promise.resolve()
      expire()
      await assert.rejects(pending, /too long to open/)
      assert.equal(state.revoked, 1); assert.equal(state.clearedImages, 1); assert.equal(cleared, true)
    } finally { globalThis.setTimeout = set; globalThis.clearTimeout = clear }
  })
})
console.log(`\n${passed} upload safety checks passed.`)
