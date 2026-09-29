import type { ColorMatchResult, ColorPalette } from '../types/colorProfile'
import { hexToRgb } from './colorUtils'
import { rgbToOklab } from './oklab'

/** Compare against the actual selected palette, including a shared palette. */
export function evaluateColorMatch(hex: string, palette: ColorPalette, shared = false): ColorMatchResult {
  const target = rgbToOklab(hexToRgb(hex))
  const candidates = [...palette.best, ...palette.neutrals].map(swatch => {
    const lab = rgbToOklab(hexToRgb(swatch.hex))
    return { swatch, distance: Math.hypot(target.l - lab.l, target.a - lab.a, target.b - lab.b) }
  }).sort((a, b) => a.distance - b.distance)
  const closest = candidates[0]
  if (!closest) return { rating: 'Neutral', explanation: 'There is not enough shared palette evidence to rate this shade. Explore it in try-on.' }
  const rating = closest.distance < 0.04 ? 'Strong match'
    : closest.distance < 0.09 ? 'Likely to work'
      : closest.distance < 0.16 ? 'Neutral' : 'More challenging'
  return {
    rating,
    explanation: `${closest.distance < 0.09 ? 'Close to' : 'A different direction from'} ${closest.swatch.name} in your ${shared ? 'starting colour selection' : 'palette'}. This compares colour similarity; try it on to see how you like the effect.`,
  }
}
