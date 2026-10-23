import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import ImagePreview from './ImagePreview'
import SiteHeader from './SiteHeader'
import { readUploadPhoto } from '../services/uploadPhoto'

interface UploadScreenProps {
  onImageReady: (dataUrl: string) => void
  errorMessage?: string | null
  onBack?: () => void
  onUseCamera?: () => void
}

export default function UploadScreen({ onImageReady, errorMessage, onBack, onUseCamera }: UploadScreenProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pending = useRef<AbortController>()
  useEffect(() => () => pending.current?.abort(), [])

  async function handleFile(file: File | undefined) {
    if (!file) return

    pending.current?.abort()
    const abort = new AbortController()
    pending.current = abort
    setError(null)
    setDataUrl(null)
    setReading(true)
    try {
      const result = await readUploadPhoto(file, abort.signal)
      if (!abort.signal.aborted) setDataUrl(result)
    } catch (error) {
      if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'We couldn’t read that photo. Try another JPG or PNG.')
    } finally {
      if (!abort.signal.aborted) { setReading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    void handleFile(event.dataTransfer.files?.[0])
  }

  function handleRemove() {
    pending.current?.abort()
    setReading(false)
    setDataUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <main className="page-shell page-shell-narrow">
      <SiteHeader onAction={onBack} />

      <p className="ui-eyebrow">01 / Your photo</p>
      <h1 className="ui-title mt-4">Start with a clear portrait.</h1>
      <p className="ui-copy mt-4">
        Face the camera in soft, even light. Skip strong filters and coloured lighting.
      </p>

      {errorMessage && (
        <p role="alert" className="ui-notice mt-6">
          {errorMessage}
        </p>
      )}

      <div className="mt-8">
        {dataUrl ? (
          <ImagePreview dataUrl={dataUrl} onRemove={handleRemove} />
        ) : (
          <div
            onDragOver={(event: DragEvent<HTMLDivElement>) => {
              event.preventDefault()
              setIsDraggingOver(true)
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); fileInputRef.current?.click() }
            }}
            aria-label="Choose or drop a portrait photo"
            className={`upload-drop gap-3 ${isDraggingOver ? 'upload-drop-active' : ''}`}
          >
            <UploadIcon />
            <p className="text-ink">
              <span className="font-medium">Choose a photo</span> or drop one here
            </p>
            <p className="text-sm text-ink-soft">JPG, PNG or WebP · up to 15 MB</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          onChange={handleInputChange}
          className="hidden"
        />

        {reading && <p role="status" className="mt-3 text-sm text-ink-soft">Opening your photo…</p>}
        {error && <p role="alert" className="mt-3 text-sm text-accent">{error}</p>}
      </div>

      <button
        onClick={() => dataUrl && onImageReady(dataUrl)}
        disabled={!dataUrl || reading}
        className="ui-button ui-button-primary mt-6"
      >
        Analyse this photo <span aria-hidden="true">→</span>
      </button>
      {onUseCamera && <div className="mt-4"><button className="ui-text-action" onClick={onUseCamera}>Use my camera instead</button></div>}
      <footer className="ui-footer"><p>Your photo stays in this browser.</p></footer>
    </main>
  )
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-ink-soft">
      <path
        d="M12 16V4m0 0L7 9m5-5l5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
