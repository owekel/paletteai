import type { ColorProfile } from '../types/colorProfile'

export const PRECISION_LIGHTING_SCENARIOS = ['precision-lighting-good', 'precision-lighting-dim', 'precision-lighting-mixed', 'precision-lighting-neutral-weak', 'precision-lighting-one-weak'] as const
export type PrecisionLightingScenario = typeof PRECISION_LIGHTING_SCENARIOS[number]

/** Synthetic quality diagnostics only; never modifies production measurements. */
export function applyPrecisionLightingFixture(profile: ColorProfile, scenario: PrecisionLightingScenario, moment = 1) {
  const m = profile.shadowMeasurements
  Object.assign(m.lighting, { spatialDisagreement: .0129, mixedLightingSuspected: false,
    backgroundCandidateCount: 2000, candidateConsistency: .86, neutralReferenceConfidence: .7,
    reliability: .6, correctionApplied: true, correctionStrength: .25 })
  m.skinDiagnostics.consistencyScore = .9
  m.skinDiagnostics.likelyCause = 'consistent'
  m.skinDiagnostics.regions.forEach((r, i) => { r.representative.l = .65 + (i === 0 ? .02 : 0) })
  m.features.skin.clippedFraction = .01
  Object.assign(m.stabilityDiagnostics.exposure, { reliability: .9, clippingScore: .9, skinExposurePlausibility: .9 })
  if (scenario === 'precision-lighting-dim') {
    m.skinDiagnostics.regions.forEach(r => { r.representative.l -= .15 })
    m.stabilityDiagnostics.exposure.reliability = .7
  }
  if (scenario === 'precision-lighting-neutral-weak') Object.assign(m.lighting, {
    neutralReferenceConfidence: .16, reliability: .14, correctionApplied: false, correctionStrength: 0 })
  if (scenario === 'precision-lighting-mixed' || scenario === 'precision-lighting-one-weak' && moment === 3) Object.assign(m.lighting, {
    spatialDisagreement: .0584, mixedLightingSuspected: true, candidateConsistency: .35,
    neutralReferenceConfidence: .4, reliability: .14, correctionApplied: false, correctionStrength: 0 })
  return profile
}
