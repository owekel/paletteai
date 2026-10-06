import type { ColourComparison } from '../types/seasonAnalysis'
import type { ColorSwatchData } from '../types/colorProfile'

export default function ColourComparisons({ comparisons, onSelect, selectedHex, compact = false }: {
  comparisons: ColourComparison[]
  onSelect: (colour: ColorSwatchData) => void
  selectedHex?: string | null
  compact?: boolean
}) {
  if (!comparisons.length) return null
  return (
    <div className={compact ? 'space-y-5' : 'comparison-grid'}>
      {comparisons.map(pair => (
        <div key={pair.id} className="border-t border-hairline pt-4">
          <h3 className="ui-subheading">{pair.title}</h3>
          {!compact && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{pair.description}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            {pair.options.map(colour => (
              <button key={colour.hex} type="button" onClick={() => onSelect(colour)}
                aria-label={`Try ${colour.name}`} aria-pressed={selectedHex === undefined ? undefined : selectedHex?.toLowerCase() === colour.hex.toLowerCase()}
                className="comparison-colour">
                <span className="comparison-colour-sample" style={{ backgroundColor: colour.hex, height: compact ? 48 : undefined }} />
                <span className="mt-2 block text-sm font-medium">{colour.name}</span>
                <span className="mt-1 block text-xs text-ink-soft">{selectedHex?.toLowerCase() === colour.hex.toLowerCase() ? 'Showing in try-on' : 'Try on →'}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
