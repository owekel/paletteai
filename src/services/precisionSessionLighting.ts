import { PRECISION_LIGHTING_CONFIG as C } from '../data/precisionLightingConfig'
import type { PrecisionCaptureRecord } from '../types/precision'
import type { PrecisionLightingCapture, PrecisionSessionLighting, SessionLightingCause } from '../types/precisionLighting'

// Intentionally consumes only photographic diagnostics. No colour coordinates,
// dimension reliability, classifier output, aggregate or sensitivity is read.
export type PrecisionLightingInput = Pick<PrecisionCaptureRecord, 'profile'>
const clamp = (x: number) => Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0
const rising = (x: number, low: number, high: number) => clamp((x - low) / (high - low))
const falling = (x: number, high: number, low: number) => rising(high - x, 0, high - low)
const causes: SessionLightingCause[] = ['mixed-lighting', 'uneven-illumination', 'exposure-clipping']
export const PRECISION_LIGHTING_GUIDANCE = 'For a more reliable result, move toward soft, even lighting and try again.'

export function assessPrecisionSessionLighting(records: PrecisionLightingInput[]): PrecisionSessionLighting {
  if (records.length < 2 || records.length > 3) throw new Error('A Precision lighting check needs two or three captures.')
  const captures = records.map(({ profile }, index): PrecisionLightingCapture => {
    const { lighting, skinDiagnostics: skin, features, stabilityDiagnostics } = profile.shadowMeasurements
    const exposure = stabilityDiagnostics.exposure
    const regions = skin.regions.filter(r => r.name !== 'fallback' && r.usedLandmarkPolygon
      && r.retainedPixelCount >= 40 && r.reliability >= 0.2 && Number.isFinite(r.representative.l))
    const levels = regions.map(r => r.representative.l)
    const delta = new Set(regions.map(r => r.name)).size === 3 ? Math.max(...levels) - Math.min(...levels) : null
    const spatial = lighting.spatialDisagreement
    // An absent/tinted neutral reference alone is not evidence of mixed light.
    // Spatial suspicion must be backed by a sampled background, substantial
    // disagreement and failure to establish one dependable illuminant.
    const spatialSeverity = lighting.mixedLightingSuspected && lighting.backgroundCandidateCount >= C.minimumBackgroundCandidates
      && spatial !== null ? rising(spatial, C.spatial.warning, C.spatial.severe) : 0
    // Normalization reliability is consistency × neutrality. Its decline
    // corroborates mixed light only when candidate agreement is also weak;
    // uncertainty about whether a wall is neutral must not act as damage.
    const weakNormalization = falling(lighting.reliability, C.normalization.weak, C.normalization.veryWeak)
      * falling(lighting.candidateConsistency, C.candidateConsistency.weak, C.candidateConsistency.veryWeak)
    const mixed = spatialSeverity > 0 ? spatialSeverity * (0.65 + 0.35 * weakNormalization) : 0
    // Low consistency caused by redness/regional colour variation is not a
    // lighting failure. Require actual regional lightness imbalance as well.
    const regionalSeverity = delta === null ? 0 : rising(delta, C.regional.warning, C.regional.severe)
    const consistencyConcern = falling(skin.consistencyScore, C.consistency.weak, C.consistency.veryWeak)
    const uneven = regionalSeverity * consistencyConcern * (skin.likelyCause === 'uneven-lighting' ? 1 : 0.5)
    // Dark skin or a uniform dim scene is never a stand-alone rejection.
    // Exposure must be accompanied by measurable loss of facial detail.
    const weakExposure = falling(exposure.reliability, C.exposure.weak, C.exposure.veryWeak)
    // The global clipping score includes dark hair/irises. It cannot stand in
    // for lost facial detail or otherwise dark-haired people could be rejected.
    const lostDetail = rising(features.skin.clippedFraction, C.clipping.warning, C.clipping.severe)
    const exposureRisk = lostDetail * (0.65 + 0.35 * weakExposure)
    const risks = { 'mixed-lighting': mixed, 'uneven-illumination': uneven, 'exposure-clipping': exposureRisk }
    // Related signals within a domain are combined once, not counted as
    // independent votes. A second distinct domain can modestly corroborate.
    const sorted = Object.values(risks).sort((a, b) => b - a)
    const risk = clamp(sorted[0] + 0.2 * sorted[1])
    const reasons: string[] = []
    if (mixed > 0) reasons.push(`Spatial illuminant disagreement ${spatial!.toFixed(4)} with mixed-light suspicion; candidate consistency ${lighting.candidateConsistency.toFixed(3)}, normalization reliability ${(lighting.reliability * 100).toFixed(0)}%.`)
    if (uneven > 0) reasons.push(`Regional ΔL ${delta!.toFixed(3)}, skin consistency ${skin.consistencyScore.toFixed(3)}, diagnosed ${skin.likelyCause}.`)
    if (exposureRisk > 0) reasons.push(`Skin clipping ${(features.skin.clippedFraction * 100).toFixed(1)}%, clipping score ${exposure.clippingScore.toFixed(3)}, exposure reliability ${exposure.reliability.toFixed(3)}.`)
    if (!reasons.length) reasons.push('No corroborated lighting damage. Dimness, weak neutral-reference confidence and no white-balance correction are not failures by themselves.')
    if (delta === null) reasons.push('Three-region comparison unavailable; the existing per-photo technical checks remain responsible for sampling usability.')
    return { capture: index + 1, signals: { lighting: { ...lighting }, maximumRegionalDeltaL: delta,
      skinConsistency: skin.consistencyScore, skinLikelyCause: skin.likelyCause, usableSkinRegions: regions.length,
      skinClippedFraction: features.skin.clippedFraction, exposureReliability: exposure.reliability,
      clippingScore: exposure.clippingScore, skinExposurePlausibility: exposure.skinExposurePlausibility },
      risks, risk, affected: risk >= C.captureRisk, reasons }
  })
  const required = Math.ceil(records.length * C.minimumAffectedFraction)
  const affected = captures.filter(c => c.affected)
  const meanRisk = captures.reduce((sum, c) => sum + c.risk, 0) / captures.length
  const sorted = captures.map(c => c.risk).sort((a, b) => a - b)
  const medianRisk = sorted.length === 2 ? (sorted[0] + sorted[1]) / 2 : sorted[1]
  const recurringCauses = causes.filter(cause => captures.filter(c => c.risks[cause] >= C.captureRisk).length >= required)
  const reject = affected.length >= required
  const reason = reject
    ? `${affected.length}/${captures.length} captures show corroborated lighting risk (mean ${meanRisk.toFixed(3)}). ${recurringCauses.length ? `Recurring: ${recurringCauses.join(', ')}.` : 'Different lighting problems recur across the set.'} Reacquire the whole scan; repeated frames cannot remove systematic illumination bias.`
    : affected.length
      ? `Passed: lighting problems affect ${affected.length}/${captures.length} captures, below the repeated-session requirement of ${required}. A single weak moment does not invalidate the set.`
      : 'Passed: no recurring, corroborated evidence of illumination bias. Moderate/absent neutral-reference confidence, uniform dimness and unapplied correction are allowed.'
  return { version: C.version, status: reject ? 'reacquire-required' : 'suitable', captures,
    affectedCaptures: affected.map(c => c.capture), requiredAffectedCaptures: required, meanRisk, medianRisk,
    recurringCauses, reason, guidance: reject ? PRECISION_LIGHTING_GUIDANCE : null }
}

export class PrecisionSessionLightingError extends Error {
  constructor(public readonly diagnostics: PrecisionSessionLighting) {
    super(PRECISION_LIGHTING_GUIDANCE)
    this.name = 'PrecisionSessionLightingError'
  }
}
