import type { SeasonAnalysis } from '../types/seasonAnalysis'

interface ResultsHeroProps {
  analysis: SeasonAnalysis
  imageDataUrl: string
}

export default function ResultsHero({ analysis, imageDataUrl }: ResultsHeroProps) {
  const specific = analysis.status === 'specific'
  const colours = [...analysis.palette.best, ...analysis.palette.neutrals].slice(0, 6)
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:gap-16" aria-labelledby="result-title">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          {specific ? 'Your closest season' : 'Your colour direction'}
        </p>
        <h1 id="result-title" className={`mt-5 font-display leading-[1.08] text-ink ${specific ? 'text-5xl sm:text-7xl' : 'text-4xl capitalize sm:text-5xl'}`}>
          {analysis.title}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">{analysis.summary}</p>
        {specific && analysis.runnerUp && (
          <p className="mt-5 text-sm text-ink-soft">
            A nearby direction: <span className="font-medium text-ink">{analysis.runnerUp.label}</span>.
            Your main palette follows {analysis.title}.
          </p>
        )}
        {!specific && analysis.candidates.length > 0 && (
          <div className="mt-7">
            <h2 className="text-sm font-medium">Seasons to explore together</h2>
            <ul className="mt-3 flex flex-wrap gap-2" aria-label="Possible seasons">
              {analysis.candidates.map(candidate => (
                <li key={candidate.id} className="rounded-full border border-hairline bg-white/50 px-3 py-2 text-sm">
                  {candidate.label}
                </li>
              ))}
            </ul>
          </div>
        )}
        {analysis.unresolved.length > 0 && (
          <p className="mt-6 max-w-xl border-l-2 border-accent/30 pl-4 text-sm leading-relaxed text-ink-soft">
            Still open: {analysis.unresolved.join('; ')}. These qualities remain flexible in your result.
          </p>
        )}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={analysis.paletteMode === 'explore' ? '#try-on' : '#your-palette'} className="rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-accent">
            {analysis.paletteMode === 'explore' ? 'Explore colours on your photo' : 'Explore your colours'}
          </a>
          {analysis.paletteMode !== 'explore' && (
            <a href="#try-on" className="rounded-full border border-hairline px-6 py-3 text-sm transition-colors hover:border-ink">See them on you ↓</a>
          )}
        </div>
      </div>
      <figure className="mx-auto w-full max-w-xs lg:max-w-none">
        <div className="overflow-hidden rounded-t-[7rem] rounded-b-2xl bg-white/40 shadow-[0_20px_50px_-30px_rgba(28,26,23,0.35)]">
          <img src={imageDataUrl} alt="Your original analysis photo" className="aspect-[4/5] w-full object-cover" />
          {colours.length > 0 && (
            <div className="flex h-10" aria-hidden="true">
              {colours.map(c => <span key={c.hex} className="flex-1" style={{ backgroundColor: c.hex }} />)}
            </div>
          )}
        </div>
        <figcaption className="mt-3 text-center text-xs text-ink-soft">
          Your original photo · analysed privately in your browser
        </figcaption>
      </figure>
    </section>
  )
}
