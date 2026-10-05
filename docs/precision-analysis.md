# Precision Analysis v1

This is an interpretable, provisional photographic-repeatability model, not a validated undertone model or calibrated probability of season membership. Prototype-12-v3 coordinates, base weights, palettes, try-on, and core per-photo measurement formulas are unchanged.

## Capture and quality

`CaptureScreen` offers Precision (three photos), Quick (existing single camera photo), and upload (existing single-photo path). `PrecisionCapture` retains each accepted record in memory. Each moment uses a fresh `CameraCapture` instance and therefore a new stability window/buffer; previous frames cannot be reused for the next photo. Camera tracks and the disposable live landmark model are released between moments and on exit. Shared full-photo models remain cached. No photos are uploaded or persisted.

Live checks still use 250 ms samples, 1.1 seconds / at least five stable observations, and at most five JPEG frames from the last 1.5 seconds. Normally the best three lightweight candidates get full-photo analysis; if all three fail, remaining buffered candidates are evaluated. Highest detailed photographic score wins. Selection never reads season scores, dimension reliability, or season labels.

Full checks require all three landmark-aware skin regions (at least 40 retained pixels and 20% sample reliability), the existing technical image gate, regional lightness spread at most 0.14, and no severe diagnosed lighting inconsistency. V3 additionally rejects the corroborated combination of mixed-light suspicion, regional ΔL > 0.09, and skin consistency < 0.55. Colour variation or weak temperature alone is not a rejection. The existing 30% regional-lighting score now falls quadratically from ΔL 0.035 to 0.14, strongly preferring even illumination. Other weights are unchanged.

Manual shutter still overrides live readiness. Precision manual frames undergo the same full-photo technical check. Unavailable live metrics receive no ranking credit rather than fabricated sharpness/framing scores. A failed manual photo remains available for review/retake; failed automatic sets return to live guidance. Previously accepted photos stay saved. Final review allows replacing an individual photo.

After two good captures, two failed finalist batches/manual checks **or 20 seconds without a third** reveal “Use my two good photos.” This also prevents getting stuck when live conditions never become stable. The user chooses whether to continue. No one-photo Precision result is created.

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

## Continuous uncertainty and sensitivity

`seasonSensitivity.ts` uses `precisionConfig.ts`; prototype calibration is untouched.

For each aggregated dimension, `u=(1−reliability)²`. Low/high endpoints extend from the estimate toward the domain minimum/maximum by `u` of that distance, plus a 0.04 floor (0.02 for contrast) and 1.5× observed spread. Endpoints are bounded by the domain. Zero reliability gives the whole domain. These are conservative plausible ranges, **not statistical confidence intervals**.

81 combinations of low / estimate / high are evaluated across the four dimensions. Sample hypotheses use the unchanged **base-weight prototype distance**, not an additional reliability multiplier: uncertainty is already expressed by the ranges. Otherwise a zero-weight temperature axis could never affect the ranking, even across −1…+1. Exact distance ties split the sample contribution.

- Specific: one season wins at least 85% of stress samples.
- Candidate group: up to three seasons together win at least 90%, and each pair has base-weight RMS prototype distance ≤0.60.
- Broad: neither condition holds; use the existing broad-profile/consensus exploration experience.

Those operational boundaries and the coarse grid remain provisional. Frequencies describe robustness under a stress test, not probabilities that a person belongs to a season. An exact result can legitimately retain an open temperature dimension when that uncertainty does not change the leading season.

A consumer dimension description is supported only when the entire range stays in its existing descriptive band (cool/balanced/warm, deep/medium/light, soft/medium/clear, low/moderate/high contrast). Recommendations consume those supported dimensions and sensitivity-selected candidate identities. The existing palette engine is reused. The old 45% labels remain in legacy diagnostics and the explicitly preserved single-photo path, but do **not** decide Precision specificity, candidate membership or supported dimension descriptions.

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
