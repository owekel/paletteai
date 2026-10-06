import type { ColorProfile } from '../types/colorProfile'
import type { PrecisionCaptureRecord, PrecisionDiagnostics } from '../types/precision'
import { PRECISION_CONFIG } from '../data/precisionConfig'
import { aggregateDimension, PRECISION_DIMENSIONS } from './precisionAggregation'
import { assessSeasonSensitivity } from './seasonSensitivity'
import { classifyShadowSeason } from './shadowSeasonClassifier'
import { buildSeasonAnalysis } from './seasonAnalysis'

export function buildPrecisionProfile(records: PrecisionCaptureRecord[]): { image: string; profile: ColorProfile } {
  if (records.length < 2 || records.length > 3 || records.some(r => r.profile.analysis.quality.imageQuality.status !== 'usable')) {
    throw new Error('Precision analysis requires two or three technically usable captures.')
  }
  // Image/feature diagnostics are from an actual reference capture, never
  // fabricated by averaging segmentation, pixels or per-photo quality flags.
  const reference = records.reduce((best, r, i) => r.quality > records[best].quality ? i : best, 0)
  const base = records[reference].profile
  const dimensions = Object.fromEntries(PRECISION_DIMENSIONS.map(d => [d, aggregateDimension(records, d)])) as PrecisionDiagnostics['dimensions']
  const combined = <T extends { score: number; reliability: number }>(original: T, d: keyof typeof dimensions): T =>
    ({ ...original, score: dimensions[d].score, reliability: dimensions[d].reliability })
  const measurements = { ...base.shadowMeasurements,
    temperature: combined(base.shadowMeasurements.temperature, 'temperature'), value: combined(base.shadowMeasurements.value, 'value'),
    chroma: combined(base.shadowMeasurements.chroma, 'chroma'), contrast: combined(base.shadowMeasurements.contrast, 'contrast') }
  const classification = classifyShadowSeason(measurements)
  const sensitivity = assessSeasonSensitivity(dimensions, classification.rankings[0].id)
  const analysis = buildSeasonAnalysis(measurements, classification, sensitivity)
  analysis.dimensions = analysis.dimensions.map(d => ({ ...d, description: d.description.replace('This photo does not settle', 'These captures do not settle') }))
  analysis.paletteDescription = analysis.paletteDescription.replace('your photo supports', 'your captures support').replace('the photo has not established', 'the captures have not established')
  const count = records.length === 3 ? 'three' : 'two'
  const consistent = analysis.dimensions.filter(d => d.resolved).map(d => d.label.toLowerCase())
  const supported = consistent.length ? `Your ${consistent.join(', ')} held a consistent direction across your ${count} captures.` : `Your ${count} captures give us a starting point for colour comparisons, but do not yet settle a single colour direction.`
  analysis.summary = analysis.status === 'specific'
    ? sensitivity.confidence === 'moderate'
      ? `Your ${count} captures lean towards ${analysis.title}. It leads across most of the variations we checked, with nearby seasons still worth exploring. Start with this palette and compare the finer differences on your photo.`
      : `Your ${count} captures point towards ${analysis.title}, which stays the closest match across most of the variations we checked. Explore this palette as a starting point, not a fixed rule.`
    : `${supported} ${analysis.unresolved.length ? `We’re keeping ${analysis.unresolved.join(', ')} open. ` : ''}${analysis.resultKind === 'candidate-group' ? 'Start with colours shared by the nearby seasons below.' : 'Use the comparisons below to explore what feels most natural on you.'}`
  if (records.length === 2) analysis.summary += ' This uses two good photos; we’ve allowed more room for uncertainty than with three.'
  const precision: PrecisionDiagnostics = { version: PRECISION_CONFIG.version, captureCount: records.length, referenceCapture: reference + 1, dimensions, sensitivity,
    captures: records.map(r => ({ quality: r.quality, measurements: Object.fromEntries(PRECISION_DIMENSIONS.map(d => [d, { score: r.profile.shadowMeasurements[d].score, reliability: r.profile.shadowMeasurements[d].reliability }])) as PrecisionDiagnostics['captures'][number]['measurements'],
      skin: r.profile.shadowMeasurements.skinDiagnostics, lighting: r.profile.shadowMeasurements.lighting,
      imageQuality: r.profile.analysis.quality.imageQuality, selection: r.selection })) }
  return { image: records[reference].image, profile: { ...base, shadowMeasurements: measurements, shadowSeasonClassification: classification, analysis, precision } }
}
