import { useEffect, useRef, useState } from 'react'
import { CAPTURE_CONFIG as C } from '../data/captureConfig'
import type { CaptureRuntime, CaptureSelection, CaptureSource, CaptureQuality, CaptureFacingMode } from '../types/capture'
import type { ColorProfile } from '../types/colorProfile'
import type { AnalysisQualityIssue } from '../types/analysisQuality'
import { CaptureBuffer } from '../services/capture/captureBuffer'
import { CaptureStability } from '../services/capture/captureStability'
import { describeCameraError } from '../services/capture/cameraRuntime'
import { chooseCaptureFinalists } from '../services/capture/captureFinalists'

type Phase = 'opening' | 'live' | 'choosing' | 'verifying' | 'review' | 'unavailable'
export function useGuidedCapture(runtime: CaptureRuntime) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sourceRef = useRef<CaptureSource | null>(null)
  const buffer = useRef(new CaptureBuffer()), stability = useRef(new CaptureStability())
  const captureLocked = useRef(false), epoch = useRef(0), mounted = useRef(false)
  const verification = useRef<AbortController>()
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<Phase>('opening')
  const [analyzer, setAnalyzer] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [quality, setQuality] = useState<CaptureQuality>()
  const [windowState, setWindowState] = useState(() => new CaptureStability().update('no-face', 0))
  const [frames, setFrames] = useState<ReturnType<CaptureBuffer['summary']>>([])
  const [selection, setSelection] = useState<CaptureSelection>()
  const [image, setImage] = useState<string>()
  const [profile, setProfile] = useState<ColorProfile>()
  const [error, setError] = useState('')
  const [selectionProblem, setSelectionProblem] = useState<AnalysisQualityIssue>()
  const [paused, setPaused] = useState(false)
  const [failedSelections, setFailedSelections] = useState(0)
  const preferredCamera = useRef<CaptureFacingMode>('user')
  const [facingMode, setFacingMode] = useState<CaptureFacingMode>()
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)

  function switchCamera() {
    if (phase !== 'live' || !canSwitchCamera || captureLocked.current) return
    preferredCamera.current = (sourceRef.current?.facingMode ?? preferredCamera.current) === 'user' ? 'environment' : 'user'
    // Release the old camera before requesting the next one (required on some phones).
    ++epoch.current
    verification.current?.abort()
    sourceRef.current?.stop(); sourceRef.current = null
    buffer.current.clear(); stability.current.reset(); setFrames([])
    setCanSwitchCamera(false); setPhase('opening')
    setAttempt(n => n + 1)
  }

  async function verify(photo: string, token: number) {
    verification.current?.abort()
    const abort = new AbortController()
    verification.current = abort
    setPhase('verifying'); setError(''); setProfile(undefined)
    try {
      const result = await runtime.verify(photo, abort.signal)
      if (mounted.current && epoch.current === token) { setProfile(result); setPhase('review') }
    } catch {
      if (mounted.current && epoch.current === token) { setError('We couldn’t finish checking this photo. Try the check again, or take another photo.'); setPhase('review') }
    }
  }

  function finish(photo: string, chosen: CaptureSelection) {
    if (captureLocked.current || !mounted.current) return
    captureLocked.current = true
    ++epoch.current
    sourceRef.current?.stop(); sourceRef.current = null
    buffer.current.clear(); stability.current.reset()
    setImage(photo); setSelection(chosen)
    void verify(photo, epoch.current)
  }

  function manual() {
    const source = sourceRef.current
    if (!source || captureLocked.current && phase !== 'choosing') return
    try {
      const photo = source.capture()
      if (phase === 'choosing') { verification.current?.abort(); captureLocked.current = false }
      finish(photo, { method: 'manual', selectedId: null, frames: buffer.current.summary(), quality,
        reason: 'Manual shutter: the frame at your tap, regardless of live guidance.' })
    } catch { setError('The camera frame isn’t ready yet. Give it a moment and tap again.') }
  }

  useEffect(() => {
    mounted.current = true
    const token = ++epoch.current, abort = new AbortController()
    let timer: number | undefined
    let retryAfter = 0, resumeWhenVisible = false
    captureLocked.current = false; buffer.current.clear(); stability.current = new CaptureStability()
    setPhase('opening'); setError(''); setImage(undefined); setProfile(undefined); setSelection(undefined)
    setSelectionProblem(undefined)
    setQuality(undefined); setAnalyzer('loading'); setFrames([]); setPaused(false)
    setFacingMode(undefined); setCanSwitchCamera(false)
    setWindowState(new CaptureStability().update('no-face', 0))
    const current = () => mounted.current && token === epoch.current && !abort.signal.aborted
    const clearWindow = () => { buffer.current.clear(); stability.current.reset(); setFrames([]); setWindowState(new CaptureStability().update('no-face', 0)) }
    const suspend = () => {
      if (!current()) return
      resumeWhenVisible = true
      setPaused(true); clearWindow(); setCanSwitchCamera(false); setPhase('opening')
      verification.current?.abort(); abort.abort(); window.clearTimeout(timer)
      sourceRef.current?.stop(); sourceRef.current = null
    }
    const resume = () => {
      if (!resumeWhenVisible || document.hidden || !mounted.current) return
      resumeWhenVisible = false
      setAttempt(n => n + 1)
    }
    const visibility = () => { if (document.hidden) suspend(); else resume() }
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('pagehide', suspend)
    window.addEventListener('pageshow', resume)
    async function poll(source: CaptureSource) {
      if (!current() || captureLocked.current) return
      const began = performance.now()
      try {
        if (!document.hidden) {
          const observation = await source.sample()
          if (!current() || captureLocked.current) return
          setAnalyzer(observation.analyzer); setQuality(observation.quality)
          // A frame that finishes after the tab was hidden must not restart
          // the stability window that visibilitychange just cancelled.
          if (observation.quality && !document.hidden && performance.now() >= retryAfter) {
            const now = performance.now()
            const window = stability.current.update(observation.quality.blocker, now)
            setWindowState(window)
            if (window.resetBuffer) buffer.current.clear()
            if (observation.frame) buffer.current.push(observation.frame)
            setFrames(buffer.current.summary())
            if (window.ready) {
              const candidates = buffer.current.candidates(now)
              if (candidates.length) {
                captureLocked.current = true
                const selectionAbort = new AbortController()
                verification.current = selectionAbort
                setPhase('choosing'); setError(''); setSelection(undefined)
                setSelectionProblem(undefined)
                buffer.current.clear(); stability.current.reset()
                try {
                  const result = await chooseCaptureFinalists(candidates, runtime.verify, selectionAbort.signal,
                    selected => { if (current()) setSelection(selected) })
                  if (!current()) return
                  setSelection(result.selection)
                  if (result.winner) {
                    ++epoch.current
                    source.stop(); sourceRef.current = null
                    setImage(result.winner.frame.image); setProfile(result.winner.profile); setPhase('review')
                    return
                  }
                  setSelectionProblem(result.problem)
                  setFailedSelections(n => n + 1)
                  retryAfter = performance.now() + C.finalists.retryDelayMs
                } catch {
                  if (!current()) return
                  // Hidden-tab cancellation resumes with a fresh stable window.
                  if (!selectionAbort.signal.aborted) setError('We couldn’t check this set. Hold still for another moment, or take a photo yourself.')
                }
                if (!current()) return
                captureLocked.current = false; clearWindow(); setPhase('live')
              }
            }
          } else clearWindow()
        }
      } catch {
        if (current()) { source.stop(); sourceRef.current = null; clearWindow(); setError('The camera connection stopped. Reconnect it and try again, or upload a photo.'); setPhase('unavailable') }
        return
      }
      if (current()) timer = window.setTimeout(() => void poll(source), Math.max(30, C.intervalMs - (performance.now() - began)))
    }
    if (document.hidden) { resumeWhenVisible = true; setPaused(true) }
    else void runtime.open(videoRef.current!, abort.signal, { facingMode: preferredCamera.current }).then(source => {
      if (!current()) { source.stop(); return }
      sourceRef.current = source; setFacingMode(source.facingMode); setCanSwitchCamera(!!source.canSwitchCamera)
      setPhase('live'); void poll(source)
    }).catch(reason => { if (current()) { setError(describeCameraError(reason)); setPhase('unavailable') } })
    return () => {
      mounted.current = false; ++epoch.current
      verification.current?.abort(); verification.current = undefined
      abort.abort(); window.clearTimeout(timer); document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('pagehide', suspend); window.removeEventListener('pageshow', resume)
      sourceRef.current?.stop(); sourceRef.current = null
      buffer.current.clear(); stability.current.reset()
    }
  }, [attempt, runtime])

  return { videoRef, phase, analyzer, quality, windowState, frames, selection, selectionProblem, image, profile, error, paused, failedSelections, facingMode, canSwitchCamera,
    manual, switchCamera, retake: () => setAttempt(n => n + 1), retryVerification: () => { if (image) void verify(image, ++epoch.current) } }
}
