import { SEASON_PALETTES, assemblePalette } from '../data/palettes'
import { CONSENSUS_PALETTE_POLICY as policy } from '../data/consensusPalettePolicy'
import { SHADOW_SEASON_PROTOTYPES } from '../data/shadowSeasonCalibration'
import { TEMPERATURE_COMPARISONS, INTENSITY_COMPARISON, DEPTH_COMPARISON, CONTRAST_COMPARISON } from '../data/colourComparisons'
import { hexToRgb } from './colorUtils'
import { rgbToOklab, oklabToOklch, type OKLab } from './oklab'
import type { ShadowSeasonMeasurements } from '../types/seasonMeasurements'
import type { ShadowSeasonCandidateScore, ShadowSeasonDimension } from '../types/shadowSeasonClassification'
import type { ColourRecommendations, ConsensusColourEvidence, ColourComparison } from '../types/seasonAnalysis'
import type { ColorSwatchData } from '../types/colorProfile'

const DIMENSIONS: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma', 'contrast']
const lab = (hex: string) => rgbToOklab(hexToRgb(hex))
const distance = (a: OKLab, b: OKLab) => Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b)
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const seasonEntries = SHADOW_SEASON_PROTOTYPES.map(p => ({
  id: p.id, warm: p.center.temperature > 0,
  colours: [...SEASON_PALETTES[p.id].best, ...SEASON_PALETTES[p.id].neutrals].map(c => lab(c.hex)),
}))
const neutralHexes = new Set(Object.values(SEASON_PALETTES).flatMap(p => p.neutrals.map(c => c.hex)))
const catalogue = [...new Map(Object.values(SEASON_PALETTES).flatMap(p => [...p.best, ...p.neutrals]).map(c => [c.hex, c])).values()]
  .map(swatch => ({ swatch, lab: lab(swatch.hex), neutral: neutralHexes.has(swatch.hex) }))

/** One vote per season: palettes with more similar swatches cannot vote twice. */
export function paletteSimilarity(hex: string, colours: ColorSwatchData[]): number {
  const colour = lab(hex)
  return colours.length ? Math.max(...colours.map(c => Math.exp(-0.5 * (distance(colour, lab(c.hex)) / policy.similaritySigma) ** 2))) : 0
}

/** Only sufficiently reliable dimensions create personalized styling advice. */
export function dimensionRecommendation(id: ShadowSeasonDimension, score: number): string {
  if (id === 'value') return score <= -0.35 ? 'Start with richer, deeper shades; use pale colours as accents.'
    : score >= 0.35 ? 'Start with lighter shades and gentle neutrals rather than very dark blocks of colour.'
      : 'Favour medium-depth shades before very pale or very dark colours.'
  if (id === 'chroma') return score <= -0.35 ? 'Choose softened colours before very vivid, highly saturated shades.'
    : score >= 0.35 ? 'Try clear colours with some brightness rather than heavily greyed shades.'
      : 'Start with moderate colour intensity, between dusty and very vivid.'
  if (id === 'contrast') return score <= 0.33 ? 'Keep neighbouring pieces close in depth for a harmonious, lower-contrast outfit.'
    : score >= 0.67 ? 'Try distinct light and dark pieces together for definition.'
      : 'Try a moderate difference in depth between your top and other pieces.'
  return score <= -0.3 ? 'Begin with cooler colour directions.' : score >= 0.3 ? 'Begin with warmer colour directions.'
    : 'Explore both gently warm and gently cool shades; neither needs to dominate.'
}

function makeComparisons(m: ShadowSeasonMeasurements, reliable: Set<ShadowSeasonDimension>): ColourComparison[] {
  const comparisons: ColourComparison[] = []
  if (!reliable.has('temperature')) {
    const desiredL = reliable.has('value') ? policy.garmentLightnessCenter + policy.garmentLightnessRange * m.value.score : 0.65
    const desiredC = reliable.has('chroma') ? policy.garmentChromaCenter + policy.garmentChromaRange * m.chroma.score : 0.08
    const pairs = TEMPERATURE_COMPARISONS.map(pair => {
      const labs = pair.options.map(c => oklabToOklch(lab(c.hex)))
      return { pair, error: Math.abs((labs[0].l + labs[1].l) / 2 - desiredL) + 2 * Math.abs((labs[0].c + labs[1].c) / 2 - desiredC) }
    }).sort((a, b) => a.error - b.error)
    comparisons.push(pairs[0].pair)
  }
  if (!reliable.has('chroma')) comparisons.push(INTENSITY_COMPARISON)
  if (!reliable.has('value')) comparisons.push(DEPTH_COMPARISON)
  else if (!reliable.has('contrast')) comparisons.push(CONTRAST_COMPARISON)
  return comparisons
}

/** Weighted, perceptual consensus. The classifier and its probabilities stay untouched. */
export function buildConsensusPalette(
  m: ShadowSeasonMeasurements,
  candidates: ShadowSeasonCandidateScore[],
  reliableDimensions: ShadowSeasonDimension[],
) {
  const reliable = new Set(reliableDimensions)
  const personalized = reliable.size > 0
  const weightTotal = candidates.reduce((s, c) => s + c.probability, 0)
  const weights = seasonEntries.map(s => ({ id: s.id, weight: weightTotal > 0
    ? (candidates.find(c => c.id === s.id)?.probability ?? 0) / weightTotal : 1 / seasonEntries.length }))
  const activeWeights = weights.filter(w => w.weight > 0)
  const evidence = catalogue.map(colour => {
    const similarities = seasonEntries.map(season => ({ ...season,
      similarity: Math.max(...season.colours.map(c => Math.exp(-0.5 * (distance(colour.lab, c) / policy.similaritySigma) ** 2))),
    }))
    const support = similarities.reduce((sum, s) => sum + s.similarity * (weights.find(w => w.id === s.id)?.weight ?? 0), 0)
    const warm = similarities.filter(s => s.warm).reduce((sum, s) => sum + s.similarity, 0)
    const cool = similarities.filter(s => !s.warm).reduce((sum, s) => sum + s.similarity, 0)
    // Dependence comes from the full palette catalogue, not the current top
    // candidate's temperature. Balanced/near-neutral choices get no penalty.
    const temperatureLean = (warm - cool) / (warm + cool || 1)
    const temperatureDependence = Math.abs(temperatureLean)
    const chroma = oklabToOklch(colour.lab).c
    let fit = 0
    let fitWeight = 0
    const addFit = (id: ShadowSeasonDimension, value: number) => {
      if (!reliable.has(id)) return
      const weight = m[id].reliability
      fit += weight * clamp(value)
      fitWeight += weight
    }
    const valueTarget = policy.garmentLightnessCenter + policy.garmentLightnessRange * m.value.score
    const chromaTarget = policy.garmentChromaCenter + policy.garmentChromaRange * m.chroma.score
    addFit('value', Math.exp(-0.5 * ((colour.lab.l - valueTarget) / 0.23) ** 2))
    // Neutrals serve as foundations even for a clear/bright profile.
    if (!colour.neutral) addFit('chroma', Math.exp(-0.5 * ((chroma - chromaTarget) / 0.07) ** 2))
    addFit('temperature', 1 - Math.max(0, -m.temperature.score * temperatureLean))
    const dimensionFit = fitWeight > 0 ? fit / fitWeight : 1
    const temperaturePenalty = reliable.has('temperature') ? 1 : 1 - policy.unresolvedTemperaturePenalty * temperatureDependence
    const score = support * (policy.supportWeight + (1 - policy.supportWeight) * dimensionFit) * temperaturePenalty
    const diagnostic: ConsensusColourEvidence = {
      hex: colour.swatch.hex, support, temperatureDependence, dimensionFit, score,
      matchingSeasons: similarities.filter(s => s.similarity >= policy.matchingSimilarity && weights.some(w => w.id === s.id && w.weight > 0)).map(s => s.id),
    }
    return { ...colour, ...diagnostic }
  }).sort((a, b) => b.score - a.score || a.hex.localeCompare(b.hex))

  // Greedy selection removes near-duplicate shades instead of concatenating
  // palettes. Contrast supports a useful tonal spread across the selection.
  const choose = (neutral: boolean, count: number, anchor?: number) => {
    const pool = evidence.filter(c => c.neutral === neutral && c.support >= policy.minimumSupport)
    const selected: typeof pool = []
    while (selected.length < count) {
      const ranked = pool.filter(c => !selected.includes(c) && selected.every(s => distance(s.lab, c.lab) >= policy.minimumColourSeparation))
        .map(c => {
          const referenceL = anchor ?? selected[0]?.lab.l
          let contrastFit = 1
          if (referenceL !== undefined && reliable.has('contrast')) {
            const gap = Math.abs(c.lab.l - referenceL)
            contrastFit = m.contrast.score <= 0.33 ? 1 - 0.55 * clamp((gap - 0.12) / 0.25)
              : m.contrast.score >= 0.67 ? 0.8 + 0.2 * clamp(gap / 0.4) : 1
          }
          return { colour: c, rank: c.score * contrastFit }
        }).sort((a, b) => b.rank - a.rank || a.colour.hex.localeCompare(b.colour.hex))
      if (!ranked.length) break
      selected.push(ranked[0].colour)
    }
    return selected
  }
  const accents = choose(false, policy.accentCount)
  const neutrals = choose(true, policy.neutralCount, accents[0]?.lab.l)
  const toSwatch = (c: typeof evidence[number]): ColorSwatchData => ({ ...c.swatch,
    description: !personalized ? 'An everyday shade to compare, not a personal colour verdict.'
      : c.matchingSeasons.length >= 2 ? 'Supported by similar shades across several possible palettes.'
        : 'A starting option alongside the qualities your photo supports.',
  })
  const palette = assemblePalette(accents.map(toSwatch), neutrals.map(toSwatch))
  const lessSupported: ColourRecommendations['lessSupported'] = []
  if (reliable.has('chroma') && Math.abs(m.chroma.score) >= 0.35) lessSupported.push({
    dimension: 'chroma', title: m.chroma.score < 0 ? 'Very vivid colour' : 'Heavily greyed colour',
    description: m.chroma.score < 0 ? 'Your softer colour intensity gives more support to muted shades. Keep very saturated colours as a comparison option.'
      : 'Your clearer colour intensity gives more support to clean, vivid shades.',
  })
  if (reliable.has('value')) lessSupported.push({ dimension: 'value',
    title: m.value.score < -0.35 ? 'Very pale outfits' : m.value.score > 0.35 ? 'Very dark outfits' : 'Extreme light or dark',
    description: `${dimensionRecommendation('value', m.value.score)} Other depths remain options for accents.`,
  })
  if (reliable.has('contrast') && m.contrast.score <= 0.33) lessSupported.push({ dimension: 'contrast',
    title: 'Stark light–dark blocks', description: 'A gentler difference between neighbouring pieces has more support from your contrast measurement.',
  })
  const recommendations: ColourRecommendations = {
    personalized, comparisons: makeComparisons(m, reliable), lessSupported,
    diagnostics: { version: policy.version, candidateWeights: activeWeights,
      reliableDimensions: DIMENSIONS.filter(d => reliable.has(d)),
      colours: [...accents, ...neutrals].map(({ hex, support, matchingSeasons, dimensionFit, temperatureDependence, score }) =>
        ({ hex, support, matchingSeasons, dimensionFit, temperatureDependence, score })),
    },
  }
  if (reliable.has('contrast') && palette.best.length && palette.neutrals.length) {
    const targetGap = m.contrast.score <= 0.33 ? 0.06 : m.contrast.score >= 0.67 ? 0.35 : 0.18
    const pairs = palette.best.flatMap(a => palette.neutrals.map(b => ({
      a, b, error: Math.abs(Math.abs(lab(a.hex).l - lab(b.hex).l) - targetGap),
    }))).sort((a, b) => a.error - b.error)
    const best = pairs[0]
    recommendations.outfit = {
      title: m.contrast.score <= 0.33 ? 'Keep the outfit softly connected' : m.contrast.score >= 0.67 ? 'Give the outfit definition' : 'Add a little definition',
      description: `Try ${best.a.name} with ${best.b.name}. ${dimensionRecommendation('contrast', m.contrast.score)}`,
      colours: [best.a, best.b],
    }
  }
  return { palette, recommendations }
}
