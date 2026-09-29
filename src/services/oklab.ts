import type { RGB } from './colorUtils'

export interface OKLab {
  l: number
  a: number
  b: number
}

export interface OKLCH {
  l: number
  c: number
  /** Hue in degrees, or null when chroma is too close to zero for hue to be meaningful. */
  h: number | null
}

export interface LinearRGB {
  r: number
  g: number
  b: number
}

export interface XYZ {
  x: number
  y: number
  z: number
}

function srgbChannelToLinear(channel: number): number {
  const normalized = Math.min(1, Math.max(0, channel / 255))
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

export function rgbToLinearRgb(rgb: RGB): LinearRGB {
  return {
    r: srgbChannelToLinear(rgb.r),
    g: srgbChannelToLinear(rgb.g),
    b: srgbChannelToLinear(rgb.b),
  }
}

export function linearRgbToXyz({ r, g, b }: LinearRGB): XYZ {
  return {
    x: 0.4124564 * r + 0.3575761 * g + 0.1804375 * b,
    y: 0.2126729 * r + 0.7151522 * g + 0.072175 * b,
    z: 0.0193339 * r + 0.119192 * g + 0.9503041 * b,
  }
}

export function rgbToXyz(rgb: RGB): XYZ {
  return linearRgbToXyz(rgbToLinearRgb(rgb))
}

export function xyzToOklab({ x, y, z }: XYZ): OKLab {
  // XYZ D65 -> linear sRGB -> OKLab. Keeping XYZ explicit lets the shadow
  // measurement pipeline insert chromatic adaptation before this conversion.
  const red = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z
  const green = -0.969266 * x + 1.8760108 * y + 0.041556 * z
  const blue = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z

  const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
  const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
  const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue

  const lRoot = Math.cbrt(l)
  const mRoot = Math.cbrt(m)
  const sRoot = Math.cbrt(s)

  return {
    l: 0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
    a: 1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
    b: 0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
  }
}

/**
 * Converts display-encoded sRGB to OKLab. The matrix is the reference
 * linear-sRGB/D65 transform published with OKLab, so L and chroma are much
 * better suited to measurement than RGB/HSL lightness and saturation.
 */
export function rgbToOklab(rgb: RGB): OKLab {
  return xyzToOklab(rgbToXyz(rgb))
}

export function oklabToOklch(lab: OKLab): OKLCH {
  const chroma = Math.hypot(lab.a, lab.b)
  if (chroma < 0.0001) return { l: lab.l, c: chroma, h: null }

  const hueRadians = Math.atan2(lab.b, lab.a)
  const hueDegrees = ((hueRadians * 180) / Math.PI + 360) % 360
  return { l: lab.l, c: chroma, h: hueDegrees }
}

export function rgbToOklch(rgb: RGB): OKLCH {
  return oklabToOklch(rgbToOklab(rgb))
}
