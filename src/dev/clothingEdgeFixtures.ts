import { hslToRgb, hexToRgb, rgbToHsl } from '../services/colorUtils'
import { edgeToLinear, edgeToSrgb } from '../services/clothingEdgeMatte'

export const EDGE_CASES = [
  { name: 'Red → taupe/grey', original: '#BD2834', target: '#9C8C80' },
  { name: 'Red → pale cyan', original: '#BD2834', target: '#B8E5F1' },
  { name: 'Blue → coral', original: '#286EB6', target: '#FF6F59' },
  { name: 'White → black', original: '#EEEEEA', target: '#191B22' },
  { name: 'Black → white', original: '#252831', target: '#F6F1E4' },
  { name: 'Red → deep teal', original: '#BD2834', target: '#1F5C56' },
]

/** Procedural collar/shoulder with known coverage, folds, skin and backdrop.
 * Deliberately coarse/inset category mask. Test data, never a model benchmark. */
export function clothingEdgeFixture(index: number, linear = false, size = 384) {
  const selected = EDGE_CASES[index]
  const hue = rgbToHsl(hexToRgb(selected.original))
  const pixels = new Uint8ClampedArray(size * size * 4)
  const coverage = new Float32Array(size * size)
  const garment = new Uint8ClampedArray(pixels.length)
  const exterior = new Uint8ClampedArray(pixels.length)
  function geometry(x: number, y: number) {
    const collar = (Math.hypot((x - 192) / 62, (y - 109) / 75) - 1) * 62
    const shoulder = y - (135 + Math.abs(x - 192) * 0.14)
    const side = Math.min(x - (38 + (320 - y) * 0.17), (346 - (320 - y) * 0.17) - x)
    return Math.min(collar, shoulder, side)
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const xx = (x + 0.5) * 384 / size, yy = (y + 0.5) * 384 / size
    const distance = geometry(xx, yy) * size / 384
    const a = Math.max(0, Math.min(1, distance + 0.5))
    const fold = 5 * Math.sin(xx * 0.08 + yy * 0.025) + 3 * Math.cos(yy * 0.12)
    const seam = distance > 0 && distance < 2 ? -2 : 0
    const f = hslToRgb({ ...hue, l: Math.max(3, Math.min(97, hue.l + fold + seam)) })
    const skin = Math.hypot((xx - 192) / 64, (yy - 95) / 110) < 1
    const shade = skin ? 1 + 0.015 * Math.sin(yy * 0.035) : 1
    const b = skin ? [202 * shade, 156 * shade, 129 * shade] : [112, 129, 139]
    const fs = [f.r, f.g, f.b]
    const i = y * size + x, k = i * 4
    coverage[i] = a
    for (let channel = 0; channel < 3; channel++) {
      garment[k + channel] = fs[channel]
      exterior[k + channel] = b[channel]
      pixels[k + channel] = linear ? 255 * edgeToSrgb(a * edgeToLinear(fs[channel] / 255) + (1 - a) * edgeToLinear(b[channel] / 255))
        : a * fs[channel] + (1 - a) * b[channel]
    }
    pixels[k + 3] = garment[k + 3] = exterior[k + 3] = 255
  }
  const maskSize = Math.round(size / 4)
  const categories = new Uint8Array(maskSize * maskSize)
  for (let y = 0; y < maskSize; y++) for (let x = 0; x < maskSize; x++) {
    categories[y * maskSize + x] = geometry((x + 0.5) * 384 / maskSize, (y + 0.5) * 384 / maskSize) > 0.8 ? 4 : 0
  }
  return { pixels, coverage, garment, exterior, mask: { categories, width: maskSize, height: maskSize }, width: size, height: size }
}
