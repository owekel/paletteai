import { edgeToLinear, edgeToSrgb } from './clothingEdgeMatte'

const Y = [0.2126, 0.7152, 0.0722]
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]

/** Appearance only: no writes to coverage, recovered source, or background.
 * Read an immutable dye-colour field, so the polish cannot propagate along
 * the contour or feed back into the next pixel. Work within three PHOTO
 * pixels of the resolved visual edge, not the wider semantic search trimap. */
export function harmonizeGarmentEdge(
  dyed: Float32Array, alpha: Uint8ClampedArray, foreground: Uint8ClampedArray,
  width: number, height: number,
): Map<number, number[]> {
  const corrections = new Map<number, number[]>()
  const linear = (i: number) => [0, 1, 2].map(c => edgeToLinear(dyed[i * 3 + c] / 255))
  const luminance = (rgb: number[]) => rgb.reduce((sum, v, c) => sum + v * Y[c], 0)
  for (let i = 0; i < alpha.length; i++) {
    if (!foreground[i * 4 + 3] || alpha[i] <= 3) continue
    const x = i % width, y = Math.floor(i / width), coverage = alpha[i] / 255
    let edgeDistance = coverage < 0.98 ? 0 : Infinity
    const neighbours: { index: number; distance: number }[] = []
    for (const [dx, dy] of DIRECTIONS) for (let step = 1; step <= 3; step++) {
      const xx = x + dx * step, yy = y + dy * step
      if (xx < 0 || xx >= width || yy < 0 || yy >= height) break
      const j = yy * width + xx, distance = Math.hypot(dx * step, dy * step)
      if (distance > 3) break
      if (alpha[j] < 128) { edgeDistance = Math.min(edgeDistance, distance); break }
      if (alpha[j] >= 250) neighbours.push({ index: j, distance })
    }
    if (edgeDistance > 3 || !neighbours.length) continue
    const rgb = linear(i), localY = luminance(rgb)
    if (localY < 0.001) continue
    const chromaticity = [0, 0, 0]
    let total = 0, nearbyY = 0
    for (const neighbour of neighbours) {
      const sample = linear(neighbour.index), sampleY = luminance(sample)
      if (sampleY < 0.001) continue
      // Bilateral shading guard: real dark collar seams / folds must not be
      // lifted to the adjoining midtone. Only similar-lit fabric contributes.
      const toneDifference = Math.abs(Math.log(sampleY / localY))
      if (toneDifference > 0.3) continue
      const weight = Math.exp(-((toneDifference / 0.14) ** 2)) / neighbour.distance ** 2
      for (let c = 0; c < 3; c++) chromaticity[c] += weight * sample[c] / sampleY
      nearbyY += weight * sampleY; total += weight
    }
    if (total < 0.05) continue
    const taper = (1 - edgeDistance / 4) ** 2
    // Keep opaque pixels' local luminance exactly. At fractional pixels only,
    // weakly regularize amplified unmixing noise; cap the change at 4% of Y.
    const toneBlend = 0.25 * (1 - coverage) * taper
    const deltaY = Math.max(-localY * 0.04, Math.min(localY * 0.04, (nearbyY / total - localY) * toneBlend))
    const polishedY = localY + deltaY
    const chromaBlend = 0.35 * taper
    const result = rgb.map((v, c) => polishedY * (v / localY * (1 - chromaBlend) + chromaticity[c] / total * chromaBlend))
    // No channel clipping: leave a near-gamut-limit highlight untouched.
    if (result.some(v => v < 0 || v > 1)) continue
    const encoded = result.map(v => 255 * edgeToSrgb(v))
    if (encoded.some((v, c) => Math.abs(v - dyed[i * 3 + c]) > 0.05)) corrections.set(i, encoded)
  }
  return corrections
}
