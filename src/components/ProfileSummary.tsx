import type { ColorProfile } from '../types/colorProfile'

export default function ProfileSummary({ profile }: { profile: ColorProfile }) {
  const dimensions = profile.analysis.dimensions.filter(d => d.resolved)
  if (!dimensions.length) return null
  return (
    <section aria-labelledby="profile-heading">
      <h2 id="profile-heading" className="ui-heading">Why these colours work</h2>
      <p className="ui-copy mt-3">{profile.analysis.status === 'specific' ? 'These are the qualities behind your palette. Think of them as a guide, not a set of rules.' : 'Start with the qualities your photos support. The finer details can stay flexible.'}</p>
      <div className="profile-grid">
        {dimensions.map(item => (
          <article key={item.id}>
            <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">{item.label}</p>
            <h3 className="ui-subheading mt-2">{item.value}</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.recommendation ?? item.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
