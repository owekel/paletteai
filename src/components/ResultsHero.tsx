import type { SeasonAnalysis } from '../types/seasonAnalysis'
import PaletteStrip from './PaletteStrip'

interface ResultsHeroProps {
  analysis: SeasonAnalysis
  imageDataUrl: string
}

export default function ResultsHero({ analysis, imageDataUrl }: ResultsHeroProps) {
  const specific = analysis.status === 'specific'
  const colours = [...analysis.palette.best, ...analysis.palette.neutrals].slice(0, 8)
  const qualities = analysis.dimensions.filter(d => d.resolved).map(d => d.value)
  // Lead with an established quality, not a long diagnostic-style profile label.
  const direction = ['chroma', 'value', 'temperature', 'contrast']
    .map(id => analysis.dimensions.find(d => d.id === id && d.resolved)).find(Boolean)
  const title = specific ? analysis.title : analysis.paletteMode === 'starter' ? 'A starting palette'
    : direction ? `${direction.value} colours` : analysis.title
  const summary = analysis.summary.split(/(?<=[.!?])\s+/)[0]
  return (
    <section className={`result-hero ${specific ? 'result-hero-specific' : 'result-hero-direction'}`} aria-labelledby="result-title">
      <div className="result-hero-content">
        <div className="result-hero-title"><p className="ui-eyebrow">01 / {specific ? 'Your palette’s ready' : 'Your colour direction'}</p>
          <h1 id="result-title" className="result-season-title mt-5" aria-label={title}>{specific
            ? <>{title.split(' ')[0]}<br /><span>{title.split(' ').slice(1).join(' ')}</span></> : title}</h1>
          {qualities.length > 0 && <p className="result-qualities">{qualities.join(' · ')}</p>}
        </div>
        <div className="result-hero-description mt-5"><p className="ui-copy">{summary}</p>
          {analysis.paletteMode === 'starter' && <p className="mt-3 text-sm text-ink-soft">These are colours to explore, rather than a settled personal season.</p>}
          {specific && analysis.runnerUp && <p className="mt-3 text-xs text-ink-soft">Also worth exploring: {analysis.runnerUp.label}.</p>}
          {specific && analysis.unresolved.length > 0 && <p className="mt-3 text-sm text-ink-soft">Still flexible: {analysis.unresolved.join('; ')}.</p>}
        </div>
        <div className="result-hero-actions mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="#your-palette" className="ui-button ui-button-primary">
            {analysis.paletteMode === 'starter' ? 'See your starting set' : 'Explore your colours'}
          </a>
          <a href={analysis.recommendations?.comparisons.length ? '#compare-colours' : '#try-on'} className="ui-text-action">{specific ? 'Try them on ↓' : 'Compare shades ↓'}</a>
        </div>
      </div>
      <figure className="result-photo">
        <div className="result-photo-frame">
          <img src={imageDataUrl} alt="Your original analysis photo" />
        </div>
        <figcaption className="mt-3 text-xs text-ink-soft">
          Your original photo. Just for you.
        </figcaption>
      </figure>
      <div className="result-colour-band"><PaletteStrip colours={colours} /><div className="result-band-caption"><span>{analysis.paletteMode === 'starter' ? 'Your comparison edit' : 'Your colours, together.'}</span><span aria-hidden="true">✦</span></div></div>
    </section>
  )
}
