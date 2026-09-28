// Samples colour from a region of the photo using a TRIMMED MEAN instead of
// a plain average: the darkest and lightest 10% of pixels in the region are
// dropped before averaging, so a stray glare, shadow, or a few background
// pixels at the edge of a region can't drag the result off course the way a
// plain average can.

import type { RGB } from '../colorUtils'
import { getLuminance } from '../colorUtils'
import type { NormalizedRect, IrisSampleRegion } from './faceDetection'
import type { HairMask } from './hairSegmentation'
import { isHairAtRelativePosition } from './hairSegmentation'

export interface RegionSample {
  color: RGB | null
  pixelCount: number
}

const TRIM_FRACTION = 0.1

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
  for (let i = 0; i < data.length; i += 4) {
    rValues.push(data[i])
    gValues.push(data[i + 1])
    bValues.push(data[i + 2])
  }

  if (rValues.length === 0) return { color: null, pixelCount: 0 }

  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: rValues.length,
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
  let areaPixelCount = 0

  for (let localY = 0; localY < height; localY++) {
    for (let localX = 0; localX < width; localX++) {
      areaPixelCount += 1

      const absoluteX = x + localX
      const absoluteY = y + localY
      const isHair = isHairAtRelativePosition(mask, absoluteX / imgWidth, absoluteY / imgHeight)
      if (!isHair) continue

      const dataIndex = (localY * width + localX) * 4
      rValues.push(data[dataIndex])
      gValues.push(data[dataIndex + 1])
      bValues.push(data[dataIndex + 2])
    }
  }

  if (rValues.length === 0) return { color: null, pixelCount: 0, areaPixelCount }

  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: rValues.length,
    areaPixelCount,
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
    }
  }

  if (rValues.length === 0) return { color: null, pixelCount: 0 }

  return {
    color: { r: trimmedMean(rValues), g: trimmedMean(gValues), b: trimmedMean(bValues) },
    pixelCount: rValues.length,
  }
}
