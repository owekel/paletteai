import { useRef } from 'react'
import type { ColorPalette, ColorProfile } from '../types/colorProfile'
import ResultsHero from './ResultsHero'
import TryOnCTA from './TryOnCTA'
import ColorTryOn from './ColorTryOn'
import ColourPalette from './ColourPalette'
import ProfileSummary from './ProfileSummary'
import WardrobeSection from './WardrobeSection'
import ColourTester from './ColourTester'

interface ResultsPageProps {
  profile: ColorProfile
  palette: ColorPalette
  capturedImageDataUrl: string
  onStartOver: () => void
}

export default function ResultsPage({ profile, palette, capturedImageDataUrl, onStartOver }: ResultsPageProps) {
  const tryOnSectionRef = useRef<HTMLDivElement>(null)

  function scrollToTryOn() {
    tryOnSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="mx-auto max-w-content px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
      <div className="mb-10 flex justify-end">
        <button
          onClick={onStartOver}
          className="border border-ink px-4 py-2 text-sm text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Analyze another photo
        </button>
      </div>

      {/* 1. The main result — season name, short description, visual palette */}
      <ResultsHero profile={profile} palette={palette} />

      {/* 2. A prominent preview/CTA leading into Try-On, right after the result */}
      <div className="mt-24 sm:mt-32">
        <TryOnCTA imageDataUrl={capturedImageDataUrl} palette={palette} onStart={scrollToTryOn} />
      </div>

      {/* 3. The existing interactive Try-On experience itself */}
      <div ref={tryOnSectionRef} className="mt-24 scroll-mt-10 sm:mt-32">
        <ColorTryOn imageDataUrl={capturedImageDataUrl} palette={palette} />
      </div>

      {/* 4. Detailed palette and analysis sections follow */}
      <div className="mt-24 sm:mt-32">
        <ColourPalette palette={palette} />
      </div>

      <div className="mt-24 sm:mt-32">
        <ProfileSummary profile={profile} />
      </div>

      <div className="mt-24 sm:mt-32">
        <WardrobeSection wardrobe={palette.wardrobe} staples={palette.staples} />
      </div>

      <div className="mt-24 sm:mt-32">
        <ColourTester profile={profile} />
      </div>

      <footer className="mt-24 border-t border-hairline pt-8 pb-4 text-sm text-ink-soft sm:mt-32">
        PaletteAI is a style tool, not a scientific or medical one — think of it as a starting
        point, not a rulebook.
      </footer>
    </div>
  )
}
