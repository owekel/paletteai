import { useRef, useState } from 'react'
import type { ColorProfile, ColorSwatchData } from '../types/colorProfile'
import ResultsHero from './ResultsHero'
import ColorTryOn from './ColorTryOn'
import ColourPalette from './ColourPalette'
import ProfileSummary from './ProfileSummary'
import WardrobeSection from './WardrobeSection'
import ColourTester from './ColourTester'
import SeasonMeasurementDebug from './SeasonMeasurementDebug'
import AnalysisQualityNotice from './AnalysisQualityNotice'
import ColourComparisons from './ColourComparisons'

interface ResultsPageProps {
  profile: ColorProfile
  capturedImageDataUrl: string
  onStartOver: () => void
}

export default function ResultsPage({ profile, capturedImageDataUrl, onStartOver }: ResultsPageProps) {
  const analysis = profile.analysis
  const palette = analysis.palette
  const usable = analysis.status !== 'retake-required'
  const hasPalette = palette.best.length + palette.neutrals.length > 0
  const recommendations = analysis.recommendations
  const tryOnRef = useRef<HTMLElement>(null)
  const [requestedColour, setRequestedColour] = useState<{ hex: string; requestId: number }>()
  function compareColour(colour: ColorSwatchData) {
    setRequestedColour(previous => ({ hex: colour.hex, requestId: (previous?.requestId ?? 0) + 1 }))
    tryOnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <main className="results-page mx-auto max-w-content px-5 py-6 sm:px-10 sm:py-10 lg:px-16">
      <header className="mb-12 flex items-center justify-between gap-4 border-b border-hairline pb-5 sm:mb-16">
        <p className="font-display text-2xl tracking-tight">PaletteAI<span className="text-accent">.</span></p>
        <button onClick={onStartOver} className="rounded-full border border-hairline px-4 py-2.5 text-xs transition-colors hover:border-ink sm:text-sm">
          Analyze another photo
        </button>
      </header>

      {!usable ? <AnalysisQualityNotice assessment={analysis.quality} onRetake={onStartOver} /> : (
        <>
          <ResultsHero analysis={analysis} imageDataUrl={capturedImageDataUrl} />
          {analysis.dimensions.some(d => d.resolved) && <div className="mt-14 sm:mt-20"><ProfileSummary profile={profile} /></div>}

          <section id="your-palette" className="mt-16 scroll-mt-8 border-t border-hairline pt-10 sm:mt-20" aria-labelledby="palette-heading">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">01 / Your colours</p>
            <h2 id="palette-heading" className="mt-3 font-display text-3xl sm:text-4xl">
              {analysis.paletteMode === 'season' ? `The ${analysis.title} palette`
                : analysis.paletteMode === 'consensus' ? 'A palette to build on' : 'Your colour comparison kit'}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{analysis.paletteDescription}</p>
            {hasPalette && <div className="mt-8"><ColourPalette palette={palette} mode={analysis.paletteMode} /></div>}
            {recommendations?.outfit && (
              <div className="mt-8 flex flex-wrap items-center gap-5 rounded-xl border border-hairline bg-white/40 p-5">
                <div className="flex shrink-0 overflow-hidden rounded-lg" aria-hidden="true">
                  {recommendations.outfit.colours.map(c => <span key={c.hex} className="h-20 w-14" style={{ backgroundColor: c.hex }} />)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl">{recommendations.outfit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{recommendations.outfit.description}</p>
                </div>
              </div>
            )}
          </section>

          {analysis.status === 'constrained' && (
            <section className="mt-10 rounded-2xl border border-hairline bg-white/30 p-5 sm:p-7" aria-labelledby="season-context-heading">
              <h2 id="season-context-heading" className="font-display text-2xl">{analysis.resultKind === 'candidate-group' ? 'Where your seasons overlap' : 'The finer details can stay flexible'}</h2>
              {analysis.candidates.length > 0 && (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">These are nearby possibilities, not a single settled season. The starting palette draws on their common qualities.</p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Possible seasons">
                    {analysis.candidates.map(c => <li key={c.id} className="rounded-full border border-hairline bg-paper px-3 py-2 text-sm">{c.label}</li>)}
                  </ul>
                </>
              )}
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">
                {analysis.unresolved.length ? `Still worth exploring: ${analysis.unresolved.join('; ')}. The comparisons below help you see the difference.`
                  : 'The measured qualities are clear, but more than one season expresses them. Use the palette as your guide without choosing a label.'}
              </p>
            </section>
          )}

          {!!recommendations?.comparisons.length && (
            <section id="compare-colours" className="mt-12 scroll-mt-8" aria-labelledby="compare-heading">
              <h2 id="compare-heading" className="font-display text-3xl">Worth comparing</h2>
              <p className="mb-6 mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">Choose a shade to see it on your clothing. These pairs explore the open questions; neither option is a verdict.</p>
              <ColourComparisons comparisons={recommendations.comparisons} onSelect={compareColour} />
            </section>
          )}

          {!!recommendations?.lessSupported.length && (
            <details className="mt-10 rounded-xl border border-hairline p-5">
              <summary className="cursor-pointer font-display text-xl">Less supported right now</summary>
              <p className="mt-3 text-sm text-ink-soft">Useful directions to compare, rather than rules about what you can wear.</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {recommendations.lessSupported.map(item => <li key={item.dimension}><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.description}</p></li>)}
              </ul>
            </details>
          )}

          <section id="try-on" ref={tryOnRef} className="mt-16 scroll-mt-8 border-t border-hairline pt-10 sm:mt-20">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-accent">02 / See it on you</p>
            <ColorTryOn imageDataUrl={capturedImageDataUrl} palette={palette} comparisons={recommendations?.comparisons} requestedColour={requestedColour} recommendationLabel={
              analysis.paletteMode === 'consensus' ? 'Your starting colours' : analysis.paletteMode === 'starter' ? 'Everyday shades to explore' : `Your ${analysis.title} colours`
            } />
          </section>

          {hasPalette && analysis.paletteMode !== 'starter' && (
            <>
              <details className="mt-14 rounded-2xl border border-hairline p-5 sm:p-8">
                <summary className="cursor-pointer font-display text-2xl">Make it part of your wardrobe</summary>
                <div className="mt-8"><WardrobeSection wardrobe={palette.wardrobe} staples={palette.staples} /></div>
              </details>
              <div className="mt-14"><ColourTester palette={palette} shared={analysis.paletteMode === 'consensus'} /></div>
            </>
          )}
        </>
      )}

      {import.meta.env.DEV && (
        <div className="mt-14">
          {profile.precision && <details className="mb-6 rounded-xl border border-hairline p-5 text-xs"><summary className="cursor-pointer font-medium">Developer Precision Analysis · {profile.precision.version}</summary><p className="mt-3 text-ink-soft">Combined dimensions and sensitivity below. Pixel/feature and illumination details in the legacy measurement panel refer to reference capture {profile.precision.referenceCapture}; its historical 45% discrimination labels do not decide the precision result. Stress-test win frequencies are not calibrated season probabilities.</p><pre className="mt-4 max-h-[36rem] overflow-auto whitespace-pre-wrap">{JSON.stringify(profile.precision, null, 2)}</pre></details>}
          <SeasonMeasurementDebug measurements={profile.shadowMeasurements} classification={profile.shadowSeasonClassification}
            qualityAssessment={analysis.quality} presentation={analysis} />
        </div>
      )}
      <footer className="mt-16 border-t border-hairline pb-4 pt-6 text-xs leading-relaxed text-ink-soft">
        Colour is personal. This photo-based style guide is a starting point—wear what feels like you.
        Your photo stays in your browser.
      </footer>
    </main>
  )
}
