/** Conservative capture policy, not colour calibration or a learned probability. */
export const PRECISION_LIGHTING_CONFIG = {
  version: 'precision-lighting-v1',
  minimumBackgroundCandidates: 120,
  spatial: { warning: 0.035, severe: 0.07 },
  normalization: { weak: 0.45, veryWeak: 0.1 },
  candidateConsistency: { weak: 0.7, veryWeak: 0.35 },
  regional: { warning: 0.06, severe: 0.14 },
  consistency: { weak: 0.65, veryWeak: 0.15 },
  clipping: { warning: 0.08, severe: 0.3 },
  exposure: { weak: 0.6, veryWeak: 0.2 },
  captureRisk: 0.6,
  minimumAffectedFraction: 2 / 3,
} as const
