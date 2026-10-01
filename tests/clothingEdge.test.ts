import assert from 'node:assert/strict'
import { garmentTrimap, refineGarmentEdge, replaceEdgeGarment, edgeToLinear, edgeToSrgb } from '../src/services/clothingEdgeMatte'
import { hexToRgb } from '../src/services/colorUtils'
import { clothingEdgeFixture, EDGE_CASES } from '../src/dev/clothingEdgeFixtures'
import { harmonizeGarmentEdge } from '../src/services/clothingEdgeAppearance'

let checks = 0
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`) }
function fixture(colour: string, linear: boolean, featherRadius = 2, inset = 1, skin = [202, 156, 129]) {
  const width = 128, height = 24, boundary = 64
  const source = new Uint8ClampedArray(width * height * 4)
  const raw = new Uint8ClampedArray(source.length), blur = new Uint8ClampedArray(source.length)
  const background = new Uint8ClampedArray(source.length), alpha = new Uint8ClampedArray(width * height)
  const coverage = new Float32Array(alpha.length)
  const rgb = hexToRgb(colour), cloth = [rgb.r, rgb.g, rgb.b]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, k = i * 4
    const a = Math.max(0, Math.min(1, x - (boundary - inset) + 0.4))
    coverage[i] = a
    raw[k + 3] = x >= boundary ? 255 : 0
    blur[k + 3] = Math.round(255 / (1 + Math.exp(-(x - boundary + 0.5) / (featherRadius * 0.5))))
    alpha[i] = x >= boundary ? Math.round(Math.min(1, blur[k + 3] / 255 / 0.56) * 255) : 0
    for (let c = 0; c < 3; c++) source[k + c] = linear
      ? 255 * edgeToSrgb(a * edgeToLinear(cloth[c] / 255) + (1 - a) * edgeToLinear(skin[c] / 255))
      : a * cloth[c] + (1 - a) * skin[c]
    source[k + 3] = 255
  }
  return { source, raw, blur, alpha, background, coverage, width, height, featherRadius, boundary }
}

check('All five colour transitions replace foreground instead of retaining original dye', () => {
  for (const test of EDGE_CASES) for (const linear of [false, true]) {
    const f = fixture(test.original, linear)
    const target = Object.values(hexToRgb(test.target))
    const original = Object.values(hexToRgb(test.original))
    const exterior = [202, 156, 129]
    const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius)
    for (let y = 0; y < f.height; y++) for (let x = f.boundary - 1; x <= f.boundary + 2; x++) {
      const i = y * f.width + x, k = i * 4
      assert.ok(foreground[k + 3], `${test.name}, x=${x}, linear=${linear}`)
      const a = f.alpha[i] / 255
      for (let c = 0; c < 3; c++) {
        const actual = replaceEdgeGarment(f.background[k + c], target[c], a, foreground[k + 3])
        const expected = linear ? 255 * edgeToSrgb(f.coverage[i] * edgeToLinear(target[c] / 255)
          + (1 - f.coverage[i]) * edgeToLinear(exterior[c] / 255))
          : f.coverage[i] * target[c] + (1 - f.coverage[i]) * exterior[c]
        assert.ok(Math.abs(actual - expected) < 5, `${test.name}, ${linear}, error=${Math.abs(actual - expected)}`)
        if (f.coverage[i] === 1) assert.ok(Math.abs(foreground[k + c] - original[c]) <= 1)
      }
    }
  }
})
check('Pure exterior pixels remain untouched and mixed edge pixels retain fractional coverage', () => {
  for (const test of EDGE_CASES) for (const linear of [false, true]) {
    const f = fixture(test.original, linear)
    const before = f.alpha.slice()
    const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius)
    for (let i = 0; i < f.alpha.length; i++) {
      const x = i % f.width
      if (f.coverage[i] === 0) assert.equal(f.alpha[i], 0)
      if (x < f.boundary - 4 || x > f.boundary + 3) {
        assert.equal(f.alpha[i], before[i])
        assert.equal(foreground[i * 4 + 3], 0)
      }
      if (f.coverage[i] > 0 && f.coverage[i] < 1) assert.ok(f.alpha[i] > 30 && f.alpha[i] < 225)
    }
  }
})
check('Larger photos can reach clean samples without widening the edited band', () => {
  const f = fixture('#BD2834', false, 12)
  const before = f.alpha.slice()
  const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius)
  assert.ok(foreground[(f.boundary + 1) * 4 + 3])
  for (let i = 0; i < f.alpha.length; i++) if (Math.abs(i % f.width - f.boundary) > 4) assert.equal(f.alpha[i], before[i])
})
check('Skin-only shadows beside or mislabelled inside the boundary are never treated as fabric', () => {
  const f = fixture('#BD2834', false, 2, -1)
  // A skin shadow in the semantic garment-side pixel, plus an exterior skin
  // shadow beside it. Different brightness cannot imply garment coverage.
  for (let y = 0; y < f.height; y++) for (const x of [f.boundary - 1, f.boundary]) {
    const k = (y * f.width + x) * 4
    f.source[k] = 162; f.source[k + 1] = 125; f.source[k + 2] = 103
  }
  const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius)
  for (let y = 0; y < f.height; y++) for (const x of [f.boundary - 1, f.boundary]) {
    const i = y * f.width + x
    assert.equal(f.alpha[i], 0)
    assert.equal(foreground[i * 4 + 3], 0)
  }
})
check('Indistinguishable garment/background and unrelated edge colours do not get forced matting', () => {
  const ambiguous = fixture('#CA9C81', false)
  const before = ambiguous.alpha.slice()
  const foreground = refineGarmentEdge(ambiguous.source, ambiguous.raw, ambiguous.blur, ambiguous.alpha, ambiguous.background,
    ambiguous.width, ambiguous.height, ambiguous.featherRadius)
  assert.deepEqual(ambiguous.alpha, before)
  assert.ok(foreground.every(v => v === 0))
  const unrelated = fixture('#BD2834', false)
  const i = unrelated.boundary * 4
  unrelated.source[i] = 10; unrelated.source[i + 1] = 220; unrelated.source[i + 2] = 20
  const preserved = unrelated.alpha.slice()
  const matte = refineGarmentEdge(unrelated.source, unrelated.raw, unrelated.blur, unrelated.alpha, unrelated.background,
    unrelated.width, unrelated.height, unrelated.featherRadius)
  assert.equal(matte[i + 3], 0)
  assert.equal(unrelated.alpha[unrelated.boundary], preserved[unrelated.boundary])
})
check('Inset model edge recovers connected garment without accepting garment-coloured exterior references', () => {
  const f = fixture('#BD2834', false, 2, 7)
  const before = f.alpha.slice(), bandRadius = 11
  const diagnostics = garmentTrimap(f.raw, f.width, f.height, bandRadius)
  const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius,
    { bandRadius, diagnostics })
  for (let y = 0; y < f.height; y++) {
    for (let x = f.boundary - 6; x <= f.boundary + 3; x++) {
      const i = y * f.width + x
      assert.ok(foreground[i * 4 + 3], `unrecovered inset garment at ${x},${y}`)
      assert.ok(f.alpha[i] >= 254)
    }
    for (let x = 0; x < f.boundary - 7; x++) assert.equal(f.alpha[y * f.width + x], 0)
  }
  for (let i = 0; i < f.alpha.length; i++) if (diagnostics.trimap[i] !== 128) {
    assert.equal(f.alpha[i], before[i]); assert.equal(foreground[i * 4 + 3], 0)
  }
})
check('Dark red seam preserves its own tone instead of being rejected as an exterior shadow', () => {
  const f = fixture('#BD2834', false, 2, 4)
  for (let y = 0; y < f.height; y++) for (let x = f.boundary - 3; x < f.boundary; x++) {
    const k = (y * f.width + x) * 4
    f.source[k] = 65; f.source[k + 1] = 1; f.source[k + 2] = 5
  }
  const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius, { bandRadius: 8 })
  for (let y = 0; y < f.height; y++) for (let x = f.boundary - 3; x < f.boundary; x++) {
    const i = y * f.width + x, k = i * 4
    assert.ok(foreground[k + 3]); assert.equal(f.alpha[i], 255)
    assert.deepEqual(Array.from(foreground.slice(k, k + 3)), [65, 1, 5])
  }
})
check('Clipped red mixed edges get a valid matte rather than surviving unchanged', () => {
  const f = fixture('#FE4B5E', false)
  const x = f.boundary - 1
  for (let y = 0; y < f.height; y++) {
    const k = (y * f.width + x) * 4
    f.source[k] = 239; f.source[k + 1] = 109; f.source[k + 2] = 111
  }
  const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius)
  for (let y = 0; y < f.height; y++) {
    const i = y * f.width + x, k = i * 4
    assert.ok(foreground[k + 3]); assert.ok(f.alpha[i] > 100 && f.alpha[i] < 255)
    const taupe = [156, 140, 128]
    const output = taupe.map((v, c) => replaceEdgeGarment(f.background[k + c], v, f.alpha[i] / 255, foreground[k + 3]))
    assert.ok(output[0] - output[1] < 35, 'original red is not retained as a composite residual')
  }
})
check('Fractional antialias coverage tapers out without a hard cutout or recolouring pure skin', () => {
  const f = fixture('#BD2834', false, 2, 3), cloth = [189, 40, 52], skin = [202, 156, 129]
  const values = [0, 0.12, 0.28, 0.65, 0.95, 1]
  for (let y = 0; y < f.height; y++) for (let j = 0; j < values.length; j++) {
    const i = y * f.width + f.boundary - 5 + j, k = i * 4, a = values[j]
    for (let c = 0; c < 3; c++) f.source[k + c] = a * cloth[c] + (1 - a) * skin[c]
  }
  const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius, { bandRadius: 8 })
  for (let y = 0; y < f.height; y++) for (let j = 0; j < values.length; j++) {
    const i = y * f.width + f.boundary - 5 + j
    assert.ok(Math.abs(f.alpha[i] / 255 - values[j]) < 0.035, `coverage ${j}: ${f.alpha[i]}`)
    if (!j) assert.equal(foreground[i * 4 + 3], 0)
  }
})
check('New composite never retains a coloured source-fitting residual', () => {
  for (const space of [1, 2]) {
    const background = [130, 120, 105], target = [156, 140, 128], a = 0.7
    const result = target.map((v, c) => replaceEdgeGarment(background[c], v, a, space))
    const expected = target.map((v, c) => space === 2 ? 255 * edgeToSrgb(a * edgeToLinear(v / 255)
      + (1 - a) * edgeToLinear(background[c] / 255)) : a * v + (1 - a) * background[c])
    assert.deepEqual(result, expected)
  }
})
check('Muted blue-grey background is not mistaken for saturated blue clothing', () => {
  for (const test of EDGE_CASES) for (const linear of [false, true]) {
    const f = fixture(test.original, linear, 2, 3, [112, 129, 139])
    const foreground = refineGarmentEdge(f.source, f.raw, f.blur, f.alpha, f.background, f.width, f.height, f.featherRadius, { bandRadius: 8 })
    for (let i = 0; i < f.alpha.length; i++) {
      if (f.coverage[i] === 0) { assert.equal(f.alpha[i], 0, test.name); assert.equal(foreground[i * 4 + 3], 0, test.name) }
      else if (Math.abs(i % f.width - f.boundary) < 4) {
        assert.ok(Math.abs(f.alpha[i] / 255 - f.coverage[i]) < 0.035, `${test.name}: ${f.alpha[i]}, ${f.coverage[i]}`)
      }
    }
  }
})
check('Full collar/shoulder fixtures never recolour known exterior across all transitions and blend spaces', () => {
  for (let index = 0; index < EDGE_CASES.length; index++) for (const linear of [false, true]) {
    const fixture = clothingEdgeFixture(index, linear, 192)
    const raw = new Uint8ClampedArray(fixture.pixels.length), blurred = new Uint8ClampedArray(raw.length)
    const alpha = new Uint8ClampedArray(fixture.width * fixture.height), background = new Uint8ClampedArray(raw.length)
    for (let y = 0; y < fixture.height; y++) for (let x = 0; x < fixture.width; x++) {
      const i = y * fixture.width + x
      const garment = fixture.mask.categories[Math.floor(y / 4) * fixture.mask.width + Math.floor(x / 4)] === 4
      raw[i * 4 + 3] = alpha[i] = garment ? 255 : 0
    }
    const diagnostics = garmentTrimap(raw, fixture.width, fixture.height, 11)
    for (let i = 0; i < alpha.length; i++) blurred[i * 4 + 3] = 255 / (1 + Math.exp(-diagnostics.signedDistance[i]))
    const foreground = refineGarmentEdge(fixture.pixels, raw, blurred, alpha, background, fixture.width, fixture.height, 2,
      { bandRadius: 11, diagnostics })
    for (let i = 0; i < alpha.length; i++) if (fixture.coverage[i] === 0) {
      assert.equal(alpha[i], 0, `${EDGE_CASES[index].name}, ${linear}, exterior pixel ${i}`)
      assert.equal(foreground[i * 4 + 3], 0)
    }
  }
})
function appearanceFixture() {
  const width = 24, height = 8
  const alpha = new Uint8ClampedArray(width * height)
  const foreground = new Uint8ClampedArray(width * height * 4)
  const dyed = new Float32Array(width * height * 3)
  for (let y = 0; y < height; y++) for (let x = 9; x < width; x++) {
    const i = y * width + x
    alpha[i] = 255
    if (x < 17) foreground[i * 4 + 3] = 1
    dyed.set([156, 140, 128], i * 3)
  }
  return { width, height, alpha, foreground, dyed }
}
const light = (rgb: number[]) => rgb.reduce((sum, v, c) => sum + edgeToLinear(v / 255) * [0.2126, 0.7152, 0.0722][c], 0)
check('Edge appearance harmonizes chroma without changing opaque local luminance or matte geometry', () => {
  const f = appearanceFixture(), i = 3 * f.width + 9
  f.dyed.set([139, 132, 128], i * 3)
  const beforeAlpha = f.alpha.slice(), beforeForeground = f.foreground.slice(), beforeDye = f.dyed.slice()
  const corrections = harmonizeGarmentEdge(f.dyed, f.alpha, f.foreground, f.width, f.height)
  const original = Array.from(f.dyed.slice(i * 3, i * 3 + 3)), polished = corrections.get(i)!
  assert.ok(polished)
  assert.ok(Math.abs(light(original) - light(polished)) < 1e-8)
  const chromaRatio = (rgb: number[]) => edgeToLinear(rgb[0] / 255) / edgeToLinear(rgb[2] / 255)
  assert.ok(Math.abs(chromaRatio(polished) - chromaRatio([156, 140, 128])) < Math.abs(chromaRatio(original) - chromaRatio([156, 140, 128])))
  assert.deepEqual(f.alpha, beforeAlpha); assert.deepEqual(f.foreground, beforeForeground); assert.deepEqual(f.dyed, beforeDye)
  for (const index of corrections.keys()) {
    assert.ok(f.alpha[index] > 0 && f.foreground[index * 4 + 3])
    assert.ok(index % f.width < 12, 'no changes beyond the three-photo-pixel band')
  }
})
check('Fractional-edge tone noise is gently reduced with a four-percent luminance cap', () => {
  for (const rgb of [[130, 116, 106], [168, 205, 220]]) {
    const f = appearanceFixture(), i = 3 * f.width + 9
    f.alpha[i] = 128; f.dyed.set(rgb, i * 3)
    for (let j = 0; j < f.alpha.length; j++) if (j !== i && f.alpha[j]) f.dyed.set(rgb.map(v => v * 1.07), j * 3)
    const correction = harmonizeGarmentEdge(f.dyed, f.alpha, f.foreground, f.width, f.height).get(i)!
    assert.ok(correction)
    assert.ok(light(correction) > light(rgb))
    assert.ok(light(correction) / light(rgb) <= 1.040001)
    assert.equal(f.alpha[i], 128, 'subpixel antialiasing is untouched')
  }
})
check('Genuine dark seams and uniform fabric are not flattened by boundary polish', () => {
  const f = appearanceFixture(), i = 3 * f.width + 9
  assert.equal(harmonizeGarmentEdge(f.dyed, f.alpha, f.foreground, f.width, f.height).size, 0)
  f.dyed.set([46, 40, 36], i * 3); f.alpha[i] = 180
  assert.equal(harmonizeGarmentEdge(f.dyed, f.alpha, f.foreground, f.width, f.height).has(i), false)
})
check('Appearance polish preserves excluded skin, confident interior, and all five target dye directions', () => {
  for (const test of EDGE_CASES) for (const space of [1, 2]) {
    const f = appearanceFixture(), target = Object.values(hexToRgb(test.target)), i = 3 * f.width + 9
    for (let j = 0; j < f.alpha.length; j++) if (f.alpha[j]) f.dyed.set(target, j * 3)
    f.alpha[i] = 170; f.foreground[i * 4 + 3] = space
    f.dyed.set(target.map(v => v * 0.96), i * 3)
    const corrections = harmonizeGarmentEdge(f.dyed, f.alpha, f.foreground, f.width, f.height)
    for (const [index, rgb] of corrections) {
      assert.ok(f.alpha[index] && f.foreground[index * 4 + 3])
      assert.ok(index % f.width < 12)
      assert.ok(rgb.every(v => v >= 0 && v <= 255))
      // A positive mixture of nearby target chromaticities cannot reintroduce
      // the source dye; the original skin component and alpha are unchanged.
      for (let c = 0; c < 3; c++) assert.ok(Number.isFinite(replaceEdgeGarment(140, rgb[c], f.alpha[index] / 255, space)))
    }
    assert.equal(corrections.has(3 * f.width + 8), false)
    assert.equal(corrections.has(3 * f.width + 18), false)
  }
})
console.log(`\n${checks} clothing-edge checks passed.`)
