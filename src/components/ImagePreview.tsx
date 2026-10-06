interface ImagePreviewProps {
  dataUrl: string
  onRemove: () => void
}

export default function ImagePreview({ dataUrl, onRemove }: ImagePreviewProps) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-hairline">
      <img src={dataUrl} alt="Your uploaded photo" className="h-full w-full object-cover" />
      <button
        onClick={onRemove}
        className="ui-button ui-button-secondary absolute right-3 top-3 bg-paper"
      >
        Remove
      </button>
    </div>
  )
}
