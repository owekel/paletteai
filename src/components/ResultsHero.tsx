import type { ColorPalette, ColorProfile } from '../types/colorProfile'
import ColourSwatch from './ColourSwatch'

interface ResultsHeroProps {
  profile: ColorProfile
  palette: ColorPalette
}

function confidenceDescription(confidence: number): string {
  if (confidence >= 0.8) return 'a fairly clear-cut read'
  if (confidence >= 0.65) return 'a reasonably confident read'
  return 'a less clear-cut read, closer to a best estimate'
}

// The large opening moment of the results page: season name as the
// headline, a short explanation, and the person's own palette as a real
// visual gallery — all built from data the existing analysis already
// produced, nothing new is calculated here.
export default function ResultsHero({ profile, palette }: ResultsHeroProps) {
  return (
    <div>
      <p className="font-display text-xl tracking-tight">PaletteAI</p>

      <h1 className="mt-6 font-display text-6xl leading-[1.02] text-ink sm:text-7xl lg:text-8xl">
        {profile.seasonLabel}
      </h1>

      <p className="mt-7 max-w-2xl text-lg leading-relaxed text-ink-soft">{profile.seasonReasoning}</p>

      <p className="mt-4 max-w-2xl text-sm text-ink-soft">
        This was {confidenceDescription(profile.confidence)} — colour analysis is inherently a
        little subjective, so treat it as a helpful starting point rather than a fixed rule.
      </p>

      {profile.analysisNotes.length > 0 && (
        <div className="mt-4 max-w-2xl border border-accent bg-accent-soft px-4 py-3 text-sm text-accent">
          <p className="font-medium">Why this reading may be less precise:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            {profile.analysisNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {palette.best.length > 0 && (
        <div className="mt-16">
          <p className="text-sm font-medium text-ink-soft">Your Palette</p>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-4">
            {palette.best.map((swatch) => (
              <ColourSwatch key={swatch.hex} name={swatch.name} hex={swatch.hex} size="large" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
