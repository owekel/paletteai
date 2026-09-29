import type { ShadowSeasonMeasurements } from './seasonMeasurements'
import type { ShadowSeasonClassification } from './shadowSeasonClassification'
import type { SeasonAnalysis } from './seasonAnalysis'

// These categories remain for general colour utility functions only.
export type Undertone = 'warm' | 'cool' | 'neutral'
export type Depth = 'light' | 'medium' | 'deep'
export type Contrast = 'low' | 'medium' | 'high'

export interface ColorProfile {
  hairColor: string
  hairColorHex: string
  eyeColor: string
  eyeColorHex: string
  analysis: SeasonAnalysis
  /** Historical field names retained for the existing developer diagnostics. */
  shadowMeasurements: ShadowSeasonMeasurements
  shadowSeasonClassification: ShadowSeasonClassification
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
