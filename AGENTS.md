# PaletteAI collaboration guide

## Working source

- This folder is the persistent source of truth. Edit it in place; do not create a new ZIP for each iteration.
- The baseline is the premium Results + Color Try-On UX with the v4 adaptive clothing recoloring work.
- Keep changes small and testable. Preserve unrelated user work.

## Protected areas

Unless the user explicitly expands the scope, do not change:

- seasonal analysis or classification
- face, hair, or eye detection
- palette generation
- camera capture
- unrelated pages or Results/Try-On UX

## Current tuning area

- Clothing recoloring lives in `src/services/clothingRecolor.ts`.
- Dark colors currently use percentile-based HSL tone mapping.
- Light colors use a linear-light fabric multiplier, blended in for target lightness values from 62 to 80.
- The clothing mask uses a narrow, continuous feather derived from the blurred alpha channel.
- When tuning visuals, compare both white-to-black and black-to-white examples and preserve folds, texture, and smooth edges.

## Run and verify

- Install once with `npm install`.
- Start the live preview with `npm run dev`.
- Validate production bundling with `npx vite build`.
- `npm run lint` currently reports a pre-existing MediaPipe type-definition error in `src/services/vision/loadVisionModels.ts`: `WasmFileset` is declared locally but not exported. Do not attribute that error to recoloring-only changes.

Use the live preview and screenshots for iterative visual review. Keep a Git checkpoint for each accepted version so changes can be compared or rolled back.
