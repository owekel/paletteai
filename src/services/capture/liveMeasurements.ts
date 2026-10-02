import { CAPTURE_CONFIG as C } from '../../data/captureConfig'
import type { CaptureMetrics, CaptureRegion } from '../../types/capture'
import { faceRegionsFromLandmarks } from '../vision/faceDetection'
import { sampleSkinPolygon } from '../vision/colourSampling'

type Point = { x: number; y: number }
export interface LiveHistory { timestamp: number; points: Point[]; texture: number[] }
const median = (v: number[]) => v.length ? [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] : 0
const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const linear = (v: number) => v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4
const TRACKED = [1, 10, 152, 33, 263, 61, 291, 234, 454]

/** Reduced-frame measurements; reuses the existing landmark polygons, never runs segmentation/classification. */
export function measureCaptureFrame(
  context: CanvasRenderingContext2D, faces: Point[][], timestamp: number, previous?: LiveHistory,
): { metrics: CaptureMetrics; history?: LiveHistory } {
  const width = context.canvas.width, height = context.canvas.height
  const empty: CaptureMetrics = { faceCount: faces.length, faceWidth: 0, faceHeight: 0, centerX: 0, centerY: 0,
    rollDegrees: 0, yawRatio: 0, noseEyeRatio: 0, regionsVisible: false, landmarkPlausibility: 0, regions: [],
    medianLuma: 0, shadows: 0, highlights: 0, cheekStops: 0, mixedChromaDistance: 0, mixedEvidence: false,
    landmarkMotion: 0, pixelMotion: 0, motionKnown: false, sharpness: 0 }
  const points = faces[0]
  if (faces.length !== 1 || !points || points.length < 478 || points.some(p => !Number.isFinite(p.x + p.y))) return { metrics: empty }
  const face = faceRegionsFromLandmarks(points)
  if (!face) return { metrics: empty }
  const samples = face.skinSamplingRegions.map(region => sampleSkinPolygon(context, width, height, region, null))
  const all = samples.flatMap(s => s.pixels)
  const levels = all.map(p => luma(p.r, p.g, p.b)), level = median(levels)
  const regions: CaptureRegion[] = samples.map((sample, index) => {
    const colors = sample.pixels
    const chroma = colors.map(p => { const total = Math.max(1, p.r + p.g + p.b); return [p.r / total, p.b / total] })
    const center: [number, number] = [median(chroma.map(p => p[0])), median(chroma.map(p => p[1]))]
    return {
      name: face.skinSamplingRegions[index].name, pixels: colors.length,
      usableFraction: colors.filter(p => luma(p.r, p.g, p.b) >= Math.max(C.lighting.shadowCode, level * C.lighting.minRelativeRegionLuma) && Math.max(p.r, p.g, p.b) < C.lighting.highlightCode).length / Math.max(1, colors.length),
      medianLuma: median(colors.map(p => luma(p.r, p.g, p.b))),
      linearLuma: median(colors.map(p => luma(linear(p.r), linear(p.g), linear(p.b)))),
      shadows: colors.filter(p => Math.max(p.r, p.g, p.b) <= C.lighting.shadowCode).length / Math.max(1, colors.length),
      highlights: colors.filter(p => Math.max(p.r, p.g, p.b) >= C.lighting.highlightCode).length / Math.max(1, colors.length),
      chromaticity: center, chromaSpread: median(chroma.map(p => Math.hypot(p[0] - center[0], p[1] - center[1]))),
    }
  })
  const box = face.faceBox, faceWidth = box.xEnd - box.xStart, faceHeight = box.yEnd - box.yStart
  const left = points[33], right = points[263], nose = points[1]
  const eyeDx = (right.x - left.x) * width, eyeDy = (right.y - left.y) * height
  const eyeSpan = Math.hypot(eyeDx, eyeDy)
  const midEye = { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
  const image = context.getImageData(0, 0, width, height)
  const gray = (x: number, y: number) => { const k = (y * width + x) * 4; return luma(image.data[k], image.data[k + 1], image.data[k + 2]) }
  let sum = 0, sumSq = 0, count = 0
  const texture: number[] = []
  // A face-aligned grid gives a cheap exposure/motion change signal. Laplacian
  // energy over the face supplies relative sharpness, not an identity score.
  for (let y = Math.max(1, Math.ceil(box.yStart * height)); y < Math.min(height - 1, box.yEnd * height); y += 2) {
    for (let x = Math.max(1, Math.ceil(box.xStart * width)); x < Math.min(width - 1, box.xEnd * width); x += 2) {
      const lap = gray(x - 1, y) + gray(x + 1, y) + gray(x, y - 1) + gray(x, y + 1) - 4 * gray(x, y)
      sum += lap; sumSq += lap * lap; count++
    }
  }
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    texture.push(gray(Math.min(width - 1, Math.max(0, Math.floor((box.xStart + faceWidth * (x + 0.5) / 16) * width))),
      Math.min(height - 1, Math.max(0, Math.floor((box.yStart + faceHeight * (y + 0.5) / 16) * height)))) / 255)
  }
  const tracked = TRACKED.map(i => points[i])
  const motionKnown = !!previous && timestamp > previous.timestamp && timestamp - previous.timestamp <= C.maximumSampleGapMs
  const period = motionKnown ? C.intervalMs / Math.max(100, timestamp - previous!.timestamp) : 1
  const landmarkMotion = motionKnown ? Math.max(...tracked.map((p, i) => Math.hypot(p.x - previous!.points[i].x, p.y - previous!.points[i].y) / Math.max(0.1, faceWidth))) * period : 0
  const pixelMotion = motionKnown ? texture.reduce((s, n, i) => s + Math.abs(n - previous!.texture[i]), 0) / texture.length * period : 0
  const cheeks = regions.slice(1)
  const mixedDistance = Math.hypot(cheeks[0].chromaticity[0] - cheeks[1].chromaticity[0], cheeks[0].chromaticity[1] - cheeks[1].chromaticity[1])
  const margin = C.geometry.landmarkMargin
  const inside = TRACKED.every(i => points[i].x > margin && points[i].x < 1 - margin && points[i].y > margin && points[i].y < 1 - margin)
  return { history: { timestamp, points: tracked, texture }, metrics: {
    ...empty, faceCount: 1, faceWidth, faceHeight, centerX: (box.xStart + box.xEnd) / 2, centerY: (box.yStart + box.yEnd) / 2,
    rollDegrees: Math.atan2(eyeDy, Math.abs(eyeDx)) * 180 / Math.PI,
    yawRatio: Math.abs((nose.x - midEye.x) * width) / Math.max(1, eyeSpan),
    noseEyeRatio: (nose.y - midEye.y) * height / Math.max(1, eyeSpan),
    regionsVisible: inside, landmarkPlausibility: inside && eyeSpan > faceWidth * width * C.geometry.minEyeSpanFraction ? 1 : 0.4,
    regions, medianLuma: level,
    shadows: all.filter(p => Math.max(p.r, p.g, p.b) <= C.lighting.shadowCode).length / Math.max(1, all.length),
    highlights: all.filter(p => Math.max(p.r, p.g, p.b) >= C.lighting.highlightCode).length / Math.max(1, all.length),
    cheekStops: Math.abs(Math.log2((cheeks[0].linearLuma + C.lighting.linearLumaFloor) / (cheeks[1].linearLuma + C.lighting.linearLumaFloor))),
    mixedChromaDistance: mixedDistance,
    // Only an extreme, coherent cheek colour split is a live blocker. This is
    // a risk indicator, not white-balance estimation or undertone inference.
    mixedEvidence: cheeks.every(r => r.pixels >= C.geometry.minRegionPixels && r.usableFraction > C.lighting.minMixedEvidenceFraction && r.chromaSpread < C.lighting.mixedRegionSpread),
    motionKnown, landmarkMotion, pixelMotion, sharpness: count ? Math.max(0, sumSq / count - (sum / count) ** 2) : 0,
  } }
}
