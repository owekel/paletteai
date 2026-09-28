import { useEffect, useState } from 'react'
import { analyzeImage } from '../services/analyzeImage'
import type { ColorProfile } from '../types/colorProfile'

interface AnalysisLoadingProps {
  imageDataUrl: string
  onComplete: (profile: ColorProfile) => void
  onError?: (message: string) => void
}

const STAGES = [
  'Examining your photo...',
  'Analyzing facial colouring...',
  'Comparing colour relationships...',
  'Building your palette...',
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
      <div className="h-16 w-16">
        <SpinningSwatch />
      </div>

      <ul className="mt-10 space-y-3">
        {STAGES.map((stage, index) => (
          <li
            key={stage}
            className={`text-lg transition-colors duration-300 ${
              index === stageIndex
                ? 'font-display text-ink'
                : index < stageIndex
                  ? 'text-ink-soft line-through decoration-hairline'
                  : 'text-hairline'
            }`}
          >
            {stage}
          </li>
        ))}
      </ul>
    </div>
  )
}

// A small ring of colour segments in place of a generic spinner — a nod to
// the fact that this loading state is specifically about analysing colour.
function SpinningSwatch() {
  const colors = ['#B5502A', '#1E3A8A', '#009B77', '#C99A2E']
  return (
    <svg viewBox="0 0 40 40" className="h-full w-full animate-spin" style={{ animationDuration: '1.4s' }}>
      {colors.map((color, index) => (
        <path
          key={color}
          d={describeArc(20, 20, 16, index * 90, index * 90 + 70)}
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      ))}
    </svg>
  )
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end.x} ${end.y}`
}
