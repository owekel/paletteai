import type { PrecisionDiagnostics } from '../types/precision'
import { PRECISION_DIMENSIONS } from '../services/precisionAggregation'

const percent = (n: number) => `${(n * 100).toFixed(1)}%`
export default function PrecisionAnalysisDebug({ diagnostics: p }: { diagnostics: PrecisionDiagnostics }) {
  const s = p.sensitivity
  return <details className="mb-6 rounded-xl border border-hairline p-5 text-xs">
    <summary className="cursor-pointer font-medium">Developer Precision Analysis · {s.version}</summary>
    <p className="mt-4 font-medium">{s.state} · {s.confidence} support</p>
    <p className="mt-2 leading-relaxed text-ink-soft">{s.reason}</p>
    <p className="mt-3 leading-relaxed text-ink-soft">{s.samples} deterministic simulations of the person-level profile. These are stress-test frequencies, not scientifically calibrated diagnosis probabilities. The 5–95% intervals describe the provisional sampling model.</p>
    <div className="mt-5 overflow-x-auto"><table className="w-full whitespace-nowrap text-left tabular-nums"><caption className="mb-3 text-left font-medium">Uncertainty of the combined profile</caption><thead><tr>{['Dimension', 'Estimate', '5–95% interval', 'Empirical spread', 'Robust spread', 'Repeatability SE', 'Measurement SE', 'Combined SD', 'Effective photos', 'Description support'].map(label => <th key={label} className="border-b border-hairline px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>{PRECISION_DIMENSIONS.map(d => {
      const u = s.uncertainty[d]
      return <tr key={d}>{[d, u.center.toFixed(3), `${u.interval.low.toFixed(3)} to ${u.interval.high.toFixed(3)}`, u.empiricalSpread.toFixed(3), u.robustSpread.toFixed(3), u.repeatabilityStdError.toFixed(3), u.measurementStdError.toFixed(3), u.aggregateStdDev.toFixed(3), u.effectiveCaptures.toFixed(2), percent(s.dimensionSupport[d])].map((v, i) => <td key={i} className="border-b border-hairline px-3 py-2">{v}</td>)}</tr>
    })}</tbody></table></div>
    <div className="mt-5 grid gap-5 sm:grid-cols-2"><div><h3 className="font-medium">Exact-season wins</h3><ul className="mt-2 space-y-1">{s.wins.filter(w => w.share > 0).map(w => <li key={w.id} className="flex justify-between gap-4"><span>{w.label}</span><span>{percent(w.share)}</span></li>)}</ul></div><div><h3 className="font-medium">Season-family wins</h3><ul className="mt-2 space-y-1">{s.familyWins.map(w => <li key={w.family} className="flex justify-between gap-4"><span className="capitalize">{w.family}</span><span>{percent(w.share)}</span></li>)}</ul><p className="mt-4 leading-relaxed">Best coherent group: {percent(s.groupStability)}. Original top stays #1: {percent(s.originalTopRetainedShare)}.</p><p className="mt-2">Most common alternative: {s.mostCommonAlternative ? `${s.mostCommonAlternative.label} (${percent(s.mostCommonAlternative.share)})` : 'None in these simulations'}.</p>{s.topVsRunner && <p className="mt-2">Original top outranks that alternative in {percent(s.topVsRunner.aheadShare)}; mean squared-distance margin {s.topVsRunner.meanSquaredDistanceMargin.toFixed(3)}.</p>}</div></div>
    <p className="mt-5 leading-relaxed text-ink-soft">Pixel/feature and illumination details below refer to reference capture {p.referenceCapture}. Historical 45% labels do not decide Precision presentation. Individual-photo classifications are not voted on.</p>
    <details className="mt-4"><summary className="cursor-pointer">Full captures, contributions, covariance and neighbourhood diagnostics</summary><pre className="mt-3 max-h-[36rem] overflow-auto whitespace-pre-wrap">{JSON.stringify(p, null, 2)}</pre></details>
  </details>
}
