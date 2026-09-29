import type { ColorPalette } from '../types/colorProfile'
import ColourSwatch from './ColourSwatch'

interface ColourPaletteProps {
  palette: ColorPalette
  mode?: 'season' | 'consensus' | 'starter'
}

export default function ColourPalette({ palette, mode = 'season' }: ColourPaletteProps) {
  return (
    <div className="space-y-14">
      <PaletteGroup
        title={mode === 'season' ? 'Signature colours' : mode === 'consensus' ? 'Best colours to start with' : 'Everyday colours to compare'}
        intro={mode === 'season' ? 'Start here for colour close to your face.' : mode === 'consensus' ? 'The strongest starting options from the available colour evidence.' : 'Use these as reference points to discover the effects you enjoy.'}
        swatches={palette.best}
        concise={mode !== 'season'}
      />

      <PaletteGroup
        title="Good Neutrals"
        intro="Foundations to combine with the colours above."
        swatches={palette.neutrals}
        concise={mode !== 'season'}
      />

      <PaletteGroup
        title="Colours to Use Sparingly"
        intro="Not off-limits — these may just create less harmony with your detected colouring, so they tend to work better in small doses."
        swatches={palette.useCarefully}
      />
    </div>
  )
}

function PaletteGroup({
  title,
  intro,
  swatches,
  concise = false,
}: {
  title: string
  intro: string
  swatches: ColorPalette['best']
  concise?: boolean
}) {
  if (!swatches.length) return null
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-1 max-w-lg text-sm text-ink-soft">{intro}</p>
      <div className={`mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 ${concise ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
        {swatches.map((swatch) => (
          <ColourSwatch
            key={swatch.hex}
            name={swatch.name}
            hex={swatch.hex}
            description={concise ? undefined : swatch.description}
            size="large"
          />
        ))}
      </div>
    </div>
  )
}
