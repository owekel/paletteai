import type { RGB } from '../colorUtils'
import { rgbToOklab } from '../oklab'
import type { LightingReferenceSamples } from '../illuminationCorrection'
import type { FaceRegions, IrisSampleRegion } from './faceDetection'
import type { HairMask } from './hairSegmentation'
import { isSafeBackgroundReference } from './backgroundExclusion'

const REFERENCE_CANVAS_MAX_EDGE = 220
const BACKGROUND_CHROMA_LIMIT = 0.065
const MAX_SCLERA_PIXELS_PER_EYE = 1500

function isUnclipped({ r, g, b }: RGB): boolean {
  return r > 4 && g > 4 && b > 4 && r < 251 && g < 251 && b < 251
}

function isBackgroundNeutralCandidate(pixel: RGB): boolean {
  if (!isUnclipped(pixel)) return false
  const lab = rgbToOklab(pixel)
  return lab.l >= 0.2 && lab.l <= 0.95 && Math.hypot(lab.a, lab.b) <= BACKGROUND_CHROMA_LIMIT
}

function sampleBackgroundCandidates(
  context: CanvasRenderingContext2D,
  mask: HairMask | null,
): { pixels: RGB[]; tiles: RGB[][] } {
  const tiles = [[], [], [], []] as RGB[][]
  if (!mask) return { pixels: [], tiles }

  const sourceWidth = context.canvas.width
  const sourceHeight = context.canvas.height
  const scale = Math.min(1, REFERENCE_CANVAS_MAX_EDGE / Math.max(sourceWidth, sourceHeight))
  const width = Math.max(1, Math.round(sourceWidth * scale))
  const height = Math.max(1, Math.round(sourceHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const sampleContext = canvas.getContext('2d', { willReadFrequently: true })
  if (!sampleContext) return { pixels: [], tiles }

  sampleContext.drawImage(context.canvas, 0, 0, width, height)
  const { data } = sampleContext.getImageData(0, 0, width, height)
  const pixels: RGB[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const relativeX = (x + 0.5) / width
      const relativeY = (y + 0.5) / height
      if (!isSafeBackgroundReference(mask, relativeX, relativeY, width, height)) continue

      const index = (y * width + x) * 4
      const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] }
      if (!isBackgroundNeutralCandidate(pixel)) continue

      pixels.push(pixel)
      const tileIndex = (relativeY >= 0.5 ? 2 : 0) + (relativeX >= 0.5 ? 1 : 0)
      tiles[tileIndex].push(pixel)
    }
  }

  return { pixels, tiles }
}

function sampleScleraForIris(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  iris: IrisSampleRegion,
): RGB[] {
  if (iris.outerRadiusX <= 0 || iris.outerRadiusY <= 0) return []

  const xStart = Math.min(imgWidth - 1, Math.max(0, Math.floor((iris.centerX - iris.outerRadiusX * 2.6) * imgWidth)))
  const xEnd = Math.min(imgWidth, Math.ceil((iris.centerX + iris.outerRadiusX * 2.6) * imgWidth))
  const yStart = Math.min(imgHeight - 1, Math.max(0, Math.floor((iris.centerY - iris.outerRadiusY * 1.15) * imgHeight)))
  const yEnd = Math.min(imgHeight, Math.ceil((iris.centerY + iris.outerRadiusY * 1.15) * imgHeight))
  const width = Math.max(1, xEnd - xStart)
  const height = Math.max(1, yEnd - yStart)
  const { data } = context.getImageData(xStart, yStart, width, height)
  const candidates: RGB[] = []

  for (let localY = 0; localY < height; localY++) {
    for (let localX = 0; localX < width; localX++) {
      const relativeX = (xStart + localX) / imgWidth - iris.centerX
      const relativeY = (yStart + localY) / imgHeight - iris.centerY
      const normalizedX = Math.abs(relativeX / iris.outerRadiusX)
      const normalizedY = Math.abs(relativeY / iris.outerRadiusY)

      // Only use the two narrow side bands outside the iris. This avoids the
      // pupil/iris and most eyelid/skin pixels before colour filtering.
      if (normalizedX < 1.08 || normalizedX > 2.55 || normalizedY > 0.78) continue

      const index = (localY * width + localX) * 4
      const pixel = { r: data[index], g: data[index + 1], b: data[index + 2] }
      if (!isUnclipped(pixel)) continue
      const lab = rgbToOklab(pixel)
      if (lab.l < 0.55 || lab.l > 0.97 || Math.hypot(lab.a, lab.b) > 0.09) continue
      candidates.push(pixel)
    }
  }

  if (candidates.length <= MAX_SCLERA_PIXELS_PER_EYE) return candidates
  const stride = Math.ceil(candidates.length / MAX_SCLERA_PIXELS_PER_EYE)
  return candidates.filter((_, index) => index % stride === 0).slice(0, MAX_SCLERA_PIXELS_PER_EYE)
}

export function sampleLightingReferences(
  context: CanvasRenderingContext2D,
  imgWidth: number,
  imgHeight: number,
  mask: HairMask | null,
  faceRegions: FaceRegions,
): LightingReferenceSamples {
  const background = sampleBackgroundCandidates(context, mask)
  const leftSclera = sampleScleraForIris(context, imgWidth, imgHeight, faceRegions.leftIris)
  const rightSclera = sampleScleraForIris(context, imgWidth, imgHeight, faceRegions.rightIris)

  return {
    backgroundPixels: background.pixels,
    backgroundTiles: background.tiles,
    scleraPixels: [...leftSclera, ...rightSclera],
    scleraRegions: [leftSclera, rightSclera],
  }
}
