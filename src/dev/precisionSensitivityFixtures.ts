import { resultFixture } from './resultsFixtures'
import { buildPrecisionProfile } from '../services/buildPrecisionProfile'
import { PRECISION_DIMENSIONS as dimensions } from '../services/precisionAggregation'
import type { PrecisionCaptureRecord } from '../types/precision'

export const PRECISION_SENSITIVITY_SCENARIOS = ['precision-agreement', 'precision-regression', 'precision-weak-outlier', 'precision-temperature-open', 'precision-neighbours', 'precision-conflicting', 'precision-two-photos'] as const
export type PrecisionSensitivityScenario = typeof PRECISION_SENSITIVITY_SCENARIOS[number]

/** Synthetic repeat-photo evidence, not the user's original photographs. The
 * regression supplies aggregate values but not every capture/spread; this
 * fixture explicitly assumes modest variation in the unspecified axes. */
export function precisionSensitivityRecords(scenario: PrecisionSensitivityScenario): PrecisionCaptureRecord[] {
  const records = [0, 1, 2].map(i => {
    const profile = resultFixture('strong')
    for (const d of dimensions) { profile.shadowMeasurements[d].score += (i - 1) * .01; profile.shadowMeasurements[d].reliability = .7 }
    return { image: 'synthetic fixture', profile, quality: .9, selection: { method: 'auto' as const, selectedId: i + 1, reason: 'Synthetic input-quality fixture', frames: [] } }
  })
  if (scenario === 'precision-regression') {
    const centers = { temperature: -.479, value: -.159, chroma: -.565, contrast: .28 }
    const reliability = { temperature: .626, value: .66, chroma: .57, contrast: .64 }
    const changes = { temperature: .06, value: .04, chroma: .04, contrast: .015 }
    records.forEach((r, i) => { for (const d of dimensions) { r.profile.shadowMeasurements[d].score = centers[d] + (i - 1) * changes[d]; r.profile.shadowMeasurements[d].reliability = reliability[d] } })
  }
  if (scenario === 'precision-weak-outlier') {
    records[2].quality = .55
    for (const d of dimensions) { records[2].profile.shadowMeasurements[d].score = d === 'contrast' ? .9 : .8; records[2].profile.shadowMeasurements[d].reliability = .05 }
  }
  if (scenario === 'precision-temperature-open') records.forEach((r, i) => { r.profile.shadowMeasurements.temperature.score = [-.5,.3,.1][i]; r.profile.shadowMeasurements.temperature.reliability = 0 })
  if (scenario === 'precision-neighbours') records.forEach((r, i) => { r.profile.shadowMeasurements.temperature.score = (i - 1) * .02 })
  if (scenario === 'precision-conflicting') records.forEach((r, i) => { for (const d of ['temperature', 'value', 'chroma'] as const) { r.profile.shadowMeasurements[d].score = [-.8, 0, .8][i]; r.profile.shadowMeasurements[d].reliability = .9 } })
  return scenario === 'precision-two-photos' ? records.slice(0, 2) : records
}
export function precisionSensitivityFixture(scenario: PrecisionSensitivityScenario) {
  return buildPrecisionProfile(precisionSensitivityRecords(scenario)).profile
}
