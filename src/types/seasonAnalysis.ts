import type { AnalysisQualityAssessment } from './analysisQuality'
import type { ColorPalette, ColorSwatchData } from './colorProfile'
import type { ShadowSeasonCandidateScore, ShadowSeasonDimension, ShadowSeasonId } from './shadowSeasonClassification'

export interface ProfileDimension {
  id: ShadowSeasonDimension
  label: string
  value: string
  description: string
  resolved: boolean
  recommendation?: string
}

export interface ColourComparison {
  id: string
  dimension: ShadowSeasonDimension
  title: string
  description: string
  options: [ColorSwatchData, ColorSwatchData]
}

export interface ConsensusColourEvidence {
  hex: string
  support: number
  matchingSeasons: ShadowSeasonId[]
  dimensionFit: number
  temperatureDependence: number
  score: number
}

export interface ColourRecommendations {
  personalized: boolean
  comparisons: ColourComparison[]
  lessSupported: { dimension: ShadowSeasonDimension; title: string; description: string }[]
  outfit?: { title: string; description: string; colours: [ColorSwatchData, ColorSwatchData] }
  diagnostics: {
    version: string
    candidateWeights: { id: ShadowSeasonId; weight: number }[]
    reliableDimensions: ShadowSeasonDimension[]
    colours: ConsensusColourEvidence[]
  }
}

export interface SeasonAnalysis {
  status: 'specific' | 'constrained' | 'retake-required'
  resultKind: 'specific' | 'candidate-group' | 'broad-profile' | 'retake-required'
  quality: AnalysisQualityAssessment
  title: string
  summary: string
  dimensions: ProfileDimension[]
  candidates: ShadowSeasonCandidateScore[]
  runnerUp?: ShadowSeasonCandidateScore
  unresolved: string[]
  palette: ColorPalette
  paletteMode: 'season' | 'consensus' | 'starter'
  paletteDescription: string
  recommendations?: ColourRecommendations
  /** Presentation rules are separate from technical image quality. */
  decision: { reason: string; topToRunnerAffinityRatio: number; policyVersion: string }
}
