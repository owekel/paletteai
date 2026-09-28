import type { ColorPalette } from '../types/colorProfile'
import ColourSwatch from './ColourSwatch'

interface ColourPaletteProps {
  palette: ColorPalette
}

export default function ColourPalette({ palette }: ColourPaletteProps) {
  return (
    <div className="space-y-14">
      <PaletteGroup
        title="Best Colours"
        intro="The shades most likely to complement your colouring."
        swatches={palette.best}
      />

      <PaletteGroup
        title="Good Neutrals"
        intro="Reliable neutrals that pair easily with the colours above."
        swatches={palette.neutrals}
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
}: {
  title: string
  intro: string
  swatches: ColorPalette['best']
}) {
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      <p className="mt-1 max-w-lg text-sm text-ink-soft">{intro}</p>
      <div className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {swatches.map((swatch) => (
          <ColourSwatch
            key={swatch.hex}
            name={swatch.name}
            hex={swatch.hex}
            description={swatch.description}
            size="large"
          />
        ))}
      </div>
    </div>
  )
}
