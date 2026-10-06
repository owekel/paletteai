export default function SiteHeader({ onAction, actionLabel = 'Back', context = 'Personal colour, considered.' }: {
  onAction?: () => void
  actionLabel?: string
  context?: string
}) {
  return <header className="site-header">
    <p className="wordmark" aria-label="PaletteAI">Palette<span>AI</span><i aria-hidden="true" /></p>
    {onAction ? <button className="ui-text-action" onClick={onAction}>{actionLabel === 'Back' && <span aria-hidden="true">← </span>}{actionLabel}</button>
      : <p className="site-header-context">{context}</p>}
  </header>
}
