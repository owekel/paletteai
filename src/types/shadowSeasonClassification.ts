export type ShadowSeasonId =
  | 'light-spring'
  | 'warm-spring'
  | 'bright-spring'
  | 'light-summer'
  | 'cool-summer'
  | 'soft-summer'
  | 'soft-autumn'
  | 'warm-autumn'
  | 'deep-autumn'
  | 'deep-winter'
  | 'cool-winter'
  | 'bright-winter'

export type ShadowSeasonDimension = 'temperature' | 'value' | 'chroma' | 'contrast'

export interface ShadowSeasonCoordinates {
  temperature: number
  value: number
  chroma: number
  contrast: number
}

export interface ShadowSeasonDimensionContribution {
  measured: number
  prototype: number
  delta: number
  measurementReliability: number
  baseWeight: number
  effectiveWeight: number
  weightedSquaredError: number
  /** Share of the candidate's normalized squared distance, from 0..1. */
  contributionShare: number
}

export interface ShadowSeasonCandidateScore {
  id: ShadowSeasonId
  label: string
  /** Prototype-distance softmax before measurement-uncertainty flattening. */
  affinityProbability: number
  /** Affinity probability conservatively flattened by evidence specificity. */
  probability: number
  distance: number
  squaredDistance: number
  contributions: Record<ShadowSeasonDimension, ShadowSeasonDimensionContribution>
}

export type ShadowSeasonDimensionDiscriminationStatus =
  | 'discriminating'
  | 'supporting-only'

export interface ShadowSeasonDimensionDiscrimination {
  reliability: number
  threshold: number
  status: ShadowSeasonDimensionDiscriminationStatus
  sufficientlyReliable: boolean
}

export type ShadowSeasonSpecificity =
  | 'season-level'
  | 'dimension-constrained'
  | 'insufficient-evidence'

export interface ShadowSeasonClassification {
  version: 'prototype-12-v3'
  /** Reliability-weighted completeness of the four measured dimensions. */
  aggregateMeasurementReliability: number
  /** Additional probability-flattening factor when a major axis cannot discriminate. */
  probabilitySpecificity: number
  specificity: ShadowSeasonSpecificity
  constrainedDimensions: ShadowSeasonDimension[]
  constrainedByUnreliableTemperature: boolean
  dimensionDiscrimination: Record<ShadowSeasonDimension, ShadowSeasonDimensionDiscrimination>
  /** Human-readable description built only from sufficiently reliable dimensions. */
  broadProfileDescription: string
  dimensionWeights: Record<ShadowSeasonDimension, number>
  probabilityTemperature: number
  rankings: ShadowSeasonCandidateScore[]
  topThree: ShadowSeasonCandidateScore[]
  runnerUpDistanceMargin: number
  runnerUpProbabilityMargin: number
}
