// Turns a raw photo into face-anchored regions: where the forehead, cheeks,
// eyes, and "likely hair" area actually are — based on landmarks MediaPipe
// detected in THIS photo, not a fixed guess at image percentages.
//
// The landmark index numbers below (468, 10, 152, etc.) come from
// MediaPipe's standard 478-point face mesh, which is a stable, documented
// topology — not something guessed at. See:
// https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker

import { getFaceLandmarker } from './loadVisionModels'
import { throwIfAborted } from './modelLifecycle'

export interface NormalizedRect {
  xStart: number
  xEnd: number
  yStart: number
  yEnd: number
}

// An annulus (ring) around an iris centre, in normalized [0,1] image
// coordinates. Radii are tracked separately per axis because MediaPipe
// normalizes x by image width and y by image height independently, so a
// circular iris in the photo isn't necessarily circular in this coordinate
// space unless the photo itself is square.
export interface IrisSampleRegion {
  centerX: number
  centerY: number
  innerRadiusX: number
  innerRadiusY: number
  outerRadiusX: number
  outerRadiusY: number
}

export type SkinRegionName = 'forehead' | 'leftCheek' | 'rightCheek'

export interface NormalizedPolygon {
  points: { x: number; y: number }[]
}

export interface SkinSamplingRegion {
  name: SkinRegionName
  polygon: NormalizedPolygon
  exclusions: NormalizedPolygon[]
}

export interface FaceRegions {
  /** The detected face's own bounding box, in normalized [0,1] image coordinates. */
  faceBox: NormalizedRect
  forehead: NormalizedRect
  leftCheek: NormalizedRect
  rightCheek: NormalizedRect
  hairSearchArea: NormalizedRect
  leftIris: IrisSampleRegion
  rightIris: IrisSampleRegion
  /** Landmark-defined skin polygons used only by the shadow measurement path. */
  skinSamplingRegions: SkinSamplingRegion[]
  /** Face bounding-box area as a fraction of the whole photo — used for confidence. */
  faceAreaRatio: number
}

const LEFT_IRIS_CENTER = 468
const LEFT_IRIS_RING = [469, 470, 471, 472]
const RIGHT_IRIS_CENTER = 473
const RIGHT_IRIS_RING = [474, 475, 476, 477]

// The 4 "ring" landmarks around each iris sit at the OUTER iris boundary
// (iris meets sclera), and the centre landmark sits at the pupil centre.
// Sampling a small box at the centre — the previous approach — mostly
// samples the pupil itself, not the coloured iris. Instead we sample an
// annulus: inside the outer iris boundary, but well outside the pupil
// (whose radius varies a lot with lighting, so 60% is a conservative cut
// that clears the pupil even when it's fairly dilated), leaving a small
// margin before the outer edge too, where eyelid/eyelash overlap and
// landmark imprecision are most likely.
const IRIS_INNER_RADIUS_FRACTION = 0.6
const IRIS_OUTER_RADIUS_FRACTION = 0.88

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function clampRect(rect: NormalizedRect): NormalizedRect {
  return {
    xStart: clamp01(rect.xStart),
    xEnd: clamp01(rect.xEnd),
    yStart: clamp01(rect.yStart),
    yEnd: clamp01(rect.yEnd),
  }
}

function polygonFromIndices(points: { x: number; y: number }[], indices: number[]): NormalizedPolygon {
  return {
    points: indices.map((index) => ({ x: clamp01(points[index].x), y: clamp01(points[index].y) })),
  }
}

function insetPolygon(polygon: NormalizedPolygon, fraction: number): NormalizedPolygon {
  const center = {
    x: polygon.points.reduce((sum, point) => sum + point.x, 0) / polygon.points.length,
    y: polygon.points.reduce((sum, point) => sum + point.y, 0) / polygon.points.length,
  }
  return {
    points: polygon.points.map((point) => ({
      x: center.x + (point.x - center.x) * (1 - fraction),
      y: center.y + (point.y - center.y) * (1 - fraction),
    })),
  }
}

function paddedLandmarkBounds(
  points: { x: number; y: number }[],
  indices: number[],
  paddingX: number,
  paddingY: number,
): NormalizedPolygon {
  const selected = indices.map((index) => points[index])
  const xMin = Math.min(...selected.map((point) => point.x)) - paddingX
  const xMax = Math.max(...selected.map((point) => point.x)) + paddingX
  const yMin = Math.min(...selected.map((point) => point.y)) - paddingY
  const yMax = Math.max(...selected.map((point) => point.y)) + paddingY
  return {
    points: [
      { x: clamp01(xMin), y: clamp01(yMin) },
      { x: clamp01(xMax), y: clamp01(yMin) },
      { x: clamp01(xMax), y: clamp01(yMax) },
      { x: clamp01(xMin), y: clamp01(yMax) },
    ],
  }
}

// The ring/annulus described above, sized from THIS iris's own detected
// spread (not a fixed guess).
function irisSampleRegion(
  points: { x: number; y: number }[],
  centerIndex: number,
  ringIndices: number[],
): IrisSampleRegion {
  const center = points[centerIndex]
  const ring = ringIndices.map((i) => points[i])
  const outerRadiusX = Math.max(...ring.map((p) => Math.abs(p.x - center.x)))
  const outerRadiusY = Math.max(...ring.map((p) => Math.abs(p.y - center.y)))

  return {
    centerX: center.x,
    centerY: center.y,
    innerRadiusX: outerRadiusX * IRIS_INNER_RADIUS_FRACTION,
    innerRadiusY: outerRadiusY * IRIS_INNER_RADIUS_FRACTION,
    outerRadiusX: outerRadiusX * IRIS_OUTER_RADIUS_FRACTION,
    outerRadiusY: outerRadiusY * IRIS_OUTER_RADIUS_FRACTION,
  }
}

// Accepts a still photo (the existing post-capture use) or a live video
// element (used for the live positioning guide during camera preview) —
// same model, same landmark math either way, just a different pixel source.
export async function detectFaceRegions(image: HTMLImageElement | HTMLVideoElement, signal?: AbortSignal): Promise<FaceRegions | null> {
  throwIfAborted(signal)
  const landmarker = await getFaceLandmarker(signal)
  throwIfAborted(signal)
  const result = landmarker.detect(image)
  throwIfAborted(signal)
  return faceRegionsFromLandmarks(result.faceLandmarks?.[0])
}

/** Shared geometry only; capture uses its own multi-face model instance. */
export function faceRegionsFromLandmarks(points?: { x: number; y: number }[]): FaceRegions | null {

  // Need the full 478-point set (including the 10 iris points) to do
  // anything useful — anything less means no reliable face was found.
  if (!points || points.length < 478) return null

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  for (const point of points) {
    if (point.x < xMin) xMin = point.x
    if (point.x > xMax) xMax = point.x
    if (point.y < yMin) yMin = point.y
    if (point.y > yMax) yMax = point.y
  }

  const faceWidth = xMax - xMin
  const faceHeight = yMax - yMin
  if (faceWidth <= 0 || faceHeight <= 0) return null

  // Regions below are expressed as a percentage of the DETECTED FACE's own
  // box, not the whole photo — so they stay correctly placed regardless of
  // how the photo is framed, zoomed, or cropped.
  const forehead = clampRect({
    xStart: xMin + faceWidth * 0.28,
    xEnd: xMin + faceWidth * 0.72,
    yStart: yMin + faceHeight * 0.06,
    yEnd: yMin + faceHeight * 0.22,
  })

  const leftCheek = clampRect({
    xStart: xMin + faceWidth * 0.08,
    xEnd: xMin + faceWidth * 0.32,
    yStart: yMin + faceHeight * 0.5,
    yEnd: yMin + faceHeight * 0.68,
  })

  const rightCheek = clampRect({
    xStart: xMin + faceWidth * 0.68,
    xEnd: xMin + faceWidth * 0.92,
    yStart: yMin + faceHeight * 0.5,
    yEnd: yMin + faceHeight * 0.68,
  })

  // Generous on purpose: hairstyles vary a lot (long, short, updo), so this
  // is a CANDIDATE area — the hair segmentation mask (see hairSegmentation.ts)
  // decides which pixels inside it actually are hair.
  const hairSearchArea = clampRect({
    xStart: xMin - faceWidth * 0.25,
    xEnd: xMax + faceWidth * 0.25,
    yStart: yMin - faceHeight * 0.9,
    yEnd: yMin + faceHeight * 0.15,
  })

  const leftIris = irisSampleRegion(points, LEFT_IRIS_CENTER, LEFT_IRIS_RING)
  const rightIris = irisSampleRegion(points, RIGHT_IRIS_CENTER, RIGHT_IRIS_RING)

  // These polygons follow stable face-mesh landmarks rather than sampling
  // every pixel in a rectangular slice. They deliberately target central
  // forehead and upper/outer cheek areas, away from the mouth, nose and jaw.
  // A small inset avoids the hairline, eyelids and polygon boundary errors.
  const foreheadPolygon = insetPolygon(
    polygonFromIndices(points, [103, 67, 109, 10, 338, 297, 332, 285, 9, 55]),
    0.12,
  )
  const leftCheekPolygon = insetPolygon(
    polygonFromIndices(points, [116, 50, 101, 205, 187, 123]),
    0.1,
  )
  const rightCheekPolygon = insetPolygon(
    polygonFromIndices(points, [345, 280, 330, 425, 411, 352]),
    0.1,
  )

  const featurePaddingX = faceWidth * 0.025
  const featurePaddingY = faceHeight * 0.018
  const featureExclusions = [
    // Left/right eye and eyebrow complexes.
    paddedLandmarkBounds(points, [33, 133, 159, 145, 70, 63, 105, 66, 107], featurePaddingX, featurePaddingY),
    paddedLandmarkBounds(points, [362, 263, 386, 374, 336, 296, 334, 293, 300], featurePaddingX, featurePaddingY),
    // Nose/nostrils and the complete outer mouth/lip area.
    paddedLandmarkBounds(points, [1, 2, 4, 5, 97, 98, 326, 327], featurePaddingX, featurePaddingY),
    paddedLandmarkBounds(points, [61, 291, 0, 17, 13, 14, 78, 308], featurePaddingX, featurePaddingY),
    // Hairline and lower face/beard zones are excluded even if a landmark
    // polygon clips their boundary on an unusual pose.
    {
      points: [
        { x: clamp01(xMin - faceWidth * 0.05), y: clamp01(yMin - faceHeight * 0.02) },
        { x: clamp01(xMax + faceWidth * 0.05), y: clamp01(yMin - faceHeight * 0.02) },
        { x: clamp01(xMax + faceWidth * 0.05), y: clamp01(yMin + faceHeight * 0.075) },
        { x: clamp01(xMin - faceWidth * 0.05), y: clamp01(yMin + faceHeight * 0.075) },
      ],
    },
    {
      points: [
        { x: clamp01(xMin), y: clamp01(yMin + faceHeight * 0.7) },
        { x: clamp01(xMax), y: clamp01(yMin + faceHeight * 0.7) },
        { x: clamp01(xMax), y: clamp01(yMax) },
        { x: clamp01(xMin), y: clamp01(yMax) },
      ],
    },
  ]

  const skinSamplingRegions: SkinSamplingRegion[] = [
    { name: 'forehead', polygon: foreheadPolygon, exclusions: featureExclusions },
    { name: 'leftCheek', polygon: leftCheekPolygon, exclusions: featureExclusions },
    { name: 'rightCheek', polygon: rightCheekPolygon, exclusions: featureExclusions },
  ]

  return {
    faceBox: clampRect({ xStart: xMin, xEnd: xMax, yStart: yMin, yEnd: yMax }),
    forehead,
    leftCheek,
    rightCheek,
    hairSearchArea,
    leftIris,
    rightIris,
    skinSamplingRegions,
    faceAreaRatio: faceWidth * faceHeight,
  }
}
