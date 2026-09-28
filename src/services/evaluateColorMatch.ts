// Powers the "Try a Colour" feature: given any hex colour and the user's
// ColorProfile, produce a qualitative (not scientific) match rating.
//
// The scoring is intentionally simple and transparent — three small checks,
// each worth a point or two — rather than a black box, so it's easy for a
// beginner to read, tweak, and reason about.

import type { ColorMatchResult, ColorProfile, MatchRating } from '../types/colorProfile'
import { classifyDepth, classifyTemperature, getLuminance, hexToRgb, rgbToHsl } from './colorUtils'

function scoreUndertone(colorTemperature: ReturnType<typeof classifyTemperature>, profileUndertone: ColorProfile['undertone']): number {
  if (colorTemperature === profileUndertone) return 2
  if (colorTemperature === 'neutral' || profileUndertone === 'neutral') return 1
  return 0 // directly opposite (warm vs cool)
}

function scoreDepth(colorDepth: ReturnType<typeof classifyDepth>, profileDepth: ColorProfile['depth']): number {
  if (colorDepth === profileDepth) return 1
  const order: ColorProfile['depth'][] = ['light', 'medium', 'deep']
  const distance = Math.abs(order.indexOf(colorDepth) - order.indexOf(profileDepth))
  return distance === 1 ? 0.5 : 0
}

function scoreContrast(saturation: number, profileContrast: ColorProfile['contrast']): number {
  // A rough stand-in for "how bold does this colour read": very saturated or
  // very desaturated colours tend to suit higher- or lower-contrast
  // colouring respectively.
  if (profileContrast === 'high') return saturation > 45 ? 1 : 0.5
  if (profileContrast === 'low') return saturation < 45 ? 1 : 0.5
  return saturation >= 25 && saturation <= 70 ? 1 : 0.5
}

function ratingFromScore(score: number): MatchRating {
  if (score >= 3.5) return 'Strong match'
  if (score >= 2.5) return 'Likely to work'
  if (score >= 1.5) return 'Neutral'
  return 'More challenging'
}

function buildExplanation(
  rating: MatchRating,
  colorTemperature: ReturnType<typeof classifyTemperature>,
  profile: ColorProfile,
): string {
  const temperatureNote =
    colorTemperature === profile.undertone
      ? `its warmth leans the same way as your ${profile.undertone} undertone`
      : colorTemperature === 'neutral' || profile.undertone === 'neutral'
        ? `it's close to neutral, so it doesn't fight your undertone`
        : `it leans ${colorTemperature}, which sits opposite your ${profile.undertone} undertone`

  const prefix: Record<MatchRating, string> = {
    'Strong match': 'This looks like a strong match —',
    'Likely to work': 'This is likely to work well —',
    Neutral: "This one's fairly neutral on you —",
    'More challenging': 'This may be a bit more challenging —',
  }

  return `${prefix[rating]} ${temperatureNote}. This is a simplified estimate, not a precise or scientific measurement, so trust your eye alongside it.`
}

export function evaluateColorMatch(hex: string, profile: ColorProfile): ColorMatchResult {
  const rgb = hexToRgb(hex)
  const hsl = rgbToHsl(rgb)
  const luminance = getLuminance(rgb)

  const colorTemperature = classifyTemperature(rgb)
  const colorDepth = classifyDepth(luminance)

  const score =
    scoreUndertone(colorTemperature, profile.undertone) +
    scoreDepth(colorDepth, profile.depth) +
    scoreContrast(hsl.s, profile.contrast)

  const rating = ratingFromScore(score)

  return {
    rating,
    explanation: buildExplanation(rating, colorTemperature, profile),
  }
}
