export interface ContinuousMeasurement {
  /** Normalized diagnostic score. Temperature/value/chroma use -1..1; contrast uses 0..1. */
  score: number
  /** How trustworthy this measurement is for this particular photo, from 0..1. */
  reliability: number
}

export interface FeatureColourStatistics {
  /** Pixels retained for distribution analysis (the sampler caps very large regions). */
  sampleSize: number
  /** All valid pixels represented by the retained distribution. */
  totalPixelCount: number
  oklab: {
    medianL: number
    meanL: number
    lightnessStdDev: number
    medianA: number
    medianB: number
  }
  oklch: {
    medianChroma: number
    meanChroma: number
    chromaStdDev: number
    hueDegrees: number | null
  }
  clippedFraction: number
  reliability: number
}

export type MeasurementQualityFlagSeverity = 'info' | 'warning'

export interface MeasurementQualityFlag {
  code: string
  severity: MeasurementQualityFlagSeverity
  message: string
}

export interface LightingDiagnostics {
  correctionApplied: boolean
  correctionStrength: number
  candidateConsistency: number
  neutralReferenceConfidence: number
  reliability: number
  mixedLightingSuspected: boolean
  backgroundCandidateCount: number
  scleraCandidateCount: number
  estimatorDisagreement: number | null
  spatialDisagreement: number | null
  estimatedIlluminant: {
    rgb: { r: number; g: number; b: number }
    chromaticityX: number
    chromaticityY: number
  } | null
}

export interface MeasurementBeforeAfter {
  temperature: { before: number; after: number }
  value: { before: number; after: number }
  chroma: { before: number; after: number }
}

export interface SkinRegionDiagnostic {
  name: 'forehead' | 'leftCheek' | 'rightCheek' | 'fallback'
  usedLandmarkPolygon: boolean
  sourcePixelCount: number
  retainedPixelCount: number
  rejected: {
    shadow: number
    highlight: number
    redness: number
    multivariateOutlier: number
  }
  representative: {
    l: number
    a: number
    b: number
    chroma: number
    hueDegrees: number | null
  }
  reliability: number
}

export interface SkinRegionDistance {
  first: SkinRegionDiagnostic['name']
  second: SkinRegionDiagnostic['name']
  total: number
  lightness: number
  chromatic: number
}

export interface SkinDiagnostics {
  consistencyScore: number
  likelyCause: 'consistent' | 'sampling-contamination' | 'uneven-lighting' | 'regional-variation'
  regions: SkinRegionDiagnostic[]
  pairwiseDistances: SkinRegionDistance[]
}

export interface MeasurementStabilityDiagnostics {
  exposure: {
    reliability: number
    clippingScore: number
    skinExposurePlausibility: number
    absoluteCompositeLightness: number
    absoluteValueScore: number
    relativeValueScore: number
    stabilizedValueScore: number
    relativeValueWeight: number
    skinLightness: number
    darkerFeatureLightnessToSkinRatio: number
    hairLightnessRelativeToSkin: number
    eyeLightnessRelativeToSkin: number
  }
  chroma: {
    absoluteCompositeChroma: number
    exposureNormalizedCompositeChroma: number
    stabilizedCompositeChroma: number
    exposureNormalizationWeight: number
    skinChromaToLightness: number
    hairChromaToLightness: number
    eyeChromaToLightness: number
  }
  contrast: {
    pairs: {
      label: 'skin-hair' | 'skin-eyes' | 'hair-eyes'
      rawDeltaL: number
      relativeDeltaL: number
      normalizedContrast: number
      reliability: number
    }[]
    rawMaximum: number
    rawRms: number
    normalizedMaximum: number
    normalizedRms: number
    rawAggregate: number
    normalizedAggregate: number
    stabilizedContrast: number
    relativeWeight: number
    estimatorDisagreement: number
    estimatorAgreement: number
  }
}

export interface ImageInputDiagnostics {
  analysisMethod: 'vision' | 'fallback'
  faceAreaRatio: number | null
  landmarkSkinRegionCount: number
  hairSegmentationUsed: boolean
  hairMaskCoverageRatio: number | null
  eyeSampleUsable: boolean
}

export interface ShadowSeasonMeasurements {
  version: 'oklab-shadow-v6'
  temperature: ContinuousMeasurement & {
    skinHueDegrees: number | null
    /** A low-chroma sample has an unstable hue even when the pixel sample itself is good. */
    chromaEvidence: number
  }
  value: ContinuousMeasurement & {
    compositeLightness: number
  }
  chroma: ContinuousMeasurement & {
    compositeChroma: number
  }
  contrast: ContinuousMeasurement & {
    maximumLightnessDifference: number
    rmsLightnessDifference: number
  }
  features: {
    skin: FeatureColourStatistics
    hair: FeatureColourStatistics
    eyes: FeatureColourStatistics
  }
  lighting: LightingDiagnostics
  inputQuality: ImageInputDiagnostics
  beforeAfter: MeasurementBeforeAfter
  stabilityDiagnostics: MeasurementStabilityDiagnostics
  skinDiagnostics: SkinDiagnostics
  qualityFlags: MeasurementQualityFlag[]
}
