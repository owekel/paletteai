import { useState } from 'react'
import CameraCapture from './CameraCapture'
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
  const [mode, setMode] = useState<'camera' | 'upload'>('camera')

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
      onCancel={onCancel}
      onUseUploadInstead={() => setMode('upload')}
      errorMessage={errorMessage}
    />
  )
}
