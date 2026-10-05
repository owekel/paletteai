interface LandingPageProps {
  onStart: () => void
}

// A loose, editorial arrangement of example swatches for the hero. These are
// just for show on the landing page — real results are generated per photo.
const EXAMPLE_SWATCHES = [
  { name: 'Rust', hex: '#B5502A' },
  { name: 'Royal Blue', hex: '#1E3A8A' },
  { name: 'Warm Ivory', hex: '#F6F1E4' },
  { name: 'Sage Green', hex: '#8FA88C' },
  { name: 'Fuchsia', hex: '#C6247A' },
  { name: 'Mustard', hex: '#C99A2E' },
]

const STEPS = [
  {
    title: 'Find your light',
    body: 'Choose a guided three-photo scan, a quick camera photo, or an upload — no account, no sign-up.',
  },
  {
    title: 'We read your colouring',
    body: 'Your undertone, depth, and contrast are estimated right in your browser.',
  },
  {
    title: 'Get your palette',
    body: 'A full colour palette and wardrobe suggestions, built around what suits you.',
  },
]

export default function LandingPage({ onStart }: LandingPageProps) {
  return (
    <div className="mx-auto max-w-content px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
      <header className="mb-16 flex items-center justify-between sm:mb-24">
        <span className="font-display text-xl tracking-tight">PaletteAI</span>
        <span className="hidden text-sm text-ink-soft sm:inline">A colour analysis tool</span>
      </header>

      <section className="grid gap-14 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10">
        <div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Find the colours that work with you.
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
            Use guided capture or upload a photo. PaletteAI reads your skin, hair, and eye colouring to build a
            personal clothing colour palette — the shades likely to complement you, and the ones
            worth using more carefully.
          </p>

          <button
            onClick={onStart}
            className="mt-10 inline-flex items-center gap-2 bg-ink px-8 py-4 text-base font-medium text-paper transition-colors hover:bg-accent"
          >
            Analyze My Colours
          </button>

          <p className="mt-4 text-sm text-ink-soft">
            A short session, at your pace. Your photos stay in your browser.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {EXAMPLE_SWATCHES.map((swatch) => (
            <div
              key={swatch.hex}
              className="flex aspect-square flex-col justify-end p-3"
              style={{ backgroundColor: swatch.hex }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: isLightColor(swatch.hex) ? '#1C1A17' : '#F3EFE6' }}
              >
                {swatch.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-24 border-t border-hairline pt-14 sm:mt-32">
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, index) => (
            <div key={step.title}>
              <span className="font-display text-2xl text-accent">{index + 1}</span>
              <h2 className="mt-3 font-display text-xl text-ink">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-24 border-t border-hairline pt-8 pb-4 text-sm text-ink-soft">
        PaletteAI is a style tool, not a scientific or medical one — think of it as a starting
        point, not a rulebook.
      </footer>
    </div>
  )
}

// Rough check so the swatch label stays readable regardless of the swatch's
// own colour, without needing a design pass per colour.
function isLightColor(hex: string): boolean {
  const value = parseInt(hex.replace('#', ''), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 150
}
