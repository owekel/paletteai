import { assemblePalette, SEASON_PALETTES } from '../data/palettes'
import { SEASON_PRESENTATION_POLICY as policy } from '../data/seasonPresentationPolicy'
import { CONSENSUS_PALETTE_POLICY } from '../data/consensusPalettePolicy'
import { buildConsensusPalette, dimensionRecommendation } from './consensusPalette'
import type { SeasonAnalysis, ProfileDimension } from '../types/seasonAnalysis'
import type { ShadowSeasonMeasurements } from '../types/seasonMeasurements'
import type { ShadowSeasonClassification, ShadowSeasonDimension } from '../types/shadowSeasonClassification'
import { assessAnalysisQuality } from './analysisQualityGate'
import type { SeasonSensitivity } from '../types/precision'

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
  sensitivity?: SeasonSensitivity,
): SeasonAnalysis {
  const quality = assessAnalysisQuality(measurements, classification)
  if (sensitivity && quality.imageQuality.status === 'usable') {
    quality.canPresentSpecificSeason = sensitivity.state === 'specific'
    quality.status = sensitivity.state === 'specific' ? 'full' : 'constrained'
    quality.classificationCertainty = { status: sensitivity.state === 'specific' ? 'full' : sensitivity.state === 'candidate-group' ? 'constrained' : 'indeterminate',
      broadProfileDescription: 'Precision analysis: plausible-range sensitivity',
      candidateSeasonLabels: sensitivity.wins.filter(w => sensitivity.candidateIds.includes(w.id)).map(w => w.label) }
  }
  const dimensions: ProfileDimension[] = (Object.keys(LABELS) as ShadowSeasonDimension[]).map(id => {
    const resolved = sensitivity ? sensitivity.supportedDimensions.includes(id) : quality.measurementReliability.dimensions[id].sufficientlyReliable
    const [value, description] = describe(id, measurements[id].score)
    return { id, label: LABELS[id], resolved, value: resolved ? value : 'Still open',
      recommendation: resolved ? dimensionRecommendation(id, measurements[id].score) : undefined,
      description: resolved ? description : id === 'contrast'
        ? 'This photo does not settle the contrast between your features.'
        : `This photo does not settle your ${UNRESOLVED[id]}.` }
  })
  const unresolved = dimensions.filter(d => !d.resolved).map(d => UNRESOLVED[d.id])
  const ordered = sensitivity ? sensitivity.wins.map(w => classification.rankings.find(c => c.id === w.id)!) : classification.rankings
  const top = ordered[0]
  const runner = sensitivity && sensitivity.wins[1].share === 0
    ? classification.rankings.find(c => c.id !== top.id)! : ordered[1]
  const ratio = runner.affinityProbability > 0 ? top.affinityProbability / runner.affinityProbability : 1
  const hasMajorEvidence = dimensions.some(d => d.resolved && d.id !== 'contrast')
  const separated = ratio >= policy.minimumLeadingAffinityRatio
  const status = quality.imageQuality.status === 'retake-required' ? 'retake-required'
    : quality.canPresentSpecificSeason && (sensitivity || separated) ? 'specific' : 'constrained'
  const potentialCandidates = status === 'retake-required' ? [] : status === 'specific' ? [top]
    : sensitivity ? ordered.filter(c => sensitivity.candidateIds.includes(c.id))
    : !hasMajorEvidence ? []
      : classification.rankings.filter((c, i) =>
        i < policy.minimumCandidates || c.affinityProbability >= top.affinityProbability * policy.candidateAffinityRatio)
  const reliableDimensions = dimensions.filter(d => d.resolved)
  const resultKind = status === 'retake-required' ? 'retake-required' : status === 'specific' ? 'specific'
    : potentialCandidates.length > 0 && potentialCandidates.length <= CONSENSUS_PALETTE_POLICY.maximumCandidateGroupSize
      ? 'candidate-group' : 'broad-profile'
  const candidates = resultKind === 'broad-profile' ? [] : potentialCandidates
  const reliableDescription = [...reliableDimensions]
    .sort((a, b) => measurements[b.id].reliability - measurements[a.id].reliability)
    .map(d => d.value.toLowerCase()).join(' · ')
  const qualities = dimensions.filter(d => d.resolved).map(d =>
    d.id === 'chroma' ? `${d.value.toLowerCase()} colour intensity` : d.value.toLowerCase())
  const qualityList = qualities.length > 1
    ? `${qualities.slice(0, -1).join(', ')} and ${qualities[qualities.length - 1]}` : qualities[0]
  const title = status === 'specific' ? top.label : reliableDescription || 'Find your starting colours'
  const summary = status === 'specific'
    ? `Your mix of ${qualityList} puts your colouring closest to ${top.label}. Explore the palette below as a starting point for your style.`
    : reliableDimensions.length === 0
      ? 'Your photo is ready for colour comparisons. Start with a few everyday shades, then explore warmth, depth and intensity on your photo. This starting set is for discovery, rather than a personal season recommendation.'
      : resultKind === 'broad-profile'
        ? 'These qualities give you a useful starting direction, even without a season label. Begin with the colours below and use the comparisons to explore the details.'
        : 'Your colouring has something in common with several seasons. Start with colours that have the strongest support across those palettes, then compare the finer differences on your photo.'
  const consensus = status === 'constrained' ? buildConsensusPalette(measurements,
    candidates.length ? candidates : reliableDimensions.length === 0 ? [] : classification.rankings,
    reliableDimensions.map(d => d.id)) : undefined
  const palette = status === 'specific' ? SEASON_PALETTES[top.id] : consensus?.palette ?? assemblePalette([], [])
  const paletteMode = status === 'specific' ? 'season' : reliableDimensions.length > 0 || candidates.length > 0 ? 'consensus' : 'starter'
  return {
    status, resultKind, quality, title, summary, dimensions, candidates, unresolved, palette, paletteMode,
    recommendations: consensus?.recommendations,
    runnerUp: status === 'specific' ? runner : undefined,
    paletteDescription: paletteMode === 'season'
      ? `A curated ${top.label} palette, from expressive accents to everyday neutrals.`
      : paletteMode === 'consensus'
        ? 'A considered mix of shades found in—or close to—several possible palettes, guided by the qualities your photo supports. You do not need to settle on a season to start here.'
        : 'A balanced set of everyday shades drawn from several palettes. Try them as reference points; the photo has not established a personal colour direction yet.',
    decision: {
      reason: status === 'retake-required' ? 'technical-image-failure'
        : sensitivity ? `precision-sensitivity-${sensitivity.state}`
        : status === 'specific' ? 'reliable-major-dimensions-and-separated-leader'
          : !hasMajorEvidence ? 'insufficient-major-dimension-evidence'
            : !quality.canPresentSpecificSeason ? 'unresolved-major-dimensions' : 'close-prototype-tie',
      topToRunnerAffinityRatio: ratio, policyVersion: policy.version,
    },
  }
}
