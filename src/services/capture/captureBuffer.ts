import { CAPTURE_CONFIG as C } from '../../data/captureConfig'
import type { CaptureFrame, CaptureSelection } from '../../types/capture'

export class CaptureBuffer {
  private frames: CaptureFrame[] = []
  clear() { this.frames = [] }
  push(frame: CaptureFrame) {
    if (frame.quality.blocker) return
    this.frames = [...this.frames.filter(f => f.timestamp >= frame.timestamp - C.bufferMaxAgeMs && f.id !== frame.id), frame].slice(-C.bufferFrames)
    while (this.frames.reduce((sum, f) => sum + f.image.length, 0) > C.bufferMaxCharacters) this.frames.shift()
  }
  summary() { return this.frames.map(({ id, timestamp, quality }) => ({ id, timestamp, score: quality.score, subscores: quality.subscores })) }
  best(now: number): { frame: CaptureFrame; selection: CaptureSelection } | null {
    this.frames = this.frames.filter(f => now - f.timestamp <= C.bufferMaxAgeMs && now >= f.timestamp)
    const frame = [...this.frames].sort((a, b) => b.quality.score - a.quality.score || b.timestamp - a.timestamp)[0]
    return frame ? { frame, selection: { method: 'auto', selectedId: frame.id, quality: frame.quality, frames: this.summary(),
      reason: 'Highest weighted photo-quality score in the current uninterrupted stable window; newest frame breaks a tie.' } } : null
  }
}
