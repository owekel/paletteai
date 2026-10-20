import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import { CAPTURE_CONFIG as C } from '../../data/captureConfig'
import type { CaptureRuntime, CaptureSource } from '../../types/capture'
import { createCaptureLandmarker } from '../vision/loadVisionModels'
import { verifyCapturePhoto } from './verifyCapturePhoto'
import { measureCaptureFrame, type LiveHistory } from './liveMeasurements'
import { evaluateCaptureQuality } from './captureQuality'

export function describeCameraError(error: unknown): string {
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : ''
  if (name === 'InsecureContextError') return 'The camera needs a secure HTTPS connection. Open the secure PaletteAI link, or upload a photo instead.'
  if (name === 'NotSupportedError') return 'This browser does not support camera capture here. Open PaletteAI in an up-to-date Safari or Chrome browser, or upload a photo.'
  if (name === 'SecurityError') return 'Camera access is blocked by this browser or page. Open PaletteAI directly in your browser and check its camera permissions, or upload a photo.'
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'Camera access is turned off. Allow it in your browser settings, then try again. You can also upload a photo.'
  if (name === 'NotFoundError') return 'We couldn’t find a camera on this device. You can upload a photo instead.'
  if (name === 'NotReadableError') return 'Your camera may be open in another app. Close it there and try again, or upload a photo.'
  if (name === 'OverconstrainedError') return 'This camera could not use the requested settings. Try reconnecting it, or upload a photo instead.'
  return 'Your camera couldn’t start here. Try again, or upload a photo taken in soft, even light.'
}

export function drawCaptureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  const vw = video.videoWidth, vh = video.videoHeight
  if (!vw || !vh || video.readyState < 2) throw new Error('No camera frame available')
  // Exactly matches the portrait guide's object-cover crop, before mirroring.
  const sw = Math.min(vw, vh * 3 / 4), sh = sw * 4 / 3
  const height = Math.min(C.captureLongEdge, sh), width = Math.round(height * 3 / 4)
  if (canvas.width !== width || canvas.height !== Math.round(height)) { canvas.width = width; canvas.height = Math.round(height) }
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
}

/** The injectable model loader keeps lifecycle tests independent of network/model downloads. */
export function createBrowserCaptureRuntime(loadLandmarker = createCaptureLandmarker): CaptureRuntime { return {
  async open(video, signal, options): Promise<CaptureSource> {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    if (globalThis.isSecureContext === false) throw new DOMException('HTTPS required', 'InsecureContextError')
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) throw new DOMException('Camera unavailable', 'NotSupportedError')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: options?.facingMode ?? 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } } })
    if (signal.aborted) { stream.getTracks().forEach(t => t.stop()); throw new DOMException('Cancelled', 'AbortError') }
    let stopped = false, model: FaceLandmarker | undefined, failed = false, history: LiveHistory | undefined, sequence = 0
    let modelTimer: ReturnType<typeof setTimeout> | undefined
    const full = document.createElement('canvas'), small = document.createElement('canvas')
    small.width = C.previewWidth; small.height = C.previewHeight
    const ctx = small.getContext('2d', { willReadFrequently: true })
    const stop = () => {
      if (stopped) return
      stopped = true
      clearTimeout(modelTimer)
      signal.removeEventListener('abort', stop)
      stream.getTracks().forEach(t => t.stop())
      if (video.srcObject === stream) { video.pause(); video.srcObject = null }
      model?.close(); model = undefined; history = undefined
      full.width = full.height = small.width = small.height = 0
    }
    signal.addEventListener('abort', stop, { once: true })
    try {
      video.srcObject = stream
      await video.play()
      if (stopped || !ctx) throw new Error('Camera stopped')
      // The camera/manual shutter works while the guidance model downloads.
      modelTimer = setTimeout(() => { failed = true }, C.modelTimeoutMs)
      void loadLandmarker().then(value => {
        clearTimeout(modelTimer)
        if (stopped || failed) { value.close(); return }
        model = value
      }).catch(() => { clearTimeout(modelTimer); failed = true })
      const setting = stream.getVideoTracks()[0]?.getSettings?.().facingMode
      const facingMode = setting === 'user' || setting === 'environment' ? setting : undefined
      let canSwitchCamera = false
      if (navigator.mediaDevices.getSupportedConstraints?.().facingMode && navigator.mediaDevices.enumerateDevices) {
        try { canSwitchCamera = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === 'videoinput').length > 1 }
        catch { /* The current camera remains usable if device enumeration is restricted. */ }
      }
      if (stopped) throw new DOMException('Cancelled', 'AbortError')
      return {
        facingMode, canSwitchCamera,
        stop,
        capture() {
          if (stopped) throw new Error('Camera stopped')
          drawCaptureFrame(video, full)
          return full.toDataURL('image/jpeg', C.jpegQuality)
        },
        async sample() {
          if (stopped || stream.getVideoTracks().every(t => t.readyState === 'ended')) throw new Error('Camera disconnected')
          if (!model) return { analyzer: failed ? 'unavailable' : 'loading' }
          // One source snapshot supplies BOTH measured pixels and buffered JPEG.
          drawCaptureFrame(video, full)
          const timestamp = performance.now()
          ctx.drawImage(full, 0, 0, small.width, small.height)
          try {
            const result = model.detect(small)
            const measured = measureCaptureFrame(ctx, result.faceLandmarks, timestamp, history)
            history = measured.history
            const quality = evaluateCaptureQuality(measured.metrics)
            return { analyzer: 'ready', quality, frame: quality.blocker ? undefined : {
              id: ++sequence, timestamp, quality, image: full.toDataURL('image/jpeg', C.jpegQuality),
            } }
          } catch {
            failed = true; model?.close(); model = undefined; history = undefined
            return { analyzer: 'unavailable' }
          }
        },
      }
    } catch (error) { stop(); throw error }
  },
  verify: verifyCapturePhoto,
} }

export const browserCaptureRuntime = createBrowserCaptureRuntime()
