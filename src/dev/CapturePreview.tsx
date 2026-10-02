import { useEffect, useMemo, useRef, useState } from 'react'
import CameraCapture from '../components/CameraCapture'
import ResultsPage from '../components/ResultsPage'
import type { CaptureRuntime } from '../types/capture'
import type { ColorProfile } from '../types/colorProfile'
import { evaluateCaptureQuality } from '../services/capture/captureQuality'
import { CAPTURE_SCENARIOS, captureFixture, captureFullFixture, type CaptureScenario } from './captureFixtures'
import { FIXTURE_IMAGE } from './resultsFixtures'
import { probeCapturePhoto } from './capturePhotoProbe'
import { browserCaptureRuntime } from '../services/capture/cameraRuntime'

/** Exercises the real component, timing, buffering and handoff with deterministic inputs. */
export default function CapturePreview() {
  const [scenario, setScenario] = useState<CaptureScenario>('off-center')
  const [run, setRun] = useState(0)
  const [result, setResult] = useState<{ image: string; profile: ColorProfile }>()
  const [notice, setNotice] = useState('')
  const [photo, setPhoto] = useState<Awaited<ReturnType<typeof probeCapturePhoto>>>()
  const probe = useRef<AbortController>()
  useEffect(() => () => probe.current?.abort(), [])
  const runtime = useMemo<CaptureRuntime>(() => ({
    fixtureImage: photo?.image ?? FIXTURE_IMAGE,
    async open(_video, signal) {
      if (scenario === 'permission-denied') throw new DOMException('Fixture permission denial', 'NotAllowedError')
      let id = 0, stopped = false
      const stop = () => { stopped = true; signal.removeEventListener('abort', stop) }
      signal.addEventListener('abort', stop, { once: true })
      return { stop, capture: () => photo?.image ?? FIXTURE_IMAGE, async sample() {
        if (stopped) throw new Error('Fixture stopped')
        if (scenario === 'guidance-unavailable') return { analyzer: 'unavailable' }
        const quality = evaluateCaptureQuality(photo?.metrics ?? captureFixture(scenario, id))
        id++
        return { analyzer: 'ready', quality, frame: quality.blocker ? undefined : { id, timestamp: performance.now(), quality, image: photo?.image ?? `${FIXTURE_IMAGE}#capture-frame-${id}` } }
      } }
    },
    async verify(image, signal) {
      if (photo) return browserCaptureRuntime.verify(image, signal)
      // Short, cancellable fixture delay makes the real choosing state visible.
      await new Promise<void>((resolve, reject) => {
        const cancel = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new DOMException('Cancelled', 'AbortError')) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, 450)
        if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true })
      })
      if (scenario === 'verification-error') throw new Error('Fixture verification failure')
      return captureFullFixture(scenario, Number(image.match(/#capture-frame-(\d+)$/)?.[1] ?? 0))
    },
  }), [scenario, run, photo])
  return <>
    <aside className="flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-3 text-xs text-paper">
      <span>Developer preview · {photo ? 'real still-photo measurements; simulated camera timing' : 'simulated camera, metrics and analysis'}</span>
      <label>Scenario <select disabled={!!photo} aria-label="Capture test scenario" className="rounded border border-white/30 bg-ink p-1" value={scenario} onChange={e => { setScenario(e.target.value as CaptureScenario); setResult(undefined); setNotice('') }}>{CAPTURE_SCENARIOS.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Local photo probe <input className="max-w-[190px]" aria-label="Local capture test photo" type="file" accept="image/png,image/jpeg" onChange={event => {
        const file = event.target.files?.[0]; if (!file) return
        probe.current?.abort(); const abort = new AbortController(); probe.current = abort
        setNotice('Measuring local photo…')
        void probeCapturePhoto(file, abort.signal).then(value => { if (!abort.signal.aborted) { setPhoto(value); setScenario('ideal'); setResult(undefined); setNotice('Photo measured with the real capture model.') } }).catch(() => { if (!abort.signal.aborted) setNotice('Photo probe failed. Try another local JPG or PNG.') })
      }} /></label>
      {photo && <button className="underline" onClick={() => { probe.current?.abort(); setPhoto(undefined); setResult(undefined); setNotice('') }}>Clear photo probe</button>}
      <button className="underline" onClick={() => { setRun(r => r + 1); setResult(undefined); setNotice('') }}>Restart preview</button>
      <a className="underline" href="/">Use a real camera →</a>
      {notice && <span role="status">{notice}</span>}
    </aside>
    {result ? <ResultsPage profile={result.profile} capturedImageDataUrl={result.image} onStartOver={() => setResult(undefined)} /> : <CameraCapture runtime={runtime} onAnalyzedImage={(image, profile) => setResult({ image, profile })} onCancel={() => setNotice('Back navigation requested')} onUseUploadInstead={() => setNotice('Upload fallback requested')} />}
  </>
}
