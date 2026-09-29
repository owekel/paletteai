import type { ColorSwatchData } from '../types/colorProfile'
import type { ColourComparison } from '../types/seasonAnalysis'

const swatch = (name: string, hex: string): ColorSwatchData => ({ name, hex, description: 'An option to compare on your photo.' })

// Styling comparisons, not season tests. Temperature pairs hold approximate
// OKLab lightness/chroma steady so hue is the main visible difference.
export const TEMPERATURE_COMPARISONS: ColourComparison[] = [
  { id: 'warm-cool-soft', dimension: 'temperature', title: 'Warm clay or cool rose?',
    description: 'Two softened shades at a similar depth. Switch between them and notice which effect you prefer around your face.',
    options: [swatch('Warm Clay', '#B38370'), swatch('Cool Rose', '#AA8098')] },
  { id: 'warm-cool-light', dimension: 'temperature', title: 'Warm peach or cool pink?',
    description: 'Two light shades with similar softness. Compare their warmth while keeping depth fairly steady.',
    options: [swatch('Light Warm Peach', '#E5BCA4'), swatch('Light Cool Pink', '#DEBCD6')] },
  { id: 'warm-cool-deep', dimension: 'temperature', title: 'Warm cocoa or cool plum?',
    description: 'Two deeper, softened shades. Compare the warm and cool effect without jumping from light to dark.',
    options: [swatch('Warm Cocoa', '#785347'), swatch('Cool Plum', '#765069')] },
  { id: 'warm-cool-clear', dimension: 'temperature', title: 'Clear coral or clear rose?',
    description: 'Two lively shades at a similar depth. Explore warmth while keeping the colour intensity similar.',
    options: [swatch('Clear Coral', '#DD765E'), swatch('Clear Rose', '#D277A0')] },
]

export const INTENSITY_COMPARISON: ColourComparison = {
  id: 'soft-clear', dimension: 'chroma', title: 'Soft blue or clear blue?',
  description: 'Compare a softened and a clearer blue at a similar depth. Notice whether you enjoy a quiet or more vivid effect.',
  options: [swatch('Soft Blue', '#80929F'), swatch('Clear Blue', '#4E95DA')],
}
export const DEPTH_COMPARISON: ColourComparison = {
  id: 'light-deep', dimension: 'value', title: 'Light teal or deep teal?',
  description: 'Keep the colour family similar and compare depth. Look at the balance between your face and the top.',
  options: [swatch('Light Teal', '#8DAFA8'), swatch('Deep Soft Teal', '#416760')],
}

export const CONTRAST_COMPARISON: ColourComparison = {
  ...DEPTH_COMPARISON, id: 'gentle-strong', dimension: 'contrast', title: 'Gentle or stronger contrast?',
  description: 'Compare lighter and deeper teal against your face. This changes the depth of the top as well as its contrast with your features.',
}
