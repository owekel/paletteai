import { useEffect, useState } from 'react'
import { analyzeImage } from '../services/analyzeImage'
import type { ColorProfile } from '../types/colorProfile'
import ProcessingMark from './ProcessingMark'

interface AnalysisLoadingProps {
  imageDataUrl: string
  onComplete: (profile: ColorProfile) => void
  onError?: (message: string) => void
}

const STAGES = [
  'Checking your photo…',
  'Reading your colouring…',
  'Finding the qualities that work together…',
  'Bringing your palette together…',
]

const STAGE_INTERVAL_MS = 1100
// A floor on total loading time so the sequence always reads as
// intentional, even if the (very fast) analysis finishes almost instantly.
const MINIMUM_TOTAL_MS = 3400

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function AnalysisLoading({ imageDataUrl, onComplete, onError }: AnalysisLoadingProps) {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    let isCancelled = false

    const stageTimer = window.setInterval(() => {
      setStageIndex((current: number) => Math.min(current + 1, STAGES.length - 1))
    }, STAGE_INTERVAL_MS)

    Promise.all([analyzeImage(imageDataUrl), wait(MINIMUM_TOTAL_MS)])
      .then(([profile]) => {
        if (!isCancelled) onComplete(profile)
      })
      .catch(() => {
        if (!isCancelled) {
          onError?.('We could not analyze that photo. Please try a different one.')
        }
      })
      .finally(() => window.clearInterval(stageTimer))

    return () => {
      isCancelled = true
      window.clearInterval(stageTimer)
    }
    // This effect should only restart when the photo itself changes — not
    // when onComplete/onError happen to be recreated on parent re-renders.
  }, [imageDataUrl])

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
      <ProcessingMark />
      <h1 className="ui-heading mt-7">Building your colour profile</h1>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-ink-soft">{STAGES[stageIndex]}</p>
      <p className="mt-8 text-xs text-ink-soft">A little colour, considered carefully.</p>
    </div>
  )
}
