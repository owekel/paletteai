import { useState } from 'react'
import type { ColorPalette, ColorProfile, Screen } from './types/colorProfile'
import { generatePalette } from './data/palettes'
import LandingPage from './components/LandingPage'
import CaptureScreen from './components/CaptureScreen'
import AnalysisLoading from './components/AnalysisLoading'
import ResultsPage from './components/ResultsPage'

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [profile, setProfile] = useState<ColorProfile | null>(null)
  const [palette, setPalette] = useState<ColorPalette | null>(null)
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
    setPalette(generatePalette(result))
    // Kept (rather than cleared) now that the results page uses it for the
    // colour try-on feature. Still never leaves the browser or a server.
    setScreen('results')
  }

  function handleStartOver() {
    setProfile(null)
    setPalette(null)
    setImageDataUrl(null)
    setScreen('upload')
  }

  return (
    <div className="min-h-screen bg-paper">
      {screen === 'landing' && <LandingPage onStart={handleStart} />}

      {screen === 'upload' && (
        <CaptureScreen onImageReady={handleImageReady} errorMessage={analysisError} />
      )}

      {screen === 'loading' && imageDataUrl && (
        <AnalysisLoading
          imageDataUrl={imageDataUrl}
          onComplete={handleAnalysisComplete}
          onError={handleAnalysisError}
        />
      )}

      {screen === 'results' && profile && palette && imageDataUrl && (
        <ResultsPage
          profile={profile}
          palette={palette}
          capturedImageDataUrl={imageDataUrl}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  )
}
