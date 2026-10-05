import { PRECISION_CONFIG as C } from '../data/precisionConfig'
import type { AggregatedDimension, PrecisionCaptureRecord } from '../types/precision'
import type { ShadowSeasonDimension } from '../types/shadowSeasonClassification'

export const PRECISION_DIMENSIONS: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma', 'contrast']
const clamp = (n: number) => Math.max(0, Math.min(1, n))
function weightedMedian(items: { value: number; weight: number }[]): number {
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const half = sorted.reduce((s, v) => s + v.weight, 0) / 2
  let sum = 0
  for (const item of sorted) { sum += item.weight; if (sum >= half) return item.value }
  return 0
}

export function aggregateDimension(records: PrecisionCaptureRecord[], dimension: ShadowSeasonDimension): AggregatedDimension {
  const contributions = records.map((record, capture) => {
    const m = record.profile.shadowMeasurements[dimension]
    const reliability = Number.isFinite(m.score) && Number.isFinite(m.reliability) ? clamp(m.reliability) : 0
    return { capture: capture + 1, score: Number.isFinite(m.score) ? m.score : 0, reliability,
      quality: clamp(record.quality), initialWeight: reliability ** 2 * clamp(record.quality), outlierFactor: 1, finalShare: 0 }
  })
  const total = contributions.reduce((s, c) => s + c.initialWeight, 0)
  if (!total) return { score: dimension === 'contrast' ? 0.5 : 0, reliability: 0, spread: 0,
    usefulCaptures: 0, effectiveCaptures: 0, contributions }
  const median = weightedMedian(contributions.map(c => ({ value: c.score, weight: c.initialWeight })))
  const mad = weightedMedian(contributions.map(c => ({ value: Math.abs(c.score - median), weight: c.initialWeight })))
  const scale = Math.max(C.aggregation.residualFloor * (dimension === 'contrast' ? 0.5 : 1), 1.4826 * mad)
  // Robust centroid around the weighted median. With only two captures we
  // cannot identify an outlier: keep both, and expose their disagreement.
  for (const c of contributions) c.outlierFactor = records.length < 3 ? 1 : Math.min(1, (scale / Math.max(scale, Math.abs(c.score - median))) ** 2)
  const robustTotal = contributions.reduce((s, c) => s + c.initialWeight * c.outlierFactor, 0)
  for (const c of contributions) c.finalShare = c.initialWeight * c.outlierFactor / robustTotal
  const score = contributions.reduce((s, c) => s + c.score * c.finalShare, 0)
  // BEFORE robust downweighting: disagreement must not disappear just because
  // a discordant capture loses influence over the combined coordinate.
  const spread = Math.sqrt(contributions.reduce((s, c) => s + c.initialWeight * (c.score - score) ** 2, 0) / total)
  const effectiveCaptures = 1 / contributions.reduce((s, c) => s + c.finalShare ** 2, 0)
  const baseline = contributions.reduce((s, c) => s + c.reliability * c.finalShare, 0)
  const normalizedSpread = spread * (dimension === 'contrast' ? 2 : 1)
  const agreement = Math.exp(-((normalizedSpread / C.aggregation.disagreementScale) ** 2))
  const bonus = C.aggregation.agreementBonus * Math.max(0, effectiveCaptures - 1) / 2 * (1 - baseline) * agreement
  const reliability = clamp((baseline + bonus) * agreement * (records.length === 2 ? C.aggregation.twoPhotoPenalty : 1))
  return { score, reliability, spread, effectiveCaptures, usefulCaptures: contributions.filter(c => c.finalShare >= 0.05 && c.reliability > 0).length, contributions }
}
