import { useState } from 'react'

interface ColourSwatchProps {
  name: string
  hex: string
  description?: string
  size?: 'large' | 'small'
  number?: number
}

export default function ColourSwatch({ name, hex, description, size = 'large', number }: ColourSwatchProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can fail (e.g. unsupported browser) — this is a
      // convenience feature, so we just quietly do nothing if it does.
    }
  }

  if (size === 'small') {
    return (
      <button
        onClick={handleCopy}
        className="palette-small"
        aria-label={`Copy ${name}, ${hex}`}
        title={`Copy ${hex}`}
      >
        <span
          style={{ backgroundColor: hex }}
        />
        <span aria-live="polite">{copied ? 'Copied' : name}</span>
      </button>
    )
  }

  return (
    <button onClick={handleCopy} className="palette-swatch" data-copied={copied} title={description ? `${description} Copy ${hex}` : `Copy ${hex}`} aria-label={`Copy ${name}, ${hex}`}>
      <span
        className="palette-swatch-colour"
        style={{ backgroundColor: hex }}
      />
      <span className="palette-swatch-label">{number !== undefined && <span className="palette-swatch-number" aria-hidden="true">{String(number).padStart(2, '0')}</span>}<span className="palette-swatch-name">{name}</span></span>
      <span className="palette-swatch-code" aria-live="polite">{copied ? 'Copied ✓' : hex}</span>
    </button>
  )
}
