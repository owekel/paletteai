import type { ColorPalette } from '../types/colorProfile'

interface TryOnCTAProps {
  imageDataUrl: string
  palette: ColorPalette
  onStart: () => void
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="transition-transform group-hover:translate-x-1">
      <path
        d="M5 12h14m0 0l-6-6m6 6l-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// A large, editorial preview of Color Try-On, using the person's own
// captured photo — not a generic feature card. Leads into the existing
// interactive experience below (see ColorTryOn.tsx); nothing here touches
// the photo or runs any processing itself.
export default function TryOnCTA({ imageDataUrl, palette, onStart }: TryOnCTAProps) {
  const accentColors = palette.best.slice(0, 6)

  return (
    <div className="grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
      <div className="mx-auto w-full max-w-xs sm:max-w-sm">
        <div className="aspect-[3/4] w-full overflow-hidden rounded-xl">
          <img src={imageDataUrl} alt="Your captured photo" className="h-full w-full object-cover" />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink-soft">A new way to explore your palette</p>
        <h2 className="ui-heading mt-2">
          See it on you.
        </h2>
        <p className="ui-copy mt-4">
          Browse your colourways on your own photo. The same clothing, in a different shade.
        </p>

        {accentColors.length > 0 && (
          <div className="mt-6 flex max-w-xs gap-1.5">
            {accentColors.map((color) => (
              <span key={color.hex} className="h-2 flex-1" style={{ backgroundColor: color.hex }} />
            ))}
          </div>
        )}

        <button
          onClick={onStart}
          className="ui-button ui-button-primary group mt-6"
        >
          Try your colours
          <ArrowIcon />
        </button>
      </div>
    </div>
  )
}
