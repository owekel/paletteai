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
assessment → season presentation → subtype/consensus palette → results + try-on`

- **Specific result:** image quality passes, all three major dimensions meet
  the existing 45% reliability threshold, and the leading prototype's raw
  affinity is at least 1.5 times the runner-up. Show that season and its
  subtype palette. Contrast remains supporting evidence.
- **Candidate group:** usable photo with an unresolved major dimension or
  a close season tie. Show supported qualities and a weighted consensus
  palette first, then possible seasons and open questions. Include at least
  the top three and every candidate with at least half the leading raw
  affinity; if that exceeds five candidates, use a broad-profile presentation.
- **Broad profile:** a season group is too broad or no major dimension is
  reliable. Use any reliable dimensions (including contrast alone) for
  styling advice. If none are reliable, offer an explicitly non-personal
  everyday-colour exploration kit, without invented season candidates,
  wardrobe recommendations, or personalized colour-match ratings.
- **Retake:** only technical image-quality failures. Display the actual
  capture problems and relevant guidance.

These are provisional style heuristics, not validated probabilities.
No classification percentages appear in the consumer result. Prototype
coordinates, measurement formulas, and technical image-quality thresholds
were preserved during the results integration.

## Palette behaviour

All 12 seasons have separate curated palettes. Recommended colours, wardrobe
suggestions, the colour checker, and try-on use the same selected palette.

Uncertain results use `consensus-v1`, not an exact-hex intersection or a
concatenation of candidate palettes:

- Normalize the candidates' uncertainty-adjusted probabilities. Broad
  profiles use all 12 scores; entirely unresolved profiles use uniform
  weights so unreliable measurements cannot personalize the exploration kit.
- Each catalogue colour receives support from its nearest colour in each
  season, with Gaussian OKLab similarity (sigma 0.065). A season votes once.
- Reliable value/chroma/temperature measurements contribute a styling fit:
  `support × (0.7 + 0.3 × fit)`. When temperature is unresolved, multiply by
  `1 − 0.25 × temperatureDependence`; dependence measures warm-versus-cool
  palette support across the full catalogue, not the first candidate.
- Choose up to six accents and three neutrals with support at least 0.2,
  avoiding near-duplicates within OKLab distance 0.055. Reliable contrast
  shapes tonal spread and a suggested two-piece combination.

These are provisional recommendation heuristics, not new classification
confidence thresholds. Parameters live in a separate versioned policy.
Exact subtype palettes and the existing 45% discrimination threshold remain
unchanged. Wardrobe suggestions only use the selected palette's colours.

Open dimensions get comparison pairs: warm/cool shades with similar
lightness/chroma, softer/clearer blues, or lighter/deeper teals. Clicking a
pair applies it to the same prepared clothing mask, with controls to switch
again in try-on. Selections never change or train the classifier.
"Less supported right now" advice only comes from reliable measurements.

The colour checker compares OKLab colour distance to the active palette.
It does not infer a season or reuse the former RGB undertone rules.

## Developer preview

With the development server running, open:

`/?preview=results&scenario=strong`

The toolbar switches between strong, constrained, close-tie, contrast-only
broad profile, low-certainty, indeterminate, and retake results. These use
**synthetic measurements and an illustration**; they test integration, not
classification accuracy. This preview is excluded from production. Its
optional local photo picker replaces only the try-on image, not the fixture
measurements; use it to test pair switching with actual clothing. Use the
normal upload flow to test a photo's real analysis.

The collapsed developer section on actual results retains all measurement,
lighting, skin-region, stability, prototype, and quality diagnostics, and
adds the presentation decision, consensus weights, supported styling axes,
per-colour support, dimension fit, and temperature dependence.
Historical `shadow*` field names remain
for diagnostic continuity even though the pipeline now drives results.

## Key files

- `src/services/analyzeImage.ts`: detection and sampling orchestration.
- `src/services/seasonMeasurements.ts`: continuous OKLab measurements.
- `src/services/analysisQualityGate.ts`: technical quality and reliability.
- `src/services/shadowSeasonClassifier.ts`: direct 12-season comparison.
- `src/data/shadowSeasonCalibration.ts`: versioned v3 calibration.
- `src/services/seasonAnalysis.ts`: shared consumer result model.
- `src/data/seasonPresentationPolicy.ts`: provisional presentation thresholds.
- `src/data/palettes.ts`: unchanged curated subtype palettes.
- `src/services/consensusPalette.ts`: weighted perceptual recommendations.
- `src/data/consensusPalettePolicy.ts`: versioned recommendation heuristics.
- `src/data/colourComparisons.ts`: comparable try-on pairs.
- `src/components/ResultsPage.tsx`: results, palette, and try-on layout.
- `src/services/clothingRecolor.ts`: existing fabric rendering pipeline.

The former four-season scoring, blended labels, and four-base-palette
selection have been removed. No stored profiles or server API require a
legacy classifier. Fixed-region fallback sampling remains for diagnostics;
it cannot produce a consumer season result when face detection fails.

## Clothing edge repair

The smooth feather/local matte from `17c89de` is restored. The later coverage
reconstruction, outside-mask propagation and appearance polish are removed.
Interior tone mapping, detection, palettes and consumer try-on UI are unchanged.

The only added correction reads nearby confident interior tone for strongly
source-hue-coloured pixels on the garment side within three photo pixels.
It never changes alpha or background estimates. Ambiguous, achromatic,
skin-coloured and dark-seam pixels retain the restored baseline treatment.
Lossless PNG export is retained. See `docs/garment-boundary-matting.md`.

The development-only `/?preview=recolor` compares the restored baseline and
the conservative tone correction at normal size and 3× collar/shoulder zoom.
Tests cover red→deep teal/taupe/cyan, blue→coral, white→black and black→white.
Uploaded portraits use their original pixels; source-dye simulation is opt-in.
Diagnostics check that the correction changes zero alpha pixels and zero
confident-interior pixels. Real-photo passthrough metrics are not ground-truth
segmentation accuracy. `npm test` exercises the actual compositor as well as
sampling guards, brightness contamination and continuous fractional coverage.

## Manual regression checklist

1. Upload a well-lit portrait that includes clothing. Check the result,
   recommendations, and matching try-on swatches.
2. Choose a recommended swatch and a custom light/dark colour; compare
   Before/Try-On. Check folds, edges, and skin.
3. Check all development result states at narrow and wide widths. Usable
   states must have useful colours, but no unsupported personal claims.
4. In constrained results, switch comparison pairs on an actual portrait.
   Confirm the photo changes but the analysis does not. Check Before/Try-On.
5. Open the developer section and confirm measurements and final decision.
6. Analyze another photo. Confirm the previous photo, palette, and try-on
   selection do not carry over.

Same-person photo consistency and expert seasonal agreement still require
a broader labelled evaluation. Synthetic checks do not establish accuracy.
