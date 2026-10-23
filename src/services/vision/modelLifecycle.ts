/** Lifecycle helpers are independent of MediaPipe so failure paths can be tested. */
export class VisionModelError extends Error {
  constructor(public readonly kind: 'load' | 'timeout', label: string) {
    super(kind === 'timeout' ? `${label} took too long to load.` : `${label} could not be loaded.`)
    this.name = 'VisionModelError'
  }
}

export function cancellationError(): DOMException {
  return new DOMException('Cancelled', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw cancellationError()
}

export function loadVisionImage(dataUrl: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(cancellationError()); return }
    const image = new Image()
    const cleanup = () => {
      clearTimeout(timer)
      image.onload = image.onerror = null
      signal?.removeEventListener('abort', cancel)
    }
    const cancel = () => { cleanup(); image.src = ''; reject(cancellationError()) }
    const timer = setTimeout(() => {
      cleanup()
      image.src = ''
      reject(new Error('The photo took too long to open.'))
    }, 10000)
    image.onload = () => { cleanup(); resolve(image) }
    image.onerror = () => { cleanup(); reject(new Error('Could not open the selected photo.')) }
    signal?.addEventListener('abort', cancel, { once: true })
    image.src = dataUrl
  })
}

/** Cancelling one waiter must not cancel another consumer of a shared model. */
export function waitForAbortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  return new Promise((resolve, reject) => {
    const cancel = () => { cleanup(); reject(cancellationError()) }
    const cleanup = () => signal.removeEventListener('abort', cancel)
    // Handle late rejection even when this consumer has already cancelled.
    promise.then(value => { cleanup(); if (!signal.aborted) resolve(value) }, error => { cleanup(); reject(error) })
    if (signal.aborted) cancel()
    else signal.addEventListener('abort', cancel, { once: true })
  })
}

interface ModelCacheOptions<T> {
  label: string
  timeoutMs: number
  dispose?: (value: T) => void
}

/** Failed/expired entries are evicted. Models arriving after reset or timeout
 * are closed and can never replace a newer successful entry. */
export function createModelCache<T>(
  create: (signal: AbortSignal) => Promise<T>,
  { label, timeoutMs, dispose }: ModelCacheOptions<T>,
) {
  let current: { promise: Promise<T>; release: () => void } | undefined
  const close = (value: T) => {
    try { dispose?.(value) } catch { /* Cleanup must not prevent a new attempt. */ }
  }
  return {
    get(signal?: AbortSignal): Promise<T> {
      if (signal?.aborted) return Promise.reject(cancellationError())
      if (!current) {
        const controller = new AbortController()
        let active = true
        let loaded = false
        let value: T
        let rejectPending!: (reason: unknown) => void
        let timer: ReturnType<typeof setTimeout>
        const entry = {
          promise: new Promise<T>((resolve, reject) => {
            rejectPending = reject
            timer = setTimeout(() => {
              if (!active) return
              active = false
              if (current === entry) current = undefined
              reject(new VisionModelError('timeout', label))
              controller.abort()
            }, timeoutMs)
            void Promise.resolve().then(() => {
              throwIfAborted(controller.signal)
              return create(controller.signal)
            }).then(result => {
              if (!active) { close(result); return }
              loaded = true
              value = result
              clearTimeout(timer)
              resolve(result)
            }, error => {
              if (!active) return
              active = false
              clearTimeout(timer)
              if (current === entry) current = undefined
              reject(error instanceof VisionModelError ? error : new VisionModelError('load', label))
            })
          }),
          release: () => {
            if (!active) return
            active = false
            clearTimeout(timer)
            if (loaded) close(value)
            else rejectPending(cancellationError())
            controller.abort()
          },
        }
        current = entry
      }
      return waitForAbortable(current.promise, signal)
    },
    release(): void {
      const previous = current
      current = undefined
      previous?.release()
    },
  }
}

/** Do not expose raw browser/WASM/download details in user-visible errors. */
export function describeAnalysisError(error: unknown): string {
  if (error instanceof VisionModelError) {
    return error.kind === 'timeout'
      ? 'The photo tools took too long to load. Check your connection and try again with the same photo.'
      : 'The photo tools could not load. Check your connection and try again with the same photo.'
  }
  return 'We couldn’t finish analyzing this photo. Please try again. If it still won’t open, choose another photo.'
}
