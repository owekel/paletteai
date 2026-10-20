import type { ColorProfile } from '../../types/colorProfile'
import { CAPTURE_CONFIG } from '../../data/captureConfig'
import { analyzeImage } from '../analyzeImage'
import { cancellationError } from '../vision/modelLifecycle'

/** Uses the existing full pipeline once. Cancellation releases the capture
 * listener/timer and ignores late results; model inference itself is synchronous. */
export function verifyCapturePhoto(image: string, signal: AbortSignal): Promise<ColorProfile> {
  return new Promise((resolve, reject) => {
    const analysisAbort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel) }
    const cancel = () => { cleanup(); analysisAbort.abort(); reject(cancellationError()) }
    if (signal.aborted) { cancel(); return }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => {
      cleanup()
      analysisAbort.abort()
      reject(new Error('Photo verification timed out'))
    }, CAPTURE_CONFIG.verificationTimeoutMs)
    void analyzeImage(image, analysisAbort.signal).then(result => { cleanup(); resolve(result) }, error => { cleanup(); reject(error) })
  })
}
