# Precision Analysis v1

This is an interpretable, provisional photographic-repeatability model, not a validated undertone model or calibrated probability of season membership. Prototype-12-v3 coordinates, base weights, palettes, try-on, and core per-photo measurement formulas are unchanged.

## Capture and quality

`CaptureScreen` offers Precision (three photos), Quick (existing single camera photo), and upload (existing single-photo path). `PrecisionCapture` retains each accepted record in memory. Each moment uses a fresh `CameraCapture` instance and therefore a new stability window/buffer; previous frames cannot be reused for the next photo. Camera tracks and the disposable live landmark model are released between moments and on exit. Shared full-photo models remain cached. No photos are uploaded or persisted.

Live checks still use 250 ms samples, 1.1 seconds / at least five stable observations, and at most five JPEG frames from the last 1.5 seconds. Normally the best three lightweight candidates get full-photo analysis; if all three fail, remaining buffered candidates are evaluated. Highest detailed photographic score wins. Selection never reads season scores, dimension reliability, or season labels.

Full checks require all three landmark-aware skin regions (at least 40 retained pixels and 20% sample reliability), the existing technical image gate, regional lightness spread at most 0.14, and no severe diagnosed lighting inconsistency. V3 additionally rejects the corroborated combination of mixed-light suspicion, regional ΔL > 0.09, and skin consistency < 0.55. Colour variation or weak temperature alone is not a rejection. The existing 30% regional-lighting score now falls quadratically from ΔL 0.035 to 0.14, strongly preferring even illumination. Other weights are unchanged.

Manual shutter still overrides live readiness. Precision manual frames undergo the same full-photo technical check. Unavailable live metrics receive no ranking credit rather than fabricated sharpness/framing scores. A failed manual photo remains available for review/retake; failed automatic sets return to live guidance. Previously accepted photos stay saved. Final review allows replacing an individual photo.

After two good captures, two failed finalist batches/manual checks **or 20 seconds without a third** reveal “Use my two good photos.” This also prevents getting stuck when live conditions never become stable. The user chooses whether to continue. No one-photo Precision result is created.

## Session lighting suitability v1

Before aggregation, `buildPrecisionProfile` calls the separate `precisionSessionLighting.ts` policy. It reads only existing photographic diagnostics, never colour coordinates, dimension reliability, season preference or sensitivity. A passing scan proceeds through the unchanged aggregation/classification/palette path. A failing scan throws a typed error with diagnostic evidence; `PrecisionCapture` clears **all accepted moments**, starts a fresh camera/stability window at capture 1, and shows “For a more reliable result, move toward soft, even lighting and try again.” The two-photo fallback cannot reuse the rejected moments. Quick/upload paths are unchanged.

Versioned provisional parameters live in `precisionLightingConfig.ts`. The policy computes three bounded risk domains per capture:

- Mixed lighting: requires the existing mixed-light suspicion, at least 120 background candidates and a finite spatial disagreement. Severity rises linearly from 0 at 0.035 to 1 at 0.070. Multiply by `0.65 + 0.35 × weakNormalization × poorCandidateAgreement`; weakNormalization rises from 0 at 45% normalization reliability to 1 at 10%, and poorCandidateAgreement rises from 0 at candidate consistency 0.70 to 1 at 0.35. This distinguishes poor candidate agreement from uncertainty about whether a surface is neutral. Missing backgrounds, weak neutrality or unapplied correction **alone** score zero. Related mixed/spatial/normalization signals form one domain, not independent votes; sclera is never decisive.
- Uneven facial illumination: recompute maximum forehead/left-cheek/right-cheek ΔL from usable landmark-region representatives (40 retained pixels and 20% region reliability). Severity rises from 0 at ΔL 0.060 to 1 at 0.140. Multiply by consistency concern (0 at 0.65, 1 at 0.15), with full weight only when the existing likely-cause diagnostic says uneven lighting. Other diagnosed causes get half weight and cannot fail on this domain alone. Chromatic skin variation does not automatically imply poor illumination.
- Exposure/clipping: skin clipping severity rises from 0 at 8% to 1 at 30%, multiplied by `0.65 + 0.35 × weakExposure`; weakExposure rises from 0 at exposure reliability 0.60 to 1 at 0.20. Absolute skin brightness/skin exposure plausibility is diagnostic only. Global clipping includes hair/irises and therefore cannot alone trigger a failure. Uniform dimness or naturally deep skin is not rejected just for being dark.

Capture risk = largest domain risk + 20% of the second-largest, capped at 1. A capture is affected at risk ≥0.60. Reject only when at least two of three captures are affected (both captures for a two-photo scan). Signals must therefore be substantial, corroborated and recurring: one weak capture cannot fail a three-photo set. Different combined lighting problems can recur without one domain alone crossing 0.60; diagnostics explicitly distinguish this from a recurring single cause. Mean/median risk are descriptive, not additional classifier thresholds.

The reported poor-light example (mixed, spatial 0.0584, normalization 14%, sufficient background samples) yields mixed-domain risk about 0.642 and rejects when repeated across at least two captures. The good example (spatial 0.0129, 60% normalization) yields no mixed-light risk. Merely changing value to −0.52 cannot affect the decision or trigger remapping.

Developer views in capture review, rejected-scan camera mode, and final Precision diagnostics expose the decision, per-capture signals, domain risks, affected count and pass/fail reason. Rejected diagnostics are labelled as belonging to the previous discarded scan; no rejected photos are retained for reuse. The five `precision-lighting-*` capture-preview scenarios exercise good, uniform dim, mixed, weak-neutral and one-weak sessions through the real component flow. Fixtures are synthetic, not original user photographs.

Limitations: this is an operational suitability policy, not a calibrated likelihood of illumination bias. Spatial background variation can reflect different surfaces rather than mixed light; mild suspicion is allowed, but repeated strong disagreement may still be a false positive. Without usable scene references, even-looking systematic camera tone/exposure processing can remain undetected. The gate deliberately does not try to make different sessions match, invent exposure correction, or guarantee unbiased measurements. Further threshold calibration needs diverse labelled capture-quality sessions.

## Robust aggregation

`precisionAggregation.ts` treats each dimension separately:

1. Initial weight = dimension reliability² × technical capture quality.
2. Find the weighted median, and weighted median absolute deviation (MAD).
3. Robust residual scale = max(0.08, 1.4826 × MAD), halved for contrast's 0–1 domain.
4. For three captures, residuals beyond that scale receive factor `(scale / residual)²`; otherwise factor 1. Two captures are not enough to identify an outlier, so neither is trimmed.
5. The weighted robust centroid gives the coordinate. Diagnostics expose initial weights, outlier factors and final normalized shares.
6. Spread is RMS deviation around the centroid using **pre-outlier** weights. Discarding influence must not hide conflicting evidence.
7. Effective capture count is `1 / sum(finalShare²)`. Baseline reliability is the contribution-weighted within-photo reliability. Agreement factor is `exp(-(normalizedSpread / 0.30)²)` (contrast spread is doubled). Bonus = `0.12 × (effectiveCount−1)/2 × (1−baseline) × agreement`. Final reliability = `(baseline + bonus) × agreement`, with an additional 0.92 factor for two captures. Repeating zero-reliability evidence never creates confidence.

Agreement therefore gives a modest, capped bonus rather than assuming temporally adjacent captures are independent measurements. Correlated camera/lighting bias remains possible.

The aggregated profile is classified once using the existing reliability-weighted direct classifier. Per-photo classifications, still produced by the reusable full analysis, are not voted on or consumed. The highest technical-quality capture supplies the display/try-on image and non-aggregated feature diagnostics. The UI explicitly labels those diagnostic details as reference-capture data.

## Sampled uncertainty and sensitivity v2

`precisionUncertainty.ts` estimates the person-level sampling distribution from the existing aggregated coordinates and per-capture contributions; robust aggregation itself is unchanged. `seasonSensitivity.ts` evaluates that distribution. All parameters are versioned in `precisionConfig.ts`; prototype-12-v3 geometry remains untouched.

### Why v1 lost useful evidence

V1 expanded toward scale extremes using `(1−reliability)²`, added `1.5 × spread`, and equally counted all 81 Cartesian combinations of low/center/high. It did not use effective capture count, quality or robust contribution shares in uncertainty estimation. A single endpoint crossing a category boundary erased a dimension description. Specific results needed 85% of these extreme stress combinations; groups required every pair to be close, which wrongly excluded a coherent Soft Summer / Cool Summer / Soft Autumn neighbourhood.

For the reported temperature −0.479, reliability 0.626 and spread 0.049, v1 produced −0.665…−0.159. Even assuming zero spread in the other axes, chroma expanded to −0.685…−0.236 and contrast to 0.224…0.393, withholding both descriptions. With those zero-spread assumptions the old implementation yields 80.2% Soft Summer / 19.8% Cool Summer, **constrained**, not broad. The reported broad state needs the omitted spreads/full capture data to reproduce exactly. Tests explicitly label the reconstructed capture data as assumptions, not original photographs.

### Distribution components

For each axis, normalize the existing final robust shares `w_i` and use `n_eff = 1 / sum(w_i²)`. The model reports raw empirical spread (unchanged), robust weighted residual spread, repeatability standard error, measurement standard error and their combined standard deviation.

Repeatability covariance uses shared Gaussian multipliers for each complete capture residual vector. Coefficient for capture i on dimension d is:

`sqrt(w_di × [n_eff/(n_eff−1)] / n_eff) × (capture_di − aggregate_d)`.

The weighted sample-variance correction accounts for the very small number of captures. Agreement reduces residual covariance, and multiple effective captures reduce uncertainty of the estimate. Outlier downweighting affects coefficients before sampling. When almost only one capture has influence, residual disagreement is not mistaken for a precisely repeated estimate. Cross-axis covariance is the sum of coefficient products for the same captures, preserving observed directions such as correlated value/chroma changes.

Reliability values are operational scores, not calibrated standard errors. A separate, replaceable **measurement-error prior** supplies uncertainty when identical photos have zero residual spread:

- Scale `s0` is 0.25 × median nearest-neighbour RMS distance in the existing prototype geometry; contrast uses half that scale.
- Per-photo precision proxy `p_i = reliability_i × quality_i`.
- Error variance `v_i = s0² × (1−p_i)/p_i`, capped at uniform full-domain variance.
- Combined measurement variance = `0.65 × sum(w_i² v_i) + 0.35 × (sum(w_i sqrt(v_i)))²`.

The first component contracts with independent effective evidence; the second retains shared camera/lighting bias. Three identical moderate captures therefore improve repeatability without inventing perfect certainty. This prior and the 35% shared-error allocation are provisional assumptions, **not empirically learned calibration**. No fixed reliability-derived ± interval is assigned. Completely missing evidence uses a uniform full-domain distribution and cannot support a consumer dimension description.

The aggregated reliability remains unchanged and visible. Sampling reads its underlying per-photo reliability/quality and robust shares instead of applying the aggregated disagreement penalty a second time. Raw spread remains visible; losing influence over the center does not hide disagreement from diagnostics.

### Simulations and presentation

Generate 512 deterministic seeded Gaussian multiplier-bootstrap profiles around the unchanged aggregate, add within-photo error, and bound coordinates to their valid domains. Complete residual vectors share multipliers; independent Cartesian endpoint combinations are gone. With only two or three captures, covariance has limited rank; regularized measurement variance represents unresolved directions. Results expose theoretical and simulated covariance plus sampled 5th–95th percentile intervals. Those intervals describe this model, **not scientifically calibrated confidence intervals**.

Each simulation is a plausible true person-level coordinate set. It uses unchanged v3 base-weight distances, without discounting uncertain dimensions a second time. The original reliability-weighted direct classifier and its raw affinities remain separate diagnostics. Individual photo classifications are never voted on.

- Specific: leader wins at least 65%, leads the runner by at least 15 percentage points, and at least 90% of wins remain in its neighbourhood. Exact support below 85% receives moderate consumer wording; ≥85% receives strong wording.
- Constrained: up to three seasons in one neighbourhood cover at least 90%, including the leading season. Each member must be within RMS prototype distance 0.60 of a common winning anchor; outer members need not be equally close to each other.
- Broad/indeterminate: neither condition holds. Unrelated alternatives can prevent a specific result even with a strong numerical leader.

This admits the requested 70% Soft Summer / 20% Cool Summer / 8% Soft Autumn example as moderate-specific, and 45% / 30% / 22% as constrained. A Soft Summer / Bright Spring split stays broad. Thresholds remain operational and versioned, not validated diagnosis boundaries.

Consumer dimension descriptions require at least 70% of simulations to retain the aggregate's existing descriptive band. A rare category-crossing tail no longer erases an otherwise supported direction. Palette/recommendation generation is unchanged and consumes the resulting dimensions and candidates. The legacy 45% labels remain in single-photo logic and diagnostics; they do not decide Precision presentation.

Developer output includes empirical/robust spread, both uncertainty components, effective photo count, intervals, exact-season/family/neighbourhood wins, retention of the original direct-classifier top season, its most common alternative, pairwise ranking stability, final state and its reason. Frequencies are stress-test frequencies, not calibrated diagnosis probabilities.

## Full-person illuminant audit

The existing multiclass mask already labeled 0 background, 1 hair, 2 body skin, 3 face skin, 4 clothes and 5 other. Only category 0 was sampled, so correctly segmented bare shoulders/torso/arms/neck were **already excluded**. However, a single nearest-category lookup after downsampling could admit mixed person/background pixels near the silhouette. Mislabelled foreground can also masquerade as background.

`backgroundExclusion.ts` now requires an entire local neighbourhood to be category 0: at least two segmentation pixels in each direction, enlarged to cover the sampling footprint when needed. This is a reference-sampling guard only; it never edits any mask or try-on geometry. Missing segmentation still provides no background reference. Sclera remains weak support; illuminant scoring/correction strength is not made more aggressive. Foreground segmentation errors and an apparently neutral tinted wall remain limitations; the margin cannot guarantee semantic correctness for arbitrary objects.

## Verification and entry points

- `npm run lint`, `npm test`, `npm run build`.
- New precision tests cover all 12 strong prototype profiles, weak/outlier captures, small exposure/chroma shifts, conflicting evidence, missing temperature, two-photo penalties, zero evidence, 44/45 continuity, no season voting/mutation, technical rejection, manual fallback, and all person mask labels/boundary mixtures.
- Existing capture/finalist, results/palette and clothing-edge suites remain unchanged and run alongside these tests.
- `?preview=capture&mode=precision&debug=capture`: deterministic real-UI harness. Scenarios include precision-strong, precision-temperature, precision-outlier, precision-conflict, precision-reacquire, precision-two, movement, unavailable guidance and manual shutter. These synthetic scenarios are not real-person ground truth.
- Developer multi-capture diagnostics show each capture's T/V/C/K/reliability, technical quality, skin and lighting data, finalist scores/reasons, aggregate contributions/spread and all sensitivity wins/ranges.

Further calibration needs expert-labelled, diverse multi-photo sessions. Same-person continuity is guided, not biometric identity verification. Three nearby frames cannot remove systematic exposure, makeup or camera processing bias.
