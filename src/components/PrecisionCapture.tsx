import { useEffect, useState } from 'react'
import CameraCapture from './CameraCapture'
import type { CaptureRuntime } from '../types/capture'
import type { ColorProfile } from '../types/colorProfile'
import type { PrecisionCaptureRecord } from '../types/precision'
import { PRECISION_CONFIG as C } from '../data/precisionConfig'
import { buildPrecisionProfile } from '../services/buildPrecisionProfile'
import { PrecisionSessionLightingError } from '../services/precisionSessionLighting'
import type { PrecisionSessionLighting } from '../types/precisionLighting'
import PrecisionLightingDebug from './PrecisionLightingDebug'
import SiteHeader from './SiteHeader'
import ProcessingMark from './ProcessingMark'

interface Props {
  onAnalyzedImage: (image: string, profile: ColorProfile) => void
  onUseUploadInstead: () => void
  onCancel: () => void
  runtime?: CaptureRuntime
}

export default function PrecisionCapture(props: Props) {
  const [records, setRecords] = useState<(PrecisionCaptureRecord | undefined)[]>([])
  const [slot, setSlot] = useState(0), [generation, setGeneration] = useState(0)
  const [failures, setFailures] = useState(0)
  const [takingLonger, setTakingLonger] = useState(false)
  const [phase, setPhase] = useState<'capture' | 'building' | 'review'>('capture')
  const [result, setResult] = useState<ReturnType<typeof buildPrecisionProfile>>()
  const [error, setError] = useState('')
  const [rejectedLighting, setRejectedLighting] = useState<PrecisionSessionLighting>()
  const good = records.filter((r): r is PrecisionCaptureRecord => !!r)
  useEffect(() => {
    setTakingLonger(false)
    if (phase !== 'capture' || good.length !== 2) return
    const timer = setTimeout(() => setTakingLonger(true), C.thirdCaptureWaitBeforeFallbackMs)
    return () => clearTimeout(timer)
  }, [phase, generation, good.length])
  useEffect(() => {
    if (phase !== 'building') return
    // Yield one paint before the small, synchronous aggregation/sensitivity pass.
    const timer = setTimeout(() => {
      try { setResult(buildPrecisionProfile(good)); setPhase('review') }
      catch (error) {
        if (error instanceof PrecisionSessionLightingError) {
          // These moments share the suspect environment. Do not retain two
          // biased captures for an individual replacement or two-photo bypass.
          setRejectedLighting(error.diagnostics); setError(error.message)
          setRecords([]); setSlot(0); setFailures(0); setTakingLonger(false)
          setResult(undefined); setGeneration(g => g + 1); setPhase('capture')
        } else { setError('We couldn’t combine these photos. Your saved photos are still here; try again.'); setPhase('review') }
      }
    }, 100)
    return () => clearTimeout(timer)
  }, [phase, records]) // records are immutable throughout the building phase

  function accept(record: PrecisionCaptureRecord) {
    setError('')
    const next = [...records]; next[slot] = record
    setRecords(next); setFailures(0)
    const empty = [0, 1, 2].find(i => !next[i])
    if (empty === undefined) setPhase('building')
    else { setSlot(empty); setGeneration(g => g + 1) }
  }
  function retake(index: number) {
    const next = [...records]; next[index] = undefined
    setRecords(next); setSlot(index); setGeneration(g => g + 1); setFailures(0); setResult(undefined); setError(''); setPhase('capture')
  }
  if (phase === 'capture') return <><CameraCapture key={generation} {...props} errorMessage={error || undefined}
    precision={{ index: slot, savedSlots: records.flatMap((r, i) => r ? [i] : []), onAccepted: accept, onFailed: () => setFailures(n => n + 1),
      onUseTwo: good.length === 2 && (failures >= C.thirdCaptureFailuresBeforeFallback || takingLonger) ? () => setPhase('building') : undefined }} />
    {import.meta.env.DEV && rejectedLighting && <div className="page-shell"><details className="developer-area"><summary>Developer tools · previous scan</summary><p className="text-xs text-ink-soft">Previous scan discarded; these diagnostics do not describe the new capture.</p><PrecisionLightingDebug diagnostics={rejectedLighting} /></details></div>}</>

  return <main className="page-shell page-shell-narrow">
    <SiteHeader onAction={props.onCancel} />
    <div className="mb-7"><p className="ui-eyebrow">Precision Analysis · {good.length} moments saved</p><h1 className="ui-title mt-4" aria-live="polite">{phase === 'building' ? 'Building your colour profile…' : 'Your scan is ready.'}</h1><p className="ui-copy mt-4">{phase === 'building' ? 'Finding the colour qualities that hold steady.' : 'Keep this set, or replace a moment. All your photos help shape your colour guide.'}</p></div>
    <div className="grid grid-cols-3 gap-3 sm:gap-5">{records.map((r, i) => r && <figure key={i}><img src={r.image} alt={`Precision capture ${i + 1}`} className="aspect-[3/4] w-full rounded-xl object-cover" /><figcaption className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft"><span>Moment {i + 1}</span>{phase === 'review' && <button className="ui-text-action" onClick={() => retake(i)} aria-label={`Retake capture ${i + 1}`}>Retake</button>}</figcaption></figure>)}</div>
    {phase === 'building' ? <div role="status" className="mt-8 flex items-center gap-4 text-sm text-ink-soft"><ProcessingMark /><p>Bringing your palette together.</p></div> : <div className="mt-7 flex flex-wrap items-center gap-4"><button className="ui-button ui-button-primary" onClick={() => result ? props.onAnalyzedImage(result.image, result.profile) : setPhase('building')}>{result ? 'See my colours →' : 'Try combining again'}</button><p className="max-w-xs text-xs leading-relaxed text-ink-soft">Your clearest moment becomes the try-on photo.</p></div>}
    {error && <p role="alert" className="mt-5 text-sm text-accent">{error}</p>}
    {import.meta.env.DEV && result && <details className="developer-area"><summary>Developer tools · technical detail</summary><PrecisionLightingDebug diagnostics={result.profile.precision!.sessionLighting} /><details className="mt-5 text-xs"><summary>Developer multi-capture diagnostics</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify(result.profile.precision, null, 2)}</pre></details></details>}
  </main>
}
