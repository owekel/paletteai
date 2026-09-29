// Browser-only feature sampling followed by the continuous 12-season analysis.
// The shadow-named diagnostic fields remain stable for developer comparisons.
import type { ColorProfile } from '../types/colorProfile'
import {
  type RGB,
  getLuminance,
  nearestNamedColor,
  rgbToHex,
} from './colorUtils'
import { detectFaceRegions, type NormalizedRect } from './vision/faceDetection'
import { detectHairMask } from './vision/hairSegmentation'
import {
  sampleRegion,
  sampleMaskedRegion,
  sampleIrisRing,
  sampleSkinPolygon,
  type RegionSample,
} from './vision/colourSampling'
import { withTimeout } from './vision/loadVisionModels'
import { sampleLightingReferences } from './vision/illuminationSampling'
import {
  calculateShadowSeasonMeasurements,
  type FeaturePixelDistribution,
  type SeasonMeasurementInput,
} from './seasonMeasurements'
import { classifyShadowSeason } from './shadowSeasonClassifier'
import { buildSeasonAnalysis } from './seasonAnalysis'

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
): RegionSample {
  const x = Math.round(region.xStart * width)
  const y = Math.round(region.yStart * height)
  const regionWidth = Math.max(1, Math.round((region.xEnd - region.xStart) * width))
  const regionHeight = Math.max(1, Math.round((region.yEnd - region.yStart) * height))

  const { data } = context.getImageData(x, y, regionWidth, regionHeight)

  let r = 0
  let g = 0
  let b = 0
  let pixelCount = 0
  const pixels: RGB[] = []
  const maxRetainedPixels = 12000
  const retentionStride = Math.max(1, Math.ceil(data.length / 4 / maxRetainedPixels))
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
    if (pixelCount % retentionStride === 0) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    }
    pixelCount += 1
  }

  return {
    color: { r: r / pixelCount, g: g / pixelCount, b: b / pixelCount },
    pixelCount,
    pixels,
  }
}

function combinePixelDistributions(samples: RegionSample[], maximumRetained = 24000): FeaturePixelDistribution {
  const allPixels = samples.flatMap((sample) => sample.pixels)
  const stride = Math.max(1, Math.ceil(allPixels.length / maximumRetained))
  return {
    pixels: allPixels.filter((_, index) => index % stride === 0).slice(0, maximumRetained),
    totalPixelCount: samples.reduce((sum, sample) => sum + sample.pixelCount, 0),
  }
}

function toPixelDistribution(sample: RegionSample): FeaturePixelDistribution {
  return { pixels: sample.pixels, totalPixelCount: sample.pixelCount }
}

// --- Sampling pipelines --------------------------------------------------

interface PipelineResult {
  hairRgb: RGB
  eyeRgb: RGB
  measurementInput: SeasonMeasurementInput
}

function runFallbackSampling(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
): PipelineResult {
  const skinSample = averageColorInRegion(context, imgWidth, imgHeight, REGIONS.skin)
  const hairSample = averageColorInRegion(context, imgWidth, imgHeight, REGIONS.hair)
  const eyeSample = averageColorInRegion(context, imgWidth, imgHeight, REGIONS.eyes)
  const skinRgb = skinSample.color
  const hairRgb = hairSample.color
  const eyeRgb = eyeSample.color
  if (!skinRgb || !hairRgb || !eyeRgb) {
    throw new Error('Fallback sampling returned an empty region.')
  }

  return {
    hairRgb,
    eyeRgb,
    measurementInput: {
      method: 'fallback',
      faceAreaRatio: null,
      skin: toPixelDistribution(skinSample),
      hair: toPixelDistribution(hairSample),
      eyes: toPixelDistribution(eyeSample),
      skinRegions: [{ name: 'fallback', usedLandmarkPolygon: false, ...toPixelDistribution(skinSample) }],
      eyeRegions: [toPixelDistribution(eyeSample)],
      hairUsedMaskSampling: false,
      hairMaskCoverageRatio: null,
      eyeSampleUsable: false,
      lightingReferences: {
        backgroundPixels: [],
        backgroundTiles: [[], [], [], []],
        scleraPixels: [],
        scleraRegions: [[], []],
      },
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


  // --- Eyes: iris ring samples (excludes the pupil at the centre and any
  //     highlights), discarding anything that still looks too bright overall ---
  const leftEyeSample = sampleIrisRing(context, imgWidth, imgHeight, regions.leftIris)
  const rightEyeSample = sampleIrisRing(context, imgWidth, imgHeight, regions.rightIris)
  const GLARE_LUMINANCE_THRESHOLD = 205
  const allEyeSamples = [leftEyeSample, rightEyeSample]
  const usableEyeSamples = allEyeSamples.filter(
    (sample) => sample.color !== null && getLuminance(sample.color) < GLARE_LUMINANCE_THRESHOLD,
  )
  const usableEyeColors = usableEyeSamples.map((sample) => sample.color as RGB)
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
  let selectedHairSample: RegionSample

  if (hairMask) {
    const hairSample = sampleMaskedRegion(context, imgWidth, imgHeight, regions.hairSearchArea, hairMask)
    hairPixelCount = hairSample.pixelCount
    hairAreaPixelCount = hairSample.areaPixelCount
    if (hairSample.color) {
      hairRgb = hairSample.color
      hairUsedMaskSampling = true
      selectedHairSample = hairSample
    } else {
      const fallbackSample = sampleRegion(context, imgWidth, imgHeight, narrowedHairFallbackRect(regions.hairSearchArea))
      hairRgb = fallbackSample.color ?? { r: 60, g: 50, b: 45 }
      selectedHairSample = fallbackSample
    }
  } else {
    const fallbackSample = sampleRegion(context, imgWidth, imgHeight, narrowedHairFallbackRect(regions.hairSearchArea))
    hairRgb = fallbackSample.color ?? { r: 60, g: 50, b: 45 }
    hairAreaPixelCount = fallbackSample.pixelCount
    selectedHairSample = fallbackSample
  }

  const lightingReferences = sampleLightingReferences(
    context,
    imgWidth,
    imgHeight,
    hairMask,
    regions,
  )

  const legacySkinSamples = [foreheadSample, leftCheekSample, rightCheekSample]
  const landmarkSkinSamples = regions.skinSamplingRegions.map((region, index) => {
    const polygonSample = sampleSkinPolygon(context, imgWidth, imgHeight, region, hairMask)
    const usedLandmarkPolygon = polygonSample.pixelCount >= 40
    const selectedSample = usedLandmarkPolygon ? polygonSample : legacySkinSamples[index]
    return {
      name: region.name,
      usedLandmarkPolygon,
      sample: selectedSample,
    }
  })
  const hairMaskCoverageRatio = hairAreaPixelCount > 0
    ? hairPixelCount / hairAreaPixelCount
    : null

  return {
    hairRgb,
    eyeRgb,
    measurementInput: {
      method: 'vision',
      faceAreaRatio: regions.faceAreaRatio,
      skin: combinePixelDistributions(landmarkSkinSamples.map((region) => region.sample)),
      hair: toPixelDistribution(selectedHairSample),
      eyes: combinePixelDistributions(eyeSampleUsable ? usableEyeSamples : allEyeSamples),
      skinRegions: landmarkSkinSamples.map((region) => ({
        name: region.name,
        usedLandmarkPolygon: region.usedLandmarkPolygon,
        ...toPixelDistribution(region.sample),
      })),
      eyeRegions: (eyeSampleUsable ? usableEyeSamples : allEyeSamples).map(toPixelDistribution),
      hairUsedMaskSampling,
      hairMaskCoverageRatio,
      eyeSampleUsable,
      lightingReferences,
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

  const { hairRgb, eyeRgb, measurementInput } = pipelineResult
  const hairMatch = nearestNamedColor(hairRgb, HAIR_REFERENCE_COLORS)
  const eyeMatch = nearestNamedColor(eyeRgb, EYE_REFERENCE_COLORS)
  const shadowMeasurements = calculateShadowSeasonMeasurements(measurementInput)
  const shadowSeasonClassification = classifyShadowSeason(shadowMeasurements)

  return {
    hairColor: hairMatch.name,
    hairColorHex: rgbToHex(hairRgb),
    eyeColor: eyeMatch.name,
    eyeColorHex: rgbToHex(eyeRgb),
    shadowMeasurements,
    shadowSeasonClassification,
    analysis: buildSeasonAnalysis(shadowMeasurements, shadowSeasonClassification),
  }
}
