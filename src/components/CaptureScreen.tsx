import { useState } from 'react'
import CameraCapture from './CameraCapture'
import PrecisionCapture from './PrecisionCapture'
import UploadScreen from './UploadScreen'
import type { ColorProfile } from '../types/colorProfile'

interface CaptureScreenProps {
  onImageReady: (dataUrl: string) => void
  onAnalyzedImage: (dataUrl: string, profile: ColorProfile) => void
  onCancel: () => void
  errorMessage?: string | null
}

// Decides how the person gets a photo into the app: the camera (default)
// or the existing file-upload flow (used as a fallback, or just by
// preference). UploadScreen itself is reused completely unmodified.
// Camera review supplies the already-verified profile; uploads retain the
// existing loading flow. Both use the same analysis and results pipeline.
export default function CaptureScreen({ onImageReady, onAnalyzedImage, onCancel, errorMessage }: CaptureScreenProps) {
  const [mode, setMode] = useState<'choose' | 'precision' | 'camera' | 'upload'>('choose')

  if (mode === 'choose') return <main className="mx-auto max-w-4xl px-5 py-8 sm:px-10 sm:py-12">
    <nav className="flex items-center justify-between"><p className="font-display text-2xl">PaletteAI<span className="text-accent">.</span></p><button className="capture-back" onClick={onCancel}>← Back</button></nav>
    <header className="mb-10 mt-14"><p className="capture-eyebrow">Your colour story</p><h1 className="mt-4 font-display text-4xl sm:text-5xl">More than a single moment.</h1><p className="mt-5 max-w-xl text-sm leading-relaxed text-ink-soft">Small changes in light can change a photo. Three carefully checked moments help us find the qualities that stay consistent.</p></header>
    <div className="grid gap-5 sm:grid-cols-2"><section className="rounded-2xl border border-accent/30 bg-white/50 p-6 sm:p-8"><p className="capture-eyebrow">Recommended · 3 photos</p><h2 className="mt-4 font-display text-3xl">Precision Analysis</h2><p className="mt-4 text-sm leading-relaxed text-ink-soft">A short guided scan in the same soft light. We choose each moment automatically, then bring the evidence together.</p><button className="capture-primary mt-7 w-full" onClick={() => setMode('precision')}>Begin precision capture →</button></section><section className="rounded-2xl border border-hairline p-6 sm:p-8"><p className="capture-eyebrow">A lighter starting point · 1 photo</p><h2 className="mt-4 font-display text-3xl">Quick Analysis</h2><p className="mt-4 text-sm leading-relaxed text-ink-soft">The same guided camera with one checked photo. Useful for exploring your colours when you’re short on time.</p><button className="capture-secondary mt-7 w-full" onClick={() => setMode('camera')}>Take one photo</button></section></div>
    <button className="mt-8 text-sm text-ink-soft underline underline-offset-4" onClick={() => setMode('upload')}>Or use a photo from your library</button><p className="mt-5 text-xs text-ink-soft">Private by design. Photos stay in this browser. No need to change your lighting between captures.</p>
    {errorMessage && <p role="alert" className="mt-5 text-sm text-accent">{errorMessage}</p>}
  </main>

  if (mode === 'precision') return <PrecisionCapture onAnalyzedImage={onAnalyzedImage} onCancel={() => setMode('choose')} onUseUploadInstead={() => setMode('upload')} />

  if (mode === 'upload') {
    return (
      <div>
        <UploadScreen onImageReady={onImageReady} errorMessage={errorMessage} />
        <p className="mx-auto max-w-2xl px-6 pb-14 text-sm sm:px-10">
          <button
            onClick={() => setMode('camera')}
            className="text-ink-soft underline decoration-hairline underline-offset-4 hover:text-ink"
          >
            Use my camera instead
          </button>
        </p>
      </div>
    )
  }

  return (
    <CameraCapture
      onAnalyzedImage={onAnalyzedImage}
      onCancel={() => setMode('choose')}
      onUseUploadInstead={() => setMode('upload')}
      errorMessage={errorMessage}
    />
  )
}
