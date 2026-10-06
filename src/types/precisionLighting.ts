import type { LightingDiagnostics, SkinDiagnostics } from './seasonMeasurements'

export type SessionLightingCause = 'mixed-lighting' | 'uneven-illumination' | 'exposure-clipping'
export interface PrecisionLightingCapture {
  capture: number
  signals: {
    lighting: LightingDiagnostics
    maximumRegionalDeltaL: number | null
    skinConsistency: number
    skinLikelyCause: SkinDiagnostics['likelyCause']
    usableSkinRegions: number
    skinClippedFraction: number
    exposureReliability: number
    clippingScore: number
    skinExposurePlausibility: number
  }
  risks: Record<SessionLightingCause, number>
  risk: number
  affected: boolean
  reasons: string[]
}
export interface PrecisionSessionLighting {
  version: 'precision-lighting-v1'
  status: 'suitable' | 'reacquire-required'
  captures: PrecisionLightingCapture[]
  affectedCaptures: number[]
  requiredAffectedCaptures: number
  meanRisk: number
  medianRisk: number
  recurringCauses: SessionLightingCause[]
  reason: string
  guidance: string | null
}
