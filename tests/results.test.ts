import assert from 'node:assert/strict'
import { resultFixture } from '../src/dev/resultsFixtures'
import { SHADOW_SEASON_PROTOTYPES } from '../src/data/shadowSeasonCalibration'
import { SEASON_PALETTES, sharedSeasonPalette } from '../src/data/palettes'
import { buildSeasonAnalysis } from '../src/services/seasonAnalysis'
import { classifyShadowSeason } from '../src/services/shadowSeasonClassifier'
import { evaluateColorMatch } from '../src/services/evaluateColorMatch'
import { buildConsensusPalette, paletteSimilarity } from '../src/services/consensusPalette'
import { TEMPERATURE_COMPARISONS, INTENSITY_COMPARISON } from '../src/data/colourComparisons'
import { rgbToOklch } from '../src/services/oklab'
import { hexToRgb } from '../src/services/colorUtils'

let checks = 0
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`) }

check('All 12 confident prototype profiles select their own distinct subtype palettes', () => {
  const signatures = new Set<string>()
  for (const prototype of SHADOW_SEASON_PROTOTYPES) {
    const result = resultFixture('strong', prototype.id).analysis
    assert.equal(result.status, 'specific', prototype.id)
    assert.equal(result.candidates[0].id, prototype.id)
    assert.equal(result.palette, SEASON_PALETTES[prototype.id])
    assert.equal(result.palette.best.length, 8)
    signatures.add(result.palette.best.map(c => c.hex).join(','))
    const all = [...result.palette.best, ...result.palette.neutrals]
    assert.equal(new Set(all.map(c => c.hex)).size, all.length)
    for (const colours of Object.values(result.palette.wardrobe)) {
      assert.ok(colours.every(c => all.some(s => s.hex === c.hex)))
    }
    for (const c of all) assert.match(c.hex, /^#[0-9A-F]{6}$/i)
  }
  assert.equal(signatures.size, 12)
})
check('Missing temperature produces a usable grouped result with no temperature claim', () => {
  const result = resultFixture('constrained').analysis
  assert.equal(result.quality.imageQuality.status, 'usable')
  assert.equal(result.status, 'constrained')
  assert.ok(result.candidates.length >= 3)
  assert.equal(result.dimensions.find(d => d.id === 'temperature')!.value, 'Still open')
  assert.ok(!result.title.toLowerCase().includes('cool'))
  assert.equal(result.runnerUp, undefined)
})
check('Consensus adds nearby supported colours and stays independent of candidate ordering', () => {
  const result = resultFixture('constrained').analysis
  const ids = result.candidates.map(c => c.id)
  assert.ok(result.palette.best.length >= 4)
  assert.ok(result.palette.best.length > sharedSeasonPalette(ids).best.length)
  assert.ok(result.recommendations!.diagnostics.colours.every(c => c.support >= 0.2))
  const m = resultFixture('constrained').shadowMeasurements
  assert.deepEqual(buildConsensusPalette(m, result.candidates, ['value', 'chroma', 'contrast']).palette,
    buildConsensusPalette(m, [...result.candidates].reverse(), ['value', 'chroma', 'contrast']).palette)
  for (const category of Object.values(result.palette.wardrobe)) assert.ok(category.length > 0)
})
check('Reliable dimensions with a close season tie remain grouped', () => {
  const result = resultFixture('tie').analysis
  assert.equal(result.quality.canPresentSpecificSeason, true)
  assert.equal(result.status, 'constrained')
  assert.equal(result.decision.reason, 'close-prototype-tie')
})
check('No trustworthy major dimensions means exploration without invented candidates or a retake', () => {
  const result = resultFixture('indeterminate').analysis
  assert.equal(result.status, 'constrained')
  assert.equal(result.quality.imageQuality.status, 'usable')
  assert.deepEqual(result.candidates, [])
  assert.equal(result.resultKind, 'broad-profile')
  assert.equal(result.paletteMode, 'starter')
  assert.ok(result.palette.best.length >= 4)
  assert.equal(result.recommendations!.personalized, false)
  assert.equal(result.recommendations!.lessSupported.length, 0)
  assert.ok(result.dimensions.every(d => !d.recommendation))
  assert.ok(result.recommendations!.comparisons.length >= 2)
})
check('Technical clipping failure overrides otherwise strong classification and supplies actual guidance', () => {
  const result = resultFixture('retake').analysis
  assert.equal(result.status, 'retake-required')
  assert.ok(result.quality.imageQuality.issues.some(i => i.code === 'extreme-exposure'))
  assert.equal(result.candidates.length, 0)
  assert.equal(result.palette.best.length + result.palette.neutrals.length, 0)
})
check('Zero-reliability temperature cannot change result or palette', () => {
  const m = resultFixture('constrained').shadowMeasurements
  m.temperature.score = -1
  const cool = buildSeasonAnalysis(m, classifyShadowSeason(m))
  m.temperature.score = 1
  const warm = buildSeasonAnalysis(m, classifyShadowSeason(m))
  assert.deepEqual(cool.candidates.map(c => [c.id, c.probability]), warm.candidates.map(c => [c.id, c.probability]))
  assert.deepEqual(cool.palette, warm.palette)
})
check('Custom colour comparison follows the active subtype/shared palette', () => {
  for (const scenario of ['strong', 'constrained'] as const) {
    const palette = resultFixture(scenario).analysis.palette
    const swatch = [...palette.best, ...palette.neutrals][0]
    assert.equal(evaluateColorMatch(swatch.hex, palette, scenario === 'constrained').rating, 'Strong match')
  }
})
check('Nearby shades contribute perceptually; exact membership is not required', () => {
  const palette = SEASON_PALETTES['soft-summer'].best
  assert.equal(paletteSimilarity('#8FA88C', palette), 1)
  assert.ok(paletteSimilarity('#90A98D', palette) > 0.95)
  assert.ok(paletteSimilarity('#FF0000', palette) < 0.1)
})
check('Candidate probabilities affect consensus support without changing classifier output', () => {
  const profile = resultFixture('constrained')
  const before = JSON.stringify(profile.shadowSeasonClassification)
  const warm = profile.shadowSeasonClassification.rankings.find(c => c.id === 'warm-autumn')!
  const cool = profile.shadowSeasonClassification.rankings.find(c => c.id === 'cool-summer')!
  const withWarm = buildConsensusPalette(profile.shadowMeasurements, [{ ...warm, probability: 0.8 }, { ...cool, probability: 0.2 }], ['value', 'chroma'])
  const withCool = buildConsensusPalette(profile.shadowMeasurements, [{ ...warm, probability: 0.2 }, { ...cool, probability: 0.8 }], ['value', 'chroma'])
  assert.notDeepEqual(withWarm.palette.best.map(c => c.hex), withCool.palette.best.map(c => c.hex))
  assert.equal(JSON.stringify(profile.shadowSeasonClassification), before)
  assert.ok(Math.abs(withWarm.recommendations.diagnostics.candidateWeights.reduce((s, c) => s + c.weight, 0) - 1) < 1e-9)
})
check('Reliable contrast alone gives outfit advice, without claiming depth or intensity', () => {
  const a = resultFixture('broad').analysis
  assert.equal(a.resultKind, 'broad-profile')
  assert.deepEqual(a.recommendations!.diagnostics.reliableDimensions, ['contrast'])
  assert.ok(a.recommendations!.outfit)
  assert.ok(a.dimensions.filter(d => d.id !== 'contrast').every(d => d.recommendation === undefined))
})
check('Sub-threshold dimensions never become personalized claims, even with nonzero evidence', () => {
  const a = resultFixture('low-certainty').analysis
  assert.equal(a.status, 'constrained')
  assert.equal(a.quality.imageQuality.status, 'usable')
  assert.equal(a.quality.measurementReliability.threshold, 0.45)
  assert.ok(a.dimensions.every(d => !d.resolved && d.recommendation === undefined))
  assert.equal(a.recommendations!.personalized, false)
  assert.ok(a.palette.best.length > 0)
})
check('Warm/cool comparison pairs keep lightness and chroma approximately matched', () => {
  for (const pair of TEMPERATURE_COMPARISONS) {
    const [a, b] = pair.options.map(c => rgbToOklch(hexToRgb(c.hex)))
    assert.ok(Math.abs(a.l - b.l) < 0.04, `${pair.id} ΔL ${Math.abs(a.l - b.l)}`)
    assert.ok(Math.abs(a.c - b.c) < 0.04, `${pair.id} ΔC ${Math.abs(a.c - b.c)}`)
  }
  const [a, b] = INTENSITY_COMPARISON.options.map(c => rgbToOklch(hexToRgb(c.hex)))
  assert.ok(Math.abs(a.l - b.l) < 0.04)
  assert.ok(b.c - a.c > 0.08)
})
check('Recommendations downweight temperature dependence when warmth is unresolved', () => {
  const a = resultFixture('constrained').analysis
  const colours = a.recommendations!.diagnostics.colours
  assert.ok(colours.some(c => c.temperatureDependence > 0.1))
  for (const c of colours.filter(c => c.temperatureDependence > 0.1)) {
    assert.ok(c.score < c.support * (0.7 + 0.3 * c.dimensionFit))
  }
  assert.equal(a.recommendations!.comparisons[0].dimension, 'temperature')
})
check('Every reliability combination across all 12 prototype profiles retains useful colours', () => {
  const dimensions = ['temperature', 'value', 'chroma', 'contrast'] as const
  for (const prototype of SHADOW_SEASON_PROTOTYPES) {
    const m = resultFixture('strong', prototype.id).shadowMeasurements
    for (let mask = 0; mask < 16; mask++) {
      dimensions.forEach((dimension, index) => { m[dimension].reliability = mask & (1 << index) ? 0.9 : 0 })
      const a = buildSeasonAnalysis(m, classifyShadowSeason(m))
      assert.notEqual(a.status, 'retake-required')
      assert.ok(a.palette.best.length >= 4, `${prototype.id}, reliability mask ${mask}`)
      assert.ok(a.palette.neutrals.length >= 2)
      assert.ok(a.dimensions.filter(d => !d.resolved).every(d => !d.recommendation))
      const hexes = [...a.palette.best, ...a.palette.neutrals].map(c => c.hex)
      assert.equal(new Set(hexes).size, hexes.length)
    }
  }
})
console.log(`\n${checks} integration checks passed.`)
