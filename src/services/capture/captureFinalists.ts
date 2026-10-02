import { CAPTURE_CONFIG as C } from '../../data/captureConfig'
import type { CaptureFrame, CaptureFinalistDiagnostic, CaptureRuntime, CaptureSelection } from '../../types/capture'
import type { ColorProfile } from '../../types/colorProfile'
import type { AnalysisQualityIssue, ImageQualityAssessment } from '../../types/analysisQuality'
import type { ShadowSeasonMeasurements } from '../../types/seasonMeasurements'

/** Deliberately excludes colour dimensions, season rankings and classifier confidence. */
export interface CapturePhotoEvidence {
  imageQuality: ImageQualityAssessment
  skin: ShadowSeasonMeasurements['skinDiagnostics']
  features: ShadowSeasonMeasurements['features']
  exposure: Pick<ShadowSeasonMeasurements['stabilityDiagnostics']['exposure'], 'reliability'>
  lighting: ShadowSeasonMeasurements['lighting']
}
export function capturePhotoEvidence(profile: ColorProfile): CapturePhotoEvidence {
  const m = profile.shadowMeasurements
  return { imageQuality: profile.analysis.quality.imageQuality, skin: m.skinDiagnostics,
    features: m.features, exposure: { reliability: m.stabilityDiagnostics.exposure.reliability }, lighting: m.lighting }
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const visibilityIssue: AnalysisQualityIssue = { code: 'capture-regions-unusable', title: 'Let your face show',
  guidance: 'Keep your forehead and both cheeks visible, clear of hair, glare and heavy shadows.' }
const lightingIssue: AnalysisQualityIssue = { code: 'capture-regional-lighting', title: 'Lighting is uneven',
  guidance: 'Face a broad, soft light so your forehead and both cheeks receive similar light.' }
const verificationIssue: AnalysisQualityIssue = { code: 'capture-check-unavailable', title: 'We couldn’t check this set of photos',
  guidance: 'Hold still for another moment, or use the shutter to take a photo yourself.' }

export function evaluateCaptureFinalist(frame: CaptureFrame, e: CapturePhotoEvidence): CaptureFinalistDiagnostic {
  const config = C.finalists
  const required = ['forehead', 'leftCheek', 'rightCheek']
  const regions = e.skin.regions.filter(r => required.includes(r.name))
  const usable = regions.filter(r => r.usedLandmarkPolygon && r.retainedPixelCount >= config.minimumRegionPixels
    && r.reliability >= config.minimumRegionReliability && Number.isFinite(r.representative.l))
  // Recompute across the three representatives to explicitly include forehead↔cheek.
  const levels = usable.map(r => r.representative.l)
  const delta = levels.length > 1 ? Math.max(...levels) - Math.min(...levels) : null
  const rejectionReasons = [...e.imageQuality.issues]
  if (new Set(usable.map(r => r.name)).size !== 3) rejectionReasons.push(visibilityIssue)
  const poorLightingConsistency = e.skin.likelyCause === 'uneven-lighting'
    && e.skin.consistencyScore < config.poorSkinConsistency
    && delta !== null && delta > config.inconsistentLightingDeltaL
  if (delta !== null && delta > config.maximumRegionalDeltaL || poorLightingConsistency) rejectionReasons.push(lightingIssue)
  if (e.imageQuality.status !== 'usable' && !rejectionReasons.length) rejectionReasons.push(verificationIssue)
  const skinRetention = regions.reduce((sum, r) => sum + r.retainedPixelCount, 0)
    / Math.max(1, regions.reduce((sum, r) => sum + r.sourcePixelCount, 0))
  const hair = clamp(e.features.hair.sampleSize / 100) * clamp(e.features.hair.reliability / 0.5)
  const eyes = clamp(e.features.eyes.sampleSize / 12) * clamp(e.features.eyes.reliability / 0.5)
  const m = frame.quality.metrics, g = C.geometry
  const subscores = {
    lighting: delta === null ? 0 : clamp(1 - (delta - config.goodRegionalDeltaL) / (config.maximumRegionalDeltaL - config.goodRegionalDeltaL)),
    skinConsistency: clamp(e.skin.consistencyScore),
    exposure: 0.7 * clamp(1 - e.features.skin.clippedFraction / 0.25) + 0.3 * clamp(e.exposure.reliability),
    sampling: 0.7 * clamp(usable.length / 3) * clamp(skinRetention) + 0.3 * Math.max(hair, eyes),
    mixedLighting: e.lighting.mixedLightingSuspected ? clamp(1 - (e.lighting.spatialDisagreement ?? 0.04) / 0.08) : 1,
    sharpness: frame.quality.subscores.sharpness,
    steadiness: frame.quality.subscores.steadiness,
    framing: frame.quality.subscores.framing,
    pose: clamp(1 - Math.max(Math.abs(m.rollDegrees) / g.maxRollDegrees, m.yawRatio / g.maxYawRatio)),
    landmarks: frame.quality.subscores.landmarks,
  }
  const detailedScore = (Object.keys(config.weights) as (keyof typeof config.weights)[])
    .reduce((sum, key) => sum + subscores[key] * config.weights[key], 0)
  return { id: frame.id, lightweightScore: frame.quality.score, detailedScore, durationMs: 0,
    passed: rejectionReasons.length === 0, skinConsistency: e.skin.consistencyScore, maximumRegionalDeltaL: delta,
    regions: regions.map(r => ({ name: r.name, lightness: r.representative.l, pixels: r.retainedPixelCount, reliability: r.reliability })),
    subscores, rejectionReasons }
}

export interface CaptureFinalistResult {
  selection: CaptureSelection
  winner?: { frame: CaptureFrame; profile: ColorProfile }
  problem?: AnalysisQualityIssue
}

/** Serial full checks reuse cached models. Only the winning profile is retained;
 * it proceeds straight to review, without a second analysis of that image. */
export async function chooseCaptureFinalists(
  candidates: CaptureFrame[], verify: CaptureRuntime['verify'], signal: AbortSignal,
  onProgress?: (selection: CaptureSelection) => void,
): Promise<CaptureFinalistResult> {
  const ranked = [...candidates].filter(f => !f.quality.blocker)
    .sort((a, b) => b.quality.score - a.quality.score || b.timestamp - a.timestamp)
    .slice(0, C.bufferFrames)
  const selection: CaptureSelection = { method: 'auto', selectedId: null, bufferedCandidateCount: ranked.length,
    frames: ranked.map(f => ({ id: f.id, timestamp: f.timestamp, score: f.quality.score, subscores: f.quality.subscores })),
    finalists: [], reason: 'Comparing the top recent frames using technical photo quality.' }
  let winner: CaptureFinalistResult['winner'], best: CaptureFinalistDiagnostic | undefined
  const cancelled = () => { if (signal.aborted) throw new DOMException('Cancelled', 'AbortError') }
  cancelled()
  const batch = new AbortController()
  const cancelBatch = () => batch.abort()
  signal.addEventListener('abort', cancelBatch, { once: true })
  const timer = setTimeout(cancelBatch, C.finalists.selectionTimeoutMs)
  try {
    onProgress?.({ ...selection })
    for (const [index, frame] of ranked.entries()) {
      // Normally compare three finalists. If all fail, inspect the remaining
      // (at most two) buffered frames before asking the person to adjust.
      if (index === C.finalists.count && winner) break
      cancelled()
      if (batch.signal.aborted) break
      const started = performance.now()
      let detailed: CaptureFinalistDiagnostic
      try {
        const profile = await verify(frame.image, batch.signal)
        cancelled()
        if (batch.signal.aborted) throw new DOMException('Selection timed out', 'AbortError')
        detailed = evaluateCaptureFinalist(frame, capturePhotoEvidence(profile))
        if (detailed.passed && (!best || detailed.detailedScore! > best.detailedScore!
          || detailed.detailedScore === best.detailedScore && frame.timestamp > winner!.frame.timestamp)) {
          winner = { frame, profile }; best = detailed
        }
      } catch {
        cancelled()
        detailed = { id: frame.id, lightweightScore: frame.quality.score, detailedScore: null, passed: false,
          durationMs: 0, skinConsistency: null, maximumRegionalDeltaL: null, regions: [], rejectionReasons: [verificationIssue] }
      }
      detailed.durationMs = Math.round(performance.now() - started)
      selection.finalists = [...selection.finalists!, detailed]
      onProgress?.({ ...selection })
    }
  } finally { clearTimeout(timer); signal.removeEventListener('abort', cancelBatch) }
  cancelled()
  selection.selectionTimedOut = batch.signal.aborted
  if (winner) {
    selection.selectedId = winner.frame.id; selection.quality = winner.frame.quality
    selection.reason = `Frame ${winner.frame.id} had the highest detailed photographic score among passing finalists (${best!.detailedScore!.toFixed(3)}); newer frame breaks an exact tie. All three skin regions were usable and within the regional lighting limit.`
  } else selection.reason = batch.signal.aborted
    ? 'The selection time limit was reached without a verified passing frame; returning to live guidance.'
    : 'No finalist passed the technical photo checks; returning to live guidance.'
  // Prefer an actionable capture problem over a transient check error.
  const reasons = selection.finalists!.flatMap(f => f.rejectionReasons)
  return { winner, selection, problem: reasons.find(r => r.code !== verificationIssue.code) ?? reasons[0] ?? verificationIssue }
}
