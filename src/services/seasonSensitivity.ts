import { PRECISION_CONFIG } from '../data/precisionConfig'
import { SHADOW_SEASON_CALIBRATION as calibration } from '../data/shadowSeasonCalibration'
import { PRECISION_DIMENSIONS as dimensions } from './precisionAggregation'
import { samplePrecisionProfiles } from './precisionUncertainty'
import type { AggregatedDimension, SeasonSensitivity } from '../types/precision'
import type { ShadowSeasonCoordinates, ShadowSeasonDimension, ShadowSeasonId } from '../types/shadowSeasonClassification'

const policy = PRECISION_CONFIG.sensitivity
type Win = SeasonSensitivity['wins'][number]
function distances(values: ShadowSeasonCoordinates): number[] {
  // Each simulation is a plausible true person-level profile. Uncertainty is
  // already sampled: use v3 base weights without a second reliability discount.
  // The central reliability-weighted classifier is retained separately.
  return calibration.prototypes.map(p => dimensions.reduce((sum, d) =>
    sum + calibration.dimensionWeights[d] * (values[d] - p.center[d]) ** 2, 0))
}
function nearby(a: ShadowSeasonId, b: ShadowSeasonId): boolean {
  const x = calibration.prototypes.find(p => p.id === a)!.center, y = calibration.prototypes.find(p => p.id === b)!.center
  const totalWeight = Object.values(calibration.dimensionWeights).reduce((a, b) => a + b, 0)
  return Math.sqrt(dimensions.reduce((sum, d) => sum + calibration.dimensionWeights[d] * (x[d] - y[d]) ** 2, 0) / totalWeight) <= policy.maximumNeighbourDistance
}

/** Soft Summer/Cool Summer/Soft Autumn can form a coherent neighbourhood around
 * Soft Summer without requiring both outer members to be equally close. */
export function summarizeSeasonRobustness(wins: Win[]) {
  const ordered = [...wins].sort((a, b) => b.share - a.share)
  const neighbourhoods = ordered.filter(w => w.share > 0).map(center => {
    const members = ordered.filter(w => w.share > 0 && nearby(center.id, w.id))
    return { center: center.id, label: center.label, members: members.map(w => w.id), share: members.reduce((s, w) => s + w.share, 0) }
  }).sort((a, b) => b.share - a.share)
  const leader = ordered[0], runner = ordered[1]
  const leaderNeighbourhood = neighbourhoods.find(n => n.center === leader.id)!
  const coherent = neighbourhoods.map(n => {
    const group = ordered.filter(w => n.members.includes(w.id)).slice(0, policy.maximumGroupSize)
    return { group, coverage: group.reduce((s, w) => s + w.share, 0) }
  }).filter(n => n.group.some(w => w.id === leader.id)).sort((a, b) => b.coverage - a.coverage)[0]
  const specific = leader.share >= policy.stableLeader && leader.share - runner.share >= policy.minimumLeaderMargin
    && leaderNeighbourhood.share >= policy.groupCoverage
  const state = specific ? 'specific' : coherent?.coverage >= policy.groupCoverage ? 'candidate-group' : 'broad-profile'
  const confidence = state === 'specific' ? leader.share >= policy.strongLeader ? 'strong' : 'moderate' : 'exploratory'
  const reason = specific ? `${leader.label} wins ${(leader.share * 100).toFixed(1)}% of plausible profiles; ${(leaderNeighbourhood.share * 100).toFixed(1)}% stay in its neighbourhood.`
    : state === 'candidate-group' ? `Neighbouring alternatives together win ${(coherent.coverage * 100).toFixed(1)}%; no exact season has a sufficiently stable lead.`
      : `The strongest group of up to three neighbours covers ${((coherent?.coverage ?? 0) * 100).toFixed(1)}%; plausible winners span broader directions.`
  return { state, confidence, reason, neighbourhoods, groupStability: coherent?.coverage ?? 0,
    candidateIds: specific ? [leader.id] : state === 'candidate-group' ? coherent.group.map(w => w.id) : [] } as const
}

export function assessSeasonSensitivity(profile: Record<ShadowSeasonDimension, AggregatedDimension>, originalTopId?: ShadowSeasonId): SeasonSensitivity {
  const { profiles, uncertainty, covariance, sampledCovariance } = samplePrecisionProfiles(profile)
  const counts = calibration.prototypes.map(() => 0)
  const rankings = profiles.map(values => {
    const ds = distances(values), min = Math.min(...ds)
    const tied = ds.map((v, i) => Math.abs(v - min) < 1e-10 ? i : -1).filter(i => i >= 0)
    for (const index of tied) counts[index] += 1 / tied.length
    return ds
  })
  const wins = calibration.prototypes.map((p, i) => ({ id: p.id, label: p.label, share: counts[i] / profiles.length })).sort((a, b) => b.share - a.share)
  const robustness = summarizeSeasonRobustness(wins)
  const familyWins = (['spring', 'summer', 'autumn', 'winter'] as const).map(family =>
    ({ family, share: wins.filter(w => w.id.endsWith(family)).reduce((s, w) => s + w.share, 0) })).sort((a, b) => b.share - a.share)
  const original = originalTopId ?? wins[0].id
  const mostCommonAlternative = wins.find(w => w.id !== original && w.share > 0) ?? null
  const originalIndex = calibration.prototypes.findIndex(p => p.id === original)
  const alternativeIndex = mostCommonAlternative ? calibration.prototypes.findIndex(p => p.id === mostCommonAlternative.id) : -1
  const band = (d: ShadowSeasonDimension, v: number) => {
    const [low, high] = d === 'contrast' ? [0.33, 0.67] : d === 'temperature' ? [-0.3, 0.3] : [-0.35, 0.35]
    return v <= low ? -1 : v >= high ? 1 : 0
  }
  const dimensionSupport = Object.fromEntries(dimensions.map(d => [d,
    uncertainty[d].uninformative ? 0 : profiles.filter(p => band(d, p[d]) === band(d, profile[d].score)).length / profiles.length,
  ])) as Record<ShadowSeasonDimension, number>
  return { version: policy.version, ranges: Object.fromEntries(dimensions.map(d => [d, uncertainty[d].interval])) as SeasonSensitivity['ranges'],
    uncertainty, covariance, sampledCovariance, dimensionSupport,
    supportedDimensions: dimensions.filter(d => dimensionSupport[d] >= policy.supportedBandShare),
    samples: profiles.length, wins, leaderStability: wins[0].share, ...robustness, familyWins,
    originalTopId: original, originalTopRetainedShare: wins.find(w => w.id === original)!.share,
    mostCommonAlternative,
    topVsRunner: mostCommonAlternative ? { id: mostCommonAlternative.id,
      aheadShare: rankings.filter(ds => ds[originalIndex] < ds[alternativeIndex]).length / profiles.length,
      meanSquaredDistanceMargin: rankings.reduce((s, ds) => s + ds[alternativeIndex] - ds[originalIndex], 0) / profiles.length } : null,
  }
}
