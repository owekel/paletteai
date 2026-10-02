import { CAPTURE_CONFIG as C } from '../../data/captureConfig'
import type { CaptureIssue, CaptureMetrics, CaptureQuality, CaptureSubscores } from '../../types/capture'

export const CAPTURE_GUIDANCE: Record<CaptureIssue | 'ready', { title: string; detail: string }> = {
  'no-face': { title: 'Center your face', detail: 'Bring your face into the oval, with your hair and shoulders in view.' },
  'multiple-faces': { title: 'Just you in the frame', detail: 'Make sure nobody else is visible behind you.' },
  closer: { title: 'Move closer', detail: 'Bring your face a little closer so we can see the detail.' },
  back: { title: 'Move back', detail: 'Leave a little room around your head and shoulders.' },
  center: { title: 'Center your face', detail: 'Settle into the middle of the oval.' },
  pose: { title: 'Look straight ahead', detail: 'Keep your head level and look towards the camera.' },
  visibility: { title: 'Let your face show', detail: 'Keep your forehead and both cheeks clear of hair or hands.' },
  bright: { title: 'Too bright', detail: 'Step out of direct light so the detail in your face is visible.' },
  dark: { title: 'Too dark', detail: 'Move towards soft daylight, facing the window.' },
  uneven: { title: 'Lighting is uneven', detail: 'Face a window or soft light so it reaches both cheeks.' },
  mixed: { title: 'Face the light', detail: 'Try one light source. Turn away from strongly coloured lights.' },
  motion: { title: 'Hold still', detail: 'Rest your phone or steady your hand for a moment.' },
  ready: { title: 'Looks good', detail: 'We’ll take your photo when you’re settled.' },
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))

/** Input quality only. No skin-temperature target or classification feedback. */
export function evaluateCaptureQuality(m: CaptureMetrics): CaptureQuality {
  const g = C.geometry, l = C.lighting
  // Ranking sees all three regions; the existing live blockers stay unchanged.
  const regionalLevels = m.regions.map(r => r.linearLuma + l.linearLumaFloor)
  const regionalStops = regionalLevels.length === 3
    ? Math.log2(Math.max(...regionalLevels) / Math.min(...regionalLevels)) : m.cheekStops
  const blockers: CaptureIssue[] = []
  if (!m.faceCount) blockers.push('no-face')
  else if (m.faceCount > 1) blockers.push('multiple-faces')
  else {
    if (m.faceWidth < g.minFaceWidth || m.faceHeight < g.minFaceHeight) blockers.push('closer')
    if (m.faceWidth > g.maxFaceWidth || m.faceHeight > g.maxFaceHeight) blockers.push('back')
    if (Math.abs(m.centerX - g.centerX) > g.maxOffsetX || Math.abs(m.centerY - g.centerY) > g.maxOffsetY) blockers.push('center')
    if (Math.abs(m.rollDegrees) > g.maxRollDegrees || m.yawRatio > g.maxYawRatio || m.noseEyeRatio < g.minNoseEyeRatio || m.noseEyeRatio > g.maxNoseEyeRatio) blockers.push('pose')
    if (m.highlights > l.maxHighlightFraction || m.medianLuma > l.extremeBrightMedian) blockers.push('bright')
    if (m.shadows > l.maxShadowFraction || m.medianLuma < l.extremeDarkMedian) blockers.push('dark')
    if (!m.regionsVisible || m.regions.length !== 3 || m.regions.some(r => r.pixels < g.minRegionPixels || r.usableFraction < g.minUsableRegionFraction)) blockers.push('visibility')
    if (m.cheekStops > l.maxCheekStops) blockers.push('uneven')
    if (m.mixedEvidence && m.mixedChromaDistance > l.mixedChromaDistance) blockers.push('mixed')
    if (!m.motionKnown || m.landmarkMotion > C.motion.maxLandmarkDisplacement || m.pixelMotion > C.motion.maxPixelDifference) blockers.push('motion')
  }
  const subscores: CaptureSubscores = {
    sharpness: clamp((m.sharpness - C.sharpness.soft) / (C.sharpness.good - C.sharpness.soft)),
    steadiness: m.motionKnown ? clamp(1 - Math.max(m.landmarkMotion / C.motion.maxLandmarkDisplacement, m.pixelMotion / C.motion.maxPixelDifference)) : 0,
    framing: clamp(1 - 0.5 * (Math.abs(m.centerX - g.centerX) / g.maxOffsetX + Math.abs(m.centerY - g.centerY) / g.maxOffsetY)),
    landmarks: clamp(m.landmarkPlausibility * (m.regions.filter(r => r.pixels >= g.minRegionPixels && r.usableFraction >= g.minUsableRegionFraction).length / 3)),
    exposure: clamp(1 - Math.max(m.shadows / l.maxShadowFraction, m.highlights / l.maxHighlightFraction)),
    lighting: clamp(1 - C.lightingScorePenalties.imbalance * Math.max(m.cheekStops, regionalStops) / l.maxCheekStops - C.lightingScorePenalties.colourSplit * m.mixedChromaDistance / l.mixedChromaDistance),
  }
  const score = (Object.keys(subscores) as (keyof CaptureSubscores)[]).reduce((sum, key) => sum + subscores[key] * C.weights[key], 0)
  return { metrics: m, blockers, blocker: blockers[0] ?? null, score, subscores }
}
