import { useEffect, useState } from 'react'
import CameraCapture from './CameraCapture'
import PrecisionCapture from './PrecisionCapture'
import UploadScreen from './UploadScreen'
import type { ColorProfile } from '../types/colorProfile'
import SiteHeader from './SiteHeader'
import './guidedCapture.css'

interface CaptureScreenProps {
  onImageReady: (dataUrl: string) => void
  onAnalyzedImage: (dataUrl: string, profile: ColorProfile) => void
  onCancel: () => void
  errorMessage?: string | null
}

// Decides how the person gets a photo into the app: the camera (default)
// or the existing file-upload flow (used as a fallback, or just by
// preference). UploadScreen reuses the existing file-processing workflow.
// Camera review supplies the already-verified profile; uploads retain the
// existing loading flow. Both use the same analysis and results pipeline.
export default function CaptureScreen({ onImageReady, onAnalyzedImage, onCancel, errorMessage }: CaptureScreenProps) {
  const [mode, setMode] = useState<'choose' | 'precision' | 'camera' | 'upload'>('choose')
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [mode])

  if (mode === 'choose') return <main className="page-shell page-shell-narrow">
    <SiteHeader onAction={onCancel} />
    <div className="entry-intro"><p className="ui-eyebrow">01 / Your starting point</p><h1 className="ui-title mt-4">A little light. A clearer picture.</h1><p className="ui-copy mt-4">Three photos help us find the qualities that hold steady. Face a soft light, keep your forehead and cheeks visible, and settle in.</p></div>
    <section className="entry-primary"><div><p className="ui-eyebrow">Recommended · 3 photos</p><h2 className="ui-subheading mt-3">Precision Analysis</h2><p className="ui-copy mt-2 text-sm">A short guided scan. Each photo is captured automatically when you’re ready.</p></div><button className="ui-button ui-button-primary" onClick={() => setMode('precision')}>Start guided scan <span aria-hidden="true">→</span></button></section>
    <div className="entry-alternatives"><section><h2 className="ui-subheading">Just exploring?</h2><p className="mt-2 text-sm text-ink-soft">Quick Analysis uses one guided photo.</p><button className="ui-text-action mt-2" onClick={() => setMode('camera')}>Take one photo →</button></section><section><h2 className="ui-subheading">Have a photo ready?</h2><p className="mt-2 text-sm text-ink-soft">Choose a clear, naturally lit portrait.</p><button className="ui-text-action mt-2" onClick={() => setMode('upload')}>Upload a photo →</button></section></div>
    <footer className="ui-footer"><p>Stay in the same soft light throughout your scan.</p><p>Private, in your browser.</p></footer>
    {errorMessage && <p role="alert" className="ui-notice mt-5">{errorMessage}</p>}
  </main>

  if (mode === 'precision') return <PrecisionCapture onAnalyzedImage={onAnalyzedImage} onCancel={() => setMode('choose')} onUseUploadInstead={() => setMode('upload')} />

  if (mode === 'upload') {
    return (
      <UploadScreen onImageReady={onImageReady} errorMessage={errorMessage} onBack={() => setMode('choose')} onUseCamera={() => setMode('camera')} />
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
