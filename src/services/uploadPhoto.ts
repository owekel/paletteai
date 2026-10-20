/** Upload safety limits, independent of colour measurement or classification. */
export const UPLOAD_LIMITS = {
  maximumBytes: 15 * 1024 * 1024,
  maximumPixels: 20_000_000,
  maximumSide: 8192,
  timeoutMs: 15000,
} as const

type PhotoFormat = 'image/jpeg' | 'image/png' | 'image/webp'
interface PhotoDimensions { width: number; height: number; format: PhotoFormat }
const unsupported = 'Choose a JPG, PNG or WebP photo. Other image formats are not supported here.'
const damaged = 'We couldn’t read that photo. Try a different file, or export it again as a JPG or PNG.'
const heic = 'This photo is in HEIC or HEIF format. Export it as a JPG or PNG, then choose that version.'
const tooLarge = 'That photo is too large to process safely. Choose one under 15 MB and 20 megapixels, with neither side over 8,192 pixels.'

export function validatePhotoFile(file: Pick<File, 'size' | 'type' | 'name'>): void {
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) throw new Error(heic)
  if (file.type && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error(unsupported)
  if (!file.size) throw new Error(damaged)
  if (file.size > UPLOAD_LIMITS.maximumBytes) throw new Error(tooLarge)
}

function validateDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error(damaged)
  if (width > UPLOAD_LIMITS.maximumSide || height > UPLOAD_LIMITS.maximumSide || width * height > UPLOAD_LIMITS.maximumPixels) throw new Error(tooLarge)
}

/** Read dimensions before decoding, so small compressed files cannot allocate
 * unbounded pixel canvases. The browser decoder still validates the full file. */
export function inspectPhotoBytes(bytes: Uint8Array, declaredType = ''): PhotoDimensions {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const text = (at: number, length: number) => String.fromCharCode(...bytes.subarray(at, at + length))
  let dimensions: PhotoDimensions | undefined
  if (bytes.length >= 24 && bytes[0] === 137 && text(1, 3) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 && text(12, 4) === 'IHDR') {
    dimensions = { width: view.getUint32(16), height: view.getUint32(20), format: 'image/png' }
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = view.getUint32(offset)
      if (text(offset + 4, 4) === 'acTL') throw new Error('Choose a still photo rather than an animated image.')
      if (length > bytes.length - offset - 12) break
      offset += length + 12
    }
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    let offset = 2
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error(damaged)
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 217 || marker === 218) break
      if (marker === 1 || marker >= 208 && marker <= 215) continue
      if (offset + 2 > bytes.length) break
      const length = view.getUint16(offset)
      if (length < 2 || length > bytes.length - offset) throw new Error(damaged)
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        if (length < 8) throw new Error(damaged)
        dimensions = { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3), format: 'image/jpeg' }
        break
      }
      offset += length
    }
  } else if (bytes.length >= 30 && text(0, 4) === 'RIFF' && text(8, 4) === 'WEBP') {
    const chunk = text(12, 4)
    if (chunk === 'VP8X') {
      if (bytes[20] & 2) throw new Error('Choose a still photo rather than an animated image.')
      dimensions = { width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16), format: 'image/webp' }
    } else if (chunk === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) {
      dimensions = { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff, format: 'image/webp' }
    } else if (chunk === 'VP8L' && bytes[20] === 47) {
      const bits = view.getUint32(21, true)
      dimensions = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, format: 'image/webp' }
    }
  } else if (text(4, 4) === 'ftyp' && /heic|heix|hevc|hevx|heim|heis|mif1|msf1/.test(text(8, 28))) {
    throw new Error(heic)
  }
  if (!dimensions) throw new Error(damaged)
  if (declaredType && dimensions.format !== declaredType) throw new Error('That file’s contents do not match its image format. Export it again as a JPG or PNG.')
  validateDimensions(dimensions.width, dimensions.height)
  return dimensions
}

/** Accept the original bytes, without resizing/re-encoding or changing colour.
 * Modern browser image decoding handles EXIF orientation in the existing pipeline.
 * All temporary readers/URLs are released on success, failure, timeout or cancel. */
export function readUploadPhoto(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    let reader: FileReader | undefined, image: HTMLImageElement | undefined, objectUrl: string | undefined
    let timer: ReturnType<typeof setTimeout> | undefined, settled = false
    const finish = (error?: Error, result?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      if (reader) {
        reader.onload = reader.onerror = reader.onabort = null
        if (reader.readyState === 1) reader.abort()
      }
      if (image) { image.onload = image.onerror = null; image.src = '' }
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (error) reject(error); else resolve(result!)
    }
    const cancel = () => finish(new DOMException('Cancelled', 'AbortError'))
    if (signal?.aborted) { cancel(); return }
    try {
      validatePhotoFile(file)
      signal?.addEventListener('abort', cancel, { once: true })
      timer = setTimeout(() => finish(new Error('That photo took too long to open. Try a smaller JPG or PNG.')), UPLOAD_LIMITS.timeoutMs)
      reader = new FileReader()
      reader.onerror = () => finish(new Error(damaged))
      reader.onabort = cancel
      reader.onload = () => {
        try {
          if (!(reader!.result instanceof ArrayBuffer)) throw new Error(damaged)
          inspectPhotoBytes(new Uint8Array(reader!.result), file.type)
          image = new Image()
          image.onerror = () => finish(new Error(damaged))
          image.onload = () => {
            try {
              validateDimensions(image!.naturalWidth, image!.naturalHeight)
              reader!.onload = () => {
                const value = reader!.result
                if (typeof value !== 'string' || !value.startsWith('data:')) finish(new Error(damaged))
                else finish(undefined, value)
              }
              reader!.readAsDataURL(file)
            } catch (error) { finish(error instanceof Error ? error : new Error(damaged)) }
          }
          objectUrl = URL.createObjectURL(file)
          image.src = objectUrl
        } catch (error) { finish(error instanceof Error ? error : new Error(damaged)) }
      }
      reader.readAsArrayBuffer(file)
    } catch (error) { finish(error instanceof Error ? error : new Error(damaged)) }
  })
}
