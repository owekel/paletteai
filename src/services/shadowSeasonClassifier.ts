import {
  SHADOW_SEASON_CALIBRATION,
  SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD,
  SHADOW_SEASON_DIMENSION_WEIGHTS,
  SHADOW_SEASON_PROBABILITY_TEMPERATURE,
  SHADOW_SEASON_PROTOTYPES,
} from '../data/shadowSeasonCalibration'
import type { ShadowSeasonMeasurements } from '../types/seasonMeasurements'
import type {
  ShadowSeasonCandidateScore,
  ShadowSeasonClassification,
  ShadowSeasonCoordinates,
  ShadowSeasonDimension,
  ShadowSeasonDimensionContribution,
} from '../types/shadowSeasonClassification'

const DIMENSIONS: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma', 'contrast']
const MAJOR_DIMENSIONS: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma']

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function measurementCoordinates(measurements: ShadowSeasonMeasurements): ShadowSeasonCoordinates {
  return {
    temperature: measurements.temperature.score,
    value: measurements.value.score,
    chroma: measurements.chroma.score,
    contrast: measurements.contrast.score,
  }
}

function measurementReliabilities(
  measurements: ShadowSeasonMeasurements,
): Record<ShadowSeasonDimension, number> {
  return {
    temperature: measurements.temperature.reliability,
    value: measurements.value.reliability,
    chroma: measurements.chroma.reliability,
    contrast: measurements.contrast.reliability,
  }
}

function describeDimension(dimension: ShadowSeasonDimension, score: number): string {
  if (dimension === 'temperature') {
    if (score <= -0.3) return 'cool'
    if (score >= 0.3) return 'warm'
    return 'neutral-temperature'
  }
  if (dimension === 'value') {
    if (score <= -0.35) return 'deep'
    if (score >= 0.35) return 'light'
    return 'medium-value'
  }
  if (dimension === 'chroma') {
    if (score <= -0.35) return 'muted'
    if (score >= 0.35) return 'clear'
    return 'medium-chroma'
  }
  if (score <= 0.33) return 'low-contrast'
  if (score >= 0.67) return 'high-contrast'
  return 'moderate-contrast'
}

/**
 * Directly compares one measured profile with all 12 prototypes. It does not
 * select a four-season family first. The results presenter applies quality and
 * uncertainty rules before using these candidates in the consumer experience.
 */
export function classifyShadowSeason(
  measurements: ShadowSeasonMeasurements,
): ShadowSeasonClassification {
  const measured = measurementCoordinates(measurements)
  const reliabilities = measurementReliabilities(measurements)
  const dimensionDiscrimination = Object.fromEntries(
    DIMENSIONS.map((dimension) => {
      const sufficientlyReliable =
        reliabilities[dimension] >= SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD
      return [dimension, {
        reliability: reliabilities[dimension],
        threshold: SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD,
        status: sufficientlyReliable ? 'discriminating' : 'supporting-only',
        sufficientlyReliable,
      }]
    }),
  ) as ShadowSeasonClassification['dimensionDiscrimination']
  const constrainedDimensions = MAJOR_DIMENSIONS.filter(
    (dimension) => !dimensionDiscrimination[dimension].sufficientlyReliable,
  )
  const totalBaseWeight = DIMENSIONS.reduce(
    (sum, dimension) => sum + SHADOW_SEASON_DIMENSION_WEIGHTS[dimension],
    0,
  )
  const totalEffectiveWeight = DIMENSIONS.reduce(
    (sum, dimension) =>
      sum + SHADOW_SEASON_DIMENSION_WEIGHTS[dimension] * reliabilities[dimension],
    0,
  )
  const aggregateMeasurementReliability = totalEffectiveWeight / totalBaseWeight
  const totalMajorWeight = MAJOR_DIMENSIONS.reduce(
    (sum, dimension) => sum + SHADOW_SEASON_DIMENSION_WEIGHTS[dimension],
    0,
  )
  const majorDiscriminationCoverage = MAJOR_DIMENSIONS.reduce((sum, dimension) => {
    const thresholdProgress = clamp01(
      reliabilities[dimension] / SHADOW_SEASON_DISCRIMINATION_RELIABILITY_THRESHOLD,
    )
    return sum + SHADOW_SEASON_DIMENSION_WEIGHTS[dimension] * thresholdProgress
  }, 0) / totalMajorWeight
  // Overall incompleteness and a missing major discriminator both flatten the
  // final distribution. This leaves the distance ranking intact while making
  // its apparent certainty appropriately broader.
  const probabilitySpecificity = aggregateMeasurementReliability * majorDiscriminationCoverage
  const reliableMajorDimensionCount = MAJOR_DIMENSIONS.length - constrainedDimensions.length
  const specificity = reliableMajorDimensionCount === 0
    ? 'insufficient-evidence'
    : constrainedDimensions.length > 0
      ? 'dimension-constrained'
      : 'season-level'
  const broadProfileDescriptors = DIMENSIONS
    .filter((dimension) => dimensionDiscrimination[dimension].sufficientlyReliable)
    .map((dimension) => describeDimension(dimension, measured[dimension]))
  const broadProfileDescription = broadProfileDescriptors.length > 0
    ? broadProfileDescriptors.join(' / ')
    : 'insufficient reliable dimensions for a broad profile'

  const candidatesWithoutProbability = SHADOW_SEASON_PROTOTYPES.map((prototype) => {
    const contributions = {} as Record<ShadowSeasonDimension, ShadowSeasonDimensionContribution>
    let weightedSquaredErrorTotal = 0

    for (const dimension of DIMENSIONS) {
      const baseWeight = SHADOW_SEASON_DIMENSION_WEIGHTS[dimension]
      const measurementReliability = reliabilities[dimension]
      const effectiveWeight = baseWeight * measurementReliability
      const delta = measured[dimension] - prototype.center[dimension]
      const weightedSquaredError = effectiveWeight * delta ** 2
      weightedSquaredErrorTotal += weightedSquaredError
      contributions[dimension] = {
        measured: measured[dimension],
        prototype: prototype.center[dimension],
        delta,
        measurementReliability,
        baseWeight,
        effectiveWeight,
        weightedSquaredError,
        contributionShare: 0,
      }
    }

    const squaredDistance = totalEffectiveWeight > 0
      ? weightedSquaredErrorTotal / totalEffectiveWeight
      : 0
    for (const dimension of DIMENSIONS) {
      contributions[dimension].contributionShare = weightedSquaredErrorTotal > 0
        ? contributions[dimension].weightedSquaredError / weightedSquaredErrorTotal
        : 0
    }

    return {
      id: prototype.id,
      label: prototype.label,
      distance: Math.sqrt(squaredDistance),
      squaredDistance,
      contributions,
    }
  })

  const logits = candidatesWithoutProbability.map(
    (candidate) => -candidate.squaredDistance / SHADOW_SEASON_PROBABILITY_TEMPERATURE,
  )
  const maximumLogit = Math.max(...logits)
  const exponentials = logits.map((logit) => Math.exp(logit - maximumLogit))
  const exponentialTotal = exponentials.reduce((sum, value) => sum + value, 0)
  const uniformProbability = 1 / SHADOW_SEASON_PROTOTYPES.length

  const rankings: ShadowSeasonCandidateScore[] = candidatesWithoutProbability
    .map((candidate, index) => {
      const affinityProbability = exponentials[index] / exponentialTotal
      // Weak overall evidence and missing major discriminators both pull the
      // probability toward uniform without changing the prototype ranking.
      const probability =
        probabilitySpecificity * affinityProbability +
        (1 - probabilitySpecificity) * uniformProbability
      return { ...candidate, affinityProbability, probability }
    })
    .sort((a, b) => b.probability - a.probability)

  const [top, runnerUp] = rankings
  return {
    version: SHADOW_SEASON_CALIBRATION.version,
    aggregateMeasurementReliability,
    probabilitySpecificity,
    specificity,
    constrainedDimensions,
    constrainedByUnreliableTemperature:
      !dimensionDiscrimination.temperature.sufficientlyReliable,
    dimensionDiscrimination,
    broadProfileDescription,
    dimensionWeights: { ...SHADOW_SEASON_DIMENSION_WEIGHTS },
    probabilityTemperature: SHADOW_SEASON_PROBABILITY_TEMPERATURE,
    rankings,
    topThree: rankings.slice(0, 3),
    runnerUpDistanceMargin: runnerUp.distance - top.distance,
    runnerUpProbabilityMargin: top.probability - runnerUp.probability,
  }
}
