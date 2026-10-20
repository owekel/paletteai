import { useEffect, useRef } from 'react'
import type { ColorProfile } from '../types/colorProfile'
import type { CaptureRuntime } from '../types/capture'
import type { PrecisionCaptureRecord } from '../types/precision'
import { capturePhotoEvidence, evaluateCaptureFinalist } from '../services/capture/captureFinalists'
import { useGuidedCapture } from '../hooks/useGuidedCapture'
import { browserCaptureRuntime } from '../services/capture/cameraRuntime'
import { CAPTURE_GUIDANCE } from '../services/capture/captureQuality'
import { CAPTURE_CONFIG } from '../data/captureConfig'
import './guidedCapture.css'
import SiteHeader from './SiteHeader'

interface CameraCaptureProps {
  onAnalyzedImage: (image: string, profile: ColorProfile) => void
  onUseUploadInstead: () => void
  onCancel: () => void
  errorMessage?: string | null
  runtime?: CaptureRuntime
  precision?: { index: number; savedSlots: number[]; onAccepted: (record: PrecisionCaptureRecord) => void;
    onFailed: () => void; onUseTwo?: () => void }
}

export default function CameraCapture({ onAnalyzedImage, onUseUploadInstead, onCancel, errorMessage, runtime = browserCaptureRuntime, precision }: CameraCaptureProps) {
  const capture = useGuidedCapture(runtime)
  const { phase, image, profile, windowState, analyzer } = capture
  const reviewing = phase === 'verifying' || phase === 'review'
  const choosing = phase === 'choosing'
  const usable = profile?.analysis.quality.imageQuality.status === 'usable'
  const issues = profile?.analysis.quality.imageQuality.issues ?? []
  const holding = windowState.guidance === 'ready' && windowState.holding
  const guide = CAPTURE_GUIDANCE[windowState.guidance]
  const problem = phase === 'live' && !capture.quality?.blocker ? capture.selectionProblem : undefined
  const title = capture.paused ? 'Ready when you are' : choosing ? 'Choosing the best frame…' : problem ? problem.title : analyzer === 'loading' ? 'Getting ready' : analyzer === 'unavailable' ? 'You’re in control' : holding ? 'Looks good — hold still.' : guide.title
  const detail = capture.paused ? 'Return to the camera to begin again.' : choosing ? 'A quick check of the light and detail in your recent photos.' : problem ? problem.guidance : analyzer === 'loading' ? 'Preparing your live guidance. You can already take a photo.' : analyzer === 'unavailable' ? 'Live guidance is unavailable. Take a photo when you’re ready; we’ll check it afterward.' : holding ? 'The light and framing look good. Taking your photo in a moment.' : guide.detail
  const debug = import.meta.env.DEV && new URLSearchParams(location.search).get('debug') === 'capture'
  const handledProfile = useRef<ColorProfile>(), seenFailures = useRef(0)
  useEffect(() => {
    if (precision && capture.failedSelections > seenFailures.current) {
      seenFailures.current = capture.failedSelections; precision.onFailed()
    }
  }, [capture.failedSelections, precision])
  useEffect(() => {
    if (!precision || phase !== 'review' || !profile || !image || handledProfile.current === profile) return
    handledProfile.current = profile
    const selected = capture.selection
    if (!selected) return
    // Manual capture keeps its override, but must pass the same full-photo
    // technical rules before contributing to a precision profile.
    const finalist = selected.method === 'auto' ? selected.finalists?.find(f => f.id === selected.selectedId)
      : evaluateCaptureFinalist({ id: 0, quality: capture.quality }, capturePhotoEvidence(profile))
    if (usable && finalist?.passed) {
      const selection = selected.method === 'manual' ? { ...selected, finalists: [finalist], reason: 'Manual frame passed precision full-photo validation.' } : selected
      precision.onAccepted({ image, profile, selection, quality: finalist.detailedScore ?? 0 })
    } else {
      precision.onFailed()
      // Preserve the rejected review and its actionable reason; only this
      // capture needs replacement, never the already accepted photos.
    }
  }, [precision, phase, profile, image, usable, capture.selection, capture.quality])
  const precisionManualDiagnostic = precision && profile && capture.selection?.method === 'manual'
    ? evaluateCaptureFinalist({ id: 0, quality: capture.quality }, capturePhotoEvidence(profile)) : undefined
  const precisionRejected = precision && phase === 'review' && (!usable || !precisionManualDiagnostic?.passed && capture.selection?.method === 'manual')
  return <main className="guided-capture page-shell">
    <SiteHeader onAction={onCancel} />
    <div className="capture-heading">
      {precision && <div className="capture-session mb-3" aria-live="polite"><div><p className="capture-eyebrow">Precision Analysis</p><p className="capture-session-count"><span className="sr-only">{precision.index + 1} of 3</span><span aria-hidden="true">{precision.index + 1}<span className="capture-count-total"> / 3</span></span></p></div><div className="capture-session-strip" role="img" aria-label={`${precision.savedSlots.length} photos saved`}>{[0, 1, 2].map(i => <span key={i} data-state={precision.savedSlots.includes(i) ? 'saved' : i === precision.index ? 'current' : 'next'} aria-hidden="true">{String(i + 1).padStart(2, '0')}{precision.savedSlots.includes(i) && <i>✓</i>}</span>)}</div><p className="capture-session-note">Stay in the same soft light for all three moments.</p></div>}
      {!precision && <p className="text-[10px] font-medium uppercase tracking-[0.23em] text-accent">{reviewing ? '02 / Your starting point' : '01 / Find your light'}</p>}
      <h1 className="ui-heading mt-3">{reviewing ? 'Take a look.' : 'Find your light.'}</h1>
      {!precision && <p className="mt-2 text-sm text-ink-soft">{reviewing ? 'Keep this moment, or try another.' : 'Face a soft light. We’ll take care of the timing.'}</p>}
    </div>
    {errorMessage && <p role="alert" className="ui-notice mb-5">{errorMessage}</p>}
    <div className="capture-layout">
      <section aria-label={reviewing ? 'Photo review' : 'Live camera'} className="min-w-0">
        <div className={`capture-view ${holding && !reviewing ? 'capture-holding' : ''}`}>
          <video ref={capture.videoRef} autoPlay playsInline muted style={{ transform: capture.facingMode === 'user' ? 'scaleX(-1)' : 'none' }} className={`capture-video ${reviewing || phase === 'unavailable' ? 'invisible' : ''}`} />
          {runtime.fixtureImage && !reviewing && <img src={runtime.fixtureImage} alt="Developer camera simulation" className="capture-video" />}
          {image && reviewing && <img src={image} alt="Your captured photo" className="absolute inset-0 h-full w-full object-cover" />}
          {!reviewing && phase !== 'unavailable' && <>
            <div className="capture-camera-label"><span className={`capture-dot ${phase === 'live' ? 'capture-dot-live' : ''}`} />{phase === 'opening' ? 'Opening camera' : holding ? 'Ready · hold still' : analyzer === 'ready' ? 'Auto-capture on' : 'Manual shutter available'}</div>
            <svg className="capture-guide" viewBox="0 0 300 400" aria-hidden="true"><ellipse cx="150" cy="172" rx="91" ry="104" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="16 10" /><path d="M58 338 Q72 297 112 296 M188 296 Q228 297 242 338" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" /></svg>
            {(phase === 'live' || choosing) && <div className="capture-mobile-guidance" aria-live="polite"><h2 className="font-display text-2xl">{title}</h2><p className="mt-1 text-xs leading-relaxed text-white/85">{detail}</p></div>}
          </>}
          {phase === 'opening' && <div className="capture-cover">{!capture.paused && <span className="capture-spinner" />}<p className="mt-4 text-sm">{capture.paused ? 'Camera paused' : 'Waiting for your camera'}</p><p className="mt-2 max-w-[15rem] text-xs leading-relaxed text-white/65">{capture.paused ? 'Return to this page when you’re ready.' : 'Allow camera access in your browser to get started.'}</p></div>}
          {phase === 'unavailable' && <div className="capture-cover"><CameraIcon /><p className="mt-5 font-display text-2xl">Another way in.</p><p className="mt-3 max-w-[15rem] text-sm leading-relaxed text-white/65">A photo from your library works too.</p></div>}
          {phase === 'verifying' && <div role="status" className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-lg bg-paper px-4 py-3 text-sm"><span className="capture-spinner capture-spinner-dark" />Checking your photo…</div>}
        </div>
        <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-soft">{reviewing ? 'Saved as the camera sees you, without the mirror.' : capture.facingMode === 'user' ? 'A mirrored preview. Your captured photo will be unmirrored.' : 'Your photo will be saved as the camera sees it.'}</p>
        {phase === 'live' && capture.canSwitchCamera && <div className="mt-2 text-center"><button className="ui-text-action min-h-11" onClick={capture.switchCamera}>Switch camera</button></div>}
      </section>
      <section className="capture-panel" aria-label="Capture guidance">
        {precision?.onUseTwo && <div className="mb-6 rounded-xl border border-hairline bg-white/60 p-4"><h2 className="font-display text-xl">Two good photos are ready.</h2><p className="mt-2 text-xs leading-relaxed text-ink-soft">You can continue with these. We’ll leave more room for uncertainty, or keep trying for a third.</p><button className="capture-secondary mt-3 w-full" onClick={precision.onUseTwo}>Use my two good photos</button></div>}
        {phase === 'unavailable' ? <>
          <p className="capture-eyebrow">Camera unavailable</p><h2 className="mt-3 font-display text-3xl">Let’s get you a photo.</h2>
          <p role="alert" className="mt-4 text-sm leading-relaxed text-ink-soft">{capture.error}</p>
          <div className="mt-7 flex flex-col gap-3"><button className="capture-primary" onClick={capture.retake}>Try camera again</button><button className="capture-secondary" onClick={onUseUploadInstead}>Upload a photo instead</button></div>
        </> : reviewing ? <>
          <p className="capture-eyebrow">{phase === 'verifying' ? 'One last check' : usable && !precisionRejected ? 'Ready to explore' : profile ? 'A clearer photo would help' : 'Photo saved for review'}</p>
          <h2 className="mt-3 font-display text-3xl" aria-live="polite">{phase === 'verifying' ? 'Finding the details.' : usable && !precisionRejected ? 'This is a good starting point.' : profile ? 'Let’s adjust the light or framing.' : 'Let’s check that once more.'}</h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">{phase === 'verifying' ? 'We’re checking your full photo for usable facial detail, exposure and lighting.' : usable && !precisionRejected ? 'Your photo has enough detail to continue. Keep it, or take another if you prefer.' : profile ? 'The full photo check picked up something the live preview couldn’t confirm.' : capture.error}</p>
          {!!issues.length && <ul className="mt-5 space-y-4">{issues.map(issue => <li key={issue.code} className="border-l-2 border-accent/35 pl-4"><h3 className="text-sm font-medium">{issue.title}</h3><p className="mt-1 text-xs leading-relaxed text-ink-soft">{issue.guidance}</p></li>)}</ul>}
          {precisionRejected && <p role="alert" className="mt-4 text-sm text-accent">{precisionManualDiagnostic?.rejectionReasons[0]?.guidance ?? 'We need a clearer view of all three skin regions for this capture. Keep your forehead and cheeks visible in soft, even light.'} Your earlier photos are saved.</p>}
          <div className="mt-7 grid grid-cols-2 gap-3"><button className={profile && !usable ? 'capture-primary' : 'capture-secondary'} onClick={capture.retake}>Retake</button>
            {phase === 'review' && !profile ? <button className="capture-primary" onClick={capture.retryVerification}>Check again</button> : <button className="capture-primary" disabled={!!precision || !usable || phase !== 'review'} onClick={() => { if (image && profile && usable) onAnalyzedImage(image, profile) }}>{precisionRejected ? 'New photo needed' : precision ? 'Checking capture' : 'Use Photo'} <span aria-hidden="true">→</span></button>}
          </div>
          {profile && !usable && <p className="mt-3 text-xs leading-relaxed text-ink-soft">Retake or choose another photo to continue.</p>}
        </> : <>
          <div className="capture-instruction" aria-live="polite" aria-atomic="true"><p className="capture-eyebrow">{phase === 'opening' ? 'Your camera, your privacy' : holding ? 'Almost there' : 'A little guidance'}</p><h2 className="mt-3 font-display text-3xl sm:text-4xl">{phase === 'opening' ? 'Make yourself comfortable.' : title}</h2><p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-soft">{phase === 'opening' ? 'Your photo stays in this browser. No video or image is uploaded.' : detail}</p></div>
          <div className="capture-progress-row mt-5" role="progressbar" aria-label="Automatic capture progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(windowState.progress * 100)}><div className="h-1 overflow-hidden bg-hairline"><div className="capture-progress h-full bg-success" style={{ width: `${windowState.progress * 100}%` }} /></div><p className="mt-2 text-[11px] text-ink-soft">{choosing ? 'Checking your recent photos' : holding ? 'Taking your photo shortly' : analyzer === 'unavailable' ? 'Take a photo whenever you’re ready' : 'Automatic when the moment is right'}</p></div>
          <div className="capture-shutter-panel"><button className="capture-shutter" onClick={capture.manual} disabled={phase !== 'live' && !choosing} aria-label="Take photo now"><span><CameraIcon /></span></button><div><p className="text-sm font-medium">Or take it yourself</p><p className="mt-1 text-xs text-ink-soft">Your shutter, whenever you’re ready.</p></div></div>
          {capture.error && <p role="alert" className="mb-4 text-sm text-accent">{capture.error}</p>}
          <details className="capture-help"><summary>A quick guide to good light</summary><div className="mt-4 space-y-4">{[['01', 'Soft light, straight on', 'A window in front of you is a good start.'], ['02', 'A clear view of you', 'Keep your forehead, cheeks and eyes visible.'], ['03', 'Settle in naturally', 'Relax your face and hold the camera at eye level.']].map(([n, heading, copy]) => <div key={n} className="flex gap-4"><span className="pt-0.5 text-[10px] text-accent">{n}</span><div><h3 className="text-xs font-medium">{heading}</h3><p className="mt-1 text-xs leading-relaxed text-ink-soft">{copy}</p></div></div>)}</div></details>
        </>}
        {phase !== 'unavailable' && <button onClick={onUseUploadInstead} className="ui-text-action mt-5">Choose a photo from your library</button>}
        <p className="mt-5 text-xs text-ink-soft">Private, in your browser.</p>
      </section>
    </div>
    {debug && <details className="mt-10 rounded-xl border border-hairline p-4 text-xs"><summary className="cursor-pointer">Developer capture diagnostics · {CAPTURE_CONFIG.version}</summary><pre aria-label="Capture diagnostics" className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify({ phase, analyzer, paused: capture.paused, live: capture.quality, stability: windowState, bufferedFrames: capture.frames, selection: capture.selection,
      fullPhoto: profile ? { imageQuality: profile.analysis.quality.imageQuality, classificationCertainty: profile.analysis.quality.classificationCertainty.status, skinConsistency: profile.shadowMeasurements.skinDiagnostics.consistencyScore, lighting: profile.shadowMeasurements.lighting, faceAreaRatio: profile.shadowMeasurements.inputQuality.faceAreaRatio } : null,
    }, null, 2)}</pre></details>}
  </main>
}

function CameraIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7.5h3L8.5 5h7L17 7.5h3a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.4" /></svg>
}
