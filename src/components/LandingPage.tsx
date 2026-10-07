import SiteHeader from './SiteHeader'
import PaletteStrip from './PaletteStrip'

const EXAMPLE_SWATCHES = [
  { name: 'Dusty rose', hex: '#BA8B8B' }, { name: 'Slate blue', hex: '#6E85A3' },
  { name: 'Warm ivory', hex: '#F1E9D6' }, { name: 'Sage', hex: '#8FA88C' },
  { name: 'Deep berry', hex: '#873C5A' }, { name: 'Soft taupe', hex: '#9C8C80' },
]
const STEPS = [
  ['Capture', 'Three moments in soft, even light. We’ll guide you.'],
  ['Analyse', 'Find the colour qualities that stay consistent.'],
  ['Your palette', 'Explore your shades, then see them on you.'],
]
export default function LandingPage({ onStart }: { onStart: () => void }) {
  return <main className="page-shell">
    <SiteHeader />
    <section className="landing-hero" aria-labelledby="home-title">
      <div>
        <p className="ui-eyebrow mb-5">A personal guide to colour</p>
        <h1 id="home-title" className="landing-title">Find the colours that <em>feel like you.</em></h1>
        <p className="ui-copy mt-5 max-w-sm">A considered palette for your everyday wardrobe. Start with a guided photo scan, then explore what feels natural on you.</p>
        <button className="ui-button ui-button-primary mt-7" onClick={onStart}>Start colour analysis <span aria-hidden="true">→</span></button>
        <p className="mt-4 text-xs text-ink-soft">No account. Your photos stay in your browser.</p>
      </div>
      <div className="colour-study" aria-label="Example colour study, not a personal palette">
        <div className="colour-study-heading"><span>Colour study / 01</span><span className="brand-square" aria-hidden="true" /></div>
        <div className="study-swatches">{EXAMPLE_SWATCHES.map((c, i) => <figure key={c.hex}><span style={{ backgroundColor: c.hex }} /><figcaption><span className="study-number">{String(i + 1).padStart(2, '0')}</span>{c.name}</figcaption></figure>)}</div>
        <p className="mt-5 text-xs text-ink-soft">A few possibilities. Your palette will be personal.</p>
      </div>
    </section>
    <PaletteStrip colours={EXAMPLE_SWATCHES} className="landing-colour-band" />
    <section className="landing-steps" aria-label="How it works">{STEPS.map(([title, copy], i) => <article key={title}>
      <span className="ui-eyebrow">0{i + 1}</span><div><h2 className="ui-subheading sm:mt-3">{title}</h2><p className="mt-2 text-sm text-ink-soft">{copy}</p></div>
    </article>)}</section>
    <footer className="ui-footer"><p>A style starting point, not a rulebook.</p><p>Personal colour. A little more considered.</p></footer>
  </main>
}
