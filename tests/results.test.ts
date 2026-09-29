import assert from 'node:assert/strict'
import { resultFixture } from '../src/dev/resultsFixtures'
import { SHADOW_SEASON_PROTOTYPES } from '../src/data/shadowSeasonCalibration'
import { SEASON_PALETTES, sharedSeasonPalette } from '../src/data/palettes'
import { buildSeasonAnalysis } from '../src/services/seasonAnalysis'
import { classifyShadowSeason } from '../src/services/shadowSeasonClassifier'
import { evaluateColorMatch } from '../src/services/evaluateColorMatch'

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
check('Every uncertain recommendation belongs to every candidate, with order-independent selection', () => {
  const result = resultFixture('constrained').analysis
  const ids = result.candidates.map(c => c.id)
  assert.ok(result.palette.best.length + result.palette.neutrals.length > 0)
  for (const key of ['best', 'neutrals'] as const) {
    for (const colour of result.palette[key]) {
      assert.ok(ids.every(id => SEASON_PALETTES[id][key].some(c => c.hex === colour.hex)))
    }
  }
  assert.deepEqual(sharedSeasonPalette(ids), sharedSeasonPalette([...ids].reverse()))
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
  assert.equal(result.paletteMode, 'explore')
  assert.equal(result.palette.best.length + result.palette.neutrals.length, 0)
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
console.log(`\n${checks} integration checks passed.`)
