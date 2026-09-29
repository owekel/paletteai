import type { ColorProfile } from '../types/colorProfile'
import ResultsHero from './ResultsHero'
import ColorTryOn from './ColorTryOn'
import ColourPalette from './ColourPalette'
import ProfileSummary from './ProfileSummary'
import WardrobeSection from './WardrobeSection'
import ColourTester from './ColourTester'
import SeasonMeasurementDebug from './SeasonMeasurementDebug'
import AnalysisQualityNotice from './AnalysisQualityNotice'

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
          <div className="mt-14 sm:mt-20"><ProfileSummary profile={profile} /></div>

          <section id="your-palette" className="mt-16 scroll-mt-8 border-t border-hairline pt-10 sm:mt-20" aria-labelledby="palette-heading">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">01 / Your colours</p>
            <h2 id="palette-heading" className="mt-3 font-display text-3xl sm:text-4xl">
              {analysis.paletteMode === 'season' ? `The ${analysis.title} palette`
                : analysis.paletteMode === 'shared' ? 'Common ground, beautiful colours' : 'A little room to experiment'}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink-soft">{analysis.paletteDescription}</p>
            {hasPalette && <div className="mt-8"><ColourPalette palette={palette} shared={analysis.paletteMode === 'shared'} /></div>}
          </section>

          <section id="try-on" className="mt-16 scroll-mt-8 border-t border-hairline pt-10 sm:mt-20">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-accent">02 / See it on you</p>
            <ColorTryOn imageDataUrl={capturedImageDataUrl} palette={palette} recommendationLabel={
              analysis.paletteMode === 'shared' ? 'Shared colours to try' : analysis.paletteMode === 'explore' ? 'Explore a custom colour' : `Your ${analysis.title} colours`
            } />
          </section>

          {hasPalette && (
            <>
              <details className="mt-14 rounded-2xl border border-hairline p-5 sm:p-8">
                <summary className="cursor-pointer font-display text-2xl">Make it part of your wardrobe</summary>
                <div className="mt-8"><WardrobeSection wardrobe={palette.wardrobe} staples={palette.staples} /></div>
              </details>
              <div className="mt-14"><ColourTester palette={palette} shared={analysis.paletteMode === 'shared'} /></div>
            </>
          )}
        </>
      )}

      {import.meta.env.DEV && (
        <div className="mt-14">
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
