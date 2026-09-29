import type { RGB } from './colorUtils'
import { clamp } from './colorUtils'
import { oklabToOklch, rgbToOklab, type OKLab } from './oklab'
import {
  estimateIlluminationCorrection,
  type LightingReferenceSamples,
} from './illuminationCorrection'
import type {
  FeatureColourStatistics,
  MeasurementQualityFlag,
  SkinDiagnostics,
  ShadowSeasonMeasurements,
} from '../types/seasonMeasurements'

export interface FeaturePixelDistribution {
  /** A representative, capped set of actual pixels from the feature. */
  pixels: RGB[]
  /** Number of valid source pixels represented by the retained sample. */
  totalPixelCount: number
}

export type SkinRegionLabel = 'forehead' | 'leftCheek' | 'rightCheek' | 'fallback'

export interface SkinRegionPixelDistribution extends FeaturePixelDistribution {
  name: SkinRegionLabel
  usedLandmarkPolygon: boolean
}

export interface SeasonMeasurementInput {
  method: 'vision' | 'fallback'
  faceAreaRatio: number | null
  skin: FeaturePixelDistribution
  hair: FeaturePixelDistribution
  eyes: FeaturePixelDistribution
  skinRegions: SkinRegionPixelDistribution[]
  eyeRegions: FeaturePixelDistribution[]
  hairUsedMaskSampling: boolean
  hairMaskCoverageRatio: number | null
  eyeSampleUsable: boolean
  lightingReferences: LightingReferenceSamples
}

interface InternalFeatureStatistics {
  publicStats: FeatureColourStatistics
  medianLab: OKLab
}

interface SkinRegionAnalysis {
  input: SkinRegionPixelDistribution
  filteredPixels: RGB[]
  representativeLab: OKLab
  diagnostic: SkinDiagnostics['regions'][number]
}

interface InternalSkinMeasurement extends InternalFeatureStatistics {
  diagnostics: SkinDiagnostics
}

type MeasurementCore = Omit<
  ShadowSeasonMeasurements,
  'version' | 'lighting' | 'inputQuality' | 'beforeAfter'
>

const FEATURE_SAMPLE_TARGETS = {
  skin: 500,
  hair: 500,
  eyes: 24,
} as const

// These are deliberately preliminary measurement anchors, not season
// boundaries. They only make raw human-feature chroma convenient to compare
// on a -1..1 debug scale and are isolated here for later calibration.
const MUTED_CHROMA_ANCHOR = 0.015
const CLEAR_CHROMA_ANCHOR = 0.14

// OKLab coordinates are homogeneous under an unclipped exposure change: L,
// a, and b scale together. Expressing feature chroma at a common reference L
// therefore removes most pure exposure gain while retaining colourfulness.
const CHROMA_REFERENCE_LIGHTNESS = 0.45
const CHROMA_EXPOSURE_NORMALIZATION_WEIGHT = 0.8

// Absolute lightness still carries real depth information, but relative
// feature relationships are substantially more stable between exposures.
const RELATIVE_VALUE_WEIGHT = 0.65
const LIGHT_RELATIVE_DEPTH_RATIO = 0.08
const DEEP_RELATIVE_DEPTH_RATIO = 0.68

// Pairwise ΔL is retained as a small bridge to the earlier measurement, while
// most contrast evidence comes from exposure-normalized feature ratios. The
// robust aggregate uses every reliable pair rather than only the maximum.
const CONTRAST_REFERENCE_LIGHTNESS = 0.6
const CONTRAST_RELATIVE_WEIGHT = 0.8
const CONTRAST_MAX_WEIGHT = 0.3

// Likewise, this is an explicit, replaceable heuristic rather than a learned
// undertone model. In OKLab skin colours, a lower hue angle is more
// red/pink and a higher angle more yellow/golden. This v1 shadow measurement
// remains heuristic even after white-balance correction, so its reliability
// is intentionally constrained by chroma evidence and region agreement.
const SKIN_HUE_NEUTRAL_DEGREES = 52
const SKIN_HUE_FULL_SCALE_DEGREES = 25

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint]
}

function standardDeviation(values: number[], average: number): number {
  if (values.length < 2) return 0
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length)
}

function medianAbsoluteDeviation(values: number[], center = median(values)): number {
  return median(values.map((value) => Math.abs(value - center)))
}

function geometricMedian(points: OKLab[], weights?: number[]): OKLab {
  if (points.length === 0) return { l: 0, a: 0, b: 0 }
  let current = {
    l: median(points.map((point) => point.l)),
    a: median(points.map((point) => point.a)),
    b: median(points.map((point) => point.b)),
  }

  for (let iteration = 0; iteration < 25; iteration++) {
    let weightedL = 0
    let weightedA = 0
    let weightedB = 0
    let totalWeight = 0
    for (let index = 0; index < points.length; index++) {
      const point = points[index]
      const distance = Math.max(1e-6, oklabDistance(current, point))
      const weight = (weights?.[index] ?? 1) / distance
      weightedL += point.l * weight
      weightedA += point.a * weight
      weightedB += point.b * weight
      totalWeight += weight
    }
    const next = { l: weightedL / totalWeight, a: weightedA / totalWeight, b: weightedB / totalWeight }
    if (oklabDistance(current, next) < 0.00001) return next
    current = next
  }
  return current
}

function weightedMean(values: { value: number; reliability: number }[]): { value: number; reliability: number } {
  const usable = values.filter((item) => item.reliability > 0)
  const totalWeight = usable.reduce((sum, item) => sum + item.reliability, 0)
  if (totalWeight === 0) return { value: 0, reliability: 0 }

  return {
    value: usable.reduce((sum, item) => sum + item.value * item.reliability, 0) / totalWeight,
    reliability: usable.reduce((sum, item) => sum + item.reliability, 0) / values.length,
  }
}

function weightedRootMeanSquare(values: { value: number; reliability: number }[]): number {
  const usable = values.filter((item) => item.reliability > 0)
  const totalWeight = usable.reduce((sum, item) => sum + item.reliability, 0)
  if (totalWeight === 0) return 0
  return Math.sqrt(
    usable.reduce((sum, item) => sum + item.value ** 2 * item.reliability, 0) / totalWeight,
  )
}

function chromaToLightnessRatio(feature: InternalFeatureStatistics): number {
  return feature.publicStats.oklch.medianChroma / Math.max(0.12, feature.publicStats.oklab.medianL)
}

function exposureNormalizedChroma(feature: InternalFeatureStatistics): number {
  return chromaToLightnessRatio(feature) * CHROMA_REFERENCE_LIGHTNESS
}

function calculateFeatureStatistics(
  distribution: FeaturePixelDistribution,
  expectedSamples: number,
  sourceReliability: number,
  convertToOklab: (rgb: RGB) => OKLab,
): InternalFeatureStatistics {
  const labs = distribution.pixels.map(convertToOklab)
  const lightnessValues = labs.map((lab) => lab.l)
  const aValues = labs.map((lab) => lab.a)
  const bValues = labs.map((lab) => lab.b)
  const chromaValues = labs.map((lab) => Math.hypot(lab.a, lab.b))

  const meanL = mean(lightnessValues)
  const meanChroma = mean(chromaValues)
  const medianLab = {
    l: median(lightnessValues),
    a: median(aValues),
    b: median(bValues),
  }
  const medianLch = oklabToOklch(medianLab)
  const lightnessStdDev = standardDeviation(lightnessValues, meanL)
  const chromaStdDev = standardDeviation(chromaValues, meanChroma)
  const clippedPixels = distribution.pixels.filter(
    ({ r, g, b }) => r <= 3 || g <= 3 || b <= 3 || r >= 252 || g >= 252 || b >= 252,
  ).length
  const clippedFraction = distribution.pixels.length > 0 ? clippedPixels / distribution.pixels.length : 1

  const sampleScore = clamp(distribution.pixels.length / expectedSamples, 0, 1)
  const clippingScore = 1 - clamp(clippedFraction / 0.15, 0, 1)
  // Some natural shading is useful signal. Only very broad distributions are
  // penalized here because they more often indicate mixed regions or lighting.
  const lightnessConsistency = 1 - clamp((lightnessStdDev - 0.04) / 0.18, 0, 1)
  const chromaConsistency = 1 - clamp((chromaStdDev - 0.015) / 0.1, 0, 1)
  const reliability = clamp(
    sourceReliability *
      (sampleScore * 0.35 + clippingScore * 0.2 + lightnessConsistency * 0.25 + chromaConsistency * 0.2),
    0,
    1,
  )

  return {
    medianLab,
    publicStats: {
      sampleSize: distribution.pixels.length,
      totalPixelCount: distribution.totalPixelCount,
      oklab: {
        medianL: medianLab.l,
        meanL,
        lightnessStdDev,
        medianA: medianLab.a,
        medianB: medianLab.b,
      },
      oklch: {
        medianChroma: medianLch.c,
        meanChroma,
        chromaStdDev,
        hueDegrees: medianLch.h,
      },
      clippedFraction,
      reliability,
    },
  }
}

function analyzeSkinRegion(
  input: SkinRegionPixelDistribution,
  convertToOklab: (rgb: RGB) => OKLab,
): SkinRegionAnalysis {
  const converted = input.pixels.map((rgb) => ({ rgb, lab: convertToOklab(rgb) }))
  if (converted.length === 0) {
    return {
      input,
      filteredPixels: [],
      representativeLab: { l: 0, a: 0, b: 0 },
      diagnostic: {
        name: input.name,
        usedLandmarkPolygon: input.usedLandmarkPolygon,
        sourcePixelCount: 0,
        retainedPixelCount: 0,
        rejected: { shadow: 0, highlight: 0, redness: 0, multivariateOutlier: 0 },
        representative: { l: 0, a: 0, b: 0, chroma: 0, hueDegrees: null },
        reliability: 0,
      },
    }
  }

  const medianL = median(converted.map(({ lab }) => lab.l))
  const medianA = median(converted.map(({ lab }) => lab.a))
  const madL = medianAbsoluteDeviation(converted.map(({ lab }) => lab.l), medianL)
  const madA = medianAbsoluteDeviation(converted.map(({ lab }) => lab.a), medianA)

  const rejected = { shadow: 0, highlight: 0, redness: 0, multivariateOutlier: 0 }
  const lightingFiltered = converted.filter(({ lab }) => {
    const shadowThreshold = medianL - Math.max(0.08, madL * 3)
    const highlightThreshold = medianL + Math.max(0.1, madL * 3)
    if (lab.l < Math.max(0.16, shadowThreshold)) {
      rejected.shadow += 1
      return false
    }
    if (lab.l > Math.min(0.94, highlightThreshold)) {
      rejected.highlight += 1
      return false
    }
    // Reject only the unusually red tail relative to this person's own
    // region; ordinary pink/cool skin remains part of the distribution.
    if (lab.a > medianA + Math.max(0.025, madA * 3.2)) {
      rejected.redness += 1
      return false
    }
    return true
  })

  const preliminary = lightingFiltered.length >= 8 ? lightingFiltered : converted
  const preliminaryCenter = {
    l: median(preliminary.map(({ lab }) => lab.l)),
    a: median(preliminary.map(({ lab }) => lab.a)),
    b: median(preliminary.map(({ lab }) => lab.b)),
  }
  const distances = preliminary.map(({ lab }) => oklabDistance(lab, preliminaryCenter))
  const medianDistance = median(distances)
  const distanceMad = medianAbsoluteDeviation(distances, medianDistance)
  const outlierThreshold = medianDistance + Math.max(0.025, distanceMad * 3.2)
  const robustFiltered = preliminary.filter(({ lab }) => {
    if (oklabDistance(lab, preliminaryCenter) <= outlierThreshold) return true
    rejected.multivariateOutlier += 1
    return false
  })

  const usedFallbackPixels = robustFiltered.length < 8
  const retained = usedFallbackPixels ? preliminary : robustFiltered
  const representativeLab = geometricMedian(retained.map(({ lab }) => lab))
  const retainedDistances = retained.map(({ lab }) => oklabDistance(lab, representativeLab))
  const retainedSpread = median(retainedDistances)
  const retentionRatio = retained.length / converted.length
  const sampleScore = clamp(retained.length / 250, 0, 1)
  const retentionScore = clamp((retentionRatio - 0.25) / 0.65, 0, 1)
  const compactnessScore = 1 - clamp((retainedSpread - 0.015) / 0.07, 0, 1)
  const polygonScore = input.usedLandmarkPolygon ? 1 : 0.6
  const fallbackScore = usedFallbackPixels ? 0.3 : 1
  const reliability = clamp(
    polygonScore * fallbackScore * (sampleScore * 0.3 + retentionScore * 0.35 + compactnessScore * 0.35),
    0,
    1,
  )
  const representativeLch = oklabToOklch(representativeLab)

  return {
    input,
    filteredPixels: retained.map(({ rgb }) => rgb),
    representativeLab,
    diagnostic: {
      name: input.name,
      usedLandmarkPolygon: input.usedLandmarkPolygon,
      sourcePixelCount: converted.length,
      retainedPixelCount: retained.length,
      rejected,
      representative: {
        l: representativeLab.l,
        a: representativeLab.a,
        b: representativeLab.b,
        chroma: representativeLch.c,
        hueDegrees: representativeLch.h,
      },
      reliability,
    },
  }
}

function calculateSkinMeasurement(
  input: SeasonMeasurementInput,
  sourceReliability: number,
  convertToOklab: (rgb: RGB) => OKLab,
): InternalSkinMeasurement {
  const regions = input.skinRegions.map((region) => analyzeSkinRegion(region, convertToOklab))
  const usableRegions = regions.filter((region) => region.filteredPixels.length > 0 && region.diagnostic.reliability > 0)
  const balancedPixels = usableRegions.flatMap((region) => {
    const maximumPerRegion = 8000
    const stride = Math.max(1, Math.ceil(region.filteredPixels.length / maximumPerRegion))
    return region.filteredPixels.filter((_, index) => index % stride === 0).slice(0, maximumPerRegion)
  })
  const combinedDistribution: FeaturePixelDistribution = {
    pixels: balancedPixels.length > 0 ? balancedPixels : input.skin.pixels,
    totalPixelCount: input.skinRegions.reduce((sum, region) => sum + region.totalPixelCount, 0),
  }
  const feature = calculateFeatureStatistics(
    combinedDistribution,
    FEATURE_SAMPLE_TARGETS.skin,
    sourceReliability,
    convertToOklab,
  )

  if (usableRegions.length > 0) {
    const representativeLab = geometricMedian(
      usableRegions.map((region) => region.representativeLab),
      usableRegions.map((region) => region.diagnostic.reliability),
    )
    const representativeLch = oklabToOklch(representativeLab)
    feature.medianLab = representativeLab
    feature.publicStats.oklab.medianL = representativeLab.l
    feature.publicStats.oklab.medianA = representativeLab.a
    feature.publicStats.oklab.medianB = representativeLab.b
    feature.publicStats.oklch.medianChroma = representativeLch.c
    feature.publicStats.oklch.hueDegrees = representativeLch.h
    // Missing or rejected regions must remain visible in overall skin
    // reliability rather than disappearing from the average.
    feature.publicStats.reliability *= mean(regions.map((region) => region.diagnostic.reliability))
  }

  const pairwiseDistances: SkinDiagnostics['pairwiseDistances'] = []
  for (let i = 0; i < usableRegions.length; i++) {
    for (let j = i + 1; j < usableRegions.length; j++) {
      const first = usableRegions[i]
      const second = usableRegions[j]
      pairwiseDistances.push({
        first: first.input.name,
        second: second.input.name,
        total: oklabDistance(first.representativeLab, second.representativeLab),
        lightness: Math.abs(first.representativeLab.l - second.representativeLab.l),
        chromatic: Math.hypot(
          first.representativeLab.a - second.representativeLab.a,
          first.representativeLab.b - second.representativeLab.b,
        ),
      })
    }
  }

  const maximumDistance = pairwiseDistances.length > 0 ? Math.max(...pairwiseDistances.map((pair) => pair.total)) : 0
  const rmsDistance = pairwiseDistances.length > 0
    ? Math.sqrt(mean(pairwiseDistances.map((pair) => pair.total ** 2)))
    : 0
  const disagreement = maximumDistance * 0.45 + rmsDistance * 0.55
  const consistencyScore = 1 - clamp((disagreement - 0.025) / 0.11, 0, 1)
  const rejectionFraction = regions.length > 0
    ? regions.reduce(
        (sum, region) => sum + region.diagnostic.sourcePixelCount - region.diagnostic.retainedPixelCount,
        0,
      ) / Math.max(1, regions.reduce((sum, region) => sum + region.diagnostic.sourcePixelCount, 0))
    : 1
  const averageLightnessDistance = mean(pairwiseDistances.map((pair) => pair.lightness))
  const averageChromaticDistance = mean(pairwiseDistances.map((pair) => pair.chromatic))
  const lowRegionReliability = regions.some((region) => region.diagnostic.reliability < 0.45)
  const contaminatedRegion = regions.some((region) => {
    const sourceCount = Math.max(1, region.diagnostic.sourcePixelCount)
    const rejectedFraction = 1 - region.diagnostic.retainedPixelCount / sourceCount
    const rednessFraction = region.diagnostic.rejected.redness / sourceCount
    return rejectedFraction > 0.3 || rednessFraction > 0.05
  })
  const likelyCause: SkinDiagnostics['likelyCause'] =
    rejectionFraction > 0.3 || contaminatedRegion || lowRegionReliability
      ? 'sampling-contamination'
      : consistencyScore >= 0.75
        ? 'consistent'
        : averageLightnessDistance > 0.05 && averageLightnessDistance > averageChromaticDistance * 1.25
          ? 'uneven-lighting'
          : 'regional-variation'

  return {
    ...feature,
    diagnostics: {
      consistencyScore,
      likelyCause,
      regions: regions.map((region) => region.diagnostic),
      pairwiseDistances,
    },
  }
}

function oklabDistance(a: OKLab, b: OKLab): number {
  return Math.sqrt((a.l - b.l) ** 2 + (a.a - b.a) ** 2 + (a.b - b.b) ** 2)
}

function maximumRegionDisagreement(
  regions: FeaturePixelDistribution[],
  convertToOklab: (rgb: RGB) => OKLab,
): number {
  const medians = regions
    .filter((region) => region.pixels.length > 0)
    .map((region) => calculateFeatureStatistics(region, 1, 1, convertToOklab).medianLab)
  let maximum = 0
  for (let i = 0; i < medians.length; i++) {
    for (let j = i + 1; j < medians.length; j++) {
      maximum = Math.max(maximum, oklabDistance(medians[i], medians[j]))
    }
  }
  return maximum
}

function addFeatureQualityFlags(
  flags: MeasurementQualityFlag[],
  feature: 'skin' | 'hair' | 'eyes',
  stats: FeatureColourStatistics,
): void {
  if (stats.sampleSize < FEATURE_SAMPLE_TARGETS[feature]) {
    flags.push({
      code: `${feature}_small_sample`,
      severity: 'warning',
      message: `${feature} has a small retained pixel sample (${stats.sampleSize}).`,
    })
  }
  if (stats.clippedFraction > 0.05) {
    flags.push({
      code: `${feature}_clipping`,
      severity: 'warning',
      message: `${feature} contains ${(stats.clippedFraction * 100).toFixed(1)}% clipped pixels.`,
    })
  }
  if (stats.reliability < 0.45) {
    flags.push({
      code: `${feature}_low_reliability`,
      severity: 'warning',
      message: `${feature} measurements are low reliability in this photo.`,
    })
  }
}

/**
 * Produces continuous measurements used by the v3 classifier and quality gate.
 * Historical shadow names remain stable for developer comparisons.
 */
function calculateMeasurementCore(
  input: SeasonMeasurementInput,
  convertToOklab: (rgb: RGB) => OKLab,
  lightingReliability: number,
): MeasurementCore {
  const fallbackFactor = input.method === 'vision' ? 1 : 0.5
  const skin = calculateSkinMeasurement(input, fallbackFactor, convertToOklab)
  const hair = calculateFeatureStatistics(
    input.hair,
    FEATURE_SAMPLE_TARGETS.hair,
    fallbackFactor * (input.hairUsedMaskSampling ? 1 : 0.6),
    convertToOklab,
  )
  const eyes = calculateFeatureStatistics(
    input.eyes,
    FEATURE_SAMPLE_TARGETS.eyes,
    fallbackFactor * (input.eyeSampleUsable ? 1 : 0.45),
    convertToOklab,
  )

  const skinRegionDisagreement = skin.diagnostics.pairwiseDistances.length > 0
    ? Math.max(...skin.diagnostics.pairwiseDistances.map((pair) => pair.total))
    : 0
  const eyeRegionDisagreement = maximumRegionDisagreement(input.eyeRegions, convertToOklab)
  const skinRegionAgreement = skin.diagnostics.consistencyScore

  const skinHue = oklabToOklch(skin.medianLab).h
  const skinChroma = skin.publicStats.oklch.medianChroma
  const chromaEvidence = clamp((skinChroma - 0.01) / 0.06, 0, 1)
  const plausibleSkinHue = skinHue !== null && skinHue >= 5 && skinHue <= 100
  const temperatureScore =
    skinHue === null ? 0 : clamp((skinHue - SKIN_HUE_NEUTRAL_DEGREES) / SKIN_HUE_FULL_SCALE_DEGREES, -1, 1)
  const temperatureReliability = clamp(
    skin.publicStats.reliability * skinRegionAgreement * chromaEvidence * (plausibleSkinHue ? 1 : 0.35),
    0,
    1,
  )

  const valueComposite = weightedMean([
    { value: skin.publicStats.oklab.medianL, reliability: skin.publicStats.reliability },
    { value: hair.publicStats.oklab.medianL, reliability: hair.publicStats.reliability },
    { value: eyes.publicStats.oklab.medianL, reliability: eyes.publicStats.reliability },
  ])
  const absoluteChromaComposite = weightedMean([
    { value: skin.publicStats.oklch.medianChroma, reliability: skin.publicStats.reliability },
    { value: hair.publicStats.oklch.medianChroma, reliability: hair.publicStats.reliability },
    { value: eyes.publicStats.oklch.medianChroma, reliability: eyes.publicStats.reliability },
  ])
  const exposureNormalizedChromaComposite = weightedMean([
    { value: exposureNormalizedChroma(skin), reliability: skin.publicStats.reliability },
    { value: exposureNormalizedChroma(hair), reliability: hair.publicStats.reliability },
    { value: exposureNormalizedChroma(eyes), reliability: eyes.publicStats.reliability },
  ])
  const stabilizedCompositeChroma =
    absoluteChromaComposite.value * (1 - CHROMA_EXPOSURE_NORMALIZATION_WEIGHT) +
    exposureNormalizedChromaComposite.value * CHROMA_EXPOSURE_NORMALIZATION_WEIGHT

  const darkerFeatureLightness = weightedMean([
    { value: hair.publicStats.oklab.medianL, reliability: hair.publicStats.reliability },
    { value: eyes.publicStats.oklab.medianL, reliability: eyes.publicStats.reliability },
  ])
  const darkerFeatureLightnessToSkinRatio =
    darkerFeatureLightness.value / Math.max(0.12, skin.publicStats.oklab.medianL)
  const relativeDepthRatio = 1 - darkerFeatureLightnessToSkinRatio
  const absoluteValueScore = clamp(valueComposite.value * 2 - 1, -1, 1)
  const relativeValueScore = darkerFeatureLightness.reliability > 0
    ? clamp(
        1 -
          ((relativeDepthRatio - LIGHT_RELATIVE_DEPTH_RATIO) /
            (DEEP_RELATIVE_DEPTH_RATIO - LIGHT_RELATIVE_DEPTH_RATIO)) *
            2,
        -1,
        1,
      )
    : absoluteValueScore
  const relativeValueEvidence = clamp(darkerFeatureLightness.reliability / 0.5, 0, 1)
  const relativeValueWeight = RELATIVE_VALUE_WEIGHT * relativeValueEvidence
  const stabilizedValueScore = clamp(
    absoluteValueScore * (1 - relativeValueWeight) + relativeValueScore * relativeValueWeight,
    -1,
    1,
  )

  const meanClippedFraction = mean([
    skin.publicStats.clippedFraction,
    hair.publicStats.clippedFraction,
    eyes.publicStats.clippedFraction,
  ])
  const clippingScore = 1 - clamp(meanClippedFraction / 0.12, 0, 1)
  // Skin L is only a broad exposure sanity check, not a normalization target;
  // the wide interval avoids erasing real differences in natural skin depth.
  const skinExposurePlausibility =
    1 - clamp((Math.abs(skin.publicStats.oklab.medianL - 0.6) - 0.18) / 0.22, 0, 1)
  const exposureReliability = clamp(clippingScore * 0.7 + skinExposurePlausibility * 0.3, 0, 1)
  const relativeValueReliability = Math.sqrt(
    skin.publicStats.reliability * darkerFeatureLightness.reliability,
  )
  const valueEvidenceReliability =
    valueComposite.reliability * (1 - relativeValueWeight) +
    relativeValueReliability * relativeValueWeight

  const featurePairs = [
    {
      label: 'skin-hair' as const,
      firstLightness: skin.medianLab.l,
      secondLightness: hair.medianLab.l,
      reliability: Math.sqrt(skin.publicStats.reliability * hair.publicStats.reliability),
    },
    {
      label: 'skin-eyes' as const,
      firstLightness: skin.medianLab.l,
      secondLightness: eyes.medianLab.l,
      reliability: Math.sqrt(skin.publicStats.reliability * eyes.publicStats.reliability),
    },
    {
      label: 'hair-eyes' as const,
      firstLightness: hair.medianLab.l,
      secondLightness: eyes.medianLab.l,
      reliability: Math.sqrt(hair.publicStats.reliability * eyes.publicStats.reliability),
    },
  ].map((pair) => {
    const rawDeltaL = Math.abs(pair.firstLightness - pair.secondLightness)
    const relativeDeltaL = rawDeltaL / Math.max(0.12, pair.firstLightness, pair.secondLightness)
    return {
      label: pair.label,
      rawDeltaL,
      relativeDeltaL,
      normalizedContrast: clamp(relativeDeltaL * CONTRAST_REFERENCE_LIGHTNESS, 0, 1),
      reliability: pair.reliability,
    }
  }).filter((pair) => pair.reliability > 0)
  const maximumPair = featurePairs.reduce(
    (current, pair) => (pair.rawDeltaL > current.rawDeltaL ? pair : current),
    { rawDeltaL: 0, reliability: 0 },
  )
  const rmsLightnessDifference =
    featurePairs.length > 0
      ? Math.sqrt(mean(featurePairs.map((pair) => pair.rawDeltaL ** 2)))
      : 0
  const normalizedMaximum = featurePairs.length > 0
    ? Math.max(...featurePairs.map((pair) => pair.normalizedContrast))
    : 0
  const normalizedRms = weightedRootMeanSquare(
    featurePairs.map((pair) => ({ value: pair.normalizedContrast, reliability: pair.reliability })),
  )
  const weightedRawRms = weightedRootMeanSquare(
    featurePairs.map((pair) => ({ value: pair.rawDeltaL, reliability: pair.reliability })),
  )
  const rawContrastAggregate =
    maximumPair.rawDeltaL * CONTRAST_MAX_WEIGHT + weightedRawRms * (1 - CONTRAST_MAX_WEIGHT)
  const normalizedContrastAggregate =
    normalizedMaximum * CONTRAST_MAX_WEIGHT + normalizedRms * (1 - CONTRAST_MAX_WEIGHT)
  const stabilizedContrast = clamp(
    rawContrastAggregate * (1 - CONTRAST_RELATIVE_WEIGHT) +
      normalizedContrastAggregate * CONTRAST_RELATIVE_WEIGHT,
    0,
    1,
  )
  const aggregateEstimatorDisagreement = Math.abs(
    rawContrastAggregate - normalizedContrastAggregate,
  )
  const normalizedPairRange = featurePairs.length > 0
    ? normalizedMaximum - Math.min(...featurePairs.map((pair) => pair.normalizedContrast))
    : 0
  const aggregateAgreement =
    1 - clamp((aggregateEstimatorDisagreement - 0.03) / 0.22, 0, 1)
  const pairAgreement = 1 - clamp((normalizedPairRange - 0.2) / 0.55, 0, 1)
  const contrastEstimatorAgreement = clamp(
    aggregateAgreement * 0.6 + pairAgreement * 0.4,
    0,
    1,
  )
  const contrastEvidenceReliability = mean(featurePairs.map((pair) => pair.reliability))

  const chromaticLightingFactor = 0.25 + lightingReliability * 0.75
  const valueLightingFactor = 0.45 + lightingReliability * 0.55
  const valueExposureFactor = 0.45 + exposureReliability * 0.55
  const chromaLightingFactor = 0.1 + lightingReliability * 0.9
  const chromaExposureFactor = 0.35 + exposureReliability * 0.65
  const contrastLightingFactor = 0.45 + lightingReliability * 0.55
  const contrastExposureFactor = 0.5 + exposureReliability * 0.5
  const contrastAgreementFactor = 0.3 + contrastEstimatorAgreement * 0.7
  const qualityFlags: MeasurementQualityFlag[] = []
  if (input.method === 'fallback') {
    qualityFlags.push({
      code: 'fixed_region_fallback',
      severity: 'warning',
      message: 'Face-guided sampling failed; measurements use fixed image regions.',
    })
  }
  if (!input.hairUsedMaskSampling) {
    qualityFlags.push({
      code: 'hair_mask_unavailable',
      severity: 'warning',
      message: 'Hair statistics use the face-anchored fallback region rather than segmented hair pixels.',
    })
  }
  if (skinRegionDisagreement > 0.08) {
    qualityFlags.push({
      code: 'skin_regions_inconsistent',
      severity: 'warning',
      message: `Cleaned skin regions disagree in OKLab (maximum distance ${skinRegionDisagreement.toFixed(3)}; likely cause: ${skin.diagnostics.likelyCause}).`,
    })
  }
  if (skin.diagnostics.likelyCause === 'sampling-contamination') {
    qualityFlags.push({
      code: 'skin_sampling_contamination_filtered',
      severity: 'warning',
      message: 'One or more skin regions contained substantial shadow, highlight, redness, or colour outliers; those pixels were excluded before measurement.',
    })
  }
  if (eyeRegionDisagreement > 0.12) {
    qualityFlags.push({
      code: 'eye_regions_inconsistent',
      severity: 'warning',
      message: `Left and right iris samples disagree in OKLab (distance ${eyeRegionDisagreement.toFixed(3)}).`,
    })
  }
  if (exposureReliability < 0.55) {
    qualityFlags.push({
      code: 'exposure_low_reliability',
      severity: 'warning',
      message: 'Clipping or an unusually exposed face region reduced value, chroma, and contrast reliability.',
    })
  }
  if (lightingReliability < 0.45) {
    qualityFlags.push({
      code: 'colour_dimensions_lighting_constrained',
      severity: 'warning',
      message: 'Weak white-balance evidence reduced value, chroma, and contrast reliability; relative and exposure-normalized components carry more of the diagnostic signal.',
    })
  }
  if (contrastEstimatorAgreement < 0.55) {
    qualityFlags.push({
      code: 'contrast_estimators_disagree',
      severity: 'warning',
      message: 'Raw and relative feature contrast, or the individual feature pairs, disagree; contrast reliability has been reduced.',
    })
  }
  addFeatureQualityFlags(qualityFlags, 'skin', skin.publicStats)
  addFeatureQualityFlags(qualityFlags, 'hair', hair.publicStats)
  addFeatureQualityFlags(qualityFlags, 'eyes', eyes.publicStats)

  return {
    temperature: {
      score: temperatureScore,
      reliability: temperatureReliability * chromaticLightingFactor,
      skinHueDegrees: skinHue,
      chromaEvidence,
    },
    value: {
      score: stabilizedValueScore,
      reliability: valueEvidenceReliability * valueLightingFactor * valueExposureFactor,
      compositeLightness: valueComposite.value,
    },
    chroma: {
      score: clamp(
        ((stabilizedCompositeChroma - MUTED_CHROMA_ANCHOR) /
          (CLEAR_CHROMA_ANCHOR - MUTED_CHROMA_ANCHOR)) *
          2 -
          1,
        -1,
        1,
      ),
      reliability:
        absoluteChromaComposite.reliability * chromaLightingFactor * chromaExposureFactor,
      compositeChroma: stabilizedCompositeChroma,
    },
    contrast: {
      score: stabilizedContrast,
      reliability:
        contrastEvidenceReliability *
        contrastLightingFactor *
        contrastExposureFactor *
        contrastAgreementFactor,
      maximumLightnessDifference: maximumPair.rawDeltaL,
      rmsLightnessDifference,
    },
    features: {
      skin: skin.publicStats,
      hair: hair.publicStats,
      eyes: eyes.publicStats,
    },
    stabilityDiagnostics: {
      exposure: {
        reliability: exposureReliability,
        clippingScore,
        skinExposurePlausibility,
        absoluteCompositeLightness: valueComposite.value,
        absoluteValueScore,
        relativeValueScore,
        stabilizedValueScore,
        relativeValueWeight,
        skinLightness: skin.publicStats.oklab.medianL,
        darkerFeatureLightnessToSkinRatio,
        hairLightnessRelativeToSkin:
          hair.publicStats.oklab.medianL - skin.publicStats.oklab.medianL,
        eyeLightnessRelativeToSkin:
          eyes.publicStats.oklab.medianL - skin.publicStats.oklab.medianL,
      },
      chroma: {
        absoluteCompositeChroma: absoluteChromaComposite.value,
        exposureNormalizedCompositeChroma: exposureNormalizedChromaComposite.value,
        stabilizedCompositeChroma,
        exposureNormalizationWeight: CHROMA_EXPOSURE_NORMALIZATION_WEIGHT,
        skinChromaToLightness: chromaToLightnessRatio(skin),
        hairChromaToLightness: chromaToLightnessRatio(hair),
        eyeChromaToLightness: chromaToLightnessRatio(eyes),
      },
      contrast: {
        pairs: featurePairs,
        rawMaximum: maximumPair.rawDeltaL,
        rawRms: rmsLightnessDifference,
        normalizedMaximum,
        normalizedRms,
        rawAggregate: rawContrastAggregate,
        normalizedAggregate: normalizedContrastAggregate,
        stabilizedContrast,
        relativeWeight: CONTRAST_RELATIVE_WEIGHT,
        estimatorDisagreement: aggregateEstimatorDisagreement,
        estimatorAgreement: contrastEstimatorAgreement,
      },
    },
    skinDiagnostics: skin.diagnostics,
    qualityFlags,
  }
}

/**
 * Runs the same measurement core before and after conservative illumination
 * normalization. Only the corrected core is exposed as the primary shadow
 * diagnostic; neither version participates in the live season classifier.
 */
export function calculateShadowSeasonMeasurements(input: SeasonMeasurementInput): ShadowSeasonMeasurements {
  const illumination = estimateIlluminationCorrection(input.lightingReferences)
  const before = calculateMeasurementCore(input, rgbToOklab, 1)
  const after = calculateMeasurementCore(
    input,
    illumination.convertToOklab,
    illumination.diagnostics.reliability,
  )

  return {
    version: 'oklab-shadow-v6',
    ...after,
    lighting: illumination.diagnostics,
    inputQuality: {
      analysisMethod: input.method,
      faceAreaRatio: input.faceAreaRatio,
      landmarkSkinRegionCount: input.skinRegions.filter((region) => region.usedLandmarkPolygon).length,
      hairSegmentationUsed: input.hairUsedMaskSampling,
      hairMaskCoverageRatio: input.hairMaskCoverageRatio,
      eyeSampleUsable: input.eyeSampleUsable,
    },
    beforeAfter: {
      temperature: { before: before.temperature.score, after: after.temperature.score },
      value: { before: before.value.score, after: after.value.score },
      chroma: { before: before.chroma.score, after: after.chroma.score },
    },
    qualityFlags: [...illumination.qualityFlags, ...after.qualityFlags],
  }
}
