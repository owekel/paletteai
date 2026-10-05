/** Provisional, interpretable policies, not learned confidence intervals. */
export const PRECISION_CONFIG = {
  version: 'precision-v1',
  captures: 3,
  thirdCaptureFailuresBeforeFallback: 2,
  thirdCaptureWaitBeforeFallbackMs: 20000,
  aggregation: { residualFloor: 0.08, agreementBonus: 0.12, disagreementScale: 0.3, twoPhotoPenalty: 0.92 },
  sensitivity: { rangeFloor: 0.04, spreadMultiplier: 1.5, stableLeader: 0.85,
    groupCoverage: 0.9, maximumGroupSize: 3, maximumNeighbourDistance: 0.6 },
} as const
