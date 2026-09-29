import type { AnalysisQualityAssessment } from '../types/analysisQuality'

export default function AnalysisQualityNotice({ assessment, onRetake }: {
  assessment: AnalysisQualityAssessment
  onRetake: () => void
}) {
  if (assessment.imageQuality.status !== 'retake-required') return null
  return (
    <section className="mx-auto max-w-2xl py-6 sm:py-10" aria-labelledby="retake-title">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">A clearer starting point</p>
      <h1 id="retake-title" className="mt-4 font-display text-4xl leading-tight sm:text-6xl">Let’s try a clearer photo.</h1>
      <p className="mt-6 text-base leading-relaxed text-ink-soft">
        We could not read enough facial colour from this photo to recommend a palette. Here is what would help.
      </p>
      <div className="mt-8 space-y-4">
        {assessment.imageQuality.issues.map(issue => (
          <div key={issue.code} className="rounded-xl border border-hairline bg-white/40 p-5">
            <h2 className="text-sm font-medium">{issue.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{issue.guidance}</p>
          </div>
        ))}
      </div>
      <button onClick={onRetake} className="mt-8 rounded-full bg-ink px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-accent">
        Choose another photo
      </button>
    </section>
  )
}
