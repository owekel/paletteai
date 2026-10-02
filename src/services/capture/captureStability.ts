import { CAPTURE_CONFIG as C } from '../../data/captureConfig'
import type { CaptureIssue } from '../../types/capture'

/** Display debounce never delays cancellation of the actual capture window. */
export class CaptureStability {
  private started: number | null = null
  private count = 0
  private last: number | null = null
  private shown: CaptureIssue | 'ready' = 'no-face'
  private pending: CaptureIssue | 'ready' = 'no-face'
  private pendingSince = 0
  reset() { this.started = null; this.count = 0; this.last = null }
  update(blocker: CaptureIssue | null, now: number) {
    const gap = this.last !== null && (now - this.last > C.maximumSampleGapMs || now <= this.last)
    if (blocker || gap) { this.started = null; this.count = 0 }
    this.last = now
    if (!blocker) { this.started ??= now; this.count++ }
    const next = blocker ?? 'ready'
    if (next !== this.pending) { this.pending = next; this.pendingSince = now }
    if (now - this.pendingSince >= C.messageDebounceMs) this.shown = next
    const progress = this.started === null ? 0 : Math.min(1, (now - this.started) / C.stabilityMs)
    return { guidance: this.shown, progress, stableFrames: this.count,
      ready: !blocker && progress >= 1 && this.count >= C.minimumStableFrames,
      holding: !blocker && this.count >= 2,
      resetBuffer: !!blocker || gap,
    }
  }
}
