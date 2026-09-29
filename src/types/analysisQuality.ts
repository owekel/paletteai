import type { ShadowSeasonDimension } from './shadowSeasonClassification'

export type AnalysisQualityStatus = 'full' | 'constrained' | 'retake-required'
export type MajorAnalysisDimension = Extract<
  ShadowSeasonDimension,
  'temperature' | 'value' | 'chroma'
>

export interface AnalysisQualityIssue {
  code: string
  title: string
  guidance: string
}

export type ImageQualityCheckStatus = 'pass' | 'warning' | 'fail'

export interface ImageQualityCheck {
  code: string
  label: string
  status: ImageQualityCheckStatus
  detail: string
}

export interface ImageQualityAssessment {
  status: 'usable' | 'retake-required'
  checks: ImageQualityCheck[]
  issues: AnalysisQualityIssue[]
}

export interface MeasurementReliabilityAssessment {
  threshold: number
  dimensions: Record<
    ShadowSeasonDimension,
    { reliability: number; sufficientlyReliable: boolean }
  >
  reliableMajorDimensions: MajorAnalysisDimension[]
  unresolvedMajorDimensions: MajorAnalysisDimension[]
  unresolvedSupportingDimensions: Extract<ShadowSeasonDimension, 'contrast'>[]
}

export interface ClassificationCertaintyAssessment {
  status: 'full' | 'constrained' | 'indeterminate'
  broadProfileDescription: string
  candidateSeasonLabels: string[]
}

export interface AnalysisQualityAssessment {
  status: AnalysisQualityStatus
  canPresentSpecificSeason: boolean
  imageQuality: ImageQualityAssessment
  measurementReliability: MeasurementReliabilityAssessment
  classificationCertainty: ClassificationCertaintyAssessment
}
