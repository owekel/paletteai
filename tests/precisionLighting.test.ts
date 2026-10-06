import assert from 'node:assert/strict'
import { resultFixture } from '../src/dev/resultsFixtures'
import { applyPrecisionLightingFixture, type PrecisionLightingScenario } from '../src/dev/precisionLightingFixtures'
import { assessPrecisionSessionLighting, PrecisionSessionLightingError } from '../src/services/precisionSessionLighting'
import { buildPrecisionProfile } from '../src/services/buildPrecisionProfile'
import { capturePhotoEvidence, evaluateCaptureFinalist } from '../src/services/capture/captureFinalists'
import type { PrecisionCaptureRecord } from '../src/types/precision'

let passed = 0
function test(name: string, fn: () => void) { fn(); passed++; console.log(`✓ ${name}`) }
function records(scenario: PrecisionLightingScenario = 'precision-lighting-good'): PrecisionCaptureRecord[] {
  return [1, 2, 3].map(i => ({ image: `moment-${i}`, profile: applyPrecisionLightingFixture(resultFixture('strong'), scenario, i),
    quality: .9, selection: { method: 'manual', selectedId: i, frames: [], reason: 'Synthetic technically usable capture' } }))
}

test('Three good even-light captures pass with the original result unchanged', () => {
  const r = records(), p = buildPrecisionProfile(r).profile
  assert.equal(p.precision!.sessionLighting.status, 'suitable')
  assert.equal(p.precision!.sessionLighting.affectedCaptures.length, 0)
  assert.equal(p.analysis.title, 'Soft Summer')
})
test('Somewhat dimmer but uniform lighting passes without remapping value', () => {
  const r = records('precision-lighting-dim')
  r.forEach(r => { r.profile.shadowMeasurements.value.score = -.52 })
  assert.equal(assessPrecisionSessionLighting(r).status, 'suitable')
  assert.equal(buildPrecisionProfile(r).profile.shadowMeasurements.value.score, -.52)
})
test('Repeated spatial 0.0584, mixed suspicion and 14% normalization reject before results', () => {
  const r = records('precision-lighting-mixed'), gate = assessPrecisionSessionLighting(r)
  assert.equal(gate.status, 'reacquire-required')
  assert.deepEqual(gate.affectedCaptures, [1, 2, 3])
  assert.deepEqual(gate.recurringCauses, ['mixed-lighting'])
  assert.throws(() => buildPrecisionProfile(r), (error: unknown) => error instanceof PrecisionSessionLightingError
    && error.diagnostics.status === 'reacquire-required' && error.message.includes('soft, even lighting'))
  // All moments can pass the existing individual checks: this is a session gate.
  assert.ok(r.every(r => evaluateCaptureFinalist({ id: 1 }, capturePhotoEvidence(r.profile)).passed))
})
test('Weak neutral confidence and no correction with excellent facial lighting pass', () => {
  const good = buildPrecisionProfile(records()).profile
  const weak = buildPrecisionProfile(records('precision-lighting-neutral-weak')).profile
  assert.equal(weak.precision!.sessionLighting.status, 'suitable')
  assert.deepEqual(weak.precision!.dimensions, good.precision!.dimensions)
  assert.deepEqual(weak.precision!.sensitivity, good.precision!.sensitivity)
  assert.deepEqual(weak.analysis.palette, good.analysis.palette)
})
test('One weak capture among two strong ones does not invalidate or drop the set', () => {
  const r = records('precision-lighting-one-weak'), p = buildPrecisionProfile(r).profile
  assert.equal(p.precision!.sessionLighting.status, 'suitable')
  assert.deepEqual(p.precision!.sessionLighting.affectedCaptures, [3])
  assert.equal(p.precision!.captureCount, 3)
  assert.equal(p.precision!.dimensions.value.contributions.length, 3)
})
test('Low normalization caused by weak neutrality cannot corroborate mixed suspicion when candidates agree', () => {
  const r = records('precision-lighting-mixed')
  r.forEach(r => Object.assign(r.profile.shadowMeasurements.lighting, { candidateConsistency: .9, neutralReferenceConfidence: .16 }))
  assert.equal(assessPrecisionSessionLighting(r).status, 'suitable')
})
test('Two repeatedly mixed captures among three reject; two-photo fallback requires both', () => {
  const r = records('precision-lighting-mixed')
  r[2] = records()[2]
  assert.equal(assessPrecisionSessionLighting(r).status, 'reacquire-required')
  assert.equal(assessPrecisionSessionLighting(r.slice(0, 2)).status, 'reacquire-required')
  r[1] = records()[1]
  assert.equal(assessPrecisionSessionLighting(r.slice(0, 2)).status, 'suitable')
})
test('Substantial uneven facial lighting needs both lightness imbalance and diagnosed inconsistency', () => {
  const r = records()
  r.forEach(r => {
    const skin = r.profile.shadowMeasurements.skinDiagnostics
    skin.regions[0].representative.l += .11 // total ΔL .13
    skin.consistencyScore = .15; skin.likelyCause = 'uneven-lighting'
  })
  assert.equal(assessPrecisionSessionLighting(r).status, 'reacquire-required')
  assert.deepEqual(assessPrecisionSessionLighting(r).recurringCauses, ['uneven-illumination'])
  r.forEach(r => { r.profile.shadowMeasurements.skinDiagnostics.likelyCause = 'regional-variation' })
  assert.equal(assessPrecisionSessionLighting(r).status, 'suitable')
})
test('Persistent skin clipping corroborated by weak exposure rejects, without using absolute skin brightness', () => {
  const r = records()
  r.forEach(r => {
    r.profile.shadowMeasurements.features.skin.clippedFraction = .23
    r.profile.shadowMeasurements.stabilityDiagnostics.exposure.reliability = .25
  })
  assert.equal(assessPrecisionSessionLighting(r).status, 'reacquire-required')
  assert.deepEqual(assessPrecisionSessionLighting(r).recurringCauses, ['exposure-clipping'])
})
test('Global clipping from dark hair/eyes and low skin-exposure plausibility alone do not reject', () => {
  const r = records()
  r.forEach(r => Object.assign(r.profile.shadowMeasurements.stabilityDiagnostics.exposure,
    { reliability: .1, clippingScore: 0, skinExposurePlausibility: 0 }))
  assert.equal(assessPrecisionSessionLighting(r).status, 'suitable')
})
test('Borderline mixed suspicion alone is insufficient and absent references cannot invent spatial evidence', () => {
  const r = records('precision-lighting-mixed')
  r.forEach(r => { r.profile.shadowMeasurements.lighting.spatialDisagreement = .036 })
  assert.equal(assessPrecisionSessionLighting(r).status, 'suitable')
  r.forEach(r => Object.assign(r.profile.shadowMeasurements.lighting, { spatialDisagreement: .0584, backgroundCandidateCount: 0 }))
  assert.equal(assessPrecisionSessionLighting(r).status, 'suitable')
})
test('Independent moderate mixed and uneven-light signals can corroborate one another', () => {
  const r = records('precision-lighting-mixed')
  r.forEach(r => {
    r.profile.shadowMeasurements.lighting.spatialDisagreement = .055
    const skin = r.profile.shadowMeasurements.skinDiagnostics
    skin.regions[0].representative.l += .1; skin.consistencyScore = .3; skin.likelyCause = 'uneven-lighting'
  })
  const gate = assessPrecisionSessionLighting(r)
  assert.ok(gate.captures.every(c => c.risks['mixed-lighting'] < .6 && c.risks['uneven-illumination'] < .6))
  assert.equal(gate.status, 'reacquire-required')
  assert.equal(gate.recurringCauses.length, 0)
})
test('Colour coordinates, confidence and season preference cannot influence the gate', () => {
  const r = records('precision-lighting-mixed'), before = assessPrecisionSessionLighting(r)
  r.forEach(r => {
    for (const d of ['temperature', 'value', 'chroma', 'contrast'] as const) Object.assign(r.profile.shadowMeasurements[d], { score: -.24, reliability: 1 })
    r.profile.shadowSeasonClassification.rankings.reverse()
    r.profile.analysis.title = 'Preferred season'; r.quality = 1
  })
  assert.deepEqual(assessPrecisionSessionLighting(r), before)
})
test('Passing gate preserves all inputs and repeatability/classification behavior', () => {
  const r = records(), before = JSON.stringify(r)
  const a = buildPrecisionProfile(r).profile
  assert.equal(JSON.stringify(r), before)
  const dim = records('precision-lighting-dim'), b = buildPrecisionProfile(dim).profile
  assert.deepEqual(a.precision!.dimensions, b.precision!.dimensions)
  assert.deepEqual(a.precision!.sensitivity, b.precision!.sensitivity)
  assert.deepEqual(a.shadowSeasonClassification, b.shadowSeasonClassification)
  assert.deepEqual(a.analysis.palette, b.analysis.palette)
})
console.log(`\n${passed} Precision session-lighting checks passed.`)
