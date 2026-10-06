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
  version: 'precision-sensitivity-v2'
  ranges: Record<ShadowSeasonDimension, { low: number; high: number }>
  uncertainty: Record<ShadowSeasonDimension, PrecisionDimensionUncertainty>
  covariance: Record<ShadowSeasonDimension, Record<ShadowSeasonDimension, number>>
  sampledCovariance: Record<ShadowSeasonDimension, Record<ShadowSeasonDimension, number>>
  dimensionSupport: Record<ShadowSeasonDimension, number>
  supportedDimensions: ShadowSeasonDimension[]
  samples: number
  wins: { id: ShadowSeasonId; label: string; share: number }[]
  leaderStability: number
  groupStability: number
  familyWins: { family: 'spring' | 'summer' | 'autumn' | 'winter'; share: number }[]
  neighbourhoods: { center: ShadowSeasonId; label: string; members: ShadowSeasonId[]; share: number }[]
  originalTopId: ShadowSeasonId
  originalTopRetainedShare: number
  mostCommonAlternative: { id: ShadowSeasonId; label: string; share: number } | null
  topVsRunner: { id: ShadowSeasonId; aheadShare: number; meanSquaredDistanceMargin: number } | null
  confidence: 'strong' | 'moderate' | 'exploratory'
  reason: string
  state: 'specific' | 'candidate-group' | 'broad-profile'
  candidateIds: ShadowSeasonId[]
}
export interface PrecisionDimensionUncertainty {
  center: number
  empiricalSpread: number
  robustSpread: number
  effectiveCaptures: number
  usefulCaptures: number
  qualityWeightedReliability: number
  repeatabilityStdError: number
  measurementStdError: number
  aggregateStdDev: number
  uninformative: boolean
  interval: { low: number; high: number }
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
