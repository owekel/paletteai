import type { AnalysisQualityAssessment } from './analysisQuality'
import type { ColorPalette } from './colorProfile'
import type { ShadowSeasonCandidateScore, ShadowSeasonDimension } from './shadowSeasonClassification'

export interface ProfileDimension {
  id: ShadowSeasonDimension
  label: string
  value: string
  description: string
  resolved: boolean
}

export interface SeasonAnalysis {
  status: 'specific' | 'constrained' | 'retake-required'
  quality: AnalysisQualityAssessment
  title: string
  summary: string
  dimensions: ProfileDimension[]
  candidates: ShadowSeasonCandidateScore[]
  runnerUp?: ShadowSeasonCandidateScore
  unresolved: string[]
  palette: ColorPalette
  paletteMode: 'season' | 'shared' | 'explore'
  paletteDescription: string
  /** Presentation rules are separate from technical image quality. */
  decision: { reason: string; topToRunnerAffinityRatio: number; policyVersion: string }
}
