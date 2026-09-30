// A narrow colour-matting repair, separate from semantic segmentation and
// fabric tone mapping. Only pixels within three photo pixels of the raw edge
// can change. Interior/exterior colours are sampled farther away, never blurred
// or copied over the neighbouring skin/background.

const BAND = 3
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 1], [-2, 1], [2, -1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]]
type Colour = [number, number, number]
type Endpoint = { rgb: Colour; x: number; y: number; distance: number }
type Matte = { coverage: number; foreground: Colour; background: Colour; space: 1 | 2; error: number }
const dot = (a: Colour, b: Colour) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const difference = (a: Colour, b: Colour): Colour => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const distance = (a: Colour, b: Colour) => Math.hypot(...difference(a, b))
const hueError = (a: Colour, b: Colour) => {
  const scale = dot(a, b) / Math.max(1, dot(b, b))
  return distance(a, b.map(v => v * scale) as Colour) / Math.max(1, Math.hypot(...a))
}
const clamp = (v: number) => Math.max(0, Math.min(1, v))
export const edgeToLinear = (v: number) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
export const edgeToSrgb = (v: number) => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055

function fit(source: Colour, foreground: Colour, background: Colour, space: 1 | 2, garmentSide: boolean): Matte[] {
  const decode = space === 2 ? edgeToLinear : (v: number) => v
  const encode = space === 2 ? edgeToSrgb : (v: number) => v
  const c = source.map(v => decode(v / 255)) as Colour
  const f = foreground.map(v => decode(v / 255)) as Colour
  const b = background.map(v => decode(v / 255)) as Colour
  const d = difference(f, b)
  const denominator = dot(d, d)
  if (denominator < 0.004) return []
  const fits: Matte[] = []
  const add = (coverage: number, scale: number) => {
    if (coverage < 0.08 || coverage > 1.02 || scale < (garmentSide ? 0.72 : 0.9) || scale > (garmentSide ? 1.28 : 1.1)) return
    coverage = clamp(coverage)
    const shadedF = f.map(v => v * scale) as Colour
    if (shadedF.some(v => v < 0 || v > 1)) return
    const reconstructed = shadedF.map((v, k) => 255 * encode(coverage * v + (1 - coverage) * b[k])) as Colour
    const residual = distance(source, reconstructed)
    if (residual > (garmentSide ? 12 : 6)) return
    fits.push({ coverage, foreground: shadedF.map(v => 255 * encode(v)) as Colour, background,
      space, error: residual + 0.5 * Math.abs(scale - 1) })
  }
  add(clamp(dot(difference(c, b), d) / denominator), 1)
  const ff = dot(f, f), bb = dot(b, b), fb = dot(f, b)
  const cc = dot(c, c)
  const scale = ff > 1e-8 ? dot(c, f) / ff : 0
  const foregroundHueError = cc > 1e-8 ? Math.hypot(...difference(c, f.map(v => v * scale) as Colour)) / Math.sqrt(cc) : 1
  const backgroundScale = bb > 1e-8 ? dot(c, b) / bb : 0
  const backgroundHueError = cc > 1e-8 ? Math.hypot(...difference(c, b.map(v => v * backgroundScale) as Colour)) / Math.sqrt(cc) : 0
  // A pure fabric pixel can be lighter/darker than the sampled interior.
  // In particular white folds must not be mistaken for partial transparency.
  // Require near-identical chromaticity and clear separation from the exterior;
  // a skin-only highlight/shadow fails this foreground-side test.
  const quantizedHueTolerance = 0.004 + 0.7 / Math.max(1, 255 * Math.sqrt(cc))
  if (scale >= (garmentSide ? 0.35 : 0.6) && scale <= (garmentSide ? 2 : 1.6)
    && foregroundHueError < quantizedHueTolerance && backgroundHueError > Math.max(0.02, 3 * foregroundHueError)) {
    fits.push({ coverage: 1, foreground: source, background, space, error: 0.1 })
  }
  // C = qF + bB; coverage = 1-b, local fabric shading = q/coverage.
  // This second fit tolerates a fold that differs in brightness from the
  // nearby fabric sample. It cannot explain a skin-only shadow as garment:
  // that would require zero fabric reflectance, outside the permitted range.
  const determinant = ff * bb - fb * fb
  if (determinant > ff * bb * 0.003 && determinant > 1e-8) {
    const cf = dot(c, f), cb = dot(c, b)
    const q = (cf * bb - cb * fb) / determinant
    const coverage = 1 - (cb * ff - cf * fb) / determinant
    if (coverage > 0.08) add(coverage, q / coverage)
  }
  return fits
}

/** Mutates only the narrow band's coverage/background; returns its foreground
 * component and blend-space tag (1 = encoded RGB, 2 = linear RGB). Zero tags
 * leave the existing matting/compositing path intact. */
export function refineGarmentEdge(
  source: Uint8ClampedArray, raw: Uint8ClampedArray, blurred: Uint8ClampedArray,
  alpha: Uint8ClampedArray, background: Uint8ClampedArray,
  width: number, height: number, featherRadius: number,
): Uint8ClampedArray {
  const foreground = new Uint8ClampedArray(source.length)
  const band = new Uint8Array(width * height)
  const isGarment = (i: number) => raw[i * 4 + 3] > 0
  const rgb = (i: number): Colour => [source[i * 4], source[i * 4 + 1], source[i * 4 + 2]]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x
    if ((x + 1 < width && isGarment(i) !== isGarment(i + 1)) || (y + 1 < height && isGarment(i) !== isGarment(i + width))) {
      for (let yy = Math.max(0, y - BAND); yy <= Math.min(height - 1, y + BAND); yy++)
        for (let xx = Math.max(0, x - BAND); xx <= Math.min(width - 1, x + BAND); xx++) band[yy * width + xx] = 1
    }
  }
  // Full-resolution photos have a larger existing blur. Reach clean samples
  // beyond it while retaining the same three-pixel *edited* band.
  const searchRadius = Math.min(64, Math.max(8, Math.ceil(featherRadius * 2.5)))
  const outside: { index: number; matte: Matte }[] = []
  function write(i: number, matte: Matte) {
    alpha[i] = Math.round(matte.coverage * 255)
    const k = i * 4
    for (let channel = 0; channel < 3; channel++) {
      foreground[k + channel] = matte.foreground[channel]
      background[k + channel] = matte.background[channel]
    }
    foreground[k + 3] = matte.space
    background[k + 3] = 255
  }
  for (let i = 0; i < band.length; i++) {
    if (!band[i]) continue
    const x = i % width, y = Math.floor(i / width)
    const f: Endpoint[] = [], b: Endpoint[] = []
    const seen = new Set<number>()
    for (const [dx, dy] of DIRECTIONS) {
      const norm = Math.hypot(dx, dy)
      for (let radius = 1; radius <= searchRadius; radius++) {
        const xx = x + Math.round(dx * radius / norm), yy = y + Math.round(dy * radius / norm)
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) break
        const j = yy * width + xx
        const blur = blurred[j * 4 + 3] / 255
        if ((isGarment(j) && blur >= 0.98) || (!isGarment(j) && blur <= 0.02)) {
          if (!seen.has(j)) {
            seen.add(j)
            const endpoint = { rgb: rgb(j), x: xx - x, y: yy - y, distance: Math.hypot(xx - x, yy - y) }
            const endpoints = isGarment(j) ? f : b
            endpoints.push(endpoint)
          }
          break
        }
      }
    }
    if (!f.length || !b.length) continue
    const c = rgb(i)
    const nearestBackground = Math.min(...b.map(e => distance(c, e.rgb)))
    const backgroundHueError = Math.min(...b.map(e => hueError(c, e.rgb)))
    const linearSource = c.map(v => 255 * edgeToLinear(v / 255)) as Colour
    const linearBackgroundHueError = Math.min(...b.map(e => hueError(linearSource, e.rgb.map(v => 255 * edgeToLinear(v / 255)) as Colour)))
    const foregroundHueError = Math.min(...f.map(e => hueError(c, e.rgb)))
    // A genuine background/neck pixel passes through byte-for-byte, including
    // model-labelled garment pixels whose source actually matches the exterior.
    if ((nearestBackground <= 2 && Math.min(...f.map(e => distance(c, e.rgb))) > 12)
      || (backgroundHueError < 0.006 && linearBackgroundHueError < 0.008 && foregroundHueError > Math.max(0.02, 3 * backgroundHueError))) {
      alpha[i] = 0
      background[i * 4 + 3] = 0
      continue
    }
    let best: Matte | undefined
    let bestError = Infinity
    for (const garment of f) for (const exterior of b) {
      // Prefer endpoints on opposite sides of this particular boundary.
      if ((garment.x * exterior.x + garment.y * exterior.y) / (garment.distance * exterior.distance) > 0.25) continue
      if (distance(garment.rgb, exterior.rgb) < 25) continue
      for (const space of [1, 2] as const) for (const matte of fit(c, garment.rgb, exterior.rgb, space, isGarment(i))) {
        const error = matte.error + 0.3 * (garment.distance + exterior.distance)
        if (error < bestError) { best = matte; bestError = error }
      }
    }
    if (!best) continue // ambiguous hair/skin/texture: retain the original mask
    if (isGarment(i)) write(i, best)
    else if (nearestBackground > 4) outside.push({ index: i, matte: best })
  }
  // Recovery outside an inset semantic edge requires both strong colour evidence
  // and connection to a confirmed garment pixel. Never dilate the whole mask.
  for (let pass = 0; pass < BAND; pass++) {
    const accepted: typeof outside = []
    for (const candidate of outside) {
      const i = candidate.index
      if (foreground[i * 4 + 3]) continue
      const x = i % width, y = Math.floor(i / width)
      let connected = false
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++)
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const j = yy * width + xx
          if (foreground[j * 4 + 3] && alpha[j] >= 153) connected = true
        }
      if (connected) accepted.push(candidate)
    }
    for (const candidate of accepted) write(candidate.index, candidate.matte)
  }
  return foreground
}

/** Replace only the foreground component, retaining the original residual and
 * exterior contribution. Pure outside pixels never enter this function. */
export function replaceEdgeGarment(source: number, originalGarment: number, targetGarment: number, coverage: number, space: number): number {
  if (space === 2) return 255 * edgeToSrgb(clamp(edgeToLinear(source / 255) + coverage *
    (edgeToLinear(targetGarment / 255) - edgeToLinear(originalGarment / 255))))
  return source + coverage * (targetGarment - originalGarment)
}
