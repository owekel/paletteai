import type { HairMask } from './hairSegmentation'

/** All non-background labels (including bare body/face skin and "other")
 * are foreground. The reference-only guard also excludes resampling mixtures
 * near that foreground. It does NOT modify any segmentation or try-on mask. */
export function isSafeBackgroundReference(mask: HairMask, x: number, y: number, sampleWidth: number, sampleHeight: number): boolean {
  const cx = Math.min(mask.width - 1, Math.floor(x * mask.width)), cy = Math.min(mask.height - 1, Math.floor(y * mask.height))
  const rx = Math.max(2, Math.ceil(mask.width / sampleWidth)), ry = Math.max(2, Math.ceil(mask.height / sampleHeight))
  for (let yy = Math.max(0, cy - ry); yy <= Math.min(mask.height - 1, cy + ry); yy++) {
    for (let xx = Math.max(0, cx - rx); xx <= Math.min(mask.width - 1, cx + rx); xx++) {
      if (mask.categories[yy * mask.width + xx] !== 0) return false
    }
  }
  return true
}
