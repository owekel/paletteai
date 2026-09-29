import type { ColorPalette, ColorSwatchData } from '../types/colorProfile'
import type { ShadowSeasonId } from '../types/shadowSeasonClassification'

type Colour = readonly [name: string, hex: string]

// Curated style starting points, version 1. Shared entries deliberately keep
// identical hex values: uncertain results use a real intersection, not an
// averaged colour or the first candidate's palette.
const C = {
  ivory: ['Soft Ivory', '#F6F1E4'],
  pearl: ['Pearl', '#F1F0EA'],
  stone: ['Stone', '#B5ADA0'],
  taupe: ['Soft Taupe', '#9C8C80'],
  navy: ['Soft Navy', '#38455E'],
  charcoal: ['Charcoal', '#34373D'],
  black: ['Ink Black', '#191B22'],
  white: ['Clear White', '#F8FAFC'],
  camel: ['Camel', '#C69C6D'],
  chocolate: ['Chocolate', '#5A3A22'],
  espresso: ['Espresso', '#382E2C'],
  silver: ['Silver Grey', '#BCC1C9'],
  peach: ['Peach', '#FFB48A'],
  apricot: ['Apricot', '#F4AB78'],
  coral: ['Coral', '#FF6F59'],
  aqua: ['Light Aqua', '#8BD3D0'],
  mint: ['Fresh Mint', '#A5D5B5'],
  butter: ['Butter Yellow', '#F3DC8C'],
  rose: ['Rose', '#D98CA0'],
  lavender: ['Lavender', '#B6A5D8'],
  powder: ['Powder Blue', '#A9C6E8'],
  periwinkle: ['Periwinkle', '#899ED1'],
  sage: ['Sage', '#8FA88C'],
  dustyTeal: ['Dusty Teal', '#5E9A96'],
  mauve: ['Mauve', '#A97C8E'],
  slate: ['Slate Blue', '#6E85A3'],
  dustyRose: ['Dusty Rose', '#BA8B8B'],
  eucalyptus: ['Eucalyptus', '#77958A'],
  raspberry: ['Raspberry', '#B94D70'],
  berry: ['Deep Berry', '#873C5A'],
  plum: ['Plum', '#694565'],
  teal: ['Deep Teal', '#1F5C56'],
  forest: ['Forest', '#2F5D3A'],
  olive: ['Olive', '#6B6B2E'],
  rust: ['Rust', '#B5502A'],
  terracotta: ['Terracotta', '#C1653C'],
  mustard: ['Mustard', '#C99A2E'],
  gold: ['Golden Yellow', '#F2C14E'],
  tomato: ['Tomato Red', '#E8543E'],
  grass: ['Leaf Green', '#6BA84F'],
  turquoise: ['Turquoise', '#2FB7A5'],
  emerald: ['Emerald', '#008B6D'],
  cobalt: ['Cobalt', '#2855BC'],
  royal: ['Royal Blue', '#354CC0'],
  fuchsia: ['Fuchsia', '#D33389'],
  violet: ['Violet', '#784CB0'],
  ruby: ['Ruby', '#B82746'],
  burgundy: ['Burgundy', '#612C40'],
  iceBlue: ['Ice Blue', '#D5EAF3'],
  icePink: ['Ice Pink', '#F4DCE9'],
} as const satisfies Record<string, Colour>

function swatch(colour: Colour, description: string): ColorSwatchData {
  return { name: colour[0], hex: colour[1], description }
}

export function assemblePalette(best: ColorSwatchData[], neutrals: ColorSwatchData[], useCarefully: ColorSwatchData[] = []): ColorPalette {
  const choose = (preferred: ColorSwatchData[]) =>
    [...new Map([...preferred, ...best, ...neutrals].map(c => [c.hex, c])).values()].slice(0, 4)
  return {
    best, neutrals, useCarefully,
    wardrobe: {
      tshirts: choose([...best.slice(0, 3), ...neutrals.slice(0, 1)]),
      dressShirts: choose([...neutrals.slice(0, 2), ...best.slice(1, 3)]),
      hoodiesSweaters: choose([...best.slice(2, 4), ...neutrals.slice(1, 3)]),
      jackets: choose([...neutrals.slice(1, 4), ...best.slice(3, 4)]),
      pants: choose(neutrals),
      accessories: choose(best),
    },
    staples: neutrals.length ? neutrals : best.slice(0, 3),
  }
}

function palette(best: Colour[], neutrals: Colour[], approach: string, caution: Colour[]): ColorPalette {
  return assemblePalette(
    best.map(c => swatch(c, approach)),
    neutrals.map(c => swatch(c, 'An everyday foundation for this palette.')),
    caution.map(c => swatch(c, 'Creates a stronger contrast with this palette. Try as an accent if you enjoy it.')),
  )
}

export const SEASON_PALETTES: Record<ShadowSeasonId, ColorPalette> = {
  'light-spring': palette(
    [C.peach, C.apricot, C.aqua, C.mint, C.butter, C.coral, C.periwinkle, C.rose],
    [C.ivory, C.stone, C.camel, C.taupe], 'Light, fresh colour with a gentle warm lean.', [C.black, C.burgundy]),
  'warm-spring': palette(
    [C.coral, C.apricot, C.gold, C.grass, C.turquoise, C.tomato, C.peach, C.mint],
    [C.ivory, C.camel, C.taupe, C.chocolate], 'Warm, lively colour with a clear finish.', [C.iceBlue, C.mauve]),
  'bright-spring': palette(
    [C.coral, C.turquoise, C.emerald, C.cobalt, C.fuchsia, C.gold, C.tomato, C.violet],
    [C.ivory, C.navy, C.charcoal, C.stone], 'Clear, vivid colour with warmth and definition.', [C.taupe, C.dustyRose]),
  'light-summer': palette(
    [C.powder, C.lavender, C.rose, C.aqua, C.periwinkle, C.mint, C.sage, C.dustyRose],
    [C.pearl, C.silver, C.stone, C.navy], 'Airy colour with soft, cool undertones.', [C.black, C.rust]),
  'cool-summer': palette(
    [C.rose, C.lavender, C.periwinkle, C.raspberry, C.slate, C.mauve, C.dustyTeal, C.berry],
    [C.pearl, C.silver, C.navy, C.charcoal], 'Cool colour with softly blended depth.', [C.tomato, C.mustard]),
  'soft-summer': palette(
    [C.sage, C.dustyTeal, C.mauve, C.slate, C.dustyRose, C.eucalyptus, C.lavender, C.berry],
    [C.pearl, C.stone, C.taupe, C.navy], 'Soft, greyed colour with a gentle cool lean.', [C.tomato, C.cobalt]),
  'soft-autumn': palette(
    [C.sage, C.dustyTeal, C.mauve, C.dustyRose, C.eucalyptus, C.terracotta, C.olive, C.apricot],
    [C.ivory, C.stone, C.taupe, C.navy], 'Muted, earthy colour with a gentle warm lean.', [C.fuchsia, C.iceBlue]),
  'warm-autumn': palette(
    [C.rust, C.olive, C.mustard, C.terracotta, C.forest, C.teal, C.gold, C.tomato],
    [C.ivory, C.camel, C.chocolate, C.taupe], 'Golden, earthy colour with warm richness.', [C.icePink, C.cobalt]),
  'deep-autumn': palette(
    [C.forest, C.teal, C.olive, C.rust, C.burgundy, C.terracotta, C.berry, C.mustard],
    [C.espresso, C.chocolate, C.navy, C.camel], 'Rich, deep colour with warm earthy accents.', [C.powder, C.icePink]),
  'deep-winter': palette(
    [C.burgundy, C.berry, C.plum, C.teal, C.emerald, C.ruby, C.cobalt, C.violet],
    [C.black, C.charcoal, C.navy, C.white], 'Deep, cool colour with clear definition.', [C.apricot, C.camel]),
  'cool-winter': palette(
    [C.ruby, C.fuchsia, C.royal, C.cobalt, C.violet, C.plum, C.iceBlue, C.icePink],
    [C.white, C.black, C.charcoal, C.silver], 'Cool, crisp colour with pronounced contrast.', [C.rust, C.gold]),
  'bright-winter': palette(
    [C.fuchsia, C.cobalt, C.emerald, C.violet, C.ruby, C.turquoise, C.iceBlue, C.icePink],
    [C.white, C.black, C.charcoal, C.navy], 'Clear, saturated colour with cool brilliance.', [C.taupe, C.terracotta]),
}

/** Exact intersection across ALL candidates. Never pad it with one season's colours. */
export function sharedSeasonPalette(ids: ShadowSeasonId[]): ColorPalette {
  if (!ids.length) return assemblePalette([], [])
  const palettes = [...new Set(ids)].map(id => SEASON_PALETTES[id])
  const shared = (key: 'best' | 'neutrals') => palettes[0][key]
    .filter(colour => palettes.every(p => p[key].some(c => c.hex === colour.hex)))
    .map(colour => ({ ...colour, description: 'Included in every palette in your current season group.' }))
    .sort((a, b) => a.name.localeCompare(b.name))
  return assemblePalette(shared('best'), shared('neutrals'))
}
