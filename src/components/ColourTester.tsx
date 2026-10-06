import { useMemo, useState, type ChangeEvent } from 'react'
import type { ColorPalette } from '../types/colorProfile'
import { evaluateColorMatch } from '../services/evaluateColorMatch'
import { isValidHex } from '../services/colorUtils'

interface ColourTesterProps {
  palette: ColorPalette
  shared?: boolean
}

export default function ColourTester({ palette, shared = false }: ColourTesterProps) {
  const [hex, setHex] = useState('#4A6FA5')

  const normalizedHex = hex.startsWith('#') ? hex : `#${hex}`
  const result = useMemo(() => {
    if (!isValidHex(normalizedHex)) return null
    return evaluateColorMatch(normalizedHex, palette, shared)
  }, [normalizedHex, palette, shared])

  return (
    <div className="border-t border-hairline pt-10">
      <h2 className="ui-heading">Have a colour in mind?</h2>
      <p className="mt-1 max-w-lg text-sm text-ink-soft">
        Compare a shade with {shared ? 'your starting colours' : 'your palette'} before trying it on.
      </p>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={isValidHex(normalizedHex) ? normalizedHex : '#4A6FA5'}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setHex(event.target.value)}
            className="ui-input h-12 w-12 cursor-pointer p-1"
            aria-label="Pick a colour"
          />
          <input
            type="text"
            value={hex}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setHex(event.target.value)}
            placeholder="#4A6FA5"
            aria-label="Colour to compare, hex code"
            className="ui-input w-32 font-mono uppercase"
            maxLength={7}
          />
        </div>

        <div className="flex-1">
          {result ? (
            <div>
              <p className="text-sm font-medium text-ink-soft">How this colour may work for you</p>
              <span className="mt-2 block text-sm font-medium text-ink">
                {result.rating}
              </span>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
                {result.explanation}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Enter a valid hex code, like #4A6FA5.</p>
          )}
        </div>
      </div>
    </div>
  )
}
