import { SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD } from '../data/shadowSeasonCalibration'
import type { ShadowSeasonMeasurements } from '../types/seasonMeasurements'
import type { ShadowSeasonClassification, ShadowSeasonDimension } from '../types/shadowSeasonClassification'
import type {
  AnalysisQualityAssessment,
  AnalysisQualityIssue,
  ImageQualityAssessment,
  ImageQualityCheck,
  MajorAnalysisDimension,
  MeasurementReliabilityAssessment,
} from '../types/analysisQuality'

const MAJOR_DIMENSIONS: MajorAnalysisDimension[] = ['temperature', 'value', 'chroma']
const DIMENSIONS: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma', 'contrast']

// These are capture-usability limits, deliberately separate from the 45%
// classification discrimination threshold. Only severe technical failures
// can request a retake.
const MINIMUM_FACE_AREA_RATIO = 0.01
const SMALL_FACE_AREA_RATIO = 0.04
const MINIMUM_VALID_SKIN_PIXELS = 120
const MINIMUM_USABLE_SKIN_REGIONS = 2
const SEVERE_SKIN_LIGHTNESS_DISAGREEMENT = 0.18
const SEVERE_SKIN_CONSISTENCY = 0.15
const SEVERE_SKIN_CLIPPING = 0.25
const SEVERE_MIXED_LIGHTING_DISAGREEMENT = 0.08
const EXTREME_EXPOSURE_RELIABILITY = 0.2
const MINIMUM_USABLE_FEATURE_COUNT = 2

function addIssue(issues: AnalysisQualityIssue[], issue: AnalysisQualityIssue): void {
  if (!issues.some((existing) => existing.code === issue.code)) issues.push(issue)
}

function check(
  code: string,
  label: string,
  status: ImageQualityCheck['status'],
  detail: string,
): ImageQualityCheck {
  return { code, label, status, detail }
}

function assessImageQuality(measurements: ShadowSeasonMeasurements): ImageQualityAssessment {
  const checks: ImageQualityCheck[] = []
  const issues: AnalysisQualityIssue[] = []
  const input = measurements.inputQuality
  const skinRegions = measurements.skinDiagnostics.regions
  const validSkinPixels = skinRegions.reduce((sum, region) => sum + region.retainedPixelCount, 0)
  const usableSkinRegions = skinRegions.filter(
    (region) => region.retainedPixelCount >= 40 && region.reliability >= 0.2,
  ).length
  const maximumSkinLightnessDisagreement = measurements.skinDiagnostics.pairwiseDistances.length > 0
    ? Math.max(...measurements.skinDiagnostics.pairwiseDistances.map((pair) => pair.lightness))
    : 0
  const severeUnevenLighting =
    measurements.skinDiagnostics.likelyCause === 'uneven-lighting' &&
    measurements.skinDiagnostics.consistencyScore < SEVERE_SKIN_CONSISTENCY &&
    maximumSkinLightnessDisagreement > SEVERE_SKIN_LIGHTNESS_DISAGREEMENT
  const severeMixedLighting =
    measurements.lighting.mixedLightingSuspected &&
    (measurements.lighting.spatialDisagreement ?? 0) > SEVERE_MIXED_LIGHTING_DISAGREEMENT
  const severeClipping = measurements.features.skin.clippedFraction > SEVERE_SKIN_CLIPPING
  const extremeExposure =
    measurements.stabilityDiagnostics.exposure.reliability < EXTREME_EXPOSURE_RELIABILITY &&
    (measurements.stabilityDiagnostics.exposure.clippingScore < 0.3 ||
      measurements.stabilityDiagnostics.exposure.skinExposurePlausibility < 0.1)

  const faceDetectionFailed = input.analysisMethod === 'fallback'
  const faceTooSmall = input.faceAreaRatio !== null && input.faceAreaRatio < MINIMUM_FACE_AREA_RATIO
  checks.push(check(
    'face-and-landmarks',
    'Face and landmarks',
    faceDetectionFailed || faceTooSmall
      ? 'fail'
      : (input.faceAreaRatio ?? 0) < SMALL_FACE_AREA_RATIO
        ? 'warning'
        : 'pass',
    faceDetectionFailed
      ? 'Face landmarks were unavailable and fallback sampling was used.'
      : `Face area ${(Math.max(0, input.faceAreaRatio ?? 0) * 100).toFixed(1)}% of the image; ${input.landmarkSkinRegionCount}/3 landmark skin regions were used.`,
  ))
  if (faceDetectionFailed || faceTooSmall) {
    addIssue(issues, {
      code: 'face-not-usable',
      title: faceDetectionFailed ? 'A face could not be measured reliably' : 'The face is too small in the photo',
      guidance: 'Use a front-facing photo where the face is sharp, unobstructed, and fills more of the frame.',
    })
  }

  const insufficientSkin =
    validSkinPixels < MINIMUM_VALID_SKIN_PIXELS || usableSkinRegions < MINIMUM_USABLE_SKIN_REGIONS
  checks.push(check(
    'skin-sampling',
    'Skin sampling',
    insufficientSkin ? 'fail' : usableSkinRegions < 3 ? 'warning' : 'pass',
    `${validSkinPixels} cleaned skin pixels across ${usableSkinRegions}/3 usable regions.`,
  ))
  if (insufficientSkin) {
    addIssue(issues, {
      code: 'insufficient-skin-sampling',
      title: 'Not enough valid skin was visible',
      guidance: 'Keep the forehead and both cheeks visible without hair, hands, heavy shadows, or bright glare covering them.',
    })
  }

  checks.push(check(
    'facial-lighting',
    'Facial lighting consistency',
    severeUnevenLighting ? 'fail' : measurements.skinDiagnostics.consistencyScore < 0.45 ? 'warning' : 'pass',
    `Skin consistency ${(measurements.skinDiagnostics.consistencyScore * 100).toFixed(0)}%; maximum regional ΔL ${maximumSkinLightnessDisagreement.toFixed(3)}.`,
  ))
  if (severeUnevenLighting) {
    addIssue(issues, {
      code: 'severe-uneven-lighting',
      title: 'Lighting is severely uneven across the face',
      guidance: 'Face a broad, soft light source so the forehead and both cheeks receive similar light.',
    })
  }

  checks.push(check(
    'clipping-and-exposure',
    'Clipping and exposure',
    severeClipping || extremeExposure
      ? 'fail'
      : measurements.features.skin.clippedFraction > 0.08 ||
          measurements.stabilityDiagnostics.exposure.reliability < 0.5
        ? 'warning'
        : 'pass',
    `Skin clipping ${(measurements.features.skin.clippedFraction * 100).toFixed(1)}%; exposure reliability ${(measurements.stabilityDiagnostics.exposure.reliability * 100).toFixed(0)}%.`,
  ))
  if (severeClipping || extremeExposure) {
    addIssue(issues, {
      code: 'extreme-exposure',
      title: 'Important facial colour is lost to exposure',
      guidance: 'Move out of direct sun or deep shade and retake with visible detail in both highlights and shadows.',
    })
  }

  checks.push(check(
    'mixed-lighting',
    'Mixed lighting',
    severeMixedLighting ? 'fail' : measurements.lighting.mixedLightingSuspected ? 'warning' : 'pass',
    measurements.lighting.spatialDisagreement === null
      ? 'No spatial illuminant comparison was available.'
      : `Spatial illuminant disagreement ${measurements.lighting.spatialDisagreement.toFixed(4)}.`,
  ))
  if (severeMixedLighting) {
    addIssue(issues, {
      code: 'severe-mixed-lighting',
      title: 'Different parts of the image have conflicting light colours',
      guidance: 'Use one neutral light source and avoid mixing daylight with strongly coloured indoor lighting.',
    })
  }

  const skinUsable = !insufficientSkin
  const hairUsable = measurements.features.hair.sampleSize >= 100 && measurements.features.hair.reliability >= 0.1
  const eyesUsable = measurements.features.eyes.sampleSize >= 12 && measurements.features.eyes.reliability >= 0.1
  const usableFeatureCount = [skinUsable, hairUsable, eyesUsable].filter(Boolean).length
  const insufficientFacialInformation = usableFeatureCount < MINIMUM_USABLE_FEATURE_COUNT
  const segmentationWarning = !input.hairSegmentationUsed ||
    (input.hairMaskCoverageRatio !== null && input.hairMaskCoverageRatio < 0.03)
  checks.push(check(
    'feature-information',
    'Usable facial information',
    insufficientFacialInformation ? 'fail' : segmentationWarning || !input.eyeSampleUsable ? 'warning' : 'pass',
    `${usableFeatureCount}/3 feature groups usable; hair segmentation ${input.hairSegmentationUsed ? 'available' : 'unavailable'}; iris sampling ${input.eyeSampleUsable ? 'usable' : 'limited'}.`,
  ))
  if (insufficientFacialInformation) {
    addIssue(issues, {
      code: 'insufficient-facial-information',
      title: 'Too little facial information could be measured',
      guidance: 'Use a sharp front-facing photo with visible skin, hair, and eyes and without heavy occlusion.',
    })
  }

  return {
    status: checks.some((item) => item.status === 'fail') ? 'retake-required' : 'usable',
    checks,
    issues,
  }
}

function assessMeasurementReliability(
  measurements: ShadowSeasonMeasurements,
): MeasurementReliabilityAssessment {
  const threshold = SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD
  const reliabilities: Record<ShadowSeasonDimension, number> = {
    temperature: measurements.temperature.reliability,
    value: measurements.value.reliability,
    chroma: measurements.chroma.reliability,
    contrast: measurements.contrast.reliability,
  }
  const dimensions = Object.fromEntries(
    DIMENSIONS.map((dimension) => [dimension, {
      reliability: reliabilities[dimension],
      sufficientlyReliable: reliabilities[dimension] >= threshold,
    }]),
  ) as MeasurementReliabilityAssessment['dimensions']
  const reliableMajorDimensions = MAJOR_DIMENSIONS.filter(
    (dimension) => dimensions[dimension].sufficientlyReliable,
  )
  const unresolvedMajorDimensions = MAJOR_DIMENSIONS.filter(
    (dimension) => !dimensions[dimension].sufficientlyReliable,
  )

  return {
    threshold,
    dimensions,
    reliableMajorDimensions,
    unresolvedMajorDimensions,
    unresolvedSupportingDimensions: dimensions.contrast.sufficientlyReliable ? [] : ['contrast'],
  }
}

/**
 * Separates technical image usability from colour-classification certainty.
 * A technically usable photo is never rejected solely because temperature,
 * value, chroma, or contrast is difficult to classify.
 */
export function assessAnalysisQuality(
  measurements: ShadowSeasonMeasurements,
  classification: ShadowSeasonClassification,
): AnalysisQualityAssessment {
  const imageQuality = assessImageQuality(measurements)
  const measurementReliability = assessMeasurementReliability(measurements)
  const reliableMajorCount = measurementReliability.reliableMajorDimensions.length
  const classificationCertainty = {
    status: reliableMajorCount === 3
      ? 'full' as const
      : reliableMajorCount > 0
        ? 'constrained' as const
        : 'indeterminate' as const,
    broadProfileDescription: classification.broadProfileDescription,
    candidateSeasonLabels: classification.topThree.map((candidate) => candidate.label),
  }
  const status = imageQuality.status === 'retake-required'
    ? 'retake-required' as const
    : classificationCertainty.status === 'full'
      ? 'full' as const
      : 'constrained' as const

  return {
    status,
    canPresentSpecificSeason: status === 'full',
    imageQuality,
    measurementReliability,
    classificationCertainty,
  }
}
