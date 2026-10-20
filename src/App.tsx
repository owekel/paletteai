import { lazy, Suspense, useEffect, useState } from 'react'
import type { ColorProfile, Screen } from './types/colorProfile'
import LandingPage from './components/LandingPage'
import PrivacyPage from './components/PrivacyPage'

const CaptureScreen = lazy(() => import('./components/CaptureScreen'))
const AnalysisLoading = lazy(() => import('./components/AnalysisLoading'))
const ResultsPage = lazy(() => import('./components/ResultsPage'))

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [profile, setProfile] = useState<ColorProfile | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [screen])

  function handleStart() {
    setScreen('upload')
  }

  function handleImageReady(dataUrl: string) {
    setAnalysisError(null)
    setImageDataUrl(dataUrl)
    setScreen('loading')
  }

  function handleAnalysisError(message: string) {
    setAnalysisError(message)
    setImageDataUrl(null)
    setScreen('upload')
  }

  function handleAnalysisComplete(result: ColorProfile) {
    setProfile(result)
    // Keep the photo in memory for local colour try-on.
    setScreen('results')
  }

  function handleStartOver() {
    setProfile(null)
    setImageDataUrl(null)
    setAnalysisError(null)
    void import('./services/vision/loadVisionModels')
      .then(({ releaseStillVisionModels }) => releaseStillVisionModels())
      .catch(() => { /* A failed chunk load must not prevent starting over. */ })
    setScreen('upload')
  }

  if (window.location.pathname === '/privacy') return <PrivacyPage />

  return (
    <div className="min-h-screen bg-paper">
      <Suspense fallback={<main className="page-shell"><p role="status" className="ui-copy py-16">Opening your colour guide…</p></main>}>
      {screen === 'landing' && <LandingPage onStart={handleStart} />}

      {screen === 'upload' && (
        <CaptureScreen onImageReady={handleImageReady} errorMessage={analysisError}
          onCancel={() => { setAnalysisError(null); setScreen('landing') }}
          onAnalyzedImage={(image, result) => {
            setAnalysisError(null)
            setImageDataUrl(image)
            setProfile(result)
            setScreen('results')
          }} />
      )}

      {screen === 'loading' && imageDataUrl && (
        <AnalysisLoading
          imageDataUrl={imageDataUrl}
          onComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
          onCancel={handleStartOver}
        />
      )}
      {screen === 'results' && profile && imageDataUrl && (
        <ResultsPage
          profile={profile}
          capturedImageDataUrl={imageDataUrl}
          onStartOver={handleStartOver}
        />
      )}
      </Suspense>
      <div className="page-shell pb-6 text-xs"><a className="ui-text-action" href="/privacy">Photo privacy</a></div>
    </div>
  )
}
