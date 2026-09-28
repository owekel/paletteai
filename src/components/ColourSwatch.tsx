import { useState } from 'react'

interface ColourSwatchProps {
  name: string
  hex: string
  description?: string
  size?: 'large' | 'small'
}

export default function ColourSwatch({ name, hex, description, size = 'large' }: ColourSwatchProps) {
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
        className="group flex flex-col items-start gap-1.5 text-left"
        title={`Copy ${hex}`}
      >
        <span
          className="h-12 w-12 border border-hairline transition-transform group-hover:scale-105"
          style={{ backgroundColor: hex }}
        />
        <span className="text-xs text-ink-soft">{copied ? 'Copied' : name}</span>
      </button>
    )
  }

  return (
    <button onClick={handleCopy} className="group flex flex-col text-left" title={`Copy ${hex}`}>
      <span
        className="aspect-[4/3] w-full border border-hairline transition-transform group-hover:scale-[1.02]"
        style={{ backgroundColor: hex }}
      />
      <span className="mt-3 font-display text-lg text-ink">{name}</span>
      <span className="text-sm text-ink-soft">{copied ? 'Copied to clipboard' : hex}</span>
      {description && <span className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</span>}
    </button>
  )
}
