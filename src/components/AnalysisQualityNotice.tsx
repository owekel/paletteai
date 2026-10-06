import type { AnalysisQualityAssessment } from '../types/analysisQuality'

const CAPTURE_TITLES: Record<string, string> = {
  'face-not-usable': 'Bring your face into view',
  'insufficient-skin-sampling': 'Keep your forehead and cheeks visible',
  'severe-uneven-lighting': 'Try softer, more even light',
  'extreme-exposure': 'Keep detail in the light and shade',
  'severe-mixed-lighting': 'Face one soft light source',
  'insufficient-facial-information': 'Try a clearer, closer portrait',
}

export default function AnalysisQualityNotice({ assessment, onRetake }: {
  assessment: AnalysisQualityAssessment
  onRetake: () => void
}) {
  if (assessment.imageQuality.status !== 'retake-required') return null
  return (
    <section className="mx-auto max-w-2xl py-6" aria-labelledby="retake-title">
      <p className="ui-eyebrow">A clearer starting point</p>
      <h1 id="retake-title" className="ui-title mt-4">Let’s try a clearer photo.</h1>
      <p className="ui-copy mt-5">
        This photo needs another try before we can suggest a palette. Here’s what would help.
      </p>
      <div className="mt-8 space-y-4">
        {assessment.imageQuality.issues.map(issue => (
          <div key={issue.code} className="border-t border-hairline pt-4">
            <h2 className="text-sm font-medium">{CAPTURE_TITLES[issue.code] ?? issue.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{issue.guidance}</p>
          </div>
        ))}
      </div>
      <button onClick={onRetake} className="ui-button ui-button-primary mt-8">
        Choose another photo
      </button>
    </section>
  )
}
