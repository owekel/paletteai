import type { ColorProfile } from './colorProfile'
import type { AnalysisQualityIssue } from './analysisQuality'

export type CaptureIssue = 'no-face' | 'multiple-faces' | 'closer' | 'back' | 'center' | 'pose' | 'visibility' | 'bright' | 'dark' | 'uneven' | 'mixed' | 'motion'
export interface CaptureRegion {
  name: string
  pixels: number
  usableFraction: number
  medianLuma: number
  linearLuma: number
  shadows: number
  highlights: number
  chromaticity: [number, number]
  chromaSpread: number
}
export interface CaptureMetrics {
  faceCount: number
  faceWidth: number
  faceHeight: number
  centerX: number
  centerY: number
  rollDegrees: number
  yawRatio: number
  noseEyeRatio: number
  regionsVisible: boolean
  landmarkPlausibility: number
  regions: CaptureRegion[]
  medianLuma: number
  shadows: number
  highlights: number
  cheekStops: number
  mixedChromaDistance: number
  mixedEvidence: boolean
  landmarkMotion: number
  pixelMotion: number
  motionKnown: boolean
  sharpness: number
}
export type CaptureSubscores = Record<'sharpness' | 'steadiness' | 'framing' | 'landmarks' | 'exposure' | 'lighting', number>
export interface CaptureQuality {
  metrics: CaptureMetrics
  blocker: CaptureIssue | null
  blockers: CaptureIssue[]
  score: number
  subscores: CaptureSubscores
}
export interface CaptureFrame {
  id: number
  timestamp: number
  image: string
  quality: CaptureQuality
}
export interface CaptureObservation {
  analyzer: 'loading' | 'ready' | 'unavailable'
  quality?: CaptureQuality
  frame?: CaptureFrame
}
export interface CaptureSource {
  sample(): Promise<CaptureObservation>
  capture(): string
  stop(): void
}
export interface CaptureRuntime {
  open(video: HTMLVideoElement, signal: AbortSignal): Promise<CaptureSource>
  verify(image: string, signal: AbortSignal): Promise<ColorProfile>
  /** Developer fixtures only, never set by the production runtime. */
  fixtureImage?: string
}
export interface CaptureSelection {
  method: 'auto' | 'manual'
  selectedId: number | null
  reason: string
  frames: { id: number; timestamp: number; score: number; subscores: CaptureSubscores }[]
  quality?: CaptureQuality
  bufferedCandidateCount?: number
  finalists?: CaptureFinalistDiagnostic[]
  selectionTimedOut?: boolean
}

export interface CaptureFinalistDiagnostic {
  id: number
  lightweightScore: number
  detailedScore: number | null
  durationMs: number
  passed: boolean
  skinConsistency: number | null
  maximumRegionalDeltaL: number | null
  regions: { name: string; lightness: number; pixels: number; reliability: number }[]
  subscores?: Record<keyof typeof import('../data/captureConfig').CAPTURE_CONFIG.finalists.weights, number>
  rejectionReasons: AnalysisQualityIssue[]
}
