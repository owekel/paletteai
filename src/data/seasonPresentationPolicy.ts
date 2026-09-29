/** Provisional product presentation rules; these do not change v3 scores or the image gate. */
export const SEASON_PRESENTATION_POLICY = {
  version: 'results-v2',
  // A near tie should be shown as a group even with three reliable major dimensions.
  minimumLeadingAffinityRatio: 1.5,
  // Include every plausible neighbour, plus at least three for constrained results.
  candidateAffinityRatio: 0.5,
  minimumCandidates: 3,
} as const
