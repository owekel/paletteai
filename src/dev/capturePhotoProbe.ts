import { createCaptureLandmarker } from '../services/vision/loadVisionModels'
import { measureCaptureFrame } from '../services/capture/liveMeasurements'
import { CAPTURE_CONFIG as C } from '../data/captureConfig'

/** Local still-photo probe, not a claim that simulated motion tests a webcam. */
export async function probeCapturePhoto(file: File, signal: AbortSignal) {
  const url = URL.createObjectURL(file)
  let model: Awaited<ReturnType<typeof createCaptureLandmarker>> | undefined
  try {
    const image = new Image(); image.src = url; await image.decode()
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    const sw = Math.min(image.naturalWidth, image.naturalHeight * .75), sh = sw / .75
    const full = document.createElement('canvas'), small = document.createElement('canvas')
    full.height = Math.min(C.captureLongEdge, sh); full.width = Math.round(full.height * .75)
    full.getContext('2d')!.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, 0, 0, full.width, full.height)
    small.width = C.previewWidth; small.height = C.previewHeight
    const ctx = small.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(full, 0, 0, small.width, small.height)
    model = await createCaptureLandmarker()
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    const faces = model.detect(small).faceLandmarks
    const first = measureCaptureFrame(ctx, faces, 0)
    const second = measureCaptureFrame(ctx, faces, C.intervalMs, first.history)
    return { image: full.toDataURL('image/jpeg', C.jpegQuality), metrics: second.metrics }
  } finally { model?.close(); URL.revokeObjectURL(url) }
}
