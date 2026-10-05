import { PRECISION_CONFIG as C } from '../data/precisionConfig'
import { SHADOW_SEASON_CALIBRATION as calibration } from '../data/shadowSeasonCalibration'
import { PRECISION_DIMENSIONS as dimensions } from './precisionAggregation'
import type { AggregatedDimension, SeasonSensitivity } from '../types/precision'
import type { ShadowSeasonDimension } from '../types/shadowSeasonClassification'

/** 3^4 deterministic stress samples, NOT probabilities of a person's season.
 * Uncertainty is represented in coordinate ranges, so the sampled hypotheses
 * use the original base-weight geometry (not zero weight for a missing axis).
 * Otherwise missing temperature would never be allowed to change the winner.
 */
export function assessSeasonSensitivity(profile: Record<ShadowSeasonDimension, AggregatedDimension>): SeasonSensitivity {
  const ranges = Object.fromEntries(dimensions.map(d => {
    const m = profile[d], min = d === 'contrast' ? 0 : -1, max = 1
    const floor = C.sensitivity.rangeFloor * (d === 'contrast' ? 0.5 : 1)
    const uncertainty = (1 - m.reliability) ** 2
    const extra = floor + C.sensitivity.spreadMultiplier * m.spread
    return [d, { low: Math.max(min, m.score - (m.score - min) * uncertainty - extra),
      high: Math.min(max, m.score + (max - m.score) * uncertainty + extra) }]
  })) as SeasonSensitivity['ranges']
  const counts = calibration.prototypes.map(() => 0)
  for (let sample = 0; sample < 81; sample++) {
    let code = sample
    const values = dimensions.map(d => { const step = code % 3; code = Math.floor(code / 3)
      return step === 0 ? ranges[d].low : step === 2 ? ranges[d].high : profile[d].score })
    const distances = calibration.prototypes.map(p => dimensions.reduce((sum, d, i) =>
      sum + calibration.dimensionWeights[d] * (values[i] - p.center[d]) ** 2, 0))
    const min = Math.min(...distances), tied = distances.map((v, i) => Math.abs(v - min) < 1e-10 ? i : -1).filter(i => i >= 0)
    for (const index of tied) counts[index] += 1 / tied.length
  }
  const wins = calibration.prototypes.map((p, i) => ({ id: p.id, label: p.label, share: counts[i] / 81 })).sort((a, b) => b.share - a.share)
  const group = wins.slice(0, C.sensitivity.maximumGroupSize).filter(w => w.share > 0)
  const groupStability = group.reduce((sum, w) => sum + w.share, 0)
  const weight = Object.values(calibration.dimensionWeights).reduce((a, b) => a + b, 0)
  const neighbours = group.every(a => group.every(b => {
    const x = calibration.prototypes.find(p => p.id === a.id)!.center, y = calibration.prototypes.find(p => p.id === b.id)!.center
    return Math.sqrt(dimensions.reduce((sum, d) => sum + calibration.dimensionWeights[d] * (x[d] - y[d]) ** 2, 0) / weight) <= C.sensitivity.maximumNeighbourDistance
  }))
  const state = wins[0].share >= C.sensitivity.stableLeader ? 'specific'
    : groupStability >= C.sensitivity.groupCoverage && neighbours ? 'candidate-group' : 'broad-profile'
  // Consumer descriptions only if the whole plausible interval stays in the
  // same descriptive band. This replaces the binary 45% reliability cliff.
  const band = (d: ShadowSeasonDimension, v: number) => {
    const [low, high] = d === 'contrast' ? [0.33, 0.67] : d === 'temperature' ? [-0.3, 0.3] : [-0.35, 0.35]
    return v <= low ? -1 : v >= high ? 1 : 0
  }
  const supportedDimensions = dimensions.filter(d => band(d, ranges[d].low) === band(d, ranges[d].high))
  return { version: C.version, ranges, supportedDimensions, samples: 81, wins, leaderStability: wins[0].share,
    groupStability, state, candidateIds: state === 'specific' ? [wins[0].id] : state === 'candidate-group' ? group.map(w => w.id) : [] }
}
