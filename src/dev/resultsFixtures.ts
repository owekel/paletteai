import { SHADOW_SEASON_PROTOTYPES } from '../data/shadowSeasonCalibration'
import { calculateShadowSeasonMeasurements } from '../services/seasonMeasurements'
import { classifyShadowSeason } from '../services/shadowSeasonClassifier'
import { buildSeasonAnalysis } from '../services/seasonAnalysis'
import type { ColorProfile } from '../types/colorProfile'
import type { ShadowSeasonDimension, ShadowSeasonId } from '../types/shadowSeasonClassification'

export type ResultScenario = 'strong' | 'constrained' | 'tie' | 'indeterminate' | 'retake'
export const SCENARIOS: ResultScenario[] = ['strong', 'constrained', 'tie', 'indeterminate', 'retake']

/** Synthetic integration fixtures, never photo-classification ground truth. */
export function resultFixture(scenario: ResultScenario, id: ShadowSeasonId = 'soft-summer'): ColorProfile {
  const distribution = (r: number, g: number, b: number) => ({
    pixels: Array.from({ length: 400 }, (_, i) => ({ r: r + i % 9, g: g + i % 7, b: b + i % 5 })),
    totalPixelCount: 400,
  })
  const skin = distribution(180, 140, 120)
  const eye = distribution(70, 55, 45)
  const m = calculateShadowSeasonMeasurements({
    method: 'vision', faceAreaRatio: 0.25, skin, hair: distribution(65, 50, 42), eyes: eye,
    skinRegions: (['forehead', 'leftCheek', 'rightCheek'] as const).map(name => ({ name, usedLandmarkPolygon: true, ...skin })),
    eyeRegions: [eye, eye], hairUsedMaskSampling: true, hairMaskCoverageRatio: 0.6, eyeSampleUsable: true,
    lightingReferences: { backgroundPixels: [], backgroundTiles: [[], [], [], []], scleraPixels: [], scleraRegions: [[], []] },
  })
  const center = SHADOW_SEASON_PROTOTYPES.find(p => p.id === id)!.center
  const dimensions: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma', 'contrast']
  for (const dimension of dimensions) {
    m[dimension].score = center[dimension]
    m[dimension].reliability = 0.9
  }
  if (scenario === 'constrained') m.temperature.reliability = 0
  if (scenario === 'indeterminate') for (const dimension of dimensions) m[dimension].reliability = 0
  if (scenario === 'tie') {
    const softSummer = SHADOW_SEASON_PROTOTYPES.find(p => p.id === 'soft-summer')!.center
    const softAutumn = SHADOW_SEASON_PROTOTYPES.find(p => p.id === 'soft-autumn')!.center
    for (const d of dimensions) m[d].score = (softSummer[d] + softAutumn[d]) / 2
  }
  if (scenario === 'retake') m.features.skin.clippedFraction = 0.6
  const classification = classifyShadowSeason(m)
  return {
    hairColor: 'Dark Brown', hairColorHex: '#41322A', eyeColor: 'Brown', eyeColorHex: '#46372D',
    shadowMeasurements: m, shadowSeasonClassification: classification,
    analysis: buildSeasonAnalysis(m, classification),
  }
}

// Local vector illustration, deliberately labelled as a fixture in the preview.
export const FIXTURE_IMAGE = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect width="400" height="500" fill="#d6d8ce"/><path d="M60 500V400Q60 320 145 320H255Q340 320 340 400V500Z" fill="#6e85a3"/><path d="M155 290H245V350Q200 390 155 350Z" fill="#c09279"/><ellipse cx="200" cy="205" rx="100" ry="139" fill="#41322a"/><ellipse cx="200" cy="223" rx="77" ry="109" fill="#d6aa90"/><path d="M120 211Q110 65 207 78Q280 75 287 195Q240 120 200 127Q170 185 120 211Z" fill="#41322a"/><path d="M150 218h25m50 0h25" stroke="#41322a" stroke-width="6" stroke-linecap="round"/><path d="M180 278Q200 288 220 278" fill="none" stroke="#a66d62" stroke-width="5" stroke-linecap="round"/></svg>`)
