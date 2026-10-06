import type { PrecisionSessionLighting } from '../types/precisionLighting'

export default function PrecisionLightingDebug({ diagnostics: d }: { diagnostics: PrecisionSessionLighting }) {
  return <details className="my-5 rounded-xl border border-hairline bg-white/40 p-4 text-xs">
    <summary className="cursor-pointer font-medium">Developer session lighting · {d.status} · {d.version}</summary>
    <p className="mt-3 leading-relaxed">{d.reason}</p>
    <p className="mt-2 text-ink-soft">Affected captures: {d.affectedCaptures.join(', ') || 'none'} · required: {d.requiredAffectedCaptures} · mean risk {d.meanRisk.toFixed(3)}. Risk scores are provisional technical-policy scores, not probabilities.</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full whitespace-nowrap text-left tabular-nums"><thead><tr>{['Capture', 'Mixed suspected', 'Spatial disagreement', 'Normalization', 'Neutral confidence', 'Regional ΔL', 'Skin consistency', 'Skin clipped', 'Exposure', 'Risk', 'Decision'].map(x => <th key={x} className="border-b border-hairline p-2 font-medium">{x}</th>)}</tr></thead><tbody>{d.captures.map(c => <tr key={c.capture}>{[c.capture, c.signals.lighting.mixedLightingSuspected ? 'yes' : 'no', c.signals.lighting.spatialDisagreement?.toFixed(4) ?? 'unavailable', `${Math.round(c.signals.lighting.reliability * 100)}%`, `${Math.round(c.signals.lighting.neutralReferenceConfidence * 100)}%`, c.signals.maximumRegionalDeltaL?.toFixed(3) ?? 'unavailable', c.signals.skinConsistency.toFixed(3), `${(c.signals.skinClippedFraction * 100).toFixed(1)}%`, c.signals.exposureReliability.toFixed(3), c.risk.toFixed(3), c.affected ? 'affected' : 'allowed'].map((v, i) => <td key={i} className="border-b border-hairline p-2">{v}</td>)}</tr>)}</tbody></table></div>
    <ul className="mt-4 space-y-2">{d.captures.map(c => <li key={c.capture}>Capture {c.capture}: {c.reasons.join(' ')}</li>)}</ul>
    <details className="mt-4"><summary className="cursor-pointer">Full quality signals and domain contributions</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap">{JSON.stringify(d, null, 2)}</pre></details>
  </details>
}
