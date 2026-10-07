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
import PrecisionAnalysisDebug from './PrecisionAnalysisDebug'
import SiteHeader from './SiteHeader'

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
    tryOnRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }
  return (
    <main className="results-page page-shell">
      <SiteHeader onAction={onStartOver} actionLabel="New analysis" />

      {!usable ? <AnalysisQualityNotice assessment={analysis.quality} onRetake={onStartOver} /> : (
        <>
          <ResultsHero analysis={analysis} imageDataUrl={capturedImageDataUrl} />

          <section id="your-palette" className="result-section" aria-labelledby="palette-heading">
            <div className="section-heading-row"><h2 id="palette-heading" className="ui-heading">{analysis.paletteMode === 'season' ? 'Your colour edit' : analysis.paletteMode === 'consensus' ? 'A palette to build on' : 'Your comparison edit'}</h2><span className="section-index">02 / COLOUR NOTES</span></div>
            {analysis.paletteMode !== 'season' && <p className="ui-copy text-sm">{analysis.paletteMode === 'consensus' ? 'Shades shared by your possible palettes, guided by the qualities your photos support.' : 'Try these reference shades to discover the effects you like. They are not a personal season recommendation.'}</p>}
            {hasPalette && <div className="mt-5"><ColourPalette palette={palette} mode={analysis.paletteMode} /></div>}
            {recommendations?.outfit && (
              <div className="outfit-note">
                <div className="flex shrink-0 overflow-hidden rounded-md" aria-hidden="true">
                  {recommendations.outfit.colours.map(c => <span key={c.hex} className="h-16 w-10" style={{ backgroundColor: c.hex }} />)}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="ui-subheading">{recommendations.outfit.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{recommendations.outfit.description}</p>
                </div>
              </div>
            )}
          </section>

          {analysis.dimensions.some(d => d.resolved) && <div className="result-section profile-section"><ProfileSummary profile={profile} /></div>}

          {analysis.status === 'constrained' && (
            <section className="season-context" aria-labelledby="season-context-heading">
              <h2 id="season-context-heading" className="ui-subheading">{analysis.resultKind === 'candidate-group' ? 'Nearby palettes, shared qualities' : 'Room for the finer details'}</h2>
              {analysis.candidates.length > 0 && (
                <>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">Your colour direction overlaps these palettes. You don’t need to choose one to start.</p>
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Possible seasons">
                    {analysis.candidates.map(c => <li key={c.id} className="text-sm font-medium">{c.label}</li>)}
                  </ul>
                </>
              )}
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                {analysis.unresolved.length ? `Still worth exploring: ${analysis.unresolved.join('; ')}. The comparisons below help you see the difference.`
                  : 'The measured qualities are clear, but more than one season expresses them. Use the palette as your guide without choosing a label.'}
              </p>
            </section>
          )}

          {!!recommendations?.comparisons.length && (
            <section id="compare-colours" className="result-section comparison-section" aria-labelledby="compare-heading">
              <p className="ui-eyebrow mb-4">04 / Side by side</p>
              <h2 id="compare-heading" className="ui-heading">Colours to compare</h2>
              <p className="ui-copy mb-6 mt-3">Try each pair on your photo. The differences are worth exploring; neither shade is a verdict.</p>
              <ColourComparisons comparisons={recommendations.comparisons} onSelect={compareColour} />
            </section>
          )}

          {!!recommendations?.lessSupported.length && (
            <details className="ui-disclosure mt-7">
              <summary>Other directions to explore</summary>
              <p className="mt-3 text-sm text-ink-soft">Useful directions to compare, rather than rules about what you can wear.</p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {recommendations.lessSupported.map(item => <li key={item.dimension}><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.description}</p></li>)}
              </ul>
            </details>
          )}

          <section id="try-on" ref={tryOnRef} className="result-section tryon-section">
            <p className="ui-eyebrow mb-4">05 / Colourways</p>
            <ColorTryOn imageDataUrl={capturedImageDataUrl} palette={palette} comparisons={recommendations?.comparisons} requestedColour={requestedColour} recommendationLabel={
              analysis.paletteMode === 'consensus' ? 'Your starting colours' : analysis.paletteMode === 'starter' ? 'Everyday shades to explore' : `Your ${analysis.title} colours`
            } />
          </section>

          {hasPalette && analysis.paletteMode !== 'starter' && (
            <>
              <details className="ui-disclosure mt-10">
                <summary>Make it part of your wardrobe</summary>
                <div className="mt-8"><WardrobeSection wardrobe={palette.wardrobe} staples={palette.staples} /></div>
              </details>
              <div className="mt-14"><ColourTester palette={palette} shared={analysis.paletteMode === 'consensus'} /></div>
            </>
          )}
        </>
      )}

      {import.meta.env.DEV && (
        <details className="developer-area"><summary>Developer tools · technical detail</summary><div className="mt-4">
          {profile.precision && <PrecisionAnalysisDebug diagnostics={profile.precision} />}
          <SeasonMeasurementDebug measurements={profile.shadowMeasurements} classification={profile.shadowSeasonClassification}
            qualityAssessment={analysis.quality} presentation={analysis} />
        </div></details>
      )}
      <footer className="ui-footer"><p>A starting point, not a rulebook. Wear what feels like you.</p><p>Your photos stay in your browser.</p></footer>
    </main>
  )
}
