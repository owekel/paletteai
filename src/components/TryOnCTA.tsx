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
        <div className="aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-[0_24px_60px_-24px_rgba(28,26,23,0.4)]">
          <img src={imageDataUrl} alt="Your captured photo" className="h-full w-full object-cover" />
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-ink-soft">A new way to explore your palette</p>
        <h2 className="mt-2 font-display text-4xl leading-tight text-ink sm:text-5xl">
          See Yourself in Your Colours
        </h2>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-ink-soft">
          Try any of your recommended colours directly on your own photo — the shading, folds, and
          texture stay real, only the colour changes.
        </p>

        {accentColors.length > 0 && (
          <div className="mt-6 flex max-w-xs gap-1.5">
            {accentColors.map((color) => (
              <span key={color.hex} className="h-2 flex-1 rounded-full" style={{ backgroundColor: color.hex }} />
            ))}
          </div>
        )}

        <button
          onClick={onStart}
          className="group mt-8 inline-flex items-center gap-2 bg-ink px-8 py-4 text-base font-medium text-paper transition-colors hover:bg-accent"
        >
          Try On Your Colours
          <ArrowIcon />
        </button>
      </div>
    </div>
  )
}
