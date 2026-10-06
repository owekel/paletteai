/** Provisional, interpretable policies, not learned confidence intervals. */
export const PRECISION_CONFIG = {
  version: 'precision-v1',
  captures: 3,
  thirdCaptureFailuresBeforeFallback: 2,
  thirdCaptureWaitBeforeFallbackMs: 20000,
  aggregation: { residualFloor: 0.08, agreementBonus: 0.12, disagreementScale: 0.3, twoPhotoPenalty: 0.92 },
  sensitivity: {
    version: 'precision-sensitivity-v2', samples: 512, seed: 0x50524149,
    // Provisional error prior relative to median prototype neighbour distance.
    // Replace with repeat-photo calibration data when available.
    measurementResolutionFraction: 0.25, sharedMeasurementVarianceFraction: 0.35,
    intervalTail: 0.05, supportedBandShare: 0.7,
    stableLeader: 0.65, minimumLeaderMargin: 0.15, strongLeader: 0.85,
    groupCoverage: 0.9, maximumGroupSize: 3, maximumNeighbourDistance: 0.6,
  },
} as const
