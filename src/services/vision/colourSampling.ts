// Samples colour from a region of the photo using a TRIMMED MEAN instead of
// a plain average: the darkest and lightest 10% of pixels in the region are
// dropped before averaging, so a stray glare, shadow, or a few background
// pixels at the edge of a region can't drag the result off course the way a
// plain average can.

import type { RGB } from '../colorUtils'
import { getLuminance } from '../colorUtils'
import type { NormalizedRect, IrisSampleRegion, SkinSamplingRegion } from './faceDetection'
import type { HairMask } from './hairSegmentation'
import { isHairAtRelativePosition } from './hairSegmentation'

export interface RegionSample {
  color: RGB | null
  pixelCount: number
  /**
   * Representative source pixels retained for perceptual distribution
   * analysis. Capped to avoid keeping millions of RGB objects for large
   * photos; pixelCount still reports the full number used by the legacy mean.
   */
  pixels: RGB[]
}

const TRIM_FRACTION = 0.1
const MAX_RETAINED_PIXELS = 12000

function retainReservoirPixel(pixels: RGB[], pixel: RGB, seenPixelCount: number): void {
  if (pixels.length < MAX_RETAINED_PIXELS) {
    pixels.push(pixel)
    return
  }

  // Deterministic reservoir sampling keeps runs reproducible while spreading
  // the retained pixels across the complete masked feature distribution.
  const candidate = (Math.imul(seenPixelCount, 2654435761) >>> 0) % seenPixelCount
  if (candidate < MAX_RETAINED_PIXELS) pixels[candidate] = pixel
}

function trimmedMean(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const trimCount = Math.floor(sorted.length * TRIM_FRACTION)
  const trimmed = sorted.slice(trimCount, sorted.length - trimCount)
  const usable = trimmed.length > 0 ? trimmed : sorted
  return usable.reduce((sum, value) => sum + value, 0) / usable.length
}

function toPixelRect(rect: NormalizedRect, imgWidth: number, imgHeight: number) {
  const x = Math.round(rect.xStart * imgWidth)
  const y = Math.round(rect.yStart * imgHeight)
  const width = Math.max(1, Math.round((rect.xEnd - rect.xStart) * imgWidth))
  const height = Math.max(1, Math.round((rect.yEnd - rect.yStart) * imgHeight))
  return { x, y, width, height }
}

function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i]
    const previous = polygon[j]
    const crosses = current.y > y !== previous.y > y
    const intersectionX = ((previous.x - current.x) * (y - current.y)) / (previous.y - current.y || 1e-9) + current.x
    if (crosses && x < intersectionX) inside = !inside
  }
  return inside
}

/**
 * Samples a landmark-defined skin polygon while excluding facial-feature
 * polygons and any pixel the segmentation model explicitly calls hair.
 * Colour outlier rejection happens later, after illumination correction.
 */
export function sampleSkinPolygon(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  region: SkinSamplingRegion,
  hairMask: HairMask | null,
): RegionSample {
  const xStart = Math.max(0, Math.floor(Math.min(...region.polygon.points.map((point) => point.x)) * imgWidth))
  const xEnd = Math.min(imgWidth, Math.ceil(Math.max(...region.polygon.points.map((point) => point.x)) * imgWidth))
  const yStart = Math.max(0, Math.floor(Math.min(...region.polygon.points.map((point) => point.y)) * imgHeight))
  const yEnd = Math.min(imgHeight, Math.ceil(Math.max(...region.polygon.points.map((point) => point.y)) * imgHeight))
  const width = Math.max(1, xEnd - xStart)
  const height = Math.max(1, yEnd - yStart)
  const { data } = context.getImageData(xStart, yStart, width, height)

  const rValues: number[] = []
  const gValues: number[] = []
  const bValues: number[] = []
  const pixels: RGB[] = []
  let acceptedPixelCount = 0

  for (let localY = 0; localY < height; localY++) {
    for (let localX = 0; localX < width; localX++) {
      const relativeX = (xStart + localX + 0.5) / imgWidth
      const relativeY = (yStart + localY + 0.5) / imgHeight
      if (!pointInPolygon(relativeX, relativeY, region.polygon.points)) continue
      if (region.exclusions.some((exclusion) => pointInPolygon(relativeX, relativeY, exclusion.points))) continue
      if (hairMask && isHairAtRelativePosition(hairMask, relativeX, relativeY)) continue

      const dataIndex = (localY * width + localX) * 4
      const pixel = { r: data[dataIndex], g: data[dataIndex + 1], b: data[dataIndex + 2] }
      rValues.push(pixel.r)
      gValues.push(pixel.g)
      bValues.push(pixel.b)
      acceptedPixelCount += 1
      retainReservoirPixel(pixels, pixel, acceptedPixelCount)
    }
  }

  if (acceptedPixelCount === 0) return { color: null, pixelCount: 0, pixels: [] }
  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: acceptedPixelCount,
    pixels,
  }
}

// Samples every pixel in the region — used for skin and eye regions, which
// come from face landmarks and are already trusted to be the right area.
export function sampleRegion(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  rect: NormalizedRect,
): RegionSample {
  const { x, y, width, height } = toPixelRect(rect, imgWidth, imgHeight)
  const { data } = context.getImageData(x, y, width, height)

  const rValues: number[] = []
  const gValues: number[] = []
  const bValues: number[] = []
  const pixels: RGB[] = []
  const retentionStride = Math.max(1, Math.ceil((width * height) / MAX_RETAINED_PIXELS))
  for (let i = 0; i < data.length; i += 4) {
    rValues.push(data[i])
    gValues.push(data[i + 1])
    bValues.push(data[i + 2])
    if (i / 4 % retentionStride === 0) {
      pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
    }
  }

  if (rValues.length === 0) return { color: null, pixelCount: 0, pixels: [] }

  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: rValues.length,
    pixels,
  }
}

// Samples only the pixels WITHIN the region that the hair mask actually
// labels as hair — used for hair colour, which is the fix for the
// background/lighting-gets-sampled-instead-of-hair bug.
export function sampleMaskedRegion(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  rect: NormalizedRect,
  mask: HairMask,
): RegionSample & { areaPixelCount: number } {
  const { x, y, width, height } = toPixelRect(rect, imgWidth, imgHeight)
  const { data } = context.getImageData(x, y, width, height)

  const rValues: number[] = []
  const gValues: number[] = []
  const bValues: number[] = []
  const pixels: RGB[] = []
  let areaPixelCount = 0
  let hairPixelCount = 0

  for (let localY = 0; localY < height; localY++) {
    for (let localX = 0; localX < width; localX++) {
      areaPixelCount += 1

      const absoluteX = x + localX
      const absoluteY = y + localY
      const isHair = isHairAtRelativePosition(mask, absoluteX / imgWidth, absoluteY / imgHeight)
      if (!isHair) continue

      const dataIndex = (localY * width + localX) * 4
      const pixel = { r: data[dataIndex], g: data[dataIndex + 1], b: data[dataIndex + 2] }
      rValues.push(pixel.r)
      gValues.push(pixel.g)
      bValues.push(pixel.b)
      hairPixelCount += 1
      retainReservoirPixel(pixels, pixel, hairPixelCount)
    }
  }

  if (rValues.length === 0) return { color: null, pixelCount: 0, areaPixelCount, pixels: [] }

  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: rValues.length,
    areaPixelCount,
    pixels,
  }
}

// A pixel this bright within the iris ring is almost certainly a specular
// highlight/reflection (a catchlight from a light source), not iris
// pigment — skipped so it can't pull the average toward white.
const IRIS_HIGHLIGHT_LUMINANCE = 200

// Samples an ANNULUS (ring) around an iris centre — inside the outer iris
// boundary but outside the pupil — instead of a filled circle/rectangle at
// the centre. The centre of an iris is the pupil, which is essentially
// black and carries no colour information, so including it (or sampling
// too close to it) skews results toward dark/neutral. Every pixel within
// the ring is checked individually, both for whether it falls in the ring
// at all and for whether it looks like a highlight — not just a handful of
// discrete points around it.
export function sampleIrisRing(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  region: IrisSampleRegion,
): RegionSample {
  const x = Math.round((region.centerX - region.outerRadiusX) * imgWidth)
  const y = Math.round((region.centerY - region.outerRadiusY) * imgHeight)
  const width = Math.max(1, Math.round(region.outerRadiusX * 2 * imgWidth))
  const height = Math.max(1, Math.round(region.outerRadiusY * 2 * imgHeight))

  const { data } = context.getImageData(x, y, width, height)

  const rValues: number[] = []
  const gValues: number[] = []
  const bValues: number[] = []
  const pixels: RGB[] = []

  for (let localY = 0; localY < height; localY++) {
    for (let localX = 0; localX < width; localX++) {
      // Position of this pixel relative to the iris centre, scaled so that
      // "1.0" lands exactly on the outer/inner radius — turns the per-axis
      // (elliptical) radii back into a simple circular ring test.
      const relX = (x + localX) / imgWidth - region.centerX
      const relY = (y + localY) / imgHeight - region.centerY

      const outerDistance = Math.sqrt((relX / region.outerRadiusX) ** 2 + (relY / region.outerRadiusY) ** 2)
      if (outerDistance > 1) continue // outside the iris entirely

      const innerDistance = Math.sqrt((relX / region.innerRadiusX) ** 2 + (relY / region.innerRadiusY) ** 2)
      if (innerDistance < 1) continue // inside the pupil — skip

      const dataIndex = (localY * width + localX) * 4
      const r = data[dataIndex]
      const g = data[dataIndex + 1]
      const b = data[dataIndex + 2]

      if (getLuminance({ r, g, b }) > IRIS_HIGHLIGHT_LUMINANCE) continue // likely a reflection

      rValues.push(r)
      gValues.push(g)
      bValues.push(b)
      retainReservoirPixel(pixels, { r, g, b }, rValues.length)
    }
  }

  if (rValues.length === 0) return { color: null, pixelCount: 0, pixels: [] }

  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: rValues.length,
    pixels,
  }
}
