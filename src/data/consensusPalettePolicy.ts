/** Versioned styling heuristics, not new measurement/classifier thresholds. */
export const CONSENSUS_PALETTE_POLICY = {
  version: 'consensus-v1',
  similaritySigma: 0.065, // Euclidean OKLab; exact and nearby shades both contribute.
  matchingSimilarity: 0.45,
  minimumSupport: 0.2,
  supportWeight: 0.7,
  unresolvedTemperaturePenalty: 0.25,
  accentCount: 6,
  neutralCount: 3,
  minimumColourSeparation: 0.055,
  maximumCandidateGroupSize: 5,
  // These map an observed feature direction to a broad garment preference,
  // not an assertion that garment L/C must equal the person's feature L/C.
  garmentLightnessCenter: 0.62,
  garmentLightnessRange: 0.24,
  garmentChromaCenter: 0.11,
  garmentChromaRange: 0.07,
} as const
