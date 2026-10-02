import { useState } from 'react'
import type { ColorProfile, Screen } from './types/colorProfile'
import LandingPage from './components/LandingPage'
import CaptureScreen from './components/CaptureScreen'
import AnalysisLoading from './components/AnalysisLoading'
import ResultsPage from './components/ResultsPage'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [profile, setProfile] = useState<ColorProfile | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

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
    // Kept (rather than cleared) now that the results page uses it for the
    // colour try-on feature. Still never leaves the browser or a server.
    setScreen('results')
  }

  function handleStartOver() {
    setProfile(null)
    setImageDataUrl(null)
    setScreen('upload')
  }

  return (
    <div className="min-h-screen bg-paper">
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
        />
      )}

      {screen === 'results' && profile && imageDataUrl && (
        <ResultsPage
          profile={profile}
          capturedImageDataUrl={imageDataUrl}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  )
}
