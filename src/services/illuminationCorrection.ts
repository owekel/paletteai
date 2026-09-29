import type { RGB } from './colorUtils'
import { clamp } from './colorUtils'
import {
  rgbToLinearRgb,
  rgbToOklab,
  rgbToXyz,
  xyzToOklab,
  type LinearRGB,
  type OKLab,
  type XYZ,
} from './oklab'
import type { LightingDiagnostics, MeasurementQualityFlag } from '../types/seasonMeasurements'

export interface LightingReferenceSamples {
  backgroundPixels: RGB[]
  backgroundTiles: RGB[][]
  scleraPixels: RGB[]
  scleraRegions: RGB[][]
}

export interface IlluminationCorrectionResult {
  diagnostics: LightingDiagnostics
  qualityFlags: MeasurementQualityFlag[]
  convertToOklab: (rgb: RGB) => OKLab
}

interface WhiteEstimate {
  xyz: XYZ
  displayRgb: RGB
  chromaticityX: number
  chromaticityY: number
  spread: number
  medianChroma: number
  lowChromaFraction: number
}

const D65_WHITE: XYZ = { x: 0.95047, y: 1, z: 1.08883 }
const MIN_BACKGROUND_CANDIDATES = 120
const STRONG_NEUTRAL_CHROMA = 0.025

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

function weightedMedian(values: { value: number; weight: number }[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a.value - b.value)
  const totalWeight = sorted.reduce((sum, entry) => sum + entry.weight, 0)
  let cumulativeWeight = 0
  for (const entry of sorted) {
    cumulativeWeight += entry.weight
    if (cumulativeWeight >= totalWeight / 2) return entry.value
  }
  return sorted[sorted.length - 1].value
}

function normalizeWhite(xyz: XYZ): XYZ | null {
  if (!Number.isFinite(xyz.y) || xyz.y <= 0.0001) return null
  return { x: xyz.x / xyz.y, y: 1, z: xyz.z / xyz.y }
}

function chromaticity(xyz: XYZ): { x: number; y: number } {
  const sum = xyz.x + xyz.y + xyz.z
  if (sum <= 0) return { x: 0, y: 0 }
  return { x: xyz.x / sum, y: xyz.y / sum }
}

function chromaticityDistance(a: WhiteEstimate, b: WhiteEstimate): number {
  return Math.hypot(a.chromaticityX - b.chromaticityX, a.chromaticityY - b.chromaticityY)
}

function estimateWhite(pixels: RGB[]): WhiteEstimate | null {
  if (pixels.length === 0) return null
  const linear = pixels.map(rgbToLinearRgb)
  const chromas = pixels.map((pixel) => {
    const lab = rgbToOklab(pixel)
    return Math.hypot(lab.a, lab.b)
  })
  // Pixels near the neutral axis carry more weight. More chromatic candidates
  // are not discarded outright because a genuine neutral surface under a
  // coloured illuminant will itself appear tinted, but their influence is
  // deliberately limited until other evidence supports them.
  const neutralityWeights = chromas.map((chroma) => clamp(1 - (chroma - 0.01) / 0.055, 0.1, 1))
  const medianLinear: LinearRGB = {
    r: weightedMedian(linear.map((pixel, index) => ({ value: pixel.r, weight: neutralityWeights[index] }))),
    g: weightedMedian(linear.map((pixel, index) => ({ value: pixel.g, weight: neutralityWeights[index] }))),
    b: weightedMedian(linear.map((pixel, index) => ({ value: pixel.b, weight: neutralityWeights[index] }))),
  }
  const white = normalizeWhite({
    x: 0.4124564 * medianLinear.r + 0.3575761 * medianLinear.g + 0.1804375 * medianLinear.b,
    y: 0.2126729 * medianLinear.r + 0.7151522 * medianLinear.g + 0.072175 * medianLinear.b,
    z: 0.0193339 * medianLinear.r + 0.119192 * medianLinear.g + 0.9503041 * medianLinear.b,
  })
  if (!white) return null

  const xy = chromaticity(white)
  const sampledForSpread = pixels.length > 2000
    ? pixels.filter((_, index) => index % Math.ceil(pixels.length / 2000) === 0)
    : pixels
  const distances = sampledForSpread.map((pixel) => {
    const pixelWhite = normalizeWhite(rgbToXyz(pixel))
    if (!pixelWhite) return 1
    const pixelXy = chromaticity(pixelWhite)
    return Math.hypot(pixelXy.x - xy.x, pixelXy.y - xy.y)
  })

  const medianRgb = {
    r: weightedMedian(pixels.map((pixel, index) => ({ value: pixel.r, weight: neutralityWeights[index] }))),
    g: weightedMedian(pixels.map((pixel, index) => ({ value: pixel.g, weight: neutralityWeights[index] }))),
    b: weightedMedian(pixels.map((pixel, index) => ({ value: pixel.b, weight: neutralityWeights[index] }))),
  }
  const maximumChannel = Math.max(medianRgb.r, medianRgb.g, medianRgb.b, 1)

  return {
    xyz: white,
    displayRgb: {
      r: (medianRgb.r / maximumChannel) * 255,
      g: (medianRgb.g / maximumChannel) * 255,
      b: (medianRgb.b / maximumChannel) * 255,
    },
    chromaticityX: xy.x,
    chromaticityY: xy.y,
    spread: median(distances),
    medianChroma: median(chromas),
    lowChromaFraction: chromas.filter((chroma) => chroma <= STRONG_NEUTRAL_CHROMA).length / chromas.length,
  }
}

function blendWhite(primary: WhiteEstimate, supporting: WhiteEstimate, supportingWeight: number): WhiteEstimate {
  const primaryWeight = 1 - supportingWeight
  const xyz = normalizeWhite({
    x: primary.xyz.x * primaryWeight + supporting.xyz.x * supportingWeight,
    y: 1,
    z: primary.xyz.z * primaryWeight + supporting.xyz.z * supportingWeight,
  }) ?? primary.xyz
  const xy = chromaticity(xyz)
  return {
    xyz,
    displayRgb: {
      r: primary.displayRgb.r * primaryWeight + supporting.displayRgb.r * supportingWeight,
      g: primary.displayRgb.g * primaryWeight + supporting.displayRgb.g * supportingWeight,
      b: primary.displayRgb.b * primaryWeight + supporting.displayRgb.b * supportingWeight,
    },
    chromaticityX: xy.x,
    chromaticityY: xy.y,
    spread: primary.spread,
    medianChroma: primary.medianChroma,
    lowChromaFraction: primary.lowChromaFraction,
  }
}

function bradfordLms({ x, y, z }: XYZ): XYZ {
  return {
    x: 0.8951 * x + 0.2664 * y - 0.1614 * z,
    y: -0.7502 * x + 1.7135 * y + 0.0367 * z,
    z: 0.0389 * x - 0.0685 * y + 1.0296 * z,
  }
}

function inverseBradfordLms({ x, y, z }: XYZ): XYZ {
  return {
    x: 0.9869929 * x - 0.1470543 * y + 0.1599627 * z,
    y: 0.4323053 * x + 0.5183603 * y + 0.0492912 * z,
    z: -0.0085287 * x + 0.0400428 * y + 0.9684867 * z,
  }
}

function createBradfordConverter(sourceWhite: XYZ, strength: number): (rgb: RGB) => OKLab {
  const sourceLms = bradfordLms(sourceWhite)
  const targetLms = bradfordLms(D65_WHITE)
  const scales = {
    x: Math.exp(Math.log(targetLms.x / sourceLms.x) * strength),
    y: Math.exp(Math.log(targetLms.y / sourceLms.y) * strength),
    z: Math.exp(Math.log(targetLms.z / sourceLms.z) * strength),
  }

  return (rgb: RGB) => {
    const sourcePixelLms = bradfordLms(rgbToXyz(rgb))
    const adaptedXyz = inverseBradfordLms({
      x: sourcePixelLms.x * scales.x,
      y: sourcePixelLms.y * scales.y,
      z: sourcePixelLms.z * scales.z,
    })
    return xyzToOklab(adaptedXyz)
  }
}

export function estimateIlluminationCorrection(
  references: LightingReferenceSamples,
): IlluminationCorrectionResult {
  const background = estimateWhite(references.backgroundPixels)
  const sclera = estimateWhite(references.scleraPixels)
  const tileEstimates = references.backgroundTiles
    .filter((tile) => tile.length >= 30)
    .map(estimateWhite)
    .filter((estimate): estimate is WhiteEstimate => estimate !== null)

  let spatialDisagreement: number | null = null
  for (let i = 0; i < tileEstimates.length; i++) {
    for (let j = i + 1; j < tileEstimates.length; j++) {
      const distance = chromaticityDistance(tileEstimates[i], tileEstimates[j])
      spatialDisagreement = Math.max(spatialDisagreement ?? 0, distance)
    }
  }

  const estimatorDisagreement = background && sclera ? chromaticityDistance(background, sclera) : null
  const countScore = clamp(references.backgroundPixels.length / 1800, 0, 1)
  const spreadScore = background ? 1 - clamp(background.spread / 0.035, 0, 1) : 0
  const spatialScore = spatialDisagreement === null ? 0.65 : 1 - clamp(spatialDisagreement / 0.045, 0, 1)
  const scleraAgreement = estimatorDisagreement === null ? 0.65 : 1 - clamp(estimatorDisagreement / 0.06, 0, 1)
  const hasPrimaryReference = background !== null && references.backgroundPixels.length >= MIN_BACKGROUND_CANDIDATES
  const mixedLightingSuspected = (spatialDisagreement ?? 0) > 0.035

  let selectedWhite = background
  // Sclera is intentionally capped at 10% and is only allowed to support an
  // already viable background estimate when both estimates broadly agree.
  if (background && sclera && (estimatorDisagreement ?? 1) < 0.04) {
    selectedWhite = blendWhite(background, sclera, 0.1)
  }

  const d65Estimate: WhiteEstimate = {
    xyz: D65_WHITE,
    displayRgb: { r: 255, g: 255, b: 255 },
    chromaticityX: chromaticity(D65_WHITE).x,
    chromaticityY: chromaticity(D65_WHITE).y,
    spread: 0,
    medianChroma: 0,
    lowChromaFraction: 1,
  }
  const correctionMagnitude = selectedWhite ? chromaticityDistance(selectedWhite, d65Estimate) : 0

  // Consistency answers only "are the candidate pixels telling one stable
  // story?" It intentionally contains no assumption that the story is a
  // neutral surface rather than, for example, one uniformly beige wall.
  let candidateConsistency = hasPrimaryReference
    ? countScore * 0.3 + spreadScore * 0.4 + spatialScore * 0.3
    : 0
  if (mixedLightingSuspected) candidateConsistency *= 0.55
  candidateConsistency = clamp(candidateConsistency, 0, 1)

  // Neutral-reference confidence is deliberately separate. A candidate is
  // more credible when its estimated white is not extremely far from D65,
  // its pixels have low observed OKLab chroma, and a meaningful fraction sit
  // very near the neutral axis. Sclera can adjust this by at most 12% and can
  // never create a viable primary reference by itself.
  const tintPlausibility = background
    ? 1 - clamp((chromaticityDistance(background, d65Estimate) - 0.008) / 0.045, 0, 1)
    : 0
  const chromaPlausibility = background
    ? 1 - clamp((background.medianChroma - 0.012) / 0.05, 0, 1)
    : 0
  const lowChromaSupport = background
    ? clamp((background.lowChromaFraction - 0.1) / 0.75, 0, 1)
    : 0
  const backgroundNeutralConfidence =
    tintPlausibility * 0.45 + chromaPlausibility * 0.35 + lowChromaSupport * 0.2
  const scleraWeight = sclera ? 0.12 : 0
  const neutralReferenceConfidence = hasPrimaryReference
    ? clamp(backgroundNeutralConfidence * (1 - scleraWeight) + scleraAgreement * scleraWeight, 0, 1)
    : Math.min(0.12, sclera ? references.scleraPixels.length / 3000 : 0)

  // Both conditions are required. A perfectly consistent but implausibly
  // tinted reference therefore cannot produce high lighting reliability.
  const reliability = clamp(candidateConsistency * neutralReferenceConfidence, 0, 1)
  let correctionStrength = hasPrimaryReference && reliability >= 0.4
    ? clamp((reliability - 0.35) / 0.65, 0, 1) * 0.65
    : 0
  if (mixedLightingSuspected) correctionStrength = Math.min(correctionStrength, 0.15)
  const correctionApplied = selectedWhite !== null && correctionMagnitude >= 0.003 && correctionStrength >= 0.05
  if (!correctionApplied) correctionStrength = 0

  const qualityFlags: MeasurementQualityFlag[] = []
  if (!hasPrimaryReference) {
    qualityFlags.push({
      code: 'lighting_reference_unavailable',
      severity: 'warning',
      message: 'No sufficiently large segmented low-chroma background reference was available; sclera alone cannot trigger correction.',
    })
  }
  if (mixedLightingSuspected) {
    qualityFlags.push({
      code: 'mixed_lighting_suspected',
      severity: 'warning',
      message: 'Neutral candidates in different image areas imply different illuminants, so correction was constrained.',
    })
  }
  if (hasPrimaryReference && neutralReferenceConfidence < 0.45) {
    qualityFlags.push({
      code: 'neutral_reference_low_confidence',
      severity: 'warning',
      message: 'Background candidates are consistent but too chromatic or insufficiently neutral to justify strong white-balance correction.',
    })
  }
  if (reliability < 0.45) {
    qualityFlags.push({
      code: 'lighting_low_reliability',
      severity: 'warning',
      message: 'Lighting normalization is low reliability; shadow measurement confidence has been reduced.',
    })
  }
  qualityFlags.push({
    code: correctionApplied ? 'white_balance_corrected' : 'white_balance_uncorrected',
    severity: 'info',
    message: correctionApplied
      ? `A conservative ${(correctionStrength * 100).toFixed(0)}% Bradford chromatic adaptation was applied to shadow measurements.`
      : 'No trustworthy or meaningful white-balance correction was applied to shadow measurements.',
  })

  return {
    diagnostics: {
      correctionApplied,
      correctionStrength,
      candidateConsistency,
      neutralReferenceConfidence,
      reliability,
      mixedLightingSuspected,
      backgroundCandidateCount: references.backgroundPixels.length,
      scleraCandidateCount: references.scleraPixels.length,
      estimatorDisagreement,
      spatialDisagreement,
      estimatedIlluminant: selectedWhite
        ? {
            rgb: selectedWhite.displayRgb,
            chromaticityX: selectedWhite.chromaticityX,
            chromaticityY: selectedWhite.chromaticityY,
          }
        : null,
    },
    qualityFlags,
    convertToOklab: correctionApplied && selectedWhite
      ? createBradfordConverter(selectedWhite.xyz, correctionStrength)
      : rgbToOklab,
  }
}
