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

interface ColorTryOnProps {
  imageDataUrl: string
  palette: ColorPalette
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
        stroke={dark ? '#1C1A17' : '#F3EFE6'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function ColorTryOn({ imageDataUrl, palette }: ColorTryOnProps) {
  const [status, setStatus] = useState<SessionStatus>('loading')
  const [selectedHex, setSelectedHex] = useState<string | null>(null)
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_HEX)
  const [recoloredDataUrl, setRecoloredDataUrl] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [view, setView] = useState<'before' | 'after'>('after')

  const sessionRef = useRef<ClothingRecolorSession | null>(null)

  // The same recommended colours already shown in "Your Palette" above —
  // no second colour system.
  const swatchOptions = [...palette.best, ...palette.neutrals]

  function applyColor(hex: string) {
    setSelectedHex(hex)
    setCustomHex(hex)
    setView('after')
    setIsApplying(true)
    // Deferred one tick so the "Applying colour…" state has a chance to
    // paint before the (synchronous) pixel processing runs.
    window.setTimeout(() => {
      const session = sessionRef.current
      if (session) {
        setRecoloredDataUrl(applyClothingColor(session, hex))
      }
      setIsApplying(false)
    }, 0)
  }

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setRecoloredDataUrl(null)
    setSelectedHex(null)
    sessionRef.current = null

    prepareClothingRecolorSession(imageDataUrl)
      .then((session) => {
        if (cancelled) return
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
        if (!cancelled) setStatus('error')
      })

    return () => {
      cancelled = true
    }
    // Only the photo itself should restart this — palette/swatchOptions
    // are effectively static for the lifetime of a results page.
  }, [imageDataUrl])

  function handleCustomHexCommit() {
    const normalized = normalizeHex(customHex)
    if (isValidHex(normalized)) applyColor(normalized)
  }

  const customHexForPicker = isValidHex(normalizeHex(customHex)) ? normalizeHex(customHex) : DEFAULT_CUSTOM_HEX

  // Presentational only: which recommended swatch (if any) matches the
  // current selection, for the name/hex feedback readout below.
  const selectedSwatch = swatchOptions.find((swatch) => swatch.hex.toLowerCase() === selectedHex?.toLowerCase())
  const selectedLabel = selectedHex ? (selectedSwatch ? selectedSwatch.name : 'Custom colour') : null

  // Whether the ORIGINAL photo should be the visible layer right now —
  // true while viewing "before", and also before any recoloured result
  // exists yet, so the photo is never blank while the first colour applies.
  const showBefore = view === 'before' || !recoloredDataUrl

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Try On Your Colours</h2>
      <p className="mt-1 max-w-lg text-sm leading-relaxed text-ink-soft">
        Preview a recommended (or any) colour on your own photo. Shading, folds, and texture stay
        the same — only the colour changes.
      </p>

      {status === 'loading' && <p className="mt-8 text-sm text-ink-soft">Finding the clothing in your photo…</p>}

      {status === 'error' && (
        <p className="mt-8 max-w-lg text-sm text-ink-soft">
          Something went wrong preparing this photo for try-on. This doesn't affect the rest of
          your results.
        </p>
      )}

      {status === 'no-clothing' && (
        <p className="mt-8 max-w-lg text-sm text-ink-soft">
          We couldn't find a clear clothing area to recolour in this photo — this usually happens
          with a close, face-only crop. Try again with a photo that shows some of your top.
        </p>
      )}

      {status === 'ready' && (
        <div className="mt-8">
          {/* Photo hero */}
          <div className="mx-auto max-w-md">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface shadow-[0_24px_60px_-24px_rgba(28,26,23,0.4)]">
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

              {/* Before / Try-On toggle, overlaid directly on the photo */}
              <div className="absolute left-1/2 top-4 flex -translate-x-1/2 gap-0.5 rounded-full border border-ink/10 bg-paper/90 p-1 shadow-sm backdrop-blur-sm">
                <button
                  onClick={() => setView('before')}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                    view === 'before' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Before
                </button>
                <button
                  onClick={() => setView('after')}
                  disabled={!recoloredDataUrl}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                    view === 'after' ? 'bg-ink text-paper' : 'text-ink-soft hover:text-ink'
                  }`}
                >
                  Try-On
                </button>
              </div>

              {/* Applying-colour overlay */}
              <div
                className={`absolute inset-0 flex items-center justify-center bg-ink/20 backdrop-blur-[1px] transition-opacity duration-200 ${
                  isApplying ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              >
                <div className="flex items-center gap-2 rounded-full bg-paper/95 px-4 py-2 text-sm font-medium text-ink shadow-sm">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                  Applying colour…
                </div>
              </div>
            </div>
          </div>

          {/* Colour selection */}
          <div className="mx-auto mt-10 max-w-2xl">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h3 className="font-display text-lg text-ink">Recommended for You</h3>
              {selectedLabel && (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border border-hairline"
                    style={{ backgroundColor: selectedHex ?? undefined }}
                  />
                  <span className="text-ink">
                    <span className="font-medium">{selectedLabel}</span>
                    {selectedHex && <span className="text-ink-soft"> · {selectedHex.toUpperCase()}</span>}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {swatchOptions.map((swatch) => {
                const isSelected = selectedHex?.toLowerCase() === swatch.hex.toLowerCase()
                return (
                  <button
                    key={swatch.hex}
                    onClick={() => applyColor(swatch.hex)}
                    title={swatch.name}
                    aria-label={swatch.name}
                    aria-pressed={isSelected}
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-200 hover:scale-110 ${
                      isSelected ? 'border-ink' : 'border-hairline hover:border-ink-soft'
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                  >
                    {isSelected && <CheckIcon dark={isLightColor(swatch.hex)} />}
                  </button>
                )
              })}
            </div>

            {/* Custom colour — visually separated from the recommendations above */}
            <div className="mt-8 border-t border-hairline pt-6">
              <h3 className="text-sm font-medium text-ink-soft">Custom Colour</h3>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="color"
                  value={customHexForPicker}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => applyColor(event.target.value)}
                  className="h-11 w-11 cursor-pointer rounded-lg border border-hairline p-1"
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
                  className="w-32 rounded-lg border border-hairline bg-surface px-3 py-2.5 font-mono text-sm uppercase text-ink transition-colors focus:border-ink focus:outline-none"
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
