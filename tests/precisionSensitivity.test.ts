import assert from 'node:assert/strict'
import { precisionSensitivityRecords } from '../src/dev/precisionSensitivityFixtures'
import { resultFixture } from '../src/dev/resultsFixtures'
import { buildPrecisionProfile } from '../src/services/buildPrecisionProfile'
import { aggregateDimension, PRECISION_DIMENSIONS as dims } from '../src/services/precisionAggregation'
import { assessSeasonSensitivity, summarizeSeasonRobustness } from '../src/services/seasonSensitivity'
import { samplePrecisionProfiles } from '../src/services/precisionUncertainty'
import { buildSeasonAnalysis } from '../src/services/seasonAnalysis'
import { classifyShadowSeason } from '../src/services/shadowSeasonClassifier'
import { SHADOW_SEASON_PROTOTYPES } from '../src/data/shadowSeasonCalibration'
import type { AggregatedDimension, PrecisionCaptureRecord, SeasonSensitivity } from '../src/types/precision'
import type { ShadowSeasonDimension, ShadowSeasonId } from '../src/types/shadowSeasonClassification'

let passed = 0
function test(name: string, fn: () => void) { fn(); passed++; console.log(`✓ ${name}`) }
function aggregated(records: PrecisionCaptureRecord[]) {
  return Object.fromEntries(dims.map(d => [d, aggregateDimension(records, d)])) as Record<ShadowSeasonDimension, AggregatedDimension>
}
function winFixture(shares: Partial<Record<ShadowSeasonId, number>>): SeasonSensitivity['wins'] {
  return SHADOW_SEASON_PROTOTYPES.map(p => ({ id: p.id, label: p.label, share: shares[p.id] ?? 0 })).sort((a,b)=>b.share-a.share)
}

test('Three agreeing moderate captures narrow the estimate relative to one and two captures', () => {
  const rs = precisionSensitivityRecords('precision-agreement')
  for (const r of rs) for (const d of dims) r.profile.shadowMeasurements[d].score = rs[1].profile.shadowMeasurements[d].score
  const one = assessSeasonSensitivity(aggregated(rs.slice(0,1))), two = assessSeasonSensitivity(aggregated(rs.slice(0,2))), three = assessSeasonSensitivity(aggregated(rs))
  for (const d of dims) {
    assert.ok(three.uncertainty[d].aggregateStdDev < two.uncertainty[d].aggregateStdDev)
    assert.ok(two.uncertainty[d].aggregateStdDev < one.uncertainty[d].aggregateStdDev)
    assert.ok(three.uncertainty[d].aggregateStdDev > 0) // shared error survives repetition
  }
  assert.equal(three.state,'specific')
})
test('Two good captures plus a weak outlier preserve the useful season direction and bounded uncertainty', () => {
  const good = precisionSensitivityRecords('precision-agreement'), weak = precisionSensitivityRecords('precision-weak-outlier')
  const a = assessSeasonSensitivity(aggregated(good)), b = assessSeasonSensitivity(aggregated(weak))
  assert.equal(b.wins[0].id,a.wins[0].id)
  assert.notEqual(b.state,'broad-profile')
  for(const d of dims) {
    assert.ok(aggregated(weak)[d].contributions[2].finalShare < .005)
    assert.ok(b.uncertainty[d].aggregateStdDev < a.uncertainty[d].aggregateStdDev * 2)
  }
})
test('Missing temperature keeps the soft Summer/Autumn neighbourhood useful without claiming undertone', () => {
  const p = buildPrecisionProfile(precisionSensitivityRecords('precision-temperature-open')).profile
  assert.equal(p.analysis.resultKind,'candidate-group')
  assert.ok(p.analysis.candidates.some(c=>c.id==='soft-summer') && p.analysis.candidates.some(c=>c.id==='soft-autumn'))
  assert.equal(p.analysis.dimensions.find(d=>d.id==='temperature')!.resolved,false)
  assert.equal(p.analysis.dimensions.find(d=>d.id==='chroma')!.resolved,true)
  assert.equal(p.analysis.paletteMode,'consensus')
})
test('Two competing neighbours remain constrained rather than indeterminate', () => {
  const p = buildPrecisionProfile(precisionSensitivityRecords('precision-neighbours')).profile
  assert.equal(p.analysis.resultKind,'candidate-group')
  assert.equal(p.analysis.quality.classificationCertainty.status,'constrained')
})
test('Genuinely conflicting cross-family captures remain indeterminate', () => {
  const p = buildPrecisionProfile(precisionSensitivityRecords('precision-conflicting')).profile
  assert.equal(p.analysis.resultKind,'broad-profile')
  assert.equal(p.analysis.quality.classificationCertainty.status,'indeterminate')
  assert.ok(p.precision!.sensitivity.familyWins.filter(f=>f.share>.1).length>=2)
})
test('The supplied coherent aggregate profile never loses all recommendations to a starter state', () => {
  // Full source captures were not supplied. Reconstruct equal-weight repeats
  // around the reported aggregate; unspecified spreads are modest (not truth).
  const values = {temperature:[-.479,.626,.049],value:[-.159,.66,.04],chroma:[-.565,.57,.04],contrast:[.28,.64,.015]}
  const a = Object.fromEntries(dims.map(d => {
    const [score,reliability,spread]=values[d]
    return [d,{ score,reliability,spread,effectiveCaptures:3,usefulCaptures:3,
      contributions:[-1,0,1].map((offset,i)=>({capture:i+1,score:score+offset*spread*Math.sqrt(1.5),reliability,quality:.9,initialWeight:reliability**2*.9,outlierFactor:1,finalShare:1/3})) }]
  })) as Record<ShadowSeasonDimension,AggregatedDimension>
  const measurements = resultFixture('strong').shadowMeasurements
  for(const d of dims) {measurements[d].score=a[d].score;measurements[d].reliability=a[d].reliability}
  const c = classifyShadowSeason(measurements), s = assessSeasonSensitivity(a,c.rankings[0].id)
  const result = buildSeasonAnalysis(measurements,c,s)
  assert.equal(c.rankings[0].id,'soft-summer')
  assert.notEqual(result.resultKind,'broad-profile')
  assert.notEqual(result.paletteMode,'starter')
  assert.ok(result.dimensions.filter(d=>d.resolved).length>=3)
  assert.ok(s.uncertainty.temperature.aggregateStdDev < .1)
  assert.equal(s.originalTopRetainedShare,s.wins.find(w=>w.id===c.rankings[0].id)!.share)
})
test('70/20/8 nearby wins permit a moderate exact season; 45/30/22 produce a coherent group', () => {
  const specific = summarizeSeasonRobustness(winFixture({'soft-summer':.7,'cool-summer':.2,'soft-autumn':.08,'bright-spring':.02}))
  assert.equal(specific.state,'specific'); assert.equal(specific.confidence,'moderate')
  const constrained = summarizeSeasonRobustness(winFixture({'soft-summer':.45,'cool-summer':.3,'soft-autumn':.22,'bright-spring':.03}))
  assert.equal(constrained.state,'candidate-group')
  assert.deepEqual(new Set(constrained.candidateIds),new Set(['soft-summer','cool-summer','soft-autumn']))
})
test('Strong but radically split wins cannot masquerade as a stable season neighbourhood', () => {
  const s = summarizeSeasonRobustness(winFixture({'soft-summer':.7,'bright-spring':.3}))
  assert.equal(s.state,'broad-profile')
})
test('Observed cross-dimension covariance survives the multiplier bootstrap', () => {
  const rs = precisionSensitivityRecords('precision-agreement')
  rs.forEach((r,i)=>{for(const d of dims)r.profile.shadowMeasurements[d].reliability=1;r.quality=1
    r.profile.shadowMeasurements.temperature.score=(i-1)*.02;r.profile.shadowMeasurements.value.score=(i-1)*.04})
  const s = samplePrecisionProfiles(aggregated(rs))
  assert.ok(s.covariance.temperature.value>0)
  for(const p of s.profiles)assert.ok(Math.abs(p.value-2*p.temperature)<1e-12)
})
test('Lower capture quality increases uncertainty and low influence reduces effective capture count', () => {
  const rs = precisionSensitivityRecords('precision-agreement'), normal = assessSeasonSensitivity(aggregated(rs))
  rs.forEach(r=>r.quality=.4)
  const lower = assessSeasonSensitivity(aggregated(rs))
  assert.ok(lower.uncertainty.temperature.aggregateStdDev>normal.uncertainty.temperature.aggregateStdDev)
  rs[2].profile.shadowMeasurements.temperature.reliability=.05
  assert.ok(assessSeasonSensitivity(aggregated(rs)).uncertainty.temperature.effectiveCaptures<2.1)
})
test('Seeded simulations are reproducible, bounded and do not mutate aggregation or consume per-photo seasons', () => {
  const rs = precisionSensitivityRecords('precision-regression'), a = aggregated(rs), before = JSON.stringify(a)
  const first = assessSeasonSensitivity(a), second = assessSeasonSensitivity(a)
  assert.deepEqual(first,second);assert.equal(JSON.stringify(a),before)
  for(const p of samplePrecisionProfiles(a).profiles)for(const d of dims)assert.ok(p[d]>= (d==='contrast'?0:-1) && p[d]<=1)
  assert.ok(Math.abs(first.wins.reduce((s,w)=>s+w.share,0)-1)<1e-9)
  assert.ok(Math.abs(first.familyWins.reduce((s,w)=>s+w.share,0)-1)<1e-9)
})
console.log(`\n${passed} sampled precision sensitivity checks passed.`)
