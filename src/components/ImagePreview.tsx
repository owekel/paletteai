interface ImagePreviewProps {
  dataUrl: string
  onRemove: () => void
}

export default function ImagePreview({ dataUrl, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden border border-hairline">
      <img src={dataUrl} alt="Your uploaded photo" className="h-full w-full object-cover" />
      <button
        onClick={onRemove}
        className="absolute right-3 top-3 bg-ink/80 px-3 py-1.5 text-sm text-paper backdrop-blur-sm transition-colors hover:bg-accent"
      >
        Remove
      </button>
    </div>
  )
}
