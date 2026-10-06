import { PRECISION_CONFIG } from '../data/precisionConfig'
import { SHADOW_SEASON_CALIBRATION as calibration } from '../data/shadowSeasonCalibration'
import { PRECISION_DIMENSIONS as dimensions } from './precisionAggregation'
import type { AggregatedDimension, PrecisionDimensionUncertainty } from '../types/precision'
import type { ShadowSeasonCoordinates, ShadowSeasonDimension } from '../types/shadowSeasonClassification'

type Matrix = Record<ShadowSeasonDimension, Record<ShadowSeasonDimension, number>>
const policy = PRECISION_CONFIG.sensitivity
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n))
const dimensionBounds = (d: ShadowSeasonDimension): [number, number] => [d === 'contrast' ? 0 : -1, 1]

/** Model-scale prior only; no expert-labelled measurement-error data yet. */
function modelResolution(): number {
  const weight = Object.values(calibration.dimensionWeights).reduce((a, b) => a + b, 0)
  const nearest = calibration.prototypes.map(p => Math.sqrt(Math.min(...calibration.prototypes.filter(q => q.id !== p.id)
    .map(q => dimensions.reduce((s, d) => s + calibration.dimensionWeights[d] * (p.center[d] - q.center[d]) ** 2, 0) / weight))))
    .sort((a, b) => a - b)
  return (nearest[5] + nearest[6]) / 2 * policy.measurementResolutionFraction
}

/** Gaussian multiplier bootstrap of complete capture residual vectors, plus
 * regularized within-photo error. Shared capture multipliers preserve observed
 * cross-axis relationships. With 2–3 photos covariance is low-rank; diagonal
 * measurement error supplies unresolved directions. Aggregation is untouched.
 */
export function samplePrecisionProfiles(profile: Record<ShadowSeasonDimension, AggregatedDimension>) {
  const captureIds = [...new Set(dimensions.flatMap(d => profile[d].contributions.map(c => c.capture)))].sort((a, b) => a - b)
  const resolution = modelResolution()
  const coefficients = {} as Record<ShadowSeasonDimension, number[]>
  const measurementVariance = {} as Record<ShadowSeasonDimension, number>
  const uncertainty = {} as Record<ShadowSeasonDimension, PrecisionDimensionUncertainty>
  for (const d of dimensions) {
    const m = profile[d], [min, max] = dimensionBounds(d), span = max - min
    const usable = m.contributions.filter(c => c.finalShare > 0 && Number.isFinite(c.score) && c.reliability > 0 && c.quality > 0)
    const total = usable.reduce((s, c) => s + c.finalShare, 0)
    const weights = usable.map(c => ({ ...c, weight: c.finalShare / total }))
    const effective = total > 0 ? 1 / weights.reduce((s, c) => s + c.weight ** 2, 0) : 0
    const rawVariance = weights.reduce((s, c) => s + c.weight * (c.score - m.score) ** 2, 0)
    // Weighted sample-variance correction. Near n_eff=1, almost no residual
    // freedom remains: disagreement must not masquerade as a precise mean.
    const correction = effective > 1 ? effective / (effective - 1) : 1
    coefficients[d] = captureIds.map(id => {
      const c = weights.find(c => c.capture === id)
      return c ? Math.sqrt(c.weight * correction / Math.max(1, effective)) * (c.score - m.score) : 0
    })
    const priorSd = resolution * span / 2, uniformVariance = span ** 2 / 12
    const errors = weights.map(c => {
      // Reliability is an operational precision proxy, not a probability.
      const precision = clamp(c.reliability * c.quality, 0, 1)
      return { weight: c.weight, variance: Math.min(uniformVariance,
        priorSd ** 2 * (1 - precision) / Math.max(precision, 1e-6)) }
    })
    const independent = errors.reduce((s, e) => s + e.weight ** 2 * e.variance, 0)
    const shared = errors.reduce((s, e) => s + e.weight * Math.sqrt(e.variance), 0) ** 2
    // Nearby captures share camera/lighting bias; repeating a frame cannot
    // remove this common-error component.
    measurementVariance[d] = (1 - policy.sharedMeasurementVarianceFraction) * independent
      + policy.sharedMeasurementVarianceFraction * shared
    const repeatabilityVariance = coefficients[d].reduce((s, c) => s + c ** 2, 0)
    uncertainty[d] = {
      center: m.score, empiricalSpread: m.spread, robustSpread: Math.sqrt(rawVariance),
      effectiveCaptures: effective, usefulCaptures: m.usefulCaptures,
      qualityWeightedReliability: weights.reduce((s, c) => s + c.weight * c.reliability * c.quality, 0),
      repeatabilityStdError: Math.sqrt(repeatabilityVariance), measurementStdError: Math.sqrt(measurementVariance[d]),
      aggregateStdDev: total > 0 ? Math.sqrt(repeatabilityVariance + measurementVariance[d]) : Math.sqrt(uniformVariance),
      uninformative: total === 0, interval: { low: min, high: max },
    }
  }
  const covariance = Object.fromEntries(dimensions.map(d => [d, Object.fromEntries(dimensions.map(e => [e,
    uncertainty[d].uninformative || uncertainty[e].uninformative ? d === e ? uncertainty[d].aggregateStdDev ** 2 : 0
      : coefficients[d].reduce((s, c, i) => s + c * coefficients[e][i], 0) + (d === e ? measurementVariance[d] : 0),
  ]))])) as Matrix

  let state: number = policy.seed
  const uniform = () => { state |= 0; state = state + 0x6D2B79F5 | 0; let t = Math.imul(state ^ state >>> 15, 1 | state)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(1e-12, uniform()))) * Math.cos(2 * Math.PI * uniform())
  const profiles: ShadowSeasonCoordinates[] = []
  for (let i = 0; i < policy.samples; i++) {
    const multipliers = captureIds.map(() => normal())
    profiles.push(Object.fromEntries(dimensions.map(d => {
      const [min, max] = dimensionBounds(d), u = uncertainty[d]
      const value = u.uninformative ? min + (max - min) * uniform()
        : u.center + coefficients[d].reduce((sum, c, j) => sum + c * multipliers[j], 0) + Math.sqrt(measurementVariance[d]) * normal()
      return [d, clamp(value, min, max)]
    })) as unknown as ShadowSeasonCoordinates)
  }
  for (const d of dimensions) {
    const sorted = profiles.map(p => p[d]).sort((a, b) => a - b)
    const quantile = (p: number) => { const index = (sorted.length - 1) * p, low = Math.floor(index)
      return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low) }
    uncertainty[d].interval = { low: quantile(policy.intervalTail), high: quantile(1 - policy.intervalTail) }
  }
  const means = Object.fromEntries(dimensions.map(d => [d, profiles.reduce((s, p) => s + p[d], 0) / profiles.length])) as unknown as ShadowSeasonCoordinates
  const sampledCovariance = Object.fromEntries(dimensions.map(d => [d, Object.fromEntries(dimensions.map(e => [e,
    profiles.reduce((s, p) => s + (p[d] - means[d]) * (p[e] - means[e]), 0) / profiles.length,
  ]))])) as Matrix
  return { profiles, uncertainty, covariance, sampledCovariance }
}
