import type { ShadowSeasonMeasurements } from '../types/seasonMeasurements'
import type {
  ShadowSeasonClassification,
  ShadowSeasonDimension,
} from '../types/shadowSeasonClassification'
import type { AnalysisQualityAssessment } from '../types/analysisQuality'
import type { SeasonAnalysis } from '../types/seasonAnalysis'

interface SeasonMeasurementDebugProps {
  measurements: ShadowSeasonMeasurements
  classification?: ShadowSeasonClassification
  qualityAssessment?: AnalysisQualityAssessment
  presentation?: SeasonAnalysis
}

function fixed(value: number, digits = 3): string {
  return value.toFixed(digits)
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(3)}`
}

const CLASSIFIER_DIMENSIONS: ShadowSeasonDimension[] = ['temperature', 'value', 'chroma', 'contrast']

export default function SeasonMeasurementDebug({
  measurements,
  classification,
  qualityAssessment,
  presentation,
}: SeasonMeasurementDebugProps) {
  if (!import.meta.env.DEV) return null
  // Fast Refresh can preserve a result created by an older shadow schema.
  // Avoid crashing that open preview; a fresh analysis will populate it.
  if (
    !measurements.lighting ||
    !measurements.beforeAfter ||
    !measurements.skinDiagnostics ||
    !measurements.stabilityDiagnostics ||
    !measurements.stabilityDiagnostics.contrast
  ) {
    return (
      <div className="border border-dashed border-ink-soft/50 bg-white/40 p-5 text-sm text-ink-soft">
        Re-analyze this photo to populate the updated illumination diagnostics.
      </div>
    )
  }

  const dimensions = [
    {
      label: 'Temperature',
      score: signed(measurements.temperature.score),
      scale: '−1 cool · +1 warm',
      reliability: measurements.temperature.reliability,
      raw: `skin hue ${measurements.temperature.skinHueDegrees?.toFixed(1) ?? 'n/a'}° · chroma evidence ${percent(measurements.temperature.chromaEvidence)}`,
    },
    {
      label: 'Value',
      score: signed(measurements.value.score),
      scale: '−1 deep · +1 light',
      reliability: measurements.value.reliability,
      raw: `composite L ${fixed(measurements.value.compositeLightness)}`,
    },
    {
      label: 'Chroma',
      score: signed(measurements.chroma.score),
      scale: '−1 muted · +1 clear',
      reliability: measurements.chroma.reliability,
      raw: `composite C ${fixed(measurements.chroma.compositeChroma)}`,
    },
    {
      label: 'Contrast',
      score: fixed(measurements.contrast.score),
      scale: '0 low · 1 high',
      reliability: measurements.contrast.reliability,
      raw: `max ΔL ${fixed(measurements.contrast.maximumLightnessDifference)} · RMS ΔL ${fixed(measurements.contrast.rmsLightnessDifference)}`,
    },
  ]

  const features = Object.entries(measurements.features) as [
    keyof ShadowSeasonMeasurements['features'],
    ShadowSeasonMeasurements['features'][keyof ShadowSeasonMeasurements['features']],
  ][]
  const illuminant = measurements.lighting.estimatedIlluminant
  const illuminantCss = illuminant
    ? `rgb(${Math.round(illuminant.rgb.r)}, ${Math.round(illuminant.rgb.g)}, ${Math.round(illuminant.rgb.b)})`
    : 'transparent'
  const activeClassification = classification?.version === 'prototype-12-v3'
    ? classification
    : undefined

  return (
    <details className="border border-dashed border-ink-soft/50 bg-white/40 p-5 text-sm text-ink">
      <summary className="cursor-pointer font-medium">
        Developer diagnostics · {measurements.version}
      </summary>

      <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">
        Continuous measurements and prototype-12-v3 now drive the displayed analysis and palette.
        Historical shadow labels are retained here for comparison with earlier measurements.
      </p>

      {presentation && (
        <div className="mt-4 border border-hairline p-3 font-mono text-xs">
          <p>Result presentation · {presentation.status} · {presentation.decision.policyVersion}</p>
          <p className="mt-2">Reason: {presentation.decision.reason}</p>
          <p className="mt-2">Top / runner affinity ratio: {fixed(presentation.decision.topToRunnerAffinityRatio)} · palette: {presentation.paletteMode}</p>
          <p className="mt-2">Presentation adds a close-tie check; technical image quality and classifier scores are unchanged.</p>
        </div>
      )}

      {qualityAssessment && (
        <div className="mt-5 border border-hairline bg-paper p-4">
          <p className="font-medium">Analysis-quality decision</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="border border-hairline bg-white/50 p-3">
              <p className="text-xs text-ink-soft">Image quality</p>
              <p className="mt-1 font-mono text-sm">{qualityAssessment.imageQuality.status}</p>
            </div>
            <div className="border border-hairline bg-white/50 p-3">
              <p className="text-xs text-ink-soft">Measurement reliability</p>
              <p className="mt-1 font-mono text-sm">
                {qualityAssessment.measurementReliability.reliableMajorDimensions.length}/3 major dimensions
              </p>
            </div>
            <div className="border border-hairline bg-white/50 p-3">
              <p className="text-xs text-ink-soft">Classification certainty</p>
              <p className="mt-1 font-mono text-sm">{qualityAssessment.classificationCertainty.status}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left font-mono text-[11px]">
              <thead className="text-ink-soft">
                <tr>
                  <th className="border-b border-hairline py-2 pr-4 font-normal">Image-quality check</th>
                  <th className="border-b border-hairline py-2 pr-4 font-normal">State</th>
                  <th className="border-b border-hairline py-2 font-normal">Evidence</th>
                </tr>
              </thead>
              <tbody>
                {qualityAssessment.imageQuality.checks.map((item) => (
                  <tr key={item.code}>
                    <td className="border-b border-hairline py-2 pr-4">{item.label}</td>
                    <td className="border-b border-hairline py-2 pr-4">{item.status}</td>
                    <td className="border-b border-hairline py-2 text-ink-soft">{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 font-mono text-[11px] text-ink-soft">
            Classification threshold {percent(qualityAssessment.measurementReliability.threshold)} · unresolved{' '}
            {[
              ...qualityAssessment.measurementReliability.unresolvedMajorDimensions,
              ...qualityAssessment.measurementReliability.unresolvedSupportingDimensions,
            ].join(', ') || 'none'}
          </p>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {dimensions.map((dimension) => (
          <div key={dimension.label} className="border border-hairline bg-paper p-3">
            <p className="text-xs text-ink-soft">{dimension.label}</p>
            <p className="mt-1 font-mono text-xl">{dimension.score}</p>
            <p className="mt-1 text-xs text-ink-soft">{dimension.scale}</p>
            <p className="mt-3 text-xs">Reliability: {percent(dimension.reliability)}</p>
            <p className="mt-1 break-words font-mono text-[11px] text-ink-soft">{dimension.raw}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 border border-hairline bg-paper p-4">
        <p className="font-medium">Exposure and colour stability</p>
        <p className="mt-1 max-w-4xl text-xs leading-relaxed text-ink-soft">
          Compare these values across photos: movement in absolute L with stable feature offsets points to exposure;
          movement before/after white balance points to illumination; movement in the offsets or C/L ratios points to
          sampling or actual feature-colour differences.
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="border border-hairline bg-white/50 p-3">
            <div className="flex flex-wrap justify-between gap-2">
              <p className="text-xs font-medium">Value stabilization</p>
              <p className="font-mono text-[11px] text-ink-soft">
                exposure reliability {percent(measurements.stabilityDiagnostics.exposure.reliability)}
              </p>
            </div>
            <p className="mt-3 font-mono text-xs">
              absolute score {signed(measurements.stabilityDiagnostics.exposure.absoluteValueScore)} · relative score{' '}
              {signed(measurements.stabilityDiagnostics.exposure.relativeValueScore)} · final{' '}
              {signed(measurements.stabilityDiagnostics.exposure.stabilizedValueScore)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              absolute composite L {fixed(measurements.stabilityDiagnostics.exposure.absoluteCompositeLightness)} ·
              relative weight {percent(measurements.stabilityDiagnostics.exposure.relativeValueWeight)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              skin L {fixed(measurements.stabilityDiagnostics.exposure.skinLightness)} · hair−skin ΔL{' '}
              {signed(measurements.stabilityDiagnostics.exposure.hairLightnessRelativeToSkin)} · eye−skin ΔL{' '}
              {signed(measurements.stabilityDiagnostics.exposure.eyeLightnessRelativeToSkin)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              darker-feature L / skin L{' '}
              {fixed(measurements.stabilityDiagnostics.exposure.darkerFeatureLightnessToSkinRatio)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              clipping score {percent(measurements.stabilityDiagnostics.exposure.clippingScore)} · skin exposure
              plausibility {percent(measurements.stabilityDiagnostics.exposure.skinExposurePlausibility)}
            </p>
          </div>

          <div className="border border-hairline bg-white/50 p-3">
            <p className="text-xs font-medium">Chroma stabilization</p>
            <p className="mt-3 font-mono text-xs">
              absolute C {fixed(measurements.stabilityDiagnostics.chroma.absoluteCompositeChroma)} · normalized C{' '}
              {fixed(measurements.stabilityDiagnostics.chroma.exposureNormalizedCompositeChroma)} · final C{' '}
              {fixed(measurements.stabilityDiagnostics.chroma.stabilizedCompositeChroma)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              exposure-normalized contribution{' '}
              {percent(measurements.stabilityDiagnostics.chroma.exposureNormalizationWeight)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-ink-soft">
              feature C/L · skin {fixed(measurements.stabilityDiagnostics.chroma.skinChromaToLightness)} · hair{' '}
              {fixed(measurements.stabilityDiagnostics.chroma.hairChromaToLightness)} · eyes{' '}
              {fixed(measurements.stabilityDiagnostics.chroma.eyeChromaToLightness)}
            </p>
          </div>
        </div>

        <div className="mt-4 border border-hairline bg-white/50 p-3">
          <div className="flex flex-wrap justify-between gap-2">
            <p className="text-xs font-medium">Contrast stabilization</p>
            <p className="font-mono text-[11px] text-ink-soft">
              final reliability {percent(measurements.contrast.reliability)} · estimator agreement{' '}
              {percent(measurements.stabilityDiagnostics.contrast.estimatorAgreement)}
            </p>
          </div>

          <div className="mt-3 grid gap-2 font-mono text-[11px] text-ink-soft sm:grid-cols-2 lg:grid-cols-4">
            <p>
              raw max / RMS {fixed(measurements.stabilityDiagnostics.contrast.rawMaximum)} /{' '}
              {fixed(measurements.stabilityDiagnostics.contrast.rawRms)}
            </p>
            <p>
              normalized max / RMS {fixed(measurements.stabilityDiagnostics.contrast.normalizedMaximum)} /{' '}
              {fixed(measurements.stabilityDiagnostics.contrast.normalizedRms)}
            </p>
            <p>
              aggregate raw → normalized {fixed(measurements.stabilityDiagnostics.contrast.rawAggregate)} →{' '}
              {fixed(measurements.stabilityDiagnostics.contrast.normalizedAggregate)}
            </p>
            <p>
              final {fixed(measurements.stabilityDiagnostics.contrast.stabilizedContrast)} · normalized weight{' '}
              {percent(measurements.stabilityDiagnostics.contrast.relativeWeight)} · disagreement{' '}
              {fixed(measurements.stabilityDiagnostics.contrast.estimatorDisagreement)}
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-left font-mono text-[11px]">
              <thead className="text-ink-soft">
                <tr>
                  <th className="border-b border-hairline py-2 pr-4 font-normal">Pair</th>
                  <th className="border-b border-hairline py-2 pr-4 font-normal">Raw ΔL</th>
                  <th className="border-b border-hairline py-2 pr-4 font-normal">Relative ΔL</th>
                  <th className="border-b border-hairline py-2 pr-4 font-normal">Normalized contrast</th>
                  <th className="border-b border-hairline py-2 font-normal">Pair reliability</th>
                </tr>
              </thead>
              <tbody>
                {measurements.stabilityDiagnostics.contrast.pairs.map((pair) => (
                  <tr key={pair.label}>
                    <td className="border-b border-hairline py-2 pr-4">{pair.label}</td>
                    <td className="border-b border-hairline py-2 pr-4">{fixed(pair.rawDeltaL)}</td>
                    <td className="border-b border-hairline py-2 pr-4">{fixed(pair.relativeDeltaL)}</td>
                    <td className="border-b border-hairline py-2 pr-4">{fixed(pair.normalizedContrast)}</td>
                    <td className="border-b border-hairline py-2">{percent(pair.reliability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-ink-soft">
            Local eye, brow, and lip-to-adjacent-skin contrast is not sampled yet; adding it would require a separate
            landmark-aware measurement stage.
          </p>
        </div>
      </div>

      <div className="mt-6 border border-hairline bg-paper p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-medium">Direct 12-season prototype classifier</p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-soft">
              Interpretable prototype used by the results flow. These normalized scores are provisional affinities,
              not validated probabilities of a correct diagnosis.
            </p>
          </div>
          {activeClassification && (
            <div className="text-right font-mono text-[11px] text-ink-soft">
              <p>{activeClassification.version}</p>
              <p>measurement reliability {percent(activeClassification.aggregateMeasurementReliability)}</p>
              <p>probability specificity {percent(activeClassification.probabilitySpecificity)}</p>
              <p>distance temperature {fixed(activeClassification.probabilityTemperature, 3)}</p>
            </div>
          )}
        </div>

        {activeClassification ? (
          <>
            {activeClassification.constrainedByUnreliableTemperature && (
              <div className="mt-4 border border-amber-700/30 bg-amber-50 p-3 text-xs text-amber-950">
                <p className="font-medium">Classification constrained by unreliable temperature</p>
                <p className="mt-1 leading-relaxed">
                  Warm/cool season distinctions are not considered resolved. Read the season rows as a broad set of
                  candidates rather than a confident winner.
                </p>
              </div>
            )}

            <div className="mt-4 border border-hairline bg-white/50 p-3">
              <p className="text-xs text-ink-soft">Evidence-supported profile</p>
              <p className="mt-1 font-medium">{activeClassification.broadProfileDescription}</p>
              <p className="mt-2 text-xs text-ink-soft">
                Specificity: {activeClassification.specificity} · constrained dimensions:{' '}
                {activeClassification.constrainedDimensions.length > 0
                  ? activeClassification.constrainedDimensions.join(', ')
                  : 'none'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CLASSIFIER_DIMENSIONS.map((dimension) => {
                  const state = activeClassification.dimensionDiscrimination[dimension]
                  return (
                    <span
                      key={dimension}
                      className={`border px-2 py-1 font-mono text-[11px] ${
                        state.sufficientlyReliable
                          ? 'border-emerald-700/30 bg-emerald-50 text-emerald-950'
                          : 'border-amber-700/30 bg-amber-50 text-amber-950'
                      }`}
                    >
                      {dimension}: {state.status} ({percent(state.reliability)}; threshold {percent(state.threshold)})
                    </span>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-soft">
              <span>
                Top/runner-up probability margin{' '}
                <span className="font-mono text-ink">{percent(activeClassification.runnerUpProbabilityMargin)}</span>
              </span>
              <span>
                distance margin{' '}
                <span className="font-mono text-ink">{fixed(activeClassification.runnerUpDistanceMargin, 4)}</span>
              </span>
              <span className="font-mono">
                base weights T {fixed(activeClassification.dimensionWeights.temperature, 2)} · V{' '}
                {fixed(activeClassification.dimensionWeights.value, 2)} · C{' '}
                {fixed(activeClassification.dimensionWeights.chroma, 2)} · K{' '}
                {fixed(activeClassification.dimensionWeights.contrast, 2)}
              </span>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
                <thead className="text-ink-soft">
                  <tr>
                    <th className="border-b border-hairline py-2 pr-4 font-normal">Rank / season</th>
                    <th className="border-b border-hairline py-2 pr-4 font-normal">Adjusted probability</th>
                    <th className="border-b border-hairline py-2 pr-4 font-normal">Raw affinity</th>
                    <th className="border-b border-hairline py-2 pr-4 font-normal">Distance</th>
                    {CLASSIFIER_DIMENSIONS.map((dimension) => (
                      <th key={dimension} className="border-b border-hairline py-2 pr-4 font-normal capitalize">
                        {dimension}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeClassification.topThree.map((candidate, index) => (
                    <tr key={candidate.id}>
                      <td className="border-b border-hairline py-3 pr-4 font-medium">
                        {index + 1}. {candidate.label}
                      </td>
                      <td className="border-b border-hairline py-3 pr-4 font-mono">
                        {percent(candidate.probability)}
                      </td>
                      <td className="border-b border-hairline py-3 pr-4 font-mono">
                        {percent(candidate.affinityProbability)}
                      </td>
                      <td className="border-b border-hairline py-3 pr-4 font-mono">
                        {fixed(candidate.distance, 4)}
                      </td>
                      {CLASSIFIER_DIMENSIONS.map((dimension) => {
                        const contribution = candidate.contributions[dimension]
                        return (
                          <td key={dimension} className="border-b border-hairline py-3 pr-4 font-mono text-[11px]">
                            <span className="block">
                              {signed(contribution.measured)} → {signed(contribution.prototype)}
                            </span>
                            <span className="mt-1 block text-ink-soft">
                              error {fixed(contribution.weightedSquaredError, 4)} · share{' '}
                              {percent(contribution.contributionShare)}
                            </span>
                            <span className="mt-1 block text-ink-soft">
                              reliability {percent(contribution.measurementReliability)} · effective weight{' '}
                              {fixed(contribution.effectiveWeight, 2)}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium">All 12 normalized prototype scores</p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
                Adjusted probability includes uncertainty flattening; raw affinity already uses reliability-weighted distances.
              </p>
              <div className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {activeClassification.rankings.map((candidate, index) => (
                  <p key={candidate.id} className="flex justify-between gap-4 font-mono text-[11px] text-ink-soft">
                    <span>{index + 1}. {candidate.label}</span>
                    <span>{percent(candidate.probability)} adjusted · {percent(candidate.affinityProbability)} affinity</span>
                  </p>
                ))}
              </div>
            </div>
          </>
        ) : (
          <p className="mt-4 text-xs text-ink-soft">
            Re-analyze this photo to populate the direct 12-season shadow comparison.
          </p>
        )}
      </div>

      <div className="mt-6 border border-hairline bg-paper p-4">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="font-medium">Illumination normalization</p>
            <p className="mt-1 text-xs text-ink-soft">
              {measurements.lighting.correctionApplied ? 'Correction applied' : 'Correction not applied'} · candidate consistency{' '}
              {percent(measurements.lighting.candidateConsistency)} · neutral-reference confidence{' '}
              {percent(measurements.lighting.neutralReferenceConfidence)} · final reliability{' '}
              {percent(measurements.lighting.reliability)} · strength {percent(measurements.lighting.correctionStrength)}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-soft">
              background candidates {measurements.lighting.backgroundCandidateCount} · sclera candidates{' '}
              {measurements.lighting.scleraCandidateCount} · spatial disagreement{' '}
              {measurements.lighting.spatialDisagreement?.toFixed(4) ?? 'n/a'} · background/sclera disagreement{' '}
              {measurements.lighting.estimatorDisagreement?.toFixed(4) ?? 'n/a'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="h-8 w-8 border border-hairline"
              style={{ backgroundColor: illuminantCss }}
            />
            <span className="font-mono text-[11px] text-ink-soft">
              {illuminant
                ? `RGB ${Math.round(illuminant.rgb.r)}/${Math.round(illuminant.rgb.g)}/${Math.round(illuminant.rgb.b)} · xy ${illuminant.chromaticityX.toFixed(4)}, ${illuminant.chromaticityY.toFixed(4)}`
                : 'No illuminant estimate'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {(['temperature', 'value', 'chroma'] as const).map((dimension) => (
            <div key={dimension} className="font-mono text-xs">
              <span className="capitalize text-ink-soft">{dimension}</span>{' '}
              {signed(measurements.beforeAfter[dimension].before)} →{' '}
              {signed(measurements.beforeAfter[dimension].after)}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 border border-hairline bg-paper p-4">
        <p className="font-medium">Skin-region analysis</p>
        <p className="mt-1 text-xs text-ink-soft">
          Consistency {percent(measurements.skinDiagnostics.consistencyScore)} · likely cause{' '}
          {measurements.skinDiagnostics.likelyCause}
        </p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left font-mono text-xs">
            <thead className="text-ink-soft">
              <tr>
                <th className="border-b border-hairline py-2 pr-4 font-normal">Region</th>
                <th className="border-b border-hairline py-2 pr-4 font-normal">Method</th>
                <th className="border-b border-hairline py-2 pr-4 font-normal">Retained</th>
                <th className="border-b border-hairline py-2 pr-4 font-normal">Representative L/a/b</th>
                <th className="border-b border-hairline py-2 pr-4 font-normal">C / hue</th>
                <th className="border-b border-hairline py-2 pr-4 font-normal">Rejected S/H/R/O</th>
                <th className="border-b border-hairline py-2 font-normal">Reliability</th>
              </tr>
            </thead>
            <tbody>
              {measurements.skinDiagnostics.regions.map((region) => (
                <tr key={region.name}>
                  <td className="border-b border-hairline py-2 pr-4">{region.name}</td>
                  <td className="border-b border-hairline py-2 pr-4">
                    {region.usedLandmarkPolygon ? 'landmark polygon' : 'fallback'}
                  </td>
                  <td className="border-b border-hairline py-2 pr-4">
                    {region.retainedPixelCount}/{region.sourcePixelCount}
                  </td>
                  <td className="border-b border-hairline py-2 pr-4">
                    {fixed(region.representative.l)}/{fixed(region.representative.a)}/{fixed(region.representative.b)}
                  </td>
                  <td className="border-b border-hairline py-2 pr-4">
                    {fixed(region.representative.chroma)} / {region.representative.hueDegrees?.toFixed(1) ?? 'n/a'}°
                  </td>
                  <td className="border-b border-hairline py-2 pr-4">
                    {region.rejected.shadow}/{region.rejected.highlight}/{region.rejected.redness}/{region.rejected.multivariateOutlier}
                  </td>
                  <td className="border-b border-hairline py-2">{percent(region.reliability)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {measurements.skinDiagnostics.pairwiseDistances.map((pair) => (
            <p key={`${pair.first}-${pair.second}`} className="font-mono text-[11px] text-ink-soft">
              {pair.first} ↔ {pair.second}: Δ {fixed(pair.total)} · ΔL {fixed(pair.lightness)} · ΔC{' '}
              {fixed(pair.chromatic)}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left font-mono text-xs">
          <thead className="text-ink-soft">
            <tr>
              <th className="border-b border-hairline py-2 pr-4 font-normal">Feature</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">Retained / total</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">Median L</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">L σ</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">Median C</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">C σ</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">Hue</th>
              <th className="border-b border-hairline py-2 pr-4 font-normal">Clipped</th>
              <th className="border-b border-hairline py-2 font-normal">Reliability</th>
            </tr>
          </thead>
          <tbody>
            {features.map(([name, stats]) => (
              <tr key={name}>
                <td className="border-b border-hairline py-2 pr-4 capitalize">{name}</td>
                <td className="border-b border-hairline py-2 pr-4">
                  {stats.sampleSize} / {stats.totalPixelCount}
                </td>
                <td className="border-b border-hairline py-2 pr-4">{fixed(stats.oklab.medianL)}</td>
                <td className="border-b border-hairline py-2 pr-4">{fixed(stats.oklab.lightnessStdDev)}</td>
                <td className="border-b border-hairline py-2 pr-4">{fixed(stats.oklch.medianChroma)}</td>
                <td className="border-b border-hairline py-2 pr-4">{fixed(stats.oklch.chromaStdDev)}</td>
                <td className="border-b border-hairline py-2 pr-4">
                  {stats.oklch.hueDegrees?.toFixed(1) ?? 'n/a'}°
                </td>
                <td className="border-b border-hairline py-2 pr-4">{percent(stats.clippedFraction)}</td>
                <td className="border-b border-hairline py-2">{percent(stats.reliability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5">
        <p className="font-medium">Quality flags</p>
        <ul className="mt-2 space-y-1 text-xs text-ink-soft">
          {measurements.qualityFlags.map((flag) => (
            <li key={flag.code}>
              [{flag.severity}] {flag.code}: {flag.message}
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
