import type { ColorProfile } from './colorProfile'
import type { CaptureSelection } from './capture'
import type { ShadowSeasonDimension, ShadowSeasonId } from './shadowSeasonClassification'

export interface PrecisionCaptureRecord {
  image: string
  profile: ColorProfile
  selection: CaptureSelection
  quality: number
}
export interface AggregatedDimension {
  score: number
  reliability: number
  spread: number
  usefulCaptures: number
  effectiveCaptures: number
  contributions: { capture: number; score: number; reliability: number; quality: number;
    initialWeight: number; outlierFactor: number; finalShare: number }[]
}
export interface SeasonSensitivity {
  version: 'precision-v1'
  ranges: Record<ShadowSeasonDimension, { low: number; high: number }>
  supportedDimensions: ShadowSeasonDimension[]
  samples: number
  wins: { id: ShadowSeasonId; label: string; share: number }[]
  leaderStability: number
  groupStability: number
  state: 'specific' | 'candidate-group' | 'broad-profile'
  candidateIds: ShadowSeasonId[]
}
export interface PrecisionDiagnostics {
  version: 'precision-v1'
  captureCount: number
  referenceCapture: number
  captures: { quality: number; measurements: Record<ShadowSeasonDimension, { score: number; reliability: number }>;
    skin: ColorProfile['shadowMeasurements']['skinDiagnostics']; lighting: ColorProfile['shadowMeasurements']['lighting'];
    imageQuality: ColorProfile['analysis']['quality']['imageQuality']; selection: CaptureSelection }[]
  dimensions: Record<ShadowSeasonDimension, AggregatedDimension>
  sensitivity: SeasonSensitivity
}
