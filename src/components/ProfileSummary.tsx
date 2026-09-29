import type { ColorProfile } from '../types/colorProfile'

export default function ProfileSummary({ profile }: { profile: ColorProfile }) {
  const dimensions = profile.analysis.status === 'specific' ? profile.analysis.dimensions : profile.analysis.dimensions.filter(d => d.resolved)
  if (!dimensions.length) return null
  return (
    <section aria-labelledby="profile-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="profile-heading" className="font-display text-2xl sm:text-3xl">{profile.analysis.status === 'specific' ? 'What shapes your palette' : 'What to look for in clothes'}</h2>
        <p className="text-sm text-ink-soft">A guide to your natural colouring</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dimensions.map(item => (
          <div key={item.id} className="rounded-xl border border-hairline bg-white/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">{item.label}</p>
            <p className="mt-3 font-display text-2xl">{item.value}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.recommendation ?? item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
