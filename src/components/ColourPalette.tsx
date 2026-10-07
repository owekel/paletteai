import type { ColorPalette } from '../types/colorProfile'
import ColourSwatch from './ColourSwatch'

interface ColourPaletteProps {
  palette: ColorPalette
  mode?: 'season' | 'consensus' | 'starter'
}

export default function ColourPalette({ palette, mode = 'season' }: ColourPaletteProps) {
  return (
    <div>
      <PaletteGroup
        title={mode === 'season' ? 'Your strongest colours' : mode === 'consensus' ? 'Best colours to start with' : 'Everyday shades to explore'}
        intro={mode === 'season' ? 'Try these close to your face: a tee, a knit, a scarf.' : mode === 'consensus' ? 'A shared starting point across your possible palettes.' : 'Reference shades for noticing the effects you enjoy.'}
        swatches={palette.best}
        concise={mode !== 'season'}
        layout="editorial"
      />

      <PaletteGroup
        title="Easy neutrals"
        intro="Foundations to combine with the colours above."
        swatches={palette.neutrals}
        concise={mode !== 'season'}
        layout="neutral"
      />

      {palette.useCarefully.length > 0 && <details className="ui-disclosure mt-10"><summary>For a different effect</summary><div className="mt-4"><PaletteGroup title="Colours to use thoughtfully" intro="Not off-limits. These make a stronger statement; try them as an accent." swatches={palette.useCarefully} /></div></details>}
    </div>
  )
}

function PaletteGroup({
  title,
  intro,
  swatches,
  concise = false,
  layout = 'standard',
}: {
  title: string
  intro: string
  swatches: ColorPalette['best']
  concise?: boolean
  layout?: 'editorial' | 'neutral' | 'standard'
}) {
  if (!swatches.length) return null
  return (
    <div className={`palette-group palette-group-${layout}`}>
      <h3 className="ui-subheading">{title}</h3>
      <p className="mt-1 max-w-lg text-sm text-ink-soft">{intro}</p>
      <div className="palette-grid">
        {swatches.map((swatch, index) => (
          <ColourSwatch
            key={swatch.hex}
            name={swatch.name}
            hex={swatch.hex}
            description={concise ? undefined : swatch.description}
            size="large"
            number={index + 1}
          />
        ))}
      </div>
    </div>
  )
}
