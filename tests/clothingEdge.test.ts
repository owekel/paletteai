import assert from 'node:assert/strict'
import { refineGarmentEdge, replaceEdgeGarment, edgeToLinear, edgeToSrgb } from '../src/services/clothingEdgeMatte'
import { hexToRgb } from '../src/services/colorUtils'
import { EDGE_CASES } from '../src/dev/clothingEdgeFixtures'

let checks = 0
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`) }
function fixture(colour: string, linear: boolean, featherRadius = 2, inset = 1) {
  const width = 128, height = 24, boundary = 64
  const source = new Uint8ClampedArray(width * height * 4)
  const raw = new Uint8ClampedArray(source.length), blur = new Uint8ClampedArray(source.length)
  const background = new Uint8ClampedArray(source.length), alpha = new Uint8ClampedArray(width * height)
  const coverage = new Float32Array(alpha.length)
  const rgb = hexToRgb(colour), cloth = [rgb.r, rgb.g, rgb.b], skin = [202, 156, 129]
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

check('All four colour transitions replace foreground instead of retaining original dye', () => {
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
        const actual = replaceEdgeGarment(f.source[k + c], foreground[k + c], target[c], a, foreground[k + 3])
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
console.log(`\n${checks} clothing-edge checks passed.`)
