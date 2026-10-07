import type { ColorSwatchData } from '../types/colorProfile'

/** A graphic echo of the existing palette, never a second recommendation model. */
export default function PaletteStrip({ colours, className = '' }: {
  colours: Pick<ColorSwatchData, 'hex' | 'name'>[]
  className?: string
}) {
  if (!colours.length) return null
  return <div className={`palette-strip ${className}`} aria-hidden="true">
    {colours.map((colour, index) => <span key={`${colour.hex}-${index}`} style={{ backgroundColor: colour.hex }} />)}
  </div>
}
