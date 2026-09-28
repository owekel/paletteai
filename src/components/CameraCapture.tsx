// Live camera capture, as an alternative front-end to the exact same
// analysis pipeline the file-upload flow already uses. This component's
// only job is to end up with a data URL and hand it to onImageReady — the
// same prop UploadScreen.tsx already calls. Nothing about how the photo
// gets analyzed lives here or is duplicated here.
//
// The live positioning guide reuses the SAME face detection and colour
// sampling the rest of the app already has (detectFaceRegions, sampleRegion,
// getLuminance) — just run periodically against the live video feed instead
// of once against a captured photo.

import { useEffect, useRef, useState } from 'react'
import { detectFaceRegions, type FaceRegions } from '../services/vision/faceDetection'
import { sampleRegion } from '../services/vision/colourSampling'
import { getLuminance } from '../services/colorUtils'

interface CameraCaptureProps {
  onImageReady: (dataUrl: string) => void
  onUseUploadInstead: () => void
  errorMessage?: string | null
}

type CameraStatus = 'requesting' | 'live' | 'unavailable' | 'captured'

type LivenessState = 'no-face' | 'too-far' | 'too-close' | 'off-center' | 'poor-lighting' | 'ready'

const LIVENESS_MESSAGES: Record<LivenessState, string> = {
  'no-face': 'Center your face',
  'too-far': 'Move closer',
  'too-close': 'Move farther away',
  'off-center': 'Center your face',
  'poor-lighting': 'Good lighting',
  ready: 'Ready to capture',
}

// A face is "reasonably positioned" for capture as soon as it's detected,
// sized, and centred well — lighting is shown as a tip but doesn't block
// capture, since it isn't a positioning problem.
const POSITIONED_STATES: LivenessState[] = ['poor-lighting', 'ready']

const CAPTURE_JPEG_QUALITY = 0.92
const POLL_INTERVAL_MS = 800
const MIN_FACE_AREA_RATIO = 0.05
const MAX_FACE_AREA_RATIO = 0.35
const MAX_CENTER_OFFSET_X = 0.15
const MAX_CENTER_OFFSET_Y = 0.2
const DARK_LUMINANCE_THRESHOLD = 70
const BRIGHT_LUMINANCE_THRESHOLD = 210

function evaluateLiveness(regions: FaceRegions | null, foreheadLuminance: number | null): LivenessState {
  if (!regions) return 'no-face'
  if (regions.faceAreaRatio < MIN_FACE_AREA_RATIO) return 'too-far'
  if (regions.faceAreaRatio > MAX_FACE_AREA_RATIO) return 'too-close'

  const centerX = (regions.faceBox.xStart + regions.faceBox.xEnd) / 2
  const centerY = (regions.faceBox.yStart + regions.faceBox.yEnd) / 2
  if (Math.abs(centerX - 0.5) > MAX_CENTER_OFFSET_X || Math.abs(centerY - 0.5) > MAX_CENTER_OFFSET_Y) {
    return 'off-center'
  }

  if (
    foreheadLuminance !== null &&
    (foreheadLuminance < DARK_LUMINANCE_THRESHOLD || foreheadLuminance > BRIGHT_LUMINANCE_THRESHOLD)
  ) {
    return 'poor-lighting'
  }

  return 'ready'
}

function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera access was denied. You can allow it in your browser settings, or upload a photo instead.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No camera was found on this device. Upload a photo instead.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return "Your camera couldn't be started — it may be in use by another app. Upload a photo instead."
  }
  return "We couldn't access your camera. Upload a photo instead."
}

export default function CameraCapture({ onImageReady, onUseUploadInstead, errorMessage }: CameraCaptureProps) {
  const [status, setStatus] = useState<CameraStatus>('requesting')
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const [capturedDataUrl, setCapturedDataUrl] = useState<string | null>(null)
  const [liveness, setLiveness] = useState<LivenessState>('no-face')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pollCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const isPollingRef = useRef(false)

  function stopStream() {
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setStatus('requesting')
    setUnavailableReason(null)

    if (!navigator.mediaDevices?.getUserMedia) {
      setUnavailableReason(
        "This browser can't access a camera here (it may also need a secure https connection). Upload a photo instead.",
      )
      setStatus('unavailable')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          // A plain string value is a soft ("ideal") preference, not a hard
          // requirement — safe on desktops with a single generic webcam
          // that has no front/back distinction at all.
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setStatus('live')
    } catch (error) {
      setUnavailableReason(describeCameraError(error))
      setStatus('unavailable')
    }
  }

  useEffect(() => {
    startCamera()
    return () => stopStream()
    // Runs once on mount by design. Retake calls startCamera() directly
    // rather than relying on this effect running again.
  }, [])

  // Polls face position/lighting periodically while the preview is live, so
  // the status message and capture button stay up to date. Runs on a modest
  // interval (not every frame) since each check runs the same face-landmark
  // model used elsewhere in the app, which is too slow to run continuously
  // without stuttering the preview.
  async function pollFacePosition() {
    if (isPollingRef.current) return
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    isPollingRef.current = true
    try {
      const regions = await detectFaceRegions(video)

      let foreheadLuminance: number | null = null
      if (regions) {
        if (!pollCanvasRef.current) pollCanvasRef.current = document.createElement('canvas')
        const canvas = pollCanvasRef.current
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        if (context) {
          context.drawImage(video, 0, 0, canvas.width, canvas.height)
          const sample = sampleRegion(context, canvas.width, canvas.height, regions.forehead)
          if (sample.color) foreheadLuminance = getLuminance(sample.color)
        }
      }

      setLiveness(evaluateLiveness(regions, foreheadLuminance))
    } catch {
      // A polling hiccup shouldn't disrupt the live preview — just skip this
      // cycle and try again on the next interval.
    } finally {
      isPollingRef.current = false
    }
  }

  useEffect(() => {
    if (status !== 'live') {
      setLiveness('no-face')
      return
    }
    pollFacePosition() // check right away rather than waiting a full interval
    const intervalId = window.setInterval(pollFacePosition, POLL_INTERVAL_MS)
    return () => window.clearInterval(intervalId)
    // Deliberately only depends on `status` — pollFacePosition always reads
    // the latest video/refs itself, so it doesn't need to be a dependency.
  }, [status])

  function handleCapture() {
    const video = videoRef.current
    if (!video || video.videoWidth === 0) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) return

    // Draws the video's actual decoded frame at full resolution — this is
    // unaffected by the CSS mirror transform on the preview below, so the
    // captured photo is a natural, non-mirrored, correctly oriented image.
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    setCapturedDataUrl(canvas.toDataURL('image/jpeg', CAPTURE_JPEG_QUALITY))
    setStatus('captured')
    stopStream()
  }

  function handleRetake() {
    setCapturedDataUrl(null)
    startCamera()
  }

  function handleContinue() {
    if (capturedDataUrl) onImageReady(capturedDataUrl)
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 sm:px-10 sm:py-20">
      <p className="font-display text-xl">PaletteAI</p>
      <h1 className="mt-8 font-display text-3xl text-ink sm:text-4xl">Take your photo</h1>

      {errorMessage && (
        <p className="mt-6 border border-accent bg-accent-soft px-4 py-3 text-sm text-accent">{errorMessage}</p>
      )}

      {status === 'unavailable' ? (
        <div className="mt-8">
          <p className="max-w-lg text-ink-soft">{unavailableReason}</p>
          <button
            onClick={onUseUploadInstead}
            className="mt-6 inline-flex items-center gap-2 bg-ink px-8 py-4 text-base font-medium text-paper transition-colors hover:bg-accent"
          >
            Upload a photo instead
          </button>
        </div>
      ) : status === 'captured' && capturedDataUrl ? (
        <div className="mt-8">
          <div className="mx-auto aspect-[3/4] max-w-sm overflow-hidden border border-hairline">
            <img src={capturedDataUrl} alt="Your captured photo" className="h-full w-full object-cover" />
          </div>
          <div className="mx-auto mt-6 flex max-w-sm gap-3">
            <button
              onClick={handleRetake}
              className="flex-1 border border-ink px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-ink hover:text-paper"
            >
              Retake
            </button>
            <button
              onClick={handleContinue}
              className="flex-1 bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-accent"
            >
              Continue
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 max-w-lg text-ink-soft">Position your face inside the frame.</p>

          <div className="relative mx-auto mt-8 aspect-[3/4] max-w-sm overflow-hidden border border-hairline bg-ink">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            {status === 'requesting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink/60 px-6 text-center text-sm text-paper">
                Requesting camera access…
              </div>
            )}

            {status === 'live' && <FaceGuideOverlay />}
          </div>

          {status === 'live' && (
            <div className="mx-auto mt-6 max-w-sm">
              <p
                className={`text-center text-sm font-medium ${
                  POSITIONED_STATES.includes(liveness) ? 'text-accent' : 'text-ink-soft'
                }`}
              >
                {LIVENESS_MESSAGES[liveness as LivenessState]}
              </p>
              <button
                onClick={handleCapture}
                disabled={!POSITIONED_STATES.includes(liveness)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 bg-ink px-8 py-4 text-base font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:bg-hairline disabled:text-ink-soft disabled:hover:bg-hairline"
              >
                <CameraIcon />
                Capture
              </button>
            </div>
          )}

          <p className="mt-6 text-sm">
            <button
              onClick={onUseUploadInstead}
              className="text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink"
            >
              Or upload a photo instead
            </button>
          </p>
        </>
      )}
    </div>
  )
}

// Dims everything outside a centred oval and outlines it, so it's obvious
// where to position a face. The viewBox matches the preview container's
// own 3:4 aspect ratio, so the oval scales evenly with no distortion.
function FaceGuideOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg viewBox="0 0 300 400" className="h-full w-full">
        <defs>
          <mask id="face-guide-mask">
            <rect x="0" y="0" width="300" height="400" fill="white" />
            <ellipse cx="150" cy="185" rx="95" ry="120" fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="300" height="400" fill="black" fillOpacity="0.45" mask="url(#face-guide-mask)" />
        <ellipse cx="150" cy="185" rx="95" ry="120" fill="none" stroke="white" strokeOpacity="0.9" strokeWidth="4" />
      </svg>
    </div>
  )
}

function CameraIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}
