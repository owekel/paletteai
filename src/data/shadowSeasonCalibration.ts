import type {
  ShadowSeasonCoordinates,
  ShadowSeasonDimension,
  ShadowSeasonId,
} from '../types/shadowSeasonClassification'

export interface ShadowSeasonPrototype {
  id: ShadowSeasonId
  label: string
  center: ShadowSeasonCoordinates
}

export interface ShadowSeasonCalibration {
  version: 'prototype-12-v3'
  prototypes: ShadowSeasonPrototype[]
  dimensionWeights: Record<ShadowSeasonDimension, number>
  probabilityTemperature: number
  discriminationReliabilityThreshold: number
}

/**
 * Interpretable provisional calibration for shadow-mode testing only. These
 * values are not scientifically validated. The v3 centers are deliberately
 * symmetric across warm/cool counterparts and stay away from unsupported
 * scale extremes. Expert-labelled calibration data can replace this object
 * without changing classifier code. Temperature/value/chroma use -1..1;
 * contrast uses 0..1.
 */
export const SHADOW_SEASON_CALIBRATION: ShadowSeasonCalibration = {
  version: 'prototype-12-v3',
  prototypes: [
    { id: 'light-spring', label: 'Light Spring', center: { temperature: 0.45, value: 0.75, chroma: 0.28, contrast: 0.3 } },
    { id: 'warm-spring', label: 'Warm Spring', center: { temperature: 0.75, value: 0.32, chroma: 0.5, contrast: 0.45 } },
    { id: 'bright-spring', label: 'Bright Spring', center: { temperature: 0.35, value: 0.1, chroma: 0.8, contrast: 0.78 } },

    { id: 'light-summer', label: 'Light Summer', center: { temperature: -0.45, value: 0.75, chroma: -0.28, contrast: 0.25 } },
    { id: 'cool-summer', label: 'Cool Summer', center: { temperature: -0.75, value: 0.32, chroma: -0.4, contrast: 0.35 } },
    { id: 'soft-summer', label: 'Soft Summer', center: { temperature: -0.35, value: 0.05, chroma: -0.75, contrast: 0.24 } },

    { id: 'soft-autumn', label: 'Soft Autumn', center: { temperature: 0.35, value: -0.05, chroma: -0.75, contrast: 0.28 } },
    { id: 'warm-autumn', label: 'Warm Autumn', center: { temperature: 0.75, value: -0.35, chroma: -0.35, contrast: 0.45 } },
    { id: 'deep-autumn', label: 'Deep Autumn', center: { temperature: 0.35, value: -0.75, chroma: -0.12, contrast: 0.72 } },

    { id: 'deep-winter', label: 'Deep Winter', center: { temperature: -0.35, value: -0.75, chroma: 0.28, contrast: 0.82 } },
    { id: 'cool-winter', label: 'Cool Winter', center: { temperature: -0.75, value: -0.35, chroma: 0.55, contrast: 0.75 } },
    { id: 'bright-winter', label: 'Bright Winter', center: { temperature: -0.35, value: 0, chroma: 0.8, contrast: 0.88 } },
  ],

  // Temperature, value, and chroma are equal primary axes. Contrast remains
  // supporting evidence; its 0..1 domain is also half the span of the others.
  dimensionWeights: {
    temperature: 1,
    value: 1,
    chroma: 1,
    contrast: 0.4,
  },

  // Chosen relative to the v3 median nearest-neighbour squared distance
  // (~0.104). This gives a distinct but non-degenerate affinity at a prototype.
  probabilityTemperature: 0.12,

  // Retained from v2. It is an operational uncertainty threshold, not a
  // scientifically learned boundary, and does not turn a dimension off in the
  // reliability-weighted distance.
  discriminationReliabilityThreshold: 0.45,
}

export const SHADOW_SEASON_PROTOTYPES = SHADOW_SEASON_CALIBRATION.prototypes
export const SHADOW_SEASON_DIMENSION_WEIGHTS = SHADOW_SEASON_CALIBRATION.dimensionWeights
export const SHADOW_SEASON_PROBABILITY_TEMPERATURE =
  SHADOW_SEASON_CALIBRATION.probabilityTemperature
export const SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD =
  SHADOW_SEASON_CALIBRATION.discriminationReliabilityThreshold
