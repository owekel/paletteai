// ---------------------------------------------------------------------------
// analyzeImage
//
// This is the ONE function the rest of the app depends on. It takes a photo
// and returns a ColorProfile. Nothing outside this file knows *how* that
// happens — which is exactly what makes it possible to swap out later.
//
// HOW THIS VERSION WORKS
// 1. Try to detect an actual face (src/services/vision/faceDetection.ts) and
//    an actual hair mask (src/services/vision/hairSegmentation.ts) using
//    MediaPipe's on-device models, entirely in the browser. Skin, hair, and
//    eye colour are then sampled from the regions/pixels those models
//    actually identified — see colourSampling.ts for the trimmed-mean
//    sampling itself.
// 2. If that fails for ANY reason — no face found, a model fails to load,
//    it times out, the photo is unsuitable — this quietly falls back to the
//    original V1 approach: fixed rectangles guessed from typical portrait
//    framing (see REGIONS below). The app never crashes because of this;
//    it just produces a lower-confidence result and says so.
// 3. Either way, the resulting skin/hair/eye colours feed into the SAME
//    undertone / depth / contrast / season logic as before — that part is
//    unchanged. Confidence is now computed from how much could actually be
//    detected, not just how clear-cut the season match happened to be.
//
// All of this happens in the browser. Your PHOTO is never uploaded anywhere;
// the MediaPipe models themselves are fetched from Google's public CDN the
// first time they're needed (see vision/loadVisionModels.ts).
// ---------------------------------------------------------------------------

import type { ColorProfile, Season, Undertone, Depth, Contrast } from '../types/colorProfile'
import {
  type RGB,
  classifyContrastFromDifference,
  classifyDepth,
  classifyTemperature,
  colorDistance,
  getLuminance,
  nearestNamedColor,
  rgbToHex,
} from './colorUtils'
import { detectFaceRegions, type NormalizedRect } from './vision/faceDetection'
import { detectHairMask } from './vision/hairSegmentation'
import { sampleRegion, sampleMaskedRegion, sampleIrisRing } from './vision/colourSampling'
import { withTimeout } from './vision/loadVisionModels'

// --- V1 fallback regions (unchanged) ----------------------------------------
// Approximate sample regions, expressed as a fraction of the image's
// width/height. Only used when face detection isn't available or doesn't
// find anything — see runFallbackSampling below.
const REGIONS = {
  skin: { xStart: 0.38, xEnd: 0.62, yStart: 0.42, yEnd: 0.58 },
  hair: { xStart: 0.32, xEnd: 0.68, yStart: 0.04, yEnd: 0.14 },
  eyes: { xStart: 0.3, xEnd: 0.7, yStart: 0.36, yEnd: 0.42 },
}

const HAIR_REFERENCE_COLORS: { name: string; rgb: RGB }[] = [
  { name: 'Black', rgb: { r: 20, g: 17, b: 15 } },
  { name: 'Dark Brown', rgb: { r: 59, g: 42, b: 32 } },
  { name: 'Medium Brown', rgb: { r: 101, g: 71, b: 51 } },
  { name: 'Light Brown', rgb: { r: 150, g: 111, b: 80 } },
  { name: 'Auburn', rgb: { r: 128, g: 60, b: 40 } },
  { name: 'Blonde', rgb: { r: 211, g: 180, b: 120 } },
  { name: 'Gray / Silver', rgb: { r: 176, g: 176, b: 176 } },
]

const EYE_REFERENCE_COLORS: { name: string; rgb: RGB }[] = [
  { name: 'Brown', rgb: { r: 75, g: 50, b: 35 } },
  { name: 'Hazel', rgb: { r: 120, g: 95, b: 55 } },
  { name: 'Amber', rgb: { r: 150, g: 110, b: 50 } },
  { name: 'Green', rgb: { r: 85, g: 110, b: 75 } },
  { name: 'Blue', rgb: { r: 90, g: 120, b: 150 } },
  { name: 'Gray', rgb: { r: 140, g: 140, b: 145 } },
]

// Each season's "signature" — used to score how well a reading matches it.
const SEASON_SIGNATURES: Record<Season, { undertone: Undertone; depths: Depth[]; contrasts: Contrast[] }> = {
  spring: { undertone: 'warm', depths: ['light', 'medium'], contrasts: ['medium', 'high'] },
  autumn: { undertone: 'warm', depths: ['medium', 'deep'], contrasts: ['low', 'medium'] },
  summer: { undertone: 'cool', depths: ['light', 'medium'], contrasts: ['low', 'medium'] },
  winter: { undertone: 'cool', depths: ['medium', 'deep'], contrasts: ['high'] },
}

// Secondary-qualifier labels, keyed by [primary season][secondary season].
const BLENDED_LABELS: Record<Season, Partial<Record<Season, string>>> = {
  spring: { summer: 'Light Spring', autumn: 'Warm Spring', winter: 'Clear Spring' },
  summer: { spring: 'Light Summer', autumn: 'Soft Summer', winter: 'Cool Summer' },
  autumn: { spring: 'Warm Autumn', summer: 'Soft Autumn', winter: 'Deep Autumn' },
  winter: { spring: 'Clear Winter', summer: 'Cool Winter', autumn: 'Deep Winter' },
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the selected image.'))
    image.src = dataUrl
  })
}

// Plain-average sampler — kept only for the V1 fallback path.
function averageColorInRegion(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  region: { xStart: number; xEnd: number; yStart: number; yEnd: number },
): RGB {
  const x = Math.round(region.xStart * width)
  const y = Math.round(region.yStart * height)
  const regionWidth = Math.max(1, Math.round((region.xEnd - region.xStart) * width))
  const regionHeight = Math.max(1, Math.round((region.yEnd - region.yStart) * height))

  const { data } = context.getImageData(x, y, regionWidth, regionHeight)

  let r = 0
  let g = 0
  let b = 0
  let pixelCount = 0
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    pixelCount += 1
  }

  return { r: r / pixelCount, g: g / pixelCount, b: b / pixelCount }
}

function determineSeason(
  undertone: Undertone,
  depth: Depth,
  contrast: Contrast,
): { season: Season; secondarySeason?: Season; label: string; topScore: number } {
  const scores = (Object.keys(SEASON_SIGNATURES) as Season[]).map((season) => {
    const signature = SEASON_SIGNATURES[season]
    let score = 0
    if (signature.undertone === undertone) score += 2
    else if (undertone === 'neutral') score += 1
    if (signature.depths.includes(depth)) score += 1
    if (signature.contrasts.includes(contrast)) score += 1
    return { season, score }
  })

  scores.sort((a, b) => b.score - a.score)
  const [top, runnerUp] = scores
  const isClearCut = top.score - runnerUp.score >= 2

  const label = isClearCut
    ? `True ${capitalize(top.season)}`
    : BLENDED_LABELS[top.season][runnerUp.season] ?? capitalize(top.season)

  return {
    season: top.season,
    secondarySeason: isClearCut ? undefined : runnerUp.season,
    label,
    topScore: top.score,
  }
}

function buildReasoning(
  undertone: Undertone,
  depth: Depth,
  contrast: Contrast,
  label: string,
  secondarySeason?: Season,
): string {
  const undertoneText =
    undertone === 'neutral'
      ? 'a fairly balanced undertone, without a strong pull toward warm or cool'
      : `a ${undertone} undertone`

  const contrastText =
    contrast === 'high'
      ? 'a noticeable amount of contrast between your hair and skin'
      : contrast === 'medium'
        ? 'a moderate level of contrast between your hair and skin'
        : 'fairly soft, blended contrast between your hair and skin'

  const sentences = [
    `Your photo suggests ${undertoneText}, with ${depth} overall depth and ${contrastText}.`,
    `That combination puts your colouring closest to ${label}.`,
  ]

  if (secondarySeason) {
    sentences.push(
      `It's not a clean-cut case, though — you also share some qualities with the ${capitalize(secondarySeason)} palette, so it's worth trying colours from both.`,
    )
  } else {
    sentences.push(`This read was fairly clear-cut based on the photo provided.`)
  }

  return sentences.join(' ')
}

// --- Confidence --------------------------------------------------------------

interface ConfidenceInputs {
  method: 'vision' | 'fallback'
  faceAreaRatio: number | null
  hairPixelCount: number
  hairAreaPixelCount: number
  hairUsedMaskSampling: boolean
  skinRegionDistances: number[]
  eyeSampleUsable: boolean
}

function computeConfidence(
  inputs: ConfidenceInputs,
  seasonTopScore: number,
): { confidence: number; notes: string[] } {
  const notes: string[] = []

  if (inputs.method === 'fallback') {
    notes.push(
      "We couldn't clearly detect a face in this photo, so this result uses a rough, whole-photo estimate rather than a face-guided one.",
    )
    const seasonClarity = seasonTopScore / 4
    const confidence = Math.min(0.55, Math.max(0.3, 0.3 + seasonClarity * 0.25))
    return { confidence: Number(confidence.toFixed(2)), notes }
  }

  let score = 0
  let factorCount = 0

  // A tiny or very off-centre face means fewer reliable pixels per feature.
  const faceAreaRatio = inputs.faceAreaRatio ?? 0
  const faceSizeScore = faceAreaRatio > 0.04 ? 1 : faceAreaRatio > 0.015 ? 0.6 : 0.3
  if (faceSizeScore < 1) {
    notes.push('The face took up a small part of the photo, which can make the colour samples less precise.')
  }
  score += faceSizeScore
  factorCount += 1

  // Hair coverage: how much of the candidate hair area the segmentation
  // model actually confirmed as hair.
  const hairCoverageRatio = inputs.hairAreaPixelCount > 0 ? inputs.hairPixelCount / inputs.hairAreaPixelCount : 0
  let hairScore = 1
  if (!inputs.hairUsedMaskSampling) {
    hairScore = 0.6
    notes.push('Hair segmentation was unavailable, so hair colour uses a simpler estimate anchored to the detected face.')
  } else if (inputs.hairPixelCount < 25) {
    hairScore = 0.3
    notes.push('Very little hair was detected in the photo, so hair colour is a rough estimate.')
  } else if (hairCoverageRatio < 0.08) {
    hairScore = 0.6
    notes.push('Only a small amount of hair was visible in the photo, so hair colour may be less precise.')
  }
  score += hairScore
  factorCount += 1

  // Skin agreement: how close the forehead / left-cheek / right-cheek
  // samples are to each other. Large disagreement usually means uneven
  // lighting or shadow across the face.
  const maxSkinDisagreement = inputs.skinRegionDistances.length > 0 ? Math.max(...inputs.skinRegionDistances) : 0
  const skinScore = maxSkinDisagreement > 70 ? 0.5 : maxSkinDisagreement > 40 ? 0.8 : 1
  if (skinScore < 1) {
    notes.push('Lighting looked uneven across the face, which can affect accuracy.')
  }
  score += skinScore
  factorCount += 1

  const eyeScore = inputs.eyeSampleUsable ? 1 : 0.5
  if (!inputs.eyeSampleUsable) {
    notes.push('Eye colour was hard to read clearly in this photo, so it may be less accurate.')
  }
  score += eyeScore
  factorCount += 1

  // How clear-cut the season match itself was — kept from the original
  // logic as one input among several, rather than the only one.
  score += seasonTopScore / 4
  factorCount += 1

  const confidence = Math.min(0.95, Math.max(0.45, score / factorCount))
  return { confidence: Number(confidence.toFixed(2)), notes }
}

// --- Sampling pipelines --------------------------------------------------

interface PipelineResult {
  skinRgb: RGB
  hairRgb: RGB
  eyeRgb: RGB
  confidenceInputs: ConfidenceInputs
}

function runFallbackSampling(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
): PipelineResult {
  const skinRgb = averageColorInRegion(context, imgWidth, imgHeight, REGIONS.skin)
  const hairRgb = averageColorInRegion(context, imgWidth, imgHeight, REGIONS.hair)
  const eyeRgb = averageColorInRegion(context, imgWidth, imgHeight, REGIONS.eyes)

  return {
    skinRgb,
    hairRgb,
    eyeRgb,
    confidenceInputs: {
      method: 'fallback',
      faceAreaRatio: null,
      hairPixelCount: 0,
      hairAreaPixelCount: 0,
      hairUsedMaskSampling: false,
      skinRegionDistances: [],
      eyeSampleUsable: false,
    },
  }
}

// A smaller, centred slice of the broader hair search area — used when the
// segmentation model itself isn't available or found no hair pixels at all.
// Still anchored to the detected face, so it's a meaningfully better guess
// than the old whole-image-relative rectangle, even without a mask.
function narrowedHairFallbackRect(area: NormalizedRect): NormalizedRect {
  const width = area.xEnd - area.xStart
  const height = area.yEnd - area.yStart
  return {
    xStart: area.xStart + width * 0.3,
    xEnd: area.xStart + width * 0.7,
    yStart: area.yStart + height * 0.15,
    yEnd: area.yStart + height * 0.5,
  }
}

async function tryComputerVisionAnalysis(
  image: HTMLImageElement,
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
): Promise<PipelineResult | null> {
  // Face detection and hair segmentation are independent models — kick both
  // off at once rather than waiting for one before starting the other.
  const regionsPromise = withTimeout(detectFaceRegions(image), 12000, 'Face detection').catch(() => null)
  const hairMaskPromise = withTimeout(detectHairMask(image), 12000, 'Hair segmentation').catch(() => null)

  const regions = await regionsPromise
  if (!regions) return null

  // --- Skin: three sub-samples, combined ---
  const foreheadSample = sampleRegion(context, imgWidth, imgHeight, regions.forehead)
  const leftCheekSample = sampleRegion(context, imgWidth, imgHeight, regions.leftCheek)
  const rightCheekSample = sampleRegion(context, imgWidth, imgHeight, regions.rightCheek)

  const skinColors = [foreheadSample.color, leftCheekSample.color, rightCheekSample.color].filter(
    (color): color is RGB => color !== null,
  )
  if (skinColors.length === 0) return null // nothing usable — caller falls all the way back

  const skinRgb: RGB = {
    r: skinColors.reduce((sum, c) => sum + c.r, 0) / skinColors.length,
    g: skinColors.reduce((sum, c) => sum + c.g, 0) / skinColors.length,
    b: skinColors.reduce((sum, c) => sum + c.b, 0) / skinColors.length,
  }

  const skinRegionDistances: number[] = []
  for (let i = 0; i < skinColors.length; i++) {
    for (let j = i + 1; j < skinColors.length; j++) {
      skinRegionDistances.push(colorDistance(skinColors[i], skinColors[j]))
    }
  }

  // --- Eyes: iris ring samples (excludes the pupil at the centre and any
  //     highlights), discarding anything that still looks too bright overall ---
  const leftEyeSample = sampleIrisRing(context, imgWidth, imgHeight, regions.leftIris)
  const rightEyeSample = sampleIrisRing(context, imgWidth, imgHeight, regions.rightIris)
  const GLARE_LUMINANCE_THRESHOLD = 205
  const usableEyeColors = [leftEyeSample.color, rightEyeSample.color].filter(
    (color): color is RGB => color !== null && getLuminance(color) < GLARE_LUMINANCE_THRESHOLD,
  )
  const eyeSampleUsable = usableEyeColors.length > 0
  const eyeRgb: RGB = eyeSampleUsable
    ? {
        r: usableEyeColors.reduce((sum, c) => sum + c.r, 0) / usableEyeColors.length,
        g: usableEyeColors.reduce((sum, c) => sum + c.g, 0) / usableEyeColors.length,
        b: usableEyeColors.reduce((sum, c) => sum + c.b, 0) / usableEyeColors.length,
      }
    : (leftEyeSample.color ?? rightEyeSample.color ?? { r: 120, g: 100, b: 90 })

  // --- Hair: sample only pixels the segmentation model identifies as hair ---
  const hairMask = await hairMaskPromise

  let hairRgb: RGB
  let hairPixelCount = 0
  let hairAreaPixelCount = 0
  let hairUsedMaskSampling = false

  if (hairMask) {
    const hairSample = sampleMaskedRegion(context, imgWidth, imgHeight, regions.hairSearchArea, hairMask)
    hairPixelCount = hairSample.pixelCount
    hairAreaPixelCount = hairSample.areaPixelCount
    if (hairSample.color) {
      hairRgb = hairSample.color
      hairUsedMaskSampling = true
    } else {
      const fallbackSample = sampleRegion(context, imgWidth, imgHeight, narrowedHairFallbackRect(regions.hairSearchArea))
      hairRgb = fallbackSample.color ?? { r: 60, g: 50, b: 45 }
    }
  } else {
    const fallbackSample = sampleRegion(context, imgWidth, imgHeight, narrowedHairFallbackRect(regions.hairSearchArea))
    hairRgb = fallbackSample.color ?? { r: 60, g: 50, b: 45 }
    hairAreaPixelCount = fallbackSample.pixelCount
  }

  return {
    skinRgb,
    hairRgb,
    eyeRgb,
    confidenceInputs: {
      method: 'vision',
      faceAreaRatio: regions.faceAreaRatio,
      hairPixelCount,
      hairAreaPixelCount,
      hairUsedMaskSampling,
      skinRegionDistances,
      eyeSampleUsable,
    },
  }
}

// --- Public entry point ------------------------------------------------------

export async function analyzeImage(imageDataUrl: string): Promise<ColorProfile> {
  const image = await loadImage(imageDataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Canvas is not supported in this browser.')
  }
  context.drawImage(image, 0, 0)

  let pipelineResult: PipelineResult
  try {
    pipelineResult =
      (await tryComputerVisionAnalysis(image, context, canvas.width, canvas.height)) ??
      runFallbackSampling(context, canvas.width, canvas.height)
  } catch {
    // Any unexpected failure anywhere in the computer-vision pipeline falls
    // back to the original, dependency-free sampling rather than crashing.
    pipelineResult = runFallbackSampling(context, canvas.width, canvas.height)
  }

  const { skinRgb, hairRgb, eyeRgb, confidenceInputs } = pipelineResult

  const skinLuminance = getLuminance(skinRgb)
  const hairLuminance = getLuminance(hairRgb)

  const undertone = classifyTemperature(skinRgb)
  const depth = classifyDepth(skinLuminance)
  const contrast = classifyContrastFromDifference(skinLuminance - hairLuminance)

  const hairMatch = nearestNamedColor(hairRgb, HAIR_REFERENCE_COLORS)
  const eyeMatch = nearestNamedColor(eyeRgb, EYE_REFERENCE_COLORS)

  const { season, secondarySeason, label, topScore } = determineSeason(undertone, depth, contrast)
  const { confidence, notes: analysisNotes } = computeConfidence(confidenceInputs, topScore)

  return {
    undertone,
    depth,
    contrast,
    hairColor: hairMatch.name,
    hairColorHex: rgbToHex(hairRgb),
    eyeColor: eyeMatch.name,
    eyeColorHex: rgbToHex(eyeRgb),
    season,
    secondarySeason,
    seasonLabel: label,
    seasonReasoning: buildReasoning(undertone, depth, contrast, label, secondarySeason),
    confidence,
    analysisNotes,
  }
}
