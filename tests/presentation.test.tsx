import assert from 'node:assert/strict'
import { renderToStaticMarkup } from 'react-dom/server'
import LandingPage from '../src/components/LandingPage'
import CaptureScreen from '../src/components/CaptureScreen'
import ResultsPage from '../src/components/ResultsPage'
import { resultFixture, FIXTURE_IMAGE } from '../src/dev/resultsFixtures'
import { SHADOW_SEASON_PROTOTYPES } from '../src/data/shadowSeasonCalibration'
import PaletteStrip from '../src/components/PaletteStrip'
import ColourPalette from '../src/components/ColourPalette'
import PrivacyPage from '../src/components/PrivacyPage'

let checks = 0
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`) }
const noop = () => {}
check('Privacy footer groups both native links in an accessible wrapping navigation', () => {
  const html = renderToStaticMarkup(<PrivacyPage />)
  assert.match(html, /<nav class="ui-footer-links" aria-label="Privacy page links">/)
  assert.match(html, /href="\/third-party-notices.txt"[^>]*>Open-source notices<\/a>/)
  assert.match(html, /href="\/"[^>]*>Start a colour analysis →<\/a>/)
  assert.ok(!html.includes('tabindex="-1"'))
})
const result = (scenario: Parameters<typeof resultFixture>[0], id?: Parameters<typeof resultFixture>[1]) =>
  renderToStaticMarkup(<ResultsPage profile={resultFixture(scenario, id)} capturedImageDataUrl={FIXTURE_IMAGE} onStartOver={noop} />)

check('Onboarding has one primary action and a concise three-step introduction', () => {
  const html = renderToStaticMarkup(<LandingPage onStart={noop} />)
  assert.match(html, /Start colour analysis/)
  for (const step of ['Capture', 'Analyse', 'Your palette']) assert.ok(html.includes(step))
  assert.equal((html.match(/ui-button-primary/g) ?? []).length, 1)
})
check('Precision is the primary entry without removing Quick or upload', () => {
  const html = renderToStaticMarkup(<CaptureScreen onImageReady={noop} onAnalyzedImage={noop} onCancel={noop} />)
  for (const label of ['Start guided scan', 'Quick Analysis', 'Upload a photo']) assert.ok(html.includes(label))
  assert.equal((html.match(/ui-button-primary/g) ?? []).length, 1)
})
check('Every specific subtype renders its name and original recommended colours', () => {
  for (const prototype of SHADOW_SEASON_PROTOTYPES) {
    const profile = resultFixture('strong', prototype.id)
    const html = result('strong', prototype.id)
    assert.ok(html.includes(profile.analysis.title))
    for (const colour of [...profile.analysis.palette.best, ...profile.analysis.palette.neutrals]) {
      assert.ok(html.includes(`Copy ${colour.name}, ${colour.hex}`))
    }
    assert.ok(html.indexOf('Your colour edit') < html.indexOf('Why these colours work'))
    assert.ok(!html.includes('technical detail'))
    assert.ok(!html.includes('prototype-12'))
  }
})
check('Graphic palette strips repeat the existing colours in order without inventing recommendations', () => {
  assert.equal(renderToStaticMarkup(<PaletteStrip colours={[]} />), '')
  for (const prototype of SHADOW_SEASON_PROTOTYPES) {
    const colours = resultFixture('strong', prototype.id).analysis.palette.best
    const html = renderToStaticMarkup(<PaletteStrip colours={colours} />)
    assert.match(html, /aria-hidden="true"/)
    let previous = -1
    for (const colour of colours) {
      const index = html.indexOf(colour.hex, previous + 1)
      assert.ok(index > previous)
      previous = index
    }
    assert.equal((html.match(/<span/g) ?? []).length, colours.length)
  }
})
check('Numbered colour fields keep every named copy action and separate everyday neutrals', () => {
  const palette = resultFixture('strong').analysis.palette
  const html = renderToStaticMarkup(<ColourPalette palette={palette} />)
  assert.match(html, /palette-group-editorial/)
  assert.match(html, /palette-group-neutral/)
  assert.match(html, /palette-swatch-number" aria-hidden="true">01/)
  for (const colour of [...palette.best, ...palette.neutrals, ...palette.useCarefully]) {
    assert.ok(html.includes(`Copy ${colour.name}, ${colour.hex}`))
  }
})
check('Constrained results lead with supported colour direction, not an arbitrary winner', () => {
  const html = result('constrained')
  assert.match(html, /Soft colours<\/h1>/)
  assert.match(html, /Best colours to start with/)
  assert.match(html, /Nearby palettes, shared qualities/)
  assert.match(html, /warm or cool undertone/)
  assert.ok(!html.includes('Still open'))
  assert.ok(!html.includes('Retake'))
  assert.ok(html.indexOf('Best colours to start with') < html.indexOf('Possible seasons'))
})
check('Broad and very low-certainty usable photos retain actionable comparisons', () => {
  for (const scenario of ['broad', 'low-certainty', 'indeterminate'] as const) {
    const html = result(scenario)
    assert.match(html, /Colours to compare/)
    assert.match(html, /Copy /)
    assert.ok(!html.includes('Still open'))
    assert.ok(!html.includes('Try again in softer'))
  }
  assert.match(result('indeterminate'), /A starting palette/)
  assert.match(result('indeterminate'), /not a personal season recommendation/)
})
check('Technical retake hides season, recommendations and try-on without hiding actual guidance', () => {
  const html = result('retake')
  assert.ok(!html.includes('Your strongest colours'))
  assert.ok(!html.includes('See it on you.'))
  assert.ok(!html.includes('Soft Summer'))
  assert.match(html, /Choose another photo/)
  assert.match(html, /exposure|bright|highlight|shadow/i)
})

console.log(`\n${checks} consumer presentation checks passed.`)
