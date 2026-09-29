import { assemblePalette, SEASON_PALETTES, sharedSeasonPalette } from '../data/palettes'
import { SEASON_PRESENTATION_POLICY as policy } from '../data/seasonPresentationPolicy'
import type { SeasonAnalysis, ProfileDimension } from '../types/seasonAnalysis'
import type { ShadowSeasonMeasurements } from '../types/seasonMeasurements'
import type { ShadowSeasonClassification, ShadowSeasonDimension } from '../types/shadowSeasonClassification'
import { assessAnalysisQuality } from './analysisQualityGate'

const LABELS: Record<ShadowSeasonDimension, string> = {
  temperature: 'Undertone', value: 'Depth', chroma: 'Colour intensity', contrast: 'Contrast',
}
const UNRESOLVED: Record<ShadowSeasonDimension, string> = {
  temperature: 'warm or cool undertone', value: 'light or deep colouring',
  chroma: 'soft or bright colouring', contrast: 'contrast between your features',
}

function describe(id: ShadowSeasonDimension, score: number): [string, string] {
  if (id === 'temperature') return score <= -0.3
    ? ['Cool leaning', 'Your colouring leans towards cooler tones.']
    : score >= 0.3 ? ['Warm leaning', 'Your colouring leans towards warmer tones.']
      : ['Balanced', 'Your colouring has a gentle balance of warm and cool.']
  if (id === 'value') return score <= -0.35
    ? ['Deep', 'Your features carry richer, deeper tones.']
    : score >= 0.35 ? ['Light', 'Your features read light and delicate.']
      : ['Medium depth', 'Your colouring sits between light and deep.']
  if (id === 'chroma') return score <= -0.35
    ? ['Soft', 'Your colours have a softly blended quality.']
    : score >= 0.35 ? ['Clear', 'Your colours have a clear, vivid quality.']
      : ['Gently clear', 'Your colouring sits between muted and bright.']
  return score <= 0.33 ? ['Low contrast', 'Your skin, hair and eyes are close in depth.']
    : score >= 0.67 ? ['High contrast', 'Your features have pronounced differences in depth.']
      : ['Moderate contrast', 'Your features show a moderate difference in depth.']
}

/** One presentation model for the hero, palettes, colour checker and try-on. */
export function buildSeasonAnalysis(
  measurements: ShadowSeasonMeasurements,
  classification: ShadowSeasonClassification,
): SeasonAnalysis {
  const quality = assessAnalysisQuality(measurements, classification)
  const dimensions: ProfileDimension[] = (Object.keys(LABELS) as ShadowSeasonDimension[]).map(id => {
    const resolved = quality.measurementReliability.dimensions[id].sufficientlyReliable
    const [value, description] = describe(id, measurements[id].score)
    return { id, label: LABELS[id], resolved, value: resolved ? value : 'Still open',
      description: resolved ? description : id === 'contrast'
        ? 'This photo does not settle the contrast between your features.'
        : `This photo does not settle your ${UNRESOLVED[id]}.` }
  })
  const unresolved = dimensions.filter(d => !d.resolved).map(d => UNRESOLVED[d.id])
  const [top, runner] = classification.rankings
  const ratio = runner.affinityProbability > 0 ? top.affinityProbability / runner.affinityProbability : 1
  const hasMajorEvidence = quality.measurementReliability.reliableMajorDimensions.length > 0
  const separated = ratio >= policy.minimumLeadingAffinityRatio
  const status = quality.imageQuality.status === 'retake-required' ? 'retake-required'
    : quality.canPresentSpecificSeason && separated ? 'specific' : 'constrained'
  const candidates = status === 'retake-required' ? [] : status === 'specific' ? [top]
    : !hasMajorEvidence ? []
      : classification.rankings.filter((c, i) =>
        i < policy.minimumCandidates || c.affinityProbability >= top.affinityProbability * policy.candidateAffinityRatio)
  const reliableDescription = dimensions.filter(d => d.resolved).map(d => d.value.toLowerCase()).join(' · ')
  const qualities = dimensions.filter(d => d.resolved).map(d =>
    d.id === 'chroma' ? `${d.value.toLowerCase()} colour intensity` : d.value.toLowerCase())
  const qualityList = qualities.length > 1
    ? `${qualities.slice(0, -1).join(', ')} and ${qualities[qualities.length - 1]}` : qualities[0]
  const title = status === 'specific' ? top.label : reliableDescription || 'Room to explore'
  const summary = status === 'specific'
    ? `Your mix of ${qualityList} puts your colouring closest to ${top.label}. Explore the palette below as a starting point for your style.`
    : !hasMajorEvidence
      ? 'Your photo is usable, but it leaves several colour directions open. Explore colours on your photo without committing to a season. You do not need to keep retaking it.'
      : unresolved.length
        ? 'Some qualities of your colouring are clear, while others are still open. Start with the colours your possible seasons share.'
        : 'Your colouring sits close to more than one season. Explore their shared colours first; a single label would be too narrow.'
  const palette = status === 'specific' ? SEASON_PALETTES[top.id]
    : status === 'constrained' ? sharedSeasonPalette(candidates.map(c => c.id)) : assemblePalette([], [])
  const hasColours = palette.best.length + palette.neutrals.length > 0
  const paletteMode = status === 'specific' ? 'season' : hasColours ? 'shared' : 'explore'
  return {
    status, quality, title, summary, dimensions, candidates, unresolved, palette, paletteMode,
    runnerUp: status === 'specific' ? runner : undefined,
    paletteDescription: paletteMode === 'season'
      ? `A curated ${top.label} palette, from expressive accents to everyday neutrals.`
      : paletteMode === 'shared'
        ? 'Every shade below appears in all of your possible season palettes. A smaller selection keeps the recommendations grounded in what they share.'
        : 'There is no shared colour selection to recommend yet. The custom colour preview is here to help you explore freely.',
    decision: {
      reason: status === 'retake-required' ? 'technical-image-failure'
        : status === 'specific' ? 'reliable-major-dimensions-and-separated-leader'
          : !hasMajorEvidence ? 'insufficient-major-dimension-evidence'
            : !quality.canPresentSpecificSeason ? 'unresolved-major-dimensions' : 'close-prototype-tie',
      topToRunnerAffinityRatio: ratio, policyVersion: policy.version,
    },
  }
}
