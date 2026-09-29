import type { ColorProfile } from '../types/colorProfile'

export default function ProfileSummary({ profile }: { profile: ColorProfile }) {
  return (
    <section aria-labelledby="profile-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="profile-heading" className="font-display text-2xl sm:text-3xl">What shapes your palette</h2>
        <p className="text-sm text-ink-soft">A guide to your natural colouring</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {profile.analysis.dimensions.map(item => (
          <div key={item.id} className="rounded-xl border border-hairline bg-white/40 p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-soft">{item.label}</p>
            <p className="mt-3 font-display text-2xl">{item.value}</p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{item.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
