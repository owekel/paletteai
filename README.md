# PaletteAI

Photo-based colour analysis and clothing try-on, running in your browser.
Photos stay local and remain available for try-on until you restart or close
the page. There is no account, upload service, or saved photo history.

## Run and check

```sh
npm install
npm run dev
```

Use the local address printed by Vite (usually http://localhost:5173).

- `npm test`: integration checks for 12 subtype palettes, uncertainty,
  technical rejection, and palette consistency.
- `npm run lint`: TypeScript checks.
- `npm run build`: TypeScript checks and production bundle.
- `npm run preview`: serve the production bundle.

MediaPipe downloads its public model files on first use. The photo is never
sent with those requests. Failed face detection or model loading produces
a technical-quality retake state, rather than a guessed season.

## Results flow

`analyzeImage → continuous measurements → prototype-12-v3 → image quality
assessment → season presentation → subtype/shared palette → results + try-on`

- **Specific result:** image quality passes, all three major dimensions meet
  the existing 45% reliability threshold, and the leading prototype's raw
  affinity is at least 1.5 times the runner-up. Show that season and its
  subtype palette. Contrast remains supporting evidence.
- **Constrained result:** usable photo with an unresolved major dimension or
  a close season tie. Show supported qualities first, unresolved qualities,
  and a candidate group. Include at least the top three and every candidate
  with at least half the leading raw affinity.
- **Indeterminate result:** no reliable major dimensions. Show exploration
  without claiming a candidate season or recommending a palette.
- **Retake:** only technical image-quality failures. Display the actual
  capture problems and relevant guidance.

These are provisional style heuristics, not validated probabilities.
No classification percentages appear in the consumer result. Prototype
coordinates, measurement formulas, and technical image-quality thresholds
were preserved during the results integration.

## Palette behaviour

All 12 seasons have separate curated palettes. Recommended colours, wardrobe
suggestions, the colour checker, and try-on use the same selected palette.

Uncertain results use the exact intersection of accents and neutrals across
**every** candidate palette. They never default to the first candidate or
average unrelated colours. If there is no intersection, the page offers
custom-colour exploration without a recommendation. Wardrobe suggestions
only use colours present in the selected palette.

The colour checker compares OKLab colour distance to the active palette.
It does not infer a season or reuse the former RGB undertone rules.

## Developer preview

With the development server running, open:

`/?preview=results&scenario=strong`

The toolbar switches between strong, constrained, close-tie, indeterminate,
and retake results. These fixtures use **synthetic measurements and an
illustration**; they test integration, not classification accuracy. This
preview is excluded from production. The illustration may not be recognized
as clothing by MediaPipe; use a real portrait to check recolouring.

The collapsed developer section on actual results retains all measurement,
lighting, skin-region, stability, prototype, and quality diagnostics, and
adds the final presentation decision. Historical `shadow*` field names remain
for diagnostic continuity even though the pipeline now drives results.

## Key files

- `src/services/analyzeImage.ts`: detection and sampling orchestration.
- `src/services/seasonMeasurements.ts`: continuous OKLab measurements.
- `src/services/analysisQualityGate.ts`: technical quality and reliability.
- `src/services/shadowSeasonClassifier.ts`: direct 12-season comparison.
- `src/data/shadowSeasonCalibration.ts`: versioned v3 calibration.
- `src/services/seasonAnalysis.ts`: shared consumer result model.
- `src/data/seasonPresentationPolicy.ts`: provisional presentation thresholds.
- `src/data/palettes.ts`: subtype palettes and exact intersections.
- `src/components/ResultsPage.tsx`: results, palette, and try-on layout.
- `src/services/clothingRecolor.ts`: existing fabric rendering pipeline.

The former four-season scoring, blended labels, and four-base-palette
selection have been removed. No stored profiles or server API require a
legacy classifier. Fixed-region fallback sampling remains for diagnostics;
it cannot produce a consumer season result when face detection fails.

## Manual regression checklist

1. Upload a well-lit portrait that includes clothing. Check the result,
   recommendations, and matching try-on swatches.
2. Choose a recommended swatch and a custom light/dark colour; compare
   Before/Try-On. Check folds, edges, and skin.
3. Check the development preview's strong, constrained, tie, indeterminate,
   and retake states at narrow and wide widths.
4. Open the developer section and confirm measurements and final decision.
5. Analyze another photo. Confirm the previous photo, palette, and try-on
   selection do not carry over.

Same-person photo consistency and expert seasonal agreement still require
a broader labelled evaluation. Synthetic checks do not establish accuracy.
