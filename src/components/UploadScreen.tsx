import { useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent } from 'react'
import ImagePreview from './ImagePreview'

interface UploadScreenProps {
  onImageReady: (dataUrl: string) => void
  errorMessage?: string | null
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

export default function UploadScreen({ onImageReady, errorMessage }: UploadScreenProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('That file does not look like an image. Please choose a photo instead.')
      return
    }

    setError(null)
    const result = await readFileAsDataUrl(file)
    setDataUrl(result)
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleFile(event.target.files?.[0])
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDraggingOver(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  function handleRemove() {
    setDataUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-14 sm:px-10 sm:py-20">
      <p className="font-display text-xl">PaletteAI</p>

      <h1 className="mt-8 font-display text-3xl text-ink sm:text-4xl">Upload your photo</h1>
      <p className="mt-3 max-w-lg text-ink-soft">
        For the most reliable result, use a well-lit photo facing the camera without strong
        filters or unusual coloured lighting.
      </p>

      {errorMessage && (
        <p className="mt-6 border border-accent bg-accent-soft px-4 py-3 text-sm text-accent">
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
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
            }}
            className={`flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed px-6 text-center transition-colors ${
              isDraggingOver ? 'border-accent bg-accent-soft' : 'border-hairline hover:border-ink-soft'
            }`}
          >
            <UploadIcon />
            <p className="text-ink">
              <span className="font-medium text-accent">Click to select</span> or drag and drop a
              photo
            </p>
            <p className="text-sm text-ink-soft">JPG or PNG, ideally under 10 MB</p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          className="hidden"
        />

        {error && <p className="mt-3 text-sm text-accent">{error}</p>}
      </div>

      <button
        onClick={() => dataUrl && onImageReady(dataUrl)}
        disabled={!dataUrl}
        className="mt-8 inline-flex items-center gap-2 bg-ink px-8 py-4 text-base font-medium text-paper transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:bg-hairline disabled:text-ink-soft"
      >
        Analyze Photo
      </button>
    </div>
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
