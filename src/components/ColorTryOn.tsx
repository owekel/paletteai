// "Try On Your Colours" — lets the person preview a recommended (or
// custom) colour on the clothing in their own captured photo. Reuses the
// captured photo (passed in as a prop from App.tsx/ResultsPage.tsx), the
// existing recommended palette data, and the clothingRecolor service.

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { ColorPalette } from '../types/colorProfile'
import {
  applyClothingColor,
  prepareClothingRecolorSession,
  type ClothingRecolorSession,
} from '../services/clothingRecolor'
import { isValidHex } from '../services/colorUtils'
import type { ColourComparison } from '../types/seasonAnalysis'
import ColourComparisons from './ColourComparisons'

interface ColorTryOnProps {
  imageDataUrl: string
  palette: ColorPalette
  recommendationLabel?: string
  comparisons?: ColourComparison[]
  requestedColour?: { hex: string; requestId: number }
}

type SessionStatus = 'loading' | 'ready' | 'no-clothing' | 'error'

const DEFAULT_CUSTOM_HEX = '#4A6FA5'

function normalizeHex(value: string): string {
  return value.startsWith('#') ? value : `#${value}`
}

// Presentational-only helper (mirrors the one already used on the landing
// page) — decides whether a selected-swatch checkmark should be light or
// dark so it stays legible on any colour.
function isLightColor(hex: string): boolean {
  const value = parseInt(hex.replace('#', ''), 16)
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b
  return luminance > 150
}

function CheckIcon({ dark }: { dark: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 13l4 4L19 7"
        stroke={dark ? 'var(--text-primary)' : 'var(--background)'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ColorTryOn({ imageDataUrl, palette, recommendationLabel = 'Recommended for you', comparisons = [], requestedColour }: ColorTryOnProps) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_HEX)
  const [recoloredDataUrl, setRecoloredDataUrl] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [view, setView] = useState<'before' | 'after'>('after')
  const [preparationAttempt, setPreparationAttempt] = useState(0)

  const sessionRef = useRef<ClothingRecolorSession | null>(null)
  const applicationTimerRef = useRef<number | null>(null)

  // The same recommended colours already shown in "Your Palette" above —
  // no second colour system.
  const swatchOptions = [...palette.best, ...palette.neutrals]

  function applyColor(hex: string) {
    if (applicationTimerRef.current !== null) window.clearTimeout(applicationTimerRef.current)
    setSelectedHex(hex)
    setCustomHex(hex)
    setView('after')
    setIsApplying(true)
    setApplyError(null)
    // Deferred one tick so the "Applying colour…" state has a chance to
    // paint before the (synchronous) pixel processing runs.
    applicationTimerRef.current = window.setTimeout(() => {
      const session = sessionRef.current
      try {
        if (session) setRecoloredDataUrl(applyClothingColor(session, hex))
      } catch {
        setApplyError('This shade could not be previewed. Please try another colour.')
      } finally {
        applicationTimerRef.current = null
        setIsApplying(false)
      }
    }, 0)
  }

  useEffect(() => {
    const abort = new AbortController()
    setStatus('loading')
    setRecoloredDataUrl(null)
    setSelectedHex(null)
    setIsApplying(false)
    setApplyError(null)
    setView('after')
    setCustomHex(DEFAULT_CUSTOM_HEX)
    sessionRef.current = null

    const preparationTimer = window.setTimeout(() => {
      abort.abort()
      setStatus('error')
    }, 25000)
    prepareClothingRecolorSession(imageDataUrl, abort.signal)
      .then((session) => {
        if (abort.signal.aborted) return
        if (!session || !session.hasClothing) {
          setStatus('no-clothing')
          return
        }
        sessionRef.current = session
        setStatus('ready')

        const firstColor = swatchOptions[0]
        if (firstColor) applyColor(firstColor.hex)
      })
      .catch(() => {
        if (!abort.signal.aborted) setStatus('error')
      })
      .finally(() => window.clearTimeout(preparationTimer))

    return () => {
      abort.abort()
      window.clearTimeout(preparationTimer)
      if (applicationTimerRef.current !== null) window.clearTimeout(applicationTimerRef.current)
      applicationTimerRef.current = null
      sessionRef.current = null
    }
    // The photo or an explicit retry restarts this — palette/swatchOptions
    // are effectively static for the lifetime of a results page.
  }, [imageDataUrl, preparationAttempt])

  // A comparison clicked above queues until segmentation is ready. Only the
  // requested colour changes; the prepared mask/session is reused.
  useEffect(() => {
    if (requestedColour && status === 'ready') applyColor(requestedColour.hex)
  }, [requestedColour, status])

  function handleCustomHexCommit() {
    const normalized = normalizeHex(customHex)
    if (isValidHex(normalized) && normalized.toLowerCase() !== selectedHex?.toLowerCase()) {
      applyColor(normalized)
    }
  }

  const customHexForPicker = isValidHex(normalizeHex(customHex)) ? normalizeHex(customHex) : DEFAULT_CUSTOM_HEX

  // Presentational only: which recommended swatch (if any) matches the
  // current selection, for the name/hex feedback readout below.
  const selectedSwatch = [...swatchOptions, ...comparisons.flatMap(c => c.options)].find((swatch) => swatch.hex.toLowerCase() === selectedHex?.toLowerCase())
  const selectedLabel = selectedHex ? (selectedSwatch ? selectedSwatch.name : 'Custom colour') : null

  // Whether the ORIGINAL photo should be the visible layer right now —
  // true while viewing "before", and also before any recoloured result
  // exists yet, so the photo is never blank while the first colour applies.
  const showBefore = view === 'before' || !recoloredDataUrl

  return (
    <div>
      <h2 className="ui-heading">See it on you.</h2>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-ink-soft">
        Browse your colourways. The same clothing, in a different shade.
      </p>

      {status !== 'ready' && <div className="tryon-placeholder"><img src={imageDataUrl} alt="Your photo, ready for colour comparison" />
        <p role="status" className="ui-copy">{status === 'loading' ? 'Preparing your clothing preview…' : status === 'error'
          ? 'Try-on couldn’t prepare this photo. Your palette is still ready to explore.'
          : 'For try-on, choose a portrait that shows more of your top. Your colour guide is still ready.'}</p>
        {status === 'error' && <button className="ui-text-action mt-3" onClick={() => setPreparationAttempt(attempt => attempt + 1)}>Try clothing preview again</button>}
      </div>}

      {status === 'ready' && (
        <div className="tryon-layout">
          {applyError && <p role="alert" className="mb-4 text-sm text-accent">{applyError}</p>}
          {/* Photo hero */}
          <div className="tryon-photo">
            <div className="tryon-toggle" aria-label="Photo comparison">
              <button onClick={() => setView('before')} aria-pressed={view === 'before'}>Original</button>
              <button onClick={() => setView('after')} aria-pressed={view === 'after'} disabled={!recoloredDataUrl}>Try-on</button>
            </div>
            <div className="tryon-photo-frame">
              <img
                src={imageDataUrl}
                alt="Your original photo"
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-in-out ${
                  showBefore ? 'opacity-100' : 'opacity-0'
                }`}
              />
              {recoloredDataUrl && (
                <img
                  src={recoloredDataUrl}
                  alt="Photo with try-on colour applied"
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ease-in-out ${
                    showBefore ? 'opacity-0' : 'opacity-100'
                  }`}
                />
              )}

            </div>
            <p className="tryon-working" role="status" aria-live="polite">{isApplying ? 'Applying colour…' : selectedLabel ? `${view === 'before' ? 'Original photo' : selectedLabel} · preview only` : 'Choose a shade to begin.'}</p>
          </div>

          {/* Colour selection */}
          <div className="tryon-selection min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h3 className="ui-subheading">{recommendationLabel}</h3>
              {selectedLabel && (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-sm border border-hairline"
                    style={{ backgroundColor: selectedHex ?? undefined }}
                  />
                  <span className="text-ink">
                    <span className="font-medium">{selectedLabel}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="tryon-choices">
              {swatchOptions.map((swatch) => {
                const isSelected = selectedHex?.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.hex}
                    onClick={() => applyColor(swatch.hex)}
                    title={swatch.name}
                    aria-label={`Try ${swatch.name}`}
                    aria-pressed={isSelected}
                    className="tryon-choice"
                  >
                    <span style={{ backgroundColor: swatch.hex }}>{isSelected && <CheckIcon dark={isLightColor(swatch.hex)} />}</span>
                    <span>{swatch.name}</span>
                  </button>
                )
              })}
            </div>

            {comparisons.length > 0 && (
              <div className="mt-8">
                <h3 className="ui-subheading">Compare these shades</h3>
                <p className="mb-4 mt-2 text-sm text-ink-soft">Switch between the shades and notice what you prefer. Your analysis stays the same.</p>
                <ColourComparisons comparisons={comparisons} compact selectedHex={selectedHex} onSelect={colour => applyColor(colour.hex)} />
              </div>
            )}

            {/* Custom colour — visually separated from the recommendations above */}
            <div className="mt-8 border-t border-hairline pt-6">
              <h3 className="text-sm font-medium">Try another shade</h3>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={customHexForPicker}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => applyColor(event.target.value)}
                  className="ui-input h-11 w-11 cursor-pointer p-1"
                  aria-label="Pick a custom colour"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setCustomHex(event.target.value)}
                  onBlur={handleCustomHexCommit}
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') handleCustomHexCommit()
                  }}
                  placeholder={DEFAULT_CUSTOM_HEX}
                  aria-label="Custom colour hex code"
                  className="ui-input w-32 font-mono uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
