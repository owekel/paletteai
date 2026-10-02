import type { CaptureMetrics, CaptureRegion } from '../types/capture'
import { resultFixture } from './resultsFixtures'

export const CAPTURE_SCENARIOS = ['ideal', 'finalist-fallback', 'finalist-excellent', 'finalist-none', 'uneven', 'dark', 'bright', 'moving', 'off-center', 'too-far', 'too-close', 'tilted', 'covered', 'multiple-faces', 'no-face', 'mixed', 'ready-then-moving', 'guidance-unavailable', 'permission-denied', 'post-retake', 'verification-error'] as const
export type CaptureScenario = typeof CAPTURE_SCENARIOS[number]

/** Synthetic INPUT metrics only. Never enters the production capture runtime. */
export function captureFixture(scenario: CaptureScenario = 'ideal', frame = 0): CaptureMetrics {
  const region = (name: string): CaptureRegion => ({ name, pixels: 250, usableFraction: .98, medianLuma: 145, linearLuma: .28, shadows: .01, highlights: .01, chromaticity: [.4, .26], chromaSpread: .015 })
  const m: CaptureMetrics = { faceCount: 1, faceWidth: .48, faceHeight: .45, centerX: .5, centerY: .43, rollDegrees: 2, yawRatio: .03, noseEyeRatio: .48,
    regionsVisible: true, landmarkPlausibility: 1, regions: ['forehead', 'leftCheek', 'rightCheek'].map(region), medianLuma: 145, shadows: .01, highlights: .01,
    cheekStops: .15, mixedChromaDistance: .01, mixedEvidence: true, landmarkMotion: .002, pixelMotion: .004, motionKnown: true, sharpness: 85 - (frame + 2) % 5 * 8 }
  if (scenario === 'uneven') m.cheekStops = 2.1
  if (scenario === 'dark') { m.medianLuma = 18; m.shadows = .5; m.regions.forEach(r => { r.usableFraction = .3 }) }
  if (scenario === 'bright') { m.medianLuma = 248; m.highlights = .5; m.regions.forEach(r => { r.usableFraction = .3 }) }
  if (scenario === 'moving' || scenario === 'ready-then-moving' && frame >= 3) m.landmarkMotion = .1
  if (scenario === 'off-center') m.centerX = .75
  if (scenario === 'too-far') m.faceWidth = .16
  if (scenario === 'too-close') m.faceHeight = .8
  if (scenario === 'tilted') m.rollDegrees = 24
  if (scenario === 'covered') m.regions[0].usableFraction = .1
  if (scenario === 'multiple-faces') m.faceCount = 2
  if (scenario === 'no-face') m.faceCount = 0
  if (scenario === 'mixed') m.mixedChromaDistance = .22
  return m
}

export function captureFullFixture(scenario: CaptureScenario, id: number) {
  const profile = resultFixture(scenario === 'post-retake' ? 'retake' : 'indeterminate')
  const skin = profile.shadowMeasurements.skinDiagnostics
  const uneven = scenario === 'finalist-none' || scenario === 'finalist-fallback' && id === 4
  const mediocre = scenario === 'finalist-excellent' && id !== 5
  skin.consistencyScore = uneven ? .05 : mediocre ? .3 : .9
  skin.regions.forEach((r, index) => { r.representative.l = .65 + (index === 0 ? uneven ? .2 : mediocre ? .11 : .02 : 0) })
  return profile
}
