// Conservative source-hue suppression on the ORIGINAL smooth matte.
// No coverage fitting, propagation, expansion, decontamination reconstruction,
// gamma-space selection or alpha edits. The trimap below is DEBUG ONLY.
import { rgbToHsl, type RGB } from './colorUtils'

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
export interface ClothingBoundaryDiagnostics {
  /** 0 = confident exterior, 128 = uncertain, 255 = confident garment. */
  trimap: Uint8Array
  signedDistance: Float32Array
  /** 0 = unchanged baseline, 1 = selected for local interior tone. */
  selected: Uint8Array
  bandRadius: number
}

/** Two-pass 8-neighbour chamfer distance. No mask morphology or resampling. */
export function garmentTrimap(raw: Uint8ClampedArray, width: number, height: number, bandRadius: number): ClothingBoundaryDiagnostics {
  const length = width * height
  const distance = new Float32Array(length).fill(width + height)
  const garment = (i: number) => raw[i * 4 + 3] > 0
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if ((x && garment(i) !== garment(i - 1)) || (x + 1 < width && garment(i) !== garment(i + 1))
      || (y && garment(i) !== garment(i - width)) || (y + 1 < height && garment(i) !== garment(i + width))) distance[i] = 0.5
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if (x) distance[i] = Math.min(distance[i], distance[i - 1] + 1)
    if (y) {
      distance[i] = Math.min(distance[i], distance[i - width] + 1)
      if (x) distance[i] = Math.min(distance[i], distance[i - width - 1] + Math.SQRT2)
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i - width + 1] + Math.SQRT2)
    }
  }
  for (let y = height - 1; y >= 0; y--) for (let x = width - 1; x >= 0; x--) {
    const i = y * width + x
    if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + 1] + 1)
    if (y + 1 < height) {
      distance[i] = Math.min(distance[i], distance[i + width] + 1)
      if (x) distance[i] = Math.min(distance[i], distance[i + width - 1] + Math.SQRT2)
      if (x + 1 < width) distance[i] = Math.min(distance[i], distance[i + width + 1] + Math.SQRT2)
    }
  }
  const trimap = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    trimap[i] = distance[i] <= bandRadius ? 128 : garment(i) ? 255 : 0
    if (!garment(i)) distance[i] *= -1
  }
  return { trimap, signedDistance: distance, selected: new Uint8Array(length), bandRadius }
}

export const edgeToLinear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
export const edgeToSrgb = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055
const hueDistance = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)]

/** Returns local interior RGB as a tone reference, never an unmixed edge RGB.
 * Only the semantic GARMENT side within 3 photo pixels is eligible. Alpha and
 * exterior buffers are read-only. Ambiguity deliberately keeps the old edge. */
export function sampleGarmentEdgeTone(
  source: Uint8ClampedArray, raw: Uint8ClampedArray, blurred: Uint8ClampedArray,
  alpha: Uint8ClampedArray, background: Uint8ClampedArray,
  width: number, height: number, featherRadius: number,
): Uint8ClampedArray {
  const references = new Uint8ClampedArray(source.length)
  const rgb = (i: number): RGB => ({ r: source[i * 4], g: source[i * 4 + 1], b: source[i * 4 + 2] })
  const garment = (i: number) => raw[i * 4 + 3] > 0
  const reach = Math.min(16, Math.max(6, Math.ceil(featherRadius * 2.5) + 2))
  for (let i = 0; i < alpha.length; i++) {
    if (!garment(i) || alpha[i] <= 3 || !background[i * 4 + 3]) continue
    const x = i % width, y = Math.floor(i / width)
    let edge = false
    for (const [dx, dy] of DIRECTIONS) for (let step = 1; step <= 3; step++) {
      const xx = x + dx * step, yy = y + dy * step
      if (xx < 0 || yy < 0 || xx >= width || yy >= height || Math.hypot(dx * step, dy * step) > 3) break
      if (!garment(yy * width + xx)) { edge = true; break }
    }
    if (!edge) continue
    const samples: RGB[] = []
    for (const [dx, dy] of DIRECTIONS) for (let step = 1; step <= reach; step++) {
      const xx = x + dx * step, yy = y + dy * step
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) break
      const j = yy * width + xx
      if (!garment(j)) break
      if (alpha[j] >= 250 && blurred[j * 4 + 3] >= 250) { samples.push(rgb(j)); break }
    }
    if (samples.length < 3) continue
    const reference = { r: median(samples.map(p => p.r)), g: median(samples.map(p => p.g)), b: median(samples.map(p => p.b)) }
    const f = rgbToHsl(reference), c = rgbToHsl(rgb(i))
    const b = rgbToHsl({ r: background[i * 4], g: background[i * 4 + 1], b: background[i * 4 + 2] })
    // Achromatic dyes, skin-coloured fabric, inconsistent references, and
    // real dark seams do not provide strong source-hue evidence.
    if (Math.max(reference.r, reference.g, reference.b) - Math.min(reference.r, reference.g, reference.b) < 32
      || f.s < 25 || f.l < 8 || f.l > 90 || c.s < f.s * 0.65 || hueDistance(c.h, f.h) > 8
      || c.l < f.l - 15 || (b.s > 15 && hueDistance(b.h, f.h) < 14)
      || samples.some(p => hueDistance(rgbToHsl(p).h, f.h) > 12)) continue
    const k = i * 4
    references[k] = reference.r; references[k + 1] = reference.g; references[k + 2] = reference.b
    references[k + 3] = 1
  }
  return references
}
