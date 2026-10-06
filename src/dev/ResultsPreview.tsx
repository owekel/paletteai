import { useState } from 'react'
import ResultsPage from '../components/ResultsPage'
import { FIXTURE_IMAGE, resultFixture, SCENARIOS, type ResultScenario } from './resultsFixtures'
import { PRECISION_SENSITIVITY_SCENARIOS, precisionSensitivityFixture, type PrecisionSensitivityScenario } from './precisionSensitivityFixtures'

type PreviewScenario = ResultScenario | PrecisionSensitivityScenario
const allScenarios: PreviewScenario[] = [...SCENARIOS, ...PRECISION_SENSITIVITY_SCENARIOS]
const fixture = (scenario: PreviewScenario) => PRECISION_SENSITIVITY_SCENARIOS.includes(scenario as PrecisionSensitivityScenario)
  ? precisionSensitivityFixture(scenario as PrecisionSensitivityScenario) : resultFixture(scenario as ResultScenario)

export default function ResultsPreview() {
  const initial = new URLSearchParams(location.search).get('scenario') as PreviewScenario
  const [scenario, setScenario] = useState<PreviewScenario>(allScenarios.includes(initial) ? initial : 'strong')
  const [profile, setProfile] = useState(() => fixture(scenario))
  const [image, setImage] = useState(FIXTURE_IMAGE)
  const [photoError, setPhotoError] = useState('')
  return (
    <>
      <aside className="flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-3 text-xs text-paper">
        <span>Developer preview · synthetic analysis{image === FIXTURE_IMAGE ? ' and illustration' : ' with local photo'}</span>
        <label>Result state{' '}
          <select aria-label="Preview result state" className="rounded border border-paper/30 bg-ink p-1" value={scenario} onChange={event => {
            const next = event.target.value as PreviewScenario
            setScenario(next)
            setProfile(fixture(next))
          }}>
            {allScenarios.map(state => <option key={state}>{state}</option>)}
          </select>
        </label>
        <label className="max-w-xs">Try-on test photo{' '}
          <input aria-label="Try-on test photo" type="file" accept="image/jpeg,image/png" className="max-w-full text-xs" onChange={event => {
            const file = event.target.files?.[0]
            if (!file) return
            setPhotoError('')
            if (!['image/jpeg', 'image/png'].includes(file.type)) {
              setPhotoError('Choose a JPG or PNG.')
              return
            }
            const reader = new FileReader()
            reader.onload = () => setImage(String(reader.result))
            reader.onerror = () => setPhotoError('Could not read this photo.')
            reader.readAsDataURL(file)
          }} />
        </label>
        {photoError && <p role="alert">{photoError}</p>}
        <a href="/" className="underline">Use a real photo →</a>
      </aside>
      <ResultsPage key={scenario} profile={profile} capturedImageDataUrl={image} onStartOver={() => { location.href = '/' }} />
    </>
  )
}
