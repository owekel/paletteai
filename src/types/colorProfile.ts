// Core types describing a person's estimated colour profile.
// Keeping these in one place means the analysis service, the palette
// generator, and every component all agree on the same shape of data.

export type Undertone = 'warm' | 'cool' | 'neutral'
export type Depth = 'light' | 'medium' | 'deep'
export type Contrast = 'low' | 'medium' | 'high'

// The four classic "colour seasons" used in personal colour analysis,
// each of which can carry a secondary qualifier (see seasonLabel below).
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export interface ColorProfile {
  undertone: Undertone
  depth: Depth
  contrast: Contrast

  hairColor: string // human-readable name, e.g. "Dark Brown"
  hairColorHex: string // sampled colour, e.g. "#3B2A20"

  eyeColor: string // human-readable name, e.g. "Hazel"
  eyeColorHex: string

  season: Season // primary season match
  secondarySeason?: Season // closest "runner up", when the read is a blend
  seasonLabel: string // display label, e.g. "Soft Autumn"
  seasonReasoning: string // 2-4 sentence, plain-language explanation

  confidence: number // 0 to 1 — how clear-cut the read was, not a "score"
  // Plain-language reasons the confidence is lower than ideal (e.g. "no face
  // detected", "very little hair was visible"). Empty when nothing stood out.
  analysisNotes: string[]
}

export interface ColorSwatchData {
  name: string
  hex: string
  description: string
}

export interface WardrobeColors {
  tshirts: ColorSwatchData[]
  dressShirts: ColorSwatchData[]
  hoodiesSweaters: ColorSwatchData[]
  jackets: ColorSwatchData[]
  pants: ColorSwatchData[]
  accessories: ColorSwatchData[]
}

export interface ColorPalette {
  best: ColorSwatchData[]
  neutrals: ColorSwatchData[]
  useCarefully: ColorSwatchData[]
  wardrobe: WardrobeColors
  staples: ColorSwatchData[]
}

export type MatchRating = 'Strong match' | 'Likely to work' | 'Neutral' | 'More challenging'

export interface ColorMatchResult {
  rating: MatchRating
  explanation: string
}

// The screens the app moves through, in order.
export type Screen = 'landing' | 'upload' | 'loading' | 'results'
