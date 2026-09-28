// Small, dependency-free colour-math helpers.
//
// Nothing in this file knows about faces or photos — it just converts
// between colour formats and does simple classification math. That's what
// makes it reusable by both the (mock) image analyzer and the "Try a
// Colour" feature, which both need to answer "is this warm or cool?" /
// "is this light or dark?" for an RGB colour.

import type { Contrast, Depth, Undertone } from '../types/colorProfile'

export interface RGB {
  r: number
  g: number
  b: number
}

export interface HSL {
  h: number // 0-360
  s: number // 0-100
  l: number // 0-100
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function rgbToHex({ r, g, b }: RGB): string {
  const toHex = (channel: number) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
}

export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '').trim()
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized

  const value = parseInt(full, 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

export function isValidHex(hex: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(hex.trim())
}

// Perceived brightness on a 0-255 scale. Human eyes are far more sensitive
// to green than to blue, hence the uneven weights (the standard "luma" formula).
export function getLuminance({ r, g, b }: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function rgbToHsl({ r, g, b }: RGB): HSL {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255

  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const delta = max - min

  let h = 0
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6
    else if (max === gn) h = (bn - rn) / delta + 2
    else h = (rn - gn) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }

  const l = (max + min) / 2
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1))

  return { h, s: s * 100, l: l * 100 }
}

// The inverse of rgbToHsl above — used by the colour try-on feature to
// rebuild a pixel after swapping its hue/saturation but keeping its
// original lightness (see services/clothingRecolor.ts).
export function hslToRgb({ h, s, l }: HSL): RGB {
  const sn = s / 100
  const ln = l / 100

  const c = (1 - Math.abs(2 * ln - 1)) * sn
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))
  const m = ln - c / 2

  let rp = 0
  let gp = 0
  let bp = 0
  if (hp >= 0 && hp < 1) [rp, gp, bp] = [c, x, 0]
  else if (hp >= 1 && hp < 2) [rp, gp, bp] = [x, c, 0]
  else if (hp >= 2 && hp < 3) [rp, gp, bp] = [0, c, x]
  else if (hp >= 3 && hp < 4) [rp, gp, bp] = [0, x, c]
  else if (hp >= 4 && hp < 5) [rp, gp, bp] = [x, 0, c]
  else if (hp >= 5 && hp < 6) [rp, gp, bp] = [c, 0, x]

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  }
}

export function colorDistance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
}

// Finds the closest named colour in a small reference table by straight-line
// distance in RGB space. This is a deliberately simple technique (nearest
// neighbour) — good enough to put a friendly name on a sampled colour
// without needing a real colour-naming model.
export function nearestNamedColor<T extends { name: string; rgb: RGB }>(sample: RGB, table: T[]): T {
  let closest = table[0]
  let closestDistance = Infinity

  for (const entry of table) {
    const distance = colorDistance(sample, entry.rgb)
    if (distance < closestDistance) {
      closestDistance = distance
      closest = entry
    }
  }

  return closest
}

// A colour's "temperature" — is it leaning golden/red (warm) or blue/pink
// (cool)? This is the same simplified heuristic used both for reading a
// person's skin undertone and for judging how warm or cool a candidate
// garment colour is: compare red+green (the "warm" channels) against blue.
export function classifyTemperature(rgb: RGB): Undertone {
  const warmthScore = (rgb.r + rgb.g) / 2 - rgb.b
  if (warmthScore > 12) return 'warm'
  if (warmthScore < -12) return 'cool'
  return 'neutral'
}

export function classifyDepth(luminance: number): Depth {
  if (luminance > 175) return 'light'
  if (luminance > 115) return 'medium'
  return 'deep'
}

export function classifyContrastFromDifference(luminanceDifference: number): Contrast {
  const diff = Math.abs(luminanceDifference)
  if (diff > 90) return 'high'
  if (diff > 40) return 'medium'
  return 'low'
}
