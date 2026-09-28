import type { ColorProfile, Undertone, Depth, Contrast } from '../types/colorProfile'

interface ProfileSummaryProps {
  profile: ColorProfile
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// Short, generic descriptions of what each existing characteristic value
// means — presentation only, not new analysis. The values themselves
// (undertone/depth/contrast) come entirely from the existing ColorProfile.
const UNDERTONE_DESCRIPTIONS: Record<Undertone, string> = {
  warm: 'Leans golden rather than pink or blue.',
  cool: 'Leans pink or blue rather than golden.',
  neutral: 'A balanced mix, without a strong pull either way.',
}

const DEPTH_DESCRIPTIONS: Record<Depth, string> = {
  light: 'Your overall colouring reads on the lighter side.',
  medium: 'Your overall colouring sits in a middle range.',
  deep: 'Your overall colouring reads on the deeper side.',
}

const CONTRAST_DESCRIPTIONS: Record<Contrast, string> = {
  low: 'Hair and skin sit close together in brightness.',
  medium: 'A moderate brightness gap between hair and skin.',
  high: 'A noticeable brightness gap between hair and skin.',
}

export default function ProfileSummary({ profile }: ProfileSummaryProps) {
  const characteristics: { label: string; value: string; description: string }[] = [
    { label: 'Undertone', value: capitalize(profile.undertone), description: UNDERTONE_DESCRIPTIONS[profile.undertone] },
    { label: 'Depth', value: capitalize(profile.depth), description: DEPTH_DESCRIPTIONS[profile.depth] },
    { label: 'Contrast', value: capitalize(profile.contrast), description: CONTRAST_DESCRIPTIONS[profile.contrast] },
  ]

  const details: { label: string; value: string; swatchHex: string }[] = [
    { label: 'Hair colour', value: profile.hairColor, swatchHex: profile.hairColorHex },
    { label: 'Eye colour', value: profile.eyeColor, swatchHex: profile.eyeColorHex },
  ]

  return (
    <div>
      <h2 className="font-display text-2xl text-ink">Your Characteristics</h2>

      <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
        {characteristics.map((item) => (
          <div key={item.label}>
            <p className="text-sm text-ink-soft">{item.label}</p>
            <p className="mt-1 font-display text-3xl text-ink">{item.value}</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">{item.description}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-x-10 gap-y-3 border-t border-hairline pt-8">
        {details.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full border border-hairline"
              style={{ backgroundColor: item.swatchHex }}
            />
            <span className="text-sm text-ink-soft">{item.label}:</span>
            <span className="text-sm font-medium text-ink">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
