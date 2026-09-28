import type { WardrobeColors, ColorSwatchData } from '../types/colorProfile'
import ColourSwatch from './ColourSwatch'

interface WardrobeSectionProps {
  wardrobe: WardrobeColors
  staples: ColorSwatchData[]
}

const CATEGORY_LABELS: { key: keyof WardrobeColors; label: string }[] = [
  { key: 'tshirts', label: 'T-Shirts' },
  { key: 'dressShirts', label: 'Dress Shirts' },
  { key: 'hoodiesSweaters', label: 'Hoodies / Sweaters' },
  { key: 'jackets', label: 'Jackets' },
  { key: 'pants', label: 'Pants' },
  { key: 'accessories', label: 'Accessories' },
]

export default function WardrobeSection({ wardrobe, staples }: WardrobeSectionProps) {
  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Build Your Wardrobe</h2>
      <p className="mt-1 max-w-lg text-sm text-ink-soft">
        A few starting points for each category, pulled from your palette.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_LABELS.map(({ key, label }) => (
          <div key={key}>
            <h3 className="text-sm font-medium text-ink">{label}</h3>
            <div className="mt-3 flex flex-wrap gap-4">
              {wardrobe[key].map((swatch) => (
                <ColourSwatch
                  key={swatch.hex + key}
                  name={swatch.name}
                  hex={swatch.hex}
                  size="small"
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 border-t border-hairline pt-10">
        <h3 className="font-display text-xl text-ink">Wardrobe Staples</h3>
        <p className="mt-1 max-w-lg text-sm text-ink-soft">
          Versatile basics, tinted to suit your colouring.
        </p>
        <div className="mt-5 flex flex-wrap gap-4">
          {staples.map((swatch) => (
            <ColourSwatch key={swatch.hex} name={swatch.name} hex={swatch.hex} size="small" />
          ))}
        </div>
      </div>
    </div>
  )
}
