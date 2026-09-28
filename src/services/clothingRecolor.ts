// Recolours the clothing region of a captured photo while preserving its
// original shading, folds, texture, and edges — done with plain colour
// math: the garment's shadow, midtone, and highlight percentiles are
// measured once, then each pixel's tone is mapped around the SELECTED
// colour. This preserves folds and texture without letting one extreme
// pixel flatten or clip the rest of the fabric. Not generative: no new
// garment is created, every pixel's shading pattern is kept.
//
// Reuses the app's EXISTING segmentation model (vision/hairSegmentation.ts
// already exposes a "clothes" category from the same multiclass segmenter
// used for hair) rather than adding a second detection system, and the
// existing hex/RGB/HSL colour math in colorUtils.ts.

import { detectHairMask, isClothesAtRelativePosition, type HairMask } from './vision/hairSegmentation'
import { clamp, hexToRgb, hslToRgb, rgbToHsl, type RGB } from './colorUtils'

export interface ClothingRecolorSession {
  imageWidth: number
  imageHeight: number
  originalImageData: ImageData
  // 0-255 per pixel: how strongly this pixel belongs to the clothing
  // region, already softened at the edges — see buildFeatheredAlphaMask.
  featheredAlpha: Uint8ClampedArray
  // Robust tonal landmarks from the original garment. Percentiles are used
  // instead of a plain average so a bright logo or deep fold cannot shift
  // the whole recolour and make the fabric look flat or posterized.
  shadowLightness: number
  referenceLightness: number
  highlightLightness: number
  hasClothing: boolean
}

interface ClothingMaskResult {
  alpha: Uint8ClampedArray
  shadowLightness: number
  referenceLightness: number
  highlightLightness: number
  hasClothing: boolean
}

function percentileFromHistogram(histogram: Uint32Array, pixelCount: number, percentile: number): number {
  const targetCount = Math.max(1, Math.ceil(pixelCount * percentile))
  let seen = 0

  for (let lightness = 0; lightness < histogram.length; lightness++) {
    seen += histogram[lightness]
    if (seen >= targetCount) return lightness
  }

  return 50
}

// Recolouring pale fabric in gamma-encoded sRGB tends to look chalky and
// digitally painted. These helpers let the light-colour path apply the
// garment's lighting in linear light, which behaves much more like real
// material reflectance.
function srgbChannelToLinear(channel: number): number {
  const normalized = clamp(channel / 255, 0, 1)
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
}

function linearChannelToSrgb(channel: number): number {
  const normalized = clamp(channel, 0, 1)
  const encoded = normalized <= 0.0031308 ? normalized * 12.92 : 1.055 * normalized ** (1 / 2.4) - 0.055
  return encoded * 255
}

function smoothstep(min: number, max: number, value: number): number {
  const position = clamp((value - min) / (max - min), 0, 1)
  return position * position * (3 - 2 * position)
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load the photo.'))
    image.src = dataUrl
  })
}

// Builds a smooth alpha mask marking the clothing region at the photo's
// full resolution, plus robust shadow/midtone/highlight landmarks used by
// applyClothingColor. The raw per-pixel mask is blocky because it comes from
// a lower-resolution model output, so a small blur and a contrast curve
// produce a narrow, natural edge without the old-colour halo.
function buildFeatheredAlphaMask(
  mask: HairMask,
  originalImageData: ImageData,
  width: number,
  height: number,
): ClothingMaskResult {
  const empty: ClothingMaskResult = {
    alpha: new Uint8ClampedArray(width * height),
    shadowLightness: 25,
    referenceLightness: 50,
    highlightLightness: 75,
    hasClothing: false,
  }

  const rawCanvas = document.createElement('canvas')
  rawCanvas.width = width
  rawCanvas.height = height
  const rawContext = rawCanvas.getContext('2d')
  if (!rawContext) return empty

  const source = originalImageData.data
  const rawImageData = rawContext.createImageData(width, height)
  const lightnessHistogram = new Uint32Array(101)
  let clothingPixelCount = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isClothes = isClothesAtRelativePosition(mask, x / width, y / height)
      const index = (y * width + x) * 4
      const value = isClothes ? 255 : 0
      if (isClothes) {
        clothingPixelCount += 1
        const lightness = rgbToHsl({ r: source[index], g: source[index + 1], b: source[index + 2] }).l
        lightnessHistogram[Math.round(lightness)] += 1
      }
      rawImageData.data[index] = value
      rawImageData.data[index + 1] = value
      rawImageData.data[index + 2] = value
      rawImageData.data[index + 3] = value
    }
  }
  rawContext.putImageData(rawImageData, 0, 0)

  // A handful of stray misclassified pixels shouldn't count as "found
  // clothing" — require at least a modest, deliberate area.
  const hasClothing = clothingPixelCount > width * height * 0.01
  if (!hasClothing) return empty

  const shadowLightness = percentileFromHistogram(lightnessHistogram, clothingPixelCount, 0.1)
  const referenceLightness = percentileFromHistogram(lightnessHistogram, clothingPixelCount, 0.5)
  const highlightLightness = percentileFromHistogram(lightnessHistogram, clothingPixelCount, 0.9)

  const blurredCanvas = document.createElement('canvas')
  blurredCanvas.width = width
  blurredCanvas.height = height
  const blurredContext = blurredCanvas.getContext('2d')
  if (!blurredContext) {
    return { ...empty, shadowLightness, referenceLightness, highlightLightness }
  }

  // Keep this narrow. The previous 1%-of-image blur created a wide zone of
  // mixed original/target colour, which read as an outline around the shirt.
  const featherRadius = Math.max(2, Math.round(Math.min(width, height) * 0.004))
  blurredContext.filter = `blur(${featherRadius}px)`
  blurredContext.drawImage(rawCanvas, 0, 0)
  blurredContext.filter = 'none'

  const blurredData = blurredContext.getImageData(0, 0, width, height).data
  const alpha = new Uint8ClampedArray(width * height)
  for (let i = 0; i < alpha.length; i++) {
    // Read the actual blurred transparency channel. Reading the red channel
    // here is unreliable because canvas stores blurred colours premultiplied
    // by alpha and un-premultiplies them again when pixels are read back.
    const blurredAlpha = blurredData[i * 4 + 3] / 255

    // Raise the centre of the model boundary (normally about 0.5) close to
    // opaque so the original garment colour cannot form a rim. Unlike the
    // previous raw-mask cutoff, this remains continuous on both sides and
    // therefore does not create a dark, sticker-like contour.
    const edgePosition = clamp((blurredAlpha - 0.06) / 0.5, 0, 1)
    const smoothAlpha = edgePosition * edgePosition * (3 - 2 * edgePosition)
    alpha[i] = Math.round(smoothAlpha * 255)
  }

  return { alpha, shadowLightness, referenceLightness, highlightLightness, hasClothing: true }
}

// One-time setup for a given photo: loads it, runs the existing
// segmentation model once, and precomputes the feathered clothing mask.
// The returned session is then reused for every colour the person tries,
// so switching colours doesn't repeat the expensive part.
export async function prepareClothingRecolorSession(imageDataUrl: string): Promise<ClothingRecolorSession | null> {
  const image = await loadImage(imageDataUrl)

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  context.drawImage(image, 0, 0)

  const mask = await detectHairMask(image)
  if (!mask) return null

  const originalImageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const { alpha, shadowLightness, referenceLightness, highlightLightness, hasClothing } = buildFeatheredAlphaMask(
    mask,
    originalImageData,
    canvas.width,
    canvas.height,
  )

  return {
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    originalImageData,
    featheredAlpha: alpha,
    shadowLightness,
    referenceLightness,
    highlightLightness,
    hasClothing,
  }
}

// Applies a target colour while mapping the garment's original tonal range
// around it. A robust percentile curve keeps real folds and texture visible,
// avoids clipping an entire light or dark garment, and reserves a little
// headroom even for pure black/white selections so they still look like
// fabric rather than a flat digital fill.
export function applyClothingColor(session: ClothingRecolorSession, hex: string): string | null {
  const targetRgb = hexToRgb(hex)
  const targetHsl = rgbToHsl(targetRgb)
  const {
    originalImageData,
    featheredAlpha,
    shadowLightness,
    referenceLightness,
    highlightLightness,
    imageWidth,
    imageHeight,
  } = session
  const source = originalImageData.data

  // Real black and white cloth still reflect light. Keeping a small amount
  // of headroom at both ends lets the original fold pattern remain visible.
  const baseLightness = clamp(targetHsl.l, 6, 94)
  const shadowRange = clamp(10 + baseLightness * 0.18, 10, 24)
  const highlightRange = clamp(10 + (100 - baseLightness) * 0.18, 10, 24)
  const shadowSpan = Math.max(6, referenceLightness - shadowLightness)
  const highlightSpan = Math.max(6, highlightLightness - referenceLightness)

  // Dark colours retain texture best with the percentile/HSL mapping below.
  // Pale colours are different: treating them the same way makes highlights
  // clip and gives the garment a flat, chalky coating. Fade to a physically
  // motivated linear-light multiplication between lightness 62 and 80.
  const lightFabricWeight = smoothstep(62, 80, targetHsl.l)
  const targetLinear = {
    r: srgbChannelToLinear(targetRgb.r),
    g: srgbChannelToLinear(targetRgb.g),
    b: srgbChannelToLinear(targetRgb.b),
  }

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = imageWidth
  outputCanvas.height = imageHeight
  const outputContext = outputCanvas.getContext('2d')
  if (!outputContext) return null

  const outputImageData = outputContext.createImageData(imageWidth, imageHeight)
  const output = outputImageData.data

  for (let i = 0; i < featheredAlpha.length; i++) {
    const pixelAlpha = featheredAlpha[i] / 255
    const dataIndex = i * 4

    if (pixelAlpha <= 0.01) {
      // Not clothing — pass the original pixel through untouched.
      output[dataIndex] = source[dataIndex]
      output[dataIndex + 1] = source[dataIndex + 1]
      output[dataIndex + 2] = source[dataIndex + 2]
      output[dataIndex + 3] = source[dataIndex + 3]
      continue
    }

    const originalRgb: RGB = { r: source[dataIndex], g: source[dataIndex + 1], b: source[dataIndex + 2] }
    const originalLightness = rgbToHsl(originalRgb).l

    const tonalPosition =
      originalLightness < referenceLightness
        ? (originalLightness - referenceLightness) / shadowSpan
        : (originalLightness - referenceLightness) / highlightSpan
    const naturalTone = Math.tanh(tonalPosition * 0.9)
    const lightnessRange = naturalTone < 0 ? shadowRange : highlightRange
    const recoloredLightness = clamp(baseLightness + naturalTone * lightnessRange, 0, 100)

    // Slightly soften chroma at the deepest folds and brightest highlights,
    // as real dyed fabric does, while keeping the selected colour exact in
    // the garment's midtones.
    const recoloredSaturation = targetHsl.s * (1 - Math.min(1, Math.abs(naturalTone)) * 0.12)
    const darkFabricRgb = hslToRgb({ h: targetHsl.h, s: recoloredSaturation, l: recoloredLightness })

    // Use the original garment tone as a bounded lighting multiplier. This
    // keeps a pale colour's own channel balance while the existing folds and
    // shadows modulate it naturally. Asymmetric strength prevents highlights
    // from blowing out while still giving shadows enough depth.
    const lightingMultiplier = Math.exp(naturalTone * (naturalTone < 0 ? 0.48 : 0.27))
    const lightFabricRgb: RGB = {
      r: linearChannelToSrgb(targetLinear.r * lightingMultiplier),
      g: linearChannelToSrgb(targetLinear.g * lightingMultiplier),
      b: linearChannelToSrgb(targetLinear.b * lightingMultiplier),
    }

    const recoloredRgb: RGB = {
      r: darkFabricRgb.r + (lightFabricRgb.r - darkFabricRgb.r) * lightFabricWeight,
      g: darkFabricRgb.g + (lightFabricRgb.g - darkFabricRgb.g) * lightFabricWeight,
      b: darkFabricRgb.b + (lightFabricRgb.b - darkFabricRgb.b) * lightFabricWeight,
    }

    output[dataIndex] = originalRgb.r + (recoloredRgb.r - originalRgb.r) * pixelAlpha
    output[dataIndex + 1] = originalRgb.g + (recoloredRgb.g - originalRgb.g) * pixelAlpha
    output[dataIndex + 2] = originalRgb.b + (recoloredRgb.b - originalRgb.b) * pixelAlpha
    output[dataIndex + 3] = source[dataIndex + 3]
  }

  outputContext.putImageData(outputImageData, 0, 0)
  return outputCanvas.toDataURL('image/jpeg', 0.92)
}
