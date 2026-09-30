// Boundary matting, separate from semantic segmentation and fabric tone
// mapping. A signed-distance trimap limits the *search*, not the coverage.
// Coverage comes from local foreground/background colour evidence, never a
// dilation or blur. Confident exterior pixels are passed through unchanged.

const BAND = 3
const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1],
  [2, 1], [-2, 1], [2, -1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]]
type Colour = [number, number, number]
type Endpoint = { rgb: Colour; x: number; y: number; distance: number }
type Matte = { coverage: number; foreground: Colour; background: Colour; space: 1 | 2; error: number }
export interface ClothingBoundaryDiagnostics {
  /** 0 = confident exterior, 128 = uncertain, 255 = confident garment. */
  trimap: Uint8Array
  signedDistance: Float32Array
  /** 0 = not selected, 1 = recovered garment, 2 = fractional mixed pixel. */
  selected: Uint8Array
  /** 1 = exterior match, 2 = missing references, 3 = ambiguous fit, 4 = disconnected. */
  rejected: Uint8Array
  bandRadius: number
  references?: Record<number, { foreground?: Colour[]; background?: Colour[]; fHue?: number; bHue?: number; saturation?: number; fSaturation?: number }>
}
export interface BoundaryOptions { bandRadius?: number; diagnostics?: ClothingBoundaryDiagnostics }

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
  return { trimap, signedDistance: distance, selected: new Uint8Array(length), rejected: new Uint8Array(length), bandRadius }
}
const dot = (a: Colour, b: Colour) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const difference = (a: Colour, b: Colour): Colour => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const distance = (a: Colour, b: Colour) => Math.hypot(...difference(a, b))
const hueError = (a: Colour, b: Colour) => {
  const scale = dot(a, b) / Math.max(1, dot(b, b))
  return Math.hypot(a[0] - b[0] * scale, a[1] - b[1] * scale, a[2] - b[2] * scale) / Math.max(1, Math.hypot(...a))
}
const chromatic = (v: Colour): Colour => {
  const neutral = Math.min(...v)
  return [v[0] - neutral, v[1] - neutral, v[2] - neutral]
}
const chromaticHueError = (a: Colour, b: Colour) => hueError(chromatic(a), chromatic(b))
const saturation = (v: Colour) => (Math.max(...v) - Math.min(...v)) / Math.max(1, Math.max(...v))
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
    if (coverage < 0.04 || coverage > 1.02 || scale < 0.25 || scale > (garmentSide ? 2 : 1.5)) return
    coverage = clamp(coverage)
    const shadedF = f.map(v => v * scale) as Colour
    if (shadedF.some(v => v < 0 || v > 1)) return
    const reconstructed = shadedF.map((v, k) => 255 * encode(coverage * v + (1 - coverage) * b[k])) as Colour
    const residual = distance(source, reconstructed)
    if (residual > (garmentSide ? 10 : 7)) return
    // Unmix before measuring tone. Any fit residual belongs in this recovered
    // garment estimate, NOT in the final RGB composite (where it kept red).
    const recovered = c.map((v, k) => clamp((v - (1 - coverage) * b[k]) / coverage)) as Colour
    fits.push({ coverage, foreground: recovered.map(v => 255 * encode(v)) as Colour, background,
      space, error: residual + (Math.abs(scale - 1) > 0.01 ? 1 : 0) + 8 * Math.abs(Math.log(Math.max(0.01, scale))) })
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
  // A local highlight can add a neutral component, not merely multiply RGB.
  // Fit C-B = a(F-B) + t(1,1,1), with a tightly bounded fabric tone offset.
  // Unlike free three-channel fitting this still requires the garment's hue.
  const sumD = d[0] + d[1] + d[2]
  const determinantTone = 3 * denominator - sumD * sumD
  if (determinantTone > 0.003) {
    const relative = difference(c, b), sumC = relative[0] + relative[1] + relative[2]
    const a = (3 * dot(relative, d) - sumC * sumD) / determinantTone
    const tone = (sumC - a * sumD) / 3 / Math.max(0.04, a)
    if (a >= 0.04 && a <= 1.02 && Math.abs(tone) < 0.18) {
      const shaded = f.map(v => v + tone) as Colour
      if (shaded.every(v => v >= 0 && v <= 1)) {
        const coverage = clamp(a)
        const reconstructed = shaded.map((v, k) => 255 * encode(coverage * v + (1 - coverage) * b[k])) as Colour
        const residual = distance(source, reconstructed)
        if (residual <= (garmentSide ? 10 : 7)) {
          const recovered = c.map((v, k) => clamp((v - (1 - coverage) * b[k]) / coverage)) as Colour
          fits.push({ coverage, foreground: recovered.map(v => 255 * encode(v)) as Colour, background, space,
            error: residual + 2 + 30 * Math.abs(tone) })
        }
      }
    }
  }
  // Clipped bright fabric/JPEG chroma interpolation need not lie exactly on
  // a two-colour line. Project coverage, enforce the minimum physically valid
  // coverage (so unmixing stays in gamut), then validate recovered garment
  // chromaticity. This is a colour-prior fallback, not an opacity boost.
  if (Math.hypot(...chromatic(foreground)) > 25
    && chromaticHueError(source, foreground) < 0.15
    && chromaticHueError(source, background) > 0.18) {
    let coverage = clamp(dot(difference(c, b), d) / denominator)
    for (let k = 0; k < 3; k++) {
      const minimum = c[k] >= b[k] ? (c[k] - b[k]) / Math.max(1e-6, 1 - b[k]) : (b[k] - c[k]) / Math.max(1e-6, b[k])
      coverage = Math.max(coverage, minimum)
    }
    if (coverage > 0.08) {
      const recovered = c.map((v, k) => clamp((v - (1 - coverage) * b[k]) / coverage)) as Colour
      const recoveredRgb = recovered.map(v => 255 * encode(v)) as Colour
      if (chromaticHueError(recoveredRgb, foreground) < 0.13
        && Math.hypot(...chromatic(recoveredRgb)) >= Math.hypot(...chromatic(foreground)) * 0.5) {
        fits.push({ coverage, foreground: recoveredRgb, background, space, error: 12 })
      }
    }
  }
  return fits
}

/** Mutates only the trimap band's coverage/background; returns its foreground
 * component and blend-space tag (1 = encoded RGB, 2 = linear RGB). Zero tags
 * leave the existing matting/compositing path intact. */
export function refineGarmentEdge(
  source: Uint8ClampedArray, raw: Uint8ClampedArray, blurred: Uint8ClampedArray,
  alpha: Uint8ClampedArray, background: Uint8ClampedArray,
  width: number, height: number, featherRadius: number,
  options: BoundaryOptions = {},
): Uint8ClampedArray {
  const foreground = new Uint8ClampedArray(source.length)
  const bandRadius = options.bandRadius ?? BAND
  const diagnostics = options.diagnostics ?? garmentTrimap(raw, width, height, bandRadius)
  const { trimap, signedDistance, selected, rejected } = diagnostics
  const isGarment = (i: number) => raw[i * 4 + 3] > 0
  const rgb = (i: number): Colour => [source[i * 4], source[i * 4 + 1], source[i * 4 + 2]]
  // Reach clean samples beyond the inference uncertainty/old blur. Reference
  // reach does not grant permission to edit beyond the bounded trimap.
  const searchRadius = Math.min(64, Math.max(8, Math.ceil(featherRadius * 2.5), bandRadius * 3))
  const outside: { index: number; matte: Matte }[] = []
  const mixedSteps = new Uint8Array(width * height)
  function write(i: number, matte: Matte) {
    alpha[i] = Math.round(matte.coverage * 255)
    const k = i * 4
    for (let channel = 0; channel < 3; channel++) {
      foreground[k + channel] = matte.foreground[channel]
      background[k + channel] = matte.background[channel]
    }
    foreground[k + 3] = matte.space
    background[k + 3] = 255
    selected[i] = matte.coverage < 0.98 ? 2 : 1
    rejected[i] = 0
  }
  for (let i = 0; i < trimap.length; i++) {
    if (trimap[i] !== 128) continue
    const x = i % width, y = Math.floor(i / width)
    const foregroundCandidates: Endpoint[] = [], backgroundCandidates: Endpoint[] = []
    const seen = new Set<number>()
    for (const [dx, dy] of DIRECTIONS) {
      const norm = Math.hypot(dx, dy)
      let backgroundSamples = 0
      for (let radius = 1; radius <= searchRadius; radius++) {
        const xx = x + Math.round(dx * radius / norm), yy = y + Math.round(dy * radius / norm)
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) break
        const j = yy * width + xx
        const blur = blurred[j * 4 + 3] / 255
        if ((signedDistance[j] > Math.max(2, bandRadius * 0.65) && blur >= 0.98)
          || (signedDistance[j] < -Math.max(2, bandRadius * 0.4) && blur <= 0.02)) {
          if (!seen.has(j)) {
            seen.add(j)
            const endpoint = { rgb: rgb(j), x: xx - x, y: yy - y, distance: Math.hypot(xx - x, yy - y) }
            const endpoints = isGarment(j) ? foregroundCandidates : backgroundCandidates
            endpoints.push(endpoint)
          }
          if (isGarment(j)) break
          // The categorical edge can be inset: the first "outside" sample
          // may still be red fabric. Continue past it to find true skin/scene.
          if (++backgroundSamples >= 4) break
          radius += 2
        }
      }
    }
    const f = foregroundCandidates.sort((a, b) => a.distance - b.distance).slice(0, 6)
    const fChroma = f.map(e => ({ rgb: e.rgb, colour: chromatic(e.rgb) })).filter(e => Math.hypot(...e.colour) > 18)
    const exteriorEvidence = backgroundCandidates.map(e => {
      const c = chromatic(e.rgb)
      const matching = Math.hypot(...c) > 12 ? fChroma.filter(fg => hueError(c, fg.colour) < 0.22) : []
      return { endpoint: e, matching, stronglyGarment: matching.some(fg => saturation(e.rgb) >= saturation(fg.rgb) * 0.55) }
    })
    // A low-saturation garment-hued reference can itself be a mixed pixel.
    // Reject those outliers only when >60% of local exterior references have
    // distinctly non-garment hues. If an entire blue-grey wall shares blue
    // fabric's hue, it remains a valid exterior rather than being discarded.
    const clearExterior = exteriorEvidence.filter(e => !e.matching.length).length > exteriorEvidence.length * 0.6
    const b = exteriorEvidence.filter(e => !e.stronglyGarment && (!clearExterior || !e.matching.length)).map(e => e.endpoint)
      .sort((a, b) => a.distance - b.distance).slice(0, 6)
    const referenceDebug = diagnostics.references?.[i]
    if (referenceDebug) { referenceDebug.foreground = f.map(e => e.rgb); referenceDebug.background = b.map(e => e.rgb) }
    // Outside the semantic mask, no colour/ownership evidence means no edit.
    // Do not inherit the older square-average matte's exterior decisions.
    if (!isGarment(i)) { alpha[i] = 0; background[i * 4 + 3] = 0 }
    if (!f.length || !b.length) { rejected[i] = 2; continue }
    const c = rgb(i)
    const nearestBackground = Math.min(...b.map(e => distance(c, e.rgb)))
    const backgroundHueError = Math.min(...b.map(e => hueError(c, e.rgb)))
    const linearSource = c.map(v => 255 * edgeToLinear(v / 255)) as Colour
    const linearBackgroundHueError = Math.min(...b.map(e => hueError(linearSource, e.rgb.map(v => 255 * edgeToLinear(v / 255)) as Colour)))
    const foregroundHueError = Math.min(...f.map(e => hueError(c, e.rgb)))
    const chromaticGarment = f.some(e => Math.hypot(...chromatic(e.rgb)) > 40)
    // A genuine background/neck pixel passes through byte-for-byte, including
    // model-labelled garment pixels whose source actually matches the exterior.
    if ((nearestBackground <= 2 && Math.min(...f.map(e => distance(c, e.rgb))) > 12)
      || (backgroundHueError < (chromaticGarment ? 0.02 : 0.006)
        && linearBackgroundHueError < (chromaticGarment ? 0.035 : 0.008)
        && foregroundHueError > Math.max(0.08, 4 * backgroundHueError))) {
      alpha[i] = 0
      background[i * 4 + 3] = 0
      rejected[i] = 1
      continue
    }
    let best: Matte | undefined
    let bestError = Infinity
    // Hue direction after removing the neutral component is invariant to
    // shading AND an additive highlight. It recovers a dark red collar seam
    // without treating orange/pink skin as red fabric. Neutral fabric still
    // uses the mixture fits below, not this chromatic shortcut.
    const chromaC = chromatic(c)
    const hueDirectionError = (v: Colour) => hueError(chromaC, chromatic(v))
    const fHue = Math.min(...f.map(e => hueDirectionError(e.rgb)))
    const bHue = Math.min(...b.map(e => hueDirectionError(e.rgb)))
    const fSaturation = f.reduce((sum, e) => sum + saturation(e.rgb), 0) / f.length
    if (referenceDebug) Object.assign(referenceDebug, { fHue, bHue, saturation: saturation(c), fSaturation })
    const exteriorSaturation = Math.max(...b.map(e => saturation(e.rgb)))
    const neutralLevel = f.reduce((sum, e) => sum + Math.min(...e.rgb), 0) / f.length
    if (Math.hypot(...chromaC) > 12 && saturation(c) >= fSaturation * 0.85 && Math.min(...c) <= neutralLevel + 2
      && fHue < 0.1 && (bHue > Math.max(0.1, fHue * 3) || saturation(c) > exteriorSaturation + 0.15)) {
      best = { coverage: 1, foreground: c, background: b[0].rgb, space: 1, error: 0 }
      bestError = 0
    }
    fitCandidates: if (!best) for (const garment of f) for (const exterior of b) {
      // Prefer endpoints on opposite sides of this particular boundary.
      if ((garment.x * exterior.x + garment.y * exterior.y) / (garment.distance * exterior.distance) > 0.25) continue
      if (distance(garment.rgb, exterior.rgb) < 25) continue
      let nearExact = false
      for (const space of [1, 2] as const) for (const matte of fit(c, garment.rgb, exterior.rgb, space, isGarment(i))) {
        const error = matte.error + 0.12 * (garment.distance + exterior.distance)
        if (error < bestError) { best = matte; bestError = error }
        if (matte.error < 0.8) nearExact = true
      }
      if (nearExact) break fitCandidates // compare BOTH blend spaces before stopping
    }
    if (!best) { rejected[i] = 3; continue } // ambiguous: do not force a new matte
    if (isGarment(i)) write(i, best)
    else if (nearestBackground > 4) { outside.push({ index: i, matte: best }); rejected[i] = 4 }
  }
  // Recovery outside an inset semantic edge requires both strong colour evidence
  // and connection to a confirmed garment pixel. Never dilate the whole mask.
  for (let pass = 0; pass <= Math.ceil(bandRadius); pass++) {
    const accepted: typeof outside = []
    for (const candidate of outside) {
      const i = candidate.index
      if (foreground[i * 4 + 3]) continue
      const x = i % width, y = Math.floor(i / width)
      let connected = false
      let steps = 0
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++)
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const j = yy * width + xx
          if (foreground[j * 4 + 3] || trimap[j] === 255) {
            if (alpha[j] >= 128) { connected = true; steps = 0 }
            // JPEG/anti-alias coverage can taper through more than one pixel.
            // Continue at most two low-coverage steps, only while coverage
            // decreases outwards. This is not unrestricted mask propagation.
            else if (!connected && alpha[j] >= Math.round(candidate.matte.coverage * 255)
              && signedDistance[j] >= signedDistance[i] && mixedSteps[j] < 2) {
              connected = true; steps = mixedSteps[j] + 1
            }
          }
        }
      if (connected) { accepted.push(candidate); mixedSteps[i] = steps }
    }
    for (const candidate of accepted) write(candidate.index, candidate.matte)
  }
  // Guided local reconstruction for isolated ambiguous seam/JPEG pixels.
  // Far-interior references can miss a very dark seam's colour. Use ONLY
  // already-resolved, nearly opaque garment components within 3 photo pixels,
  // with their untinted exterior reference. No morphological filling: each
  // remaining pixel must independently fit that local colour model.
  for (let pass = 0; pass < 2; pass++) {
    const recovered: { index: number; matte: Matte }[] = []
    for (let i = 0; i < trimap.length; i++) {
      if (trimap[i] !== 128 || (rejected[i] !== 3 && rejected[i] !== 4) || foreground[i * 4 + 3]) continue
      const x = i % width, y = Math.floor(i / width), c = rgb(i)
      let best: Matte | undefined, bestError = Infinity
      for (let radius = 1; radius <= 3 && !best; radius++) {
        for (const [dx, dy] of DIRECTIONS.slice(0, 8)) {
          const xx = x + dx * radius, yy = y + dy * radius
          if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue
          const j = yy * width + xx, k = j * 4
          if (!foreground[k + 3] || alpha[j] < 230) continue
          const f: Colour = [foreground[k], foreground[k + 1], foreground[k + 2]]
          const b: Colour = [background[k], background[k + 1], background[k + 2]]
          if (distance(f, b) < 25 || distance(c, b) < 4
            || (hueError(c, b) < 0.02 && hueError(c, f) > 0.08)) continue
          for (const space of [1, 2] as const) for (const matte of fit(c, f, b, space, isGarment(i))) {
            if (matte.error < bestError) { best = matte; bestError = matte.error }
          }
        }
      }
      if (best) recovered.push({ index: i, matte: best })
    }
    for (const candidate of recovered) write(candidate.index, candidate.matte)
  }
  return foreground
}

/** Composite a NEW garment component over the unchanged local exterior.
 * Never add a delta to the original mixed RGB: that preserves coloured fit
 * residuals/JPEG ringing. Local tone has already been recovered before dyeing. */
export function replaceEdgeGarment(background: number, targetGarment: number, coverage: number, space: number): number {
  if (space === 2) return 255 * edgeToSrgb(clamp((1 - coverage) * edgeToLinear(background / 255)
    + coverage * edgeToLinear(targetGarment / 255)))
  return (1 - coverage) * background + coverage * targetGarment
}
