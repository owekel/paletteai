import assert from 'node:assert/strict'
import { resultFixture } from '../src/dev/resultsFixtures'
import { captureFixture } from '../src/dev/captureFixtures'
import { aggregateDimension, PRECISION_DIMENSIONS as dims } from '../src/services/precisionAggregation'
import { buildPrecisionProfile } from '../src/services/buildPrecisionProfile'
import { evaluateCaptureFinalist, capturePhotoEvidence } from '../src/services/capture/captureFinalists'
import { evaluateCaptureQuality } from '../src/services/capture/captureQuality'
import { isSafeBackgroundReference } from '../src/services/vision/backgroundExclusion'
import { SHADOW_SEASON_PROTOTYPES } from '../src/data/shadowSeasonCalibration'
import type { PrecisionCaptureRecord } from '../src/types/precision'

let passed = 0
function test(name: string, fn: () => void) { fn(); console.log(`✓ ${name}`); passed++ }
function record(score?: number, reliability = .7): PrecisionCaptureRecord {
  const profile = resultFixture('strong')
  for (const d of dims) profile.shadowMeasurements[d].reliability = reliability
  if (score !== undefined) profile.shadowMeasurements.temperature.score = score
  return { image: 'fixture', profile, quality: .9, selection: { method: 'auto', selectedId: 1, reason: 'Test frame', frames: [] } }
}
test('Three strong captures retain each of the twelve exact subtype palettes', () => {
  for (const prototype of SHADOW_SEASON_PROTOTYPES) {
    const r = Array.from({ length: 3 }, () => ({ ...record(undefined, .95), profile: resultFixture('strong', prototype.id) }))
    const p = buildPrecisionProfile(r).profile
    assert.equal(p.analysis.status, 'specific', prototype.id)
    assert.equal(p.analysis.candidates[0].id, prototype.id)
    assert.equal(p.analysis.paletteMode, 'season')
    assert.equal(p.precision!.sensitivity.samples, 81)
  }
})
test('Robust combination is not a simple average; reliable capture outranks weak evidence', () => {
  const a = aggregateDimension([record(-.58,.33), record(-.36,.56), record(-.38,.15)], 'temperature')
  assert.ok(Math.abs(a.score + .36) < .05)
  assert.ok(a.contributions[1].finalShare > 5 * a.contributions[2].finalShare)
  assert.ok(a.score >= -.58 && a.score <= -.36)
})
test('One outlier loses influence, but its disagreement still widens uncertainty', () => {
  const clean = [record(-.4), record(-.39), record(-.41)]
  const dirty = [record(-.4), record(-.39), record(.8)]
  const a = aggregateDimension(clean, 'temperature'), b = aggregateDimension(dirty, 'temperature')
  assert.ok(b.contributions[2].outlierFactor < .02)
  assert.ok(Math.abs(b.score + .4) < .025)
  assert.ok(b.spread > a.spread && b.reliability < a.reliability)
})
test('Two good plus one weak capture cannot substantially displace the shared direction', () => {
  const a = aggregateDimension([record(-.4,.8), record(-.42,.8), record(.8,.05)], 'temperature')
  assert.ok(Math.abs(a.score + .41) < .025)
  assert.ok(a.contributions[2].finalShare < .001)
})
test('Close exposure/lighting variations remain combined without pretending they are identical', () => {
  const records = [record(), record(), record()]
  records.forEach((r, i) => { r.profile.shadowMeasurements.value.score += (i - 1) * .025; r.profile.shadowMeasurements.chroma.score += (i - 1) * .035 })
  const p = buildPrecisionProfile(records).profile.precision!
  assert.ok(p.dimensions.value.spread > 0 && p.dimensions.value.spread < .03)
  assert.ok(p.dimensions.chroma.spread > 0 && p.dimensions.chroma.spread < .04)
})
test('Repeatability gives a bounded bonus; two photos are more conservative than three', () => {
  const records = [record(-.4,.55), record(-.4,.55), record(-.4,.55)]
  const a = aggregateDimension(records, 'temperature'), b = aggregateDimension(records.slice(0,2), 'temperature')
  assert.ok(a.reliability > .55 && a.reliability < .62)
  assert.ok(b.reliability < a.reliability)
  assert.equal(buildPrecisionProfile(records.slice(0,2)).profile.precision!.captureCount,2)
})
test('Unstable temperature preserves steady value/chroma/contrast and nearby candidates', () => {
  const records = [record(-.5,.9),record(.4,.9),record(-.1,.9)]
  records.forEach(r => r.profile.shadowMeasurements.temperature.reliability = .2)
  const p = buildPrecisionProfile(records).profile
  assert.notEqual(p.analysis.status, 'specific')
  assert.equal(p.analysis.dimensions.find(d => d.id === 'temperature')!.resolved,false)
  assert.equal(p.analysis.dimensions.find(d => d.id === 'chroma')!.resolved,true)
  assert.ok(p.analysis.palette.best.length > 0)
})
test('Conflicting high-reliability captures stay broad instead of manufacturing an average winner', () => {
  const records = [-.8, .8, 0].map(value => { const r = record(value,.9); for(const d of ['value','chroma'] as const) r.profile.shadowMeasurements[d].score = value; return r })
  assert.equal(buildPrecisionProfile(records).profile.analysis.resultKind, 'broad-profile')
})
test('A stable Summer/Autumn neighbourhood uses a shared palette, not an arbitrary winner', () => {
  const p = buildPrecisionProfile([record(0,.9),record(0,.9),record(0,.9)]).profile
  assert.equal(p.analysis.resultKind,'candidate-group')
  assert.deepEqual(new Set(p.analysis.candidates.map(c=>c.id)),new Set(['soft-summer','soft-autumn']))
  assert.equal(p.analysis.paletteMode,'consensus')
  assert.ok(p.analysis.palette.best.length > 0)
})
test('A unanimous sensitivity leader uses a meaningful central runner-up, not a zero-win ordering tie', () => {
  const p = buildPrecisionProfile([record(undefined,.95),record(undefined,.95),record(undefined,.95)]).profile
  assert.equal(p.precision!.sensitivity.leaderStability,1)
  assert.equal(p.analysis.runnerUp!.id,p.shadowSeasonClassification.rankings[1].id)
})
test('No reliable evidence gives full plausible ranges and no artificial winner', () => {
  const p = buildPrecisionProfile([record(0,0),record(0,0),record(0,0)]).profile
  assert.equal(p.analysis.resultKind,'broad-profile')
  assert.deepEqual(p.precision!.sensitivity.ranges.temperature,{ low: -1, high: 1 })
  assert.equal(p.precision!.dimensions.temperature.reliability,0)
})
test('44%→45% does not trigger a presentation cliff', () => {
  const a = buildPrecisionProfile([record(-.4,.44),record(-.4,.44),record(-.4,.44)]).profile
  const b = buildPrecisionProfile([record(-.4,.45),record(-.4,.45),record(-.4,.45)]).profile
  assert.equal(a.analysis.resultKind,b.analysis.resultKind)
  assert.ok(Math.abs(a.precision!.sensitivity.ranges.temperature.high - b.precision!.sensitivity.ranges.temperature.high) < .03)
})
test('Aggregation never votes on per-photo seasons or mutates original measurements', () => {
  const records = [record(),record(),record()]
  const before = JSON.stringify(records)
  const first = buildPrecisionProfile(records).profile
  assert.equal(JSON.stringify(records),before)
  records.forEach(r => { r.profile.shadowSeasonClassification.rankings.reverse(); r.profile.analysis.title = 'Unrelated label' })
  assert.deepEqual(buildPrecisionProfile(records).profile.precision!.sensitivity,first.precision!.sensitivity)
})
test('Technical failure cannot enter aggregation and one photo cannot claim precision', () => {
  assert.throws(() => buildPrecisionProfile([record()]))
  const bad = record(); bad.profile = resultFixture('retake')
  assert.throws(() => buildPrecisionProfile([record(),bad]))
})
test('Corroborated mixed light and regional lightness reject the capture regression, never season scores', () => {
  const r = record(), m = r.profile.shadowMeasurements
  m.skinDiagnostics.consistencyScore = .45
  m.skinDiagnostics.regions.forEach((region, i) => region.representative.l = .65 + (i === 0 ? .101 : 0))
  m.lighting.mixedLightingSuspected = true
  const frame = { id: 1, quality: evaluateCaptureQuality(captureFixture()) }
  assert.ok(evaluateCaptureFinalist(frame,capturePhotoEvidence(r.profile)).rejectionReasons.some(r=>r.code==='capture-regional-lighting'))
  m.lighting.mixedLightingSuspected = false
  assert.equal(evaluateCaptureFinalist(frame,capturePhotoEvidence(r.profile)).passed,true)
})
test('Manual override without live metrics can pass full-photo checks without invented live scores', () => {
  const result = evaluateCaptureFinalist({id:0},capturePhotoEvidence(record().profile))
  assert.equal(result.passed,true); assert.equal(result.subscores!.sharpness,0)
})
test('Bare skin, hair, clothing and other foreground are excluded, including resized mixed boundaries', () => {
  for (const category of [1,2,3,4,5]) {
    const mask = {width:20,height:20,categories:new Uint8Array(400)}
    mask.categories[10 * 20 + 10] = category
    assert.equal(isSafeBackgroundReference(mask,.5,.5,20,20),false)
    assert.equal(isSafeBackgroundReference(mask,.4,.5,20,20),false)
    assert.equal(isSafeBackgroundReference(mask,.1,.1,20,20),true)
  }
})
console.log(`\n${passed} precision analysis checks passed.`)
