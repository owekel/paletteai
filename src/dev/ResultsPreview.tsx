import { useState } from 'react'
import ResultsPage from '../components/ResultsPage'
import { FIXTURE_IMAGE, resultFixture, SCENARIOS, type ResultScenario } from './resultsFixtures'

export default function ResultsPreview() {
  const initial = new URLSearchParams(location.search).get('scenario') as ResultScenario
  const [scenario, setScenario] = useState<ResultScenario>(SCENARIOS.includes(initial) ? initial : 'strong')
  const [profile, setProfile] = useState(() => resultFixture(scenario))
  return (
    <>
      <aside className="flex flex-wrap items-center justify-center gap-3 bg-ink px-4 py-3 text-xs text-paper">
        <span>Developer preview · synthetic data and illustration</span>
        <label>Result state{' '}
          <select aria-label="Preview result state" className="rounded border border-paper/30 bg-ink p-1" value={scenario} onChange={event => {
            const next = event.target.value as ResultScenario
            setScenario(next)
            setProfile(resultFixture(next))
          }}>
            {SCENARIOS.map(state => <option key={state}>{state}</option>)}
          </select>
        </label>
        <a href="/" className="underline">Use a real photo →</a>
      </aside>
      <ResultsPage key={scenario} profile={profile} capturedImageDataUrl={FIXTURE_IMAGE} onStartOver={() => { location.href = '/' }} />
    </>
  )
}
