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
import { garmentTrimap, refineGarmentEdge, replaceEdgeGarment, type ClothingBoundaryDiagnostics } from './clothingEdgeMatte'

export interface ClothingRecolorSession {
  imageWidth: number
  imageHeight: number
  originalImageData: ImageData
  // 0-255 per pixel: how strongly this pixel belongs to the clothing
  // region, already softened at the edges — see buildFeatheredAlphaMask.
  featheredAlpha: Uint8ClampedArray
  // RGBA-sized companion buffer used only for colour-matted boundary pixels.
  // RGB stores the estimated skin/background colour and A marks a valid
  // estimate, allowing applyClothingColor to replace the garment component
  // of a mixed edge pixel without tinting its background component.
  edgeBackground: Uint8ClampedArray
  // Narrow-band foreground colour + blend-space tag. Optional for older
  // prepared sessions; the interior fabric transform remains identical.
  edgeForeground?: Uint8ClampedArray
  boundaryDiagnostics?: ClothingBoundaryDiagnostics
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
  edgeBackground: Uint8ClampedArray
  edgeForeground?: Uint8ClampedArray
  boundaryDiagnostics?: ClothingBoundaryDiagnostics
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
// full resolution, plus the UNCHANGED fabric tonal landmarks. The semantic
// edge is only a coarse location prior; the boundary trimap resolves actual
// coverage from the photo. Blur is retained for reference/fallback confidence,
// not used as coverage for successfully colour-matted boundary pixels.
export function buildFeatheredAlphaMask(
  mask: HairMask,
  originalImageData: ImageData,
  width: number,
  height: number,
  refineBoundary = true,
  debugBoundary: boolean | number[] = false,
): ClothingMaskResult {
  const empty: ClothingMaskResult = {
    alpha: new Uint8ClampedArray(width * height),
    edgeBackground: new Uint8ClampedArray(width * height * 4),
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

  // Blur identifies only a narrow uncertainty band around the semantic edge.
  // Pixels in that band are resolved from their source colours below rather
  // than expanding the mask or trusting the blur as garment coverage.
  const featherRadius = Math.max(2, Math.round(Math.min(width, height) * 0.004))
  blurredContext.filter = `blur(${featherRadius}px)`
  blurredContext.drawImage(rawCanvas, 0, 0)
  blurredContext.filter = 'none'

  const blurredData = blurredContext.getImageData(0, 0, width, height).data
  const alpha = new Uint8ClampedArray(width * height)
  const edgeBackground = new Uint8ClampedArray(width * height * 4)
  const matteRadius = Math.max(3, featherRadius + 2)

  function estimateEdgeMatte(pixelIndex: number): { coverage: number; background: RGB } | null {
    const centerX = pixelIndex % width
    const centerY = Math.floor(pixelIndex / width)
    let garmentR = 0
    let garmentG = 0
    let garmentB = 0
    let garmentCount = 0
    let backgroundR = 0
    let backgroundG = 0
    let backgroundB = 0
    let backgroundCount = 0

    for (let y = Math.max(0, centerY - matteRadius); y <= Math.min(height - 1, centerY + matteRadius); y++) {
      for (let x = Math.max(0, centerX - matteRadius); x <= Math.min(width - 1, centerX + matteRadius); x++) {
        const neighbour = y * width + x
        const neighbourDataIndex = neighbour * 4
        const neighbourBlur = blurredData[neighbourDataIndex + 3] / 255
        const neighbourIsGarment = rawImageData.data[neighbourDataIndex + 3] > 0

        // Sample beyond the uncertain band on either side. This produces a
        // local foreground/background colour pair for the collar pixel rather
        // than relying on one global shirt or skin colour.
        if (neighbourIsGarment && neighbourBlur >= 0.9) {
          garmentR += source[neighbourDataIndex]
          garmentG += source[neighbourDataIndex + 1]
          garmentB += source[neighbourDataIndex + 2]
          garmentCount += 1
        } else if (!neighbourIsGarment && neighbourBlur <= 0.1) {
          backgroundR += source[neighbourDataIndex]
          backgroundG += source[neighbourDataIndex + 1]
          backgroundB += source[neighbourDataIndex + 2]
          backgroundCount += 1
        }
      }
    }

    if (garmentCount === 0 || backgroundCount === 0) return null

    const garment = {
      r: garmentR / garmentCount,
      g: garmentG / garmentCount,
      b: garmentB / garmentCount,
    }
    const background = {
      r: backgroundR / backgroundCount,
      g: backgroundG / backgroundCount,
      b: backgroundB / backgroundCount,
    }
    const direction = {
      r: garment.r - background.r,
      g: garment.g - background.g,
      b: garment.b - background.b,
    }
    const denominator = direction.r ** 2 + direction.g ** 2 + direction.b ** 2

    // When garment and background are nearly identical there is no visible
    // colour halo to correct, and the matte estimate would be unstable.
    if (denominator < 25 ** 2) return null

    const dataIndex = pixelIndex * 4
    const relative = {
      r: source[dataIndex] - background.r,
      g: source[dataIndex + 1] - background.g,
      b: source[dataIndex + 2] - background.b,
    }
    const coverage = clamp(
      (relative.r * direction.r + relative.g * direction.g + relative.b * direction.b) / denominator,
      0,
      1,
    )

    // Reject colours that do not plausibly lie on the local garment/background
    // mixture line (for example hair or an unrelated object crossing the edge).
    const reconstructed = {
      r: background.r + direction.r * coverage,
      g: background.g + direction.g * coverage,
      b: background.b + direction.b * coverage,
    }
    const residual = Math.sqrt(
      (source[dataIndex] - reconstructed.r) ** 2 +
        (source[dataIndex + 1] - reconstructed.g) ** 2 +
        (source[dataIndex + 2] - reconstructed.b) ** 2,
    )
    if (residual > 32) return null

    return { coverage, background }
  }

  for (let i = 0; i < alpha.length; i++) {
    // The previous mask eroded one full model pixel at every edge (and two
    // beside skin). At photo resolution that removed several genuine garment
    // pixels, leaving an original-colour collar rim. Start from the model's
    // un-eroded clothing side; the matte below may recover only source pixels
    // that contain measurable local garment colour.
    const isGarmentSide = rawImageData.data[i * 4 + 3] > 0

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

    // Only the narrow uncertainty band gets colour-guided matting. It can
    // recover a garment-coloured pixel just outside the semantic boundary,
    // while a true skin/background pixel estimates near-zero garment coverage.
    // The old square-average matte is kept ONLY as the developer comparison
    // baseline. Production uses a single signed-trimap colour matte below;
    // do not stack two conflicting foreground/background estimators.
    const edgeMatte = !refineBoundary && blurredAlpha > 0.02 && blurredAlpha < 0.98 ? estimateEdgeMatte(i) : null
    if (edgeMatte) {
      if (edgeMatte.coverage > 0.04) {
        alpha[i] = Math.round(edgeMatte.coverage * 255)
        const backgroundIndex = i * 4
        edgeBackground[backgroundIndex] = Math.round(edgeMatte.background.r)
        edgeBackground[backgroundIndex + 1] = Math.round(edgeMatte.background.g)
        edgeBackground[backgroundIndex + 2] = Math.round(edgeMatte.background.b)
        edgeBackground[backgroundIndex + 3] = 255
      } else {
        // The source colour matches the local skin/background end of the
        // colour line, so keep it untouched even if the coarse model label
        // happens to put this pixel on the clothing side.
        alpha[i] = 0
      }
    } else {
      alpha[i] = isGarmentSide ? Math.round(smoothAlpha * 255) : 0
    }
  }

  // The unrefined path is exposed only for the developer regression preview.
  // Normal session preparation always uses the boundary repair.
  // MediaPipe returns an image-sized category plane, but this model infers on
  // a 256x256 grid. Two inference cells + a three-pixel anti-alias footprint
  // bound the boundary search (including JPEG chroma interpolation).
  // This is ONLY a colour-matting search trimap, never a
  // coverage expansion. The confidently masked interior stays byte-identical.
  const modelCell = Math.max(width / Math.min(mask.width, 256), height / Math.min(mask.height, 256))
  const bandRadius = Math.max(3, Math.ceil(2 * modelCell) + 3)
  const boundary = refineBoundary ? garmentTrimap(rawImageData.data, width, height, bandRadius) : undefined
  if (boundary && Array.isArray(debugBoundary)) boundary.references = Object.fromEntries(debugBoundary.map(i => [i, {}]))
  const edgeForeground = refineBoundary
    ? refineGarmentEdge(source, rawImageData.data, blurredData, alpha, edgeBackground, width, height, featherRadius, { bandRadius, diagnostics: boundary }) : undefined
  return { alpha, edgeBackground, edgeForeground, boundaryDiagnostics: debugBoundary ? boundary : undefined,
    shadowLightness, referenceLightness, highlightLightness, hasClothing: true }
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
  const { alpha, edgeBackground, edgeForeground, shadowLightness, referenceLightness, highlightLightness, hasClothing } =
    buildFeatheredAlphaMask(mask, originalImageData, canvas.width, canvas.height)

  return {
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    originalImageData,
    featheredAlpha: alpha,
    edgeBackground,
    edgeForeground,
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
    edgeBackground,
    edgeForeground,
    shadowLightness,
    referenceLightness,
    highlightLightness,
    imageWidth,
    imageHeight,
  } = session
  const source = originalImageData.data

  // Real black and white cloth still reflect light. Keep enough headroom for
  // both shadows and highlights even when the requested swatch is an extreme.
  const baseLightness = clamp(targetHsl.l, 8, 92)
  const shadowSpan = Math.max(6, referenceLightness - shadowLightness)
  const highlightSpan = Math.max(6, highlightLightness - referenceLightness)

  // Similar-depth colours (for example muted purple -> navy) should keep the
  // source garment's lightness differences almost one-for-one. Only blend
  // toward controlled ranges when the requested target is far from the
  // source or very close to black/white.
  const distanceRemap = smoothstep(14, 50, Math.abs(baseLightness - referenceLightness))
  const darkExtremeRemap = 1 - smoothstep(8, 24, baseLightness)
  const lightExtremeRemap = smoothstep(76, 92, baseLightness)
  const remapStrength = Math.max(distanceRemap, darkExtremeRemap, lightExtremeRemap)

  const controlledShadowRange = Math.min(
    clamp(8 + baseLightness * 0.16, 8, 22),
    Math.max(4, baseLightness - 3),
  )
  const controlledHighlightRange = Math.min(
    clamp(8 + (100 - baseLightness) * 0.16, 8, 22),
    Math.max(4, 98 - baseLightness),
  )
  const shadowRange = shadowSpan + (controlledShadowRange - shadowSpan) * remapStrength
  const highlightRange = highlightSpan + (controlledHighlightRange - highlightSpan) * remapStrength

  // Fully saturated display colours tend to look emissive on cloth. Treat the
  // swatch as a dye colour and gently roll back only its most extreme chroma.
  const saturationRatio = targetHsl.s / 100
  const fabricBaseSaturation = targetHsl.s * (1 - 0.18 * saturationRatio ** 1.5)

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

    const hasEdgeMatte = edgeBackground[dataIndex + 3] > 0
    const backgroundRgb: RGB | null = hasEdgeMatte
      ? {
          r: edgeBackground[dataIndex],
          g: edgeBackground[dataIndex + 1],
          b: edgeBackground[dataIndex + 2],
        }
      : null

    // A source boundary pixel already contains a mixture of garment and
    // skin/background. Recover its garment component before calculating tone;
    // otherwise the original blue contaminates the coral edge even when the
    // mask opacity is increased.
    const refinedEdgeSpace = edgeForeground?.[dataIndex + 3] ?? 0
    const originalRgb: RGB = refinedEdgeSpace && edgeForeground
      ? { r: edgeForeground[dataIndex], g: edgeForeground[dataIndex + 1], b: edgeForeground[dataIndex + 2] }
      : backgroundRgb
      ? {
          r: clamp((source[dataIndex] - (1 - pixelAlpha) * backgroundRgb.r) / pixelAlpha, 0, 255),
          g: clamp((source[dataIndex + 1] - (1 - pixelAlpha) * backgroundRgb.g) / pixelAlpha, 0, 255),
          b: clamp((source[dataIndex + 2] - (1 - pixelAlpha) * backgroundRgb.b) / pixelAlpha, 0, 255),
        }
      : { r: source[dataIndex], g: source[dataIndex + 1], b: source[dataIndex + 2] }
    const originalLightness = rgbToHsl(originalRgb).l

    const tonalPosition =
      originalLightness < referenceLightness
        ? (originalLightness - referenceLightness) / shadowSpan
        : (originalLightness - referenceLightness) / highlightSpan

    // Preserve all local contrast within the robust p10-p90 range. Only the
    // rare values beyond it receive a soft logarithmic shoulder, preventing a
    // logo or specular pixel from clipping the whole transform.
    const tonalMagnitude = Math.abs(tonalPosition)
    const naturalTone =
      tonalMagnitude <= 1
        ? tonalPosition
        : Math.sign(tonalPosition) * (1 + Math.log1p(tonalMagnitude - 1) * 0.35)
    const lightnessRange = naturalTone < 0 ? shadowRange : highlightRange
    const recoloredLightness = clamp(baseLightness + naturalTone * lightnessRange, 2, 98)

    // Highlights and deep folds naturally lose a little chroma. This keeps
    // reds from turning fluorescent while allowing the midtone to communicate
    // the selected dye colour.
    const toneStrength = Math.min(1, Math.abs(naturalTone))
    const chromaRolloff = naturalTone < 0 ? 0.1 : 0.18
    const recoloredSaturation = fabricBaseSaturation * (1 - toneStrength * chromaRolloff)
    const recoloredRgb: RGB = hslToRgb({
      h: targetHsl.h,
      s: recoloredSaturation,
      l: recoloredLightness,
    })

    if (refinedEdgeSpace) {
      // Replace the reconstructed garment component, rather than blending the
      // new colour over the already-mixed original RGB (which keeps its hue).
      // The fit records whether this photo's edge was mixed in linear light or
      // encoded RGB. Recompose instead of retaining source-coloured residuals.
      output[dataIndex] = replaceEdgeGarment(edgeBackground[dataIndex], recoloredRgb.r, pixelAlpha, refinedEdgeSpace)
      output[dataIndex + 1] = replaceEdgeGarment(edgeBackground[dataIndex + 1], recoloredRgb.g, pixelAlpha, refinedEdgeSpace)
      output[dataIndex + 2] = replaceEdgeGarment(edgeBackground[dataIndex + 2], recoloredRgb.b, pixelAlpha, refinedEdgeSpace)
    } else if (backgroundRgb) {
      // Recompose the recoloured garment component over the untouched local
      // background. This removes original-shirt contamination without ever
      // recolouring the skin/background contribution of the mixed pixel.
      output[dataIndex] = backgroundRgb.r + (recoloredRgb.r - backgroundRgb.r) * pixelAlpha
      output[dataIndex + 1] = backgroundRgb.g + (recoloredRgb.g - backgroundRgb.g) * pixelAlpha
      output[dataIndex + 2] = backgroundRgb.b + (recoloredRgb.b - backgroundRgb.b) * pixelAlpha
    } else {
      output[dataIndex] = originalRgb.r + (recoloredRgb.r - originalRgb.r) * pixelAlpha
      output[dataIndex + 1] = originalRgb.g + (recoloredRgb.g - originalRgb.g) * pixelAlpha
      output[dataIndex + 2] = originalRgb.b + (recoloredRgb.b - originalRgb.b) * pixelAlpha
    }
    output[dataIndex + 3] = source[dataIndex + 3]
  }

  outputContext.putImageData(outputImageData, 0, 0)
  // JPEG chroma subsampling can recreate coloured rims and alter untouched
  // neck/background pixels after a correct composite. Keep try-on lossless.
  return outputCanvas.toDataURL('image/png')
}
