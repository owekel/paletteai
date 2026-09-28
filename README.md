# PaletteAI

A web app that looks at a photo of your face and suggests a clothing colour
palette based on your skin, hair, and eye colouring — undertone, depth,
contrast, and an estimated "colour season" (e.g. Soft Autumn, True Winter).

This is a **style recommendation tool, not a scientific or medical one**.
Results are phrased as "likely to complement" rather than objectively
correct, and no colour is ever described as unattractive — just as
something that may create less harmony with your detected colouring.

Your **photo** runs entirely in your browser and is never uploaded anywhere
— it's read locally, analyzed with the Canvas API, and then discarded once
your colour profile has been calculated. The computer-vision models used to
find your face/hair (see below) are downloaded from Google's public
MediaPipe CDN the first time you analyze a photo in a session — that's a
generic, one-time download of the *model files themselves*, not your photo.

## What it does

1. You upload a photo (drag-and-drop or file picker, no account needed).
2. The app estimates your undertone, depth, contrast, hair colour, and eye
   colour, and matches that to a colour season.
3. It generates a full colour palette for you: **Best Colours**, **Good
   Neutrals**, and **Colours to Use More Carefully**.
4. It applies that palette to a **Build Your Wardrobe** section (t-shirts,
   dress shirts, hoodies/sweaters, jackets, pants, accessories, plus
   versatile staples).
5. A **Try a Colour** tool lets you pick any hex colour and see a
   qualitative read on how it might work for you.

## Current V1 limitations

This is a first version, built to be simple and easy to extend — not a
finished product. Worth knowing before you rely on it:

- **Face/hair detection can still fail or be uncertain.** Computer vision
  isn't perfect — an unusual angle, heavy occlusion (hat, hood, hair fully
  covering the forehead), or a very low-quality photo can mean less of the
  photo gets confidently identified. When that happens the app is designed
  to lower its reported confidence and explain why (see "Why this reading
  may be less precise" on the results page) rather than pretend the result
  is exact — and if no face can be detected at all, it falls back to a
  simpler whole-photo estimate instead of failing outright.
- **Needs internet the first time in a session.** The face/hair detection
  models (a few MB) are fetched from Google's CDN on first use and cached
  in memory after that — see "How image analysis works" below. Offline or
  on a very slow connection, analysis automatically falls back to the
  simpler estimate above rather than hanging or crashing.
- **Lighting and filters still matter**, just less than before. Warm indoor
  lighting, flash, or filters shift the raw pixel colours that undertone,
  depth, and hair/eye colour are ultimately based on.
- **The palette is generated per season, not per person.** Two people
  detected as the same season currently get the same palette. Blending in
  the specific hair/eye colours detected, or the `secondarySeason` when a
  read is ambiguous, is a natural next step but isn't done in V1.
- **No persistence.** Nothing is saved between visits — refreshing the page
  clears everything. That's intentional for privacy in V1, but a "save my
  results" feature would need a deliberate (opt-in) storage decision later.
- **No automated tests yet**, and the computer-vision pipeline specifically
  has only been reviewed by careful reading and type-checking, not run
  against real photos — see the note at the bottom of this section.

## Project structure

```
palette-ai/
├── index.html                  Vite entry HTML (loads the Google Fonts used by the design)
├── package.json
├── tailwind.config.js          Colour/type design tokens
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── main.tsx                 React entry point
    ├── App.tsx                  Top-level state machine (landing → upload → loading → results)
    ├── index.css                Tailwind directives + global styles
    ├── vite-env.d.ts            Lets TypeScript understand Vite-specific imports (e.g. CSS)
    │
    ├── types/
    │   └── colorProfile.ts      Every shared TypeScript type (ColorProfile, ColorPalette, etc.)
    │
    ├── services/                Logic, deliberately separated from the UI
    │   ├── analyzeImage.ts      Main entry point — orchestrates detection + fallback, see below
    │   ├── colorUtils.ts        Shared colour-math helpers (hex/RGB/HSL conversion, etc.)
    │   ├── evaluateColorMatch.ts  Powers the "Try a Colour" feature
    │   └── vision/              Computer-vision pipeline (MediaPipe)
    │       ├── loadVisionModels.ts   Loads/caches the two MediaPipe models
    │       ├── faceDetection.ts      Landmarks → forehead/cheek/iris/hair-search regions
    │       ├── hairSegmentation.ts   Runs the hair segmentation model, exposes a mask
    │       └── colourSampling.ts     Trimmed-mean colour sampling, mask-aware
    │
    ├── data/
    │   └── palettes.ts          The actual curated colour data for each season
    │
    └── components/
        ├── LandingPage.tsx
        ├── UploadScreen.tsx
        ├── ImagePreview.tsx
        ├── AnalysisLoading.tsx
        ├── ResultsPage.tsx
        ├── ProfileSummary.tsx
        ├── ColourPalette.tsx
        ├── ColourSwatch.tsx
        ├── WardrobeSection.tsx
        └── ColourTester.tsx
```

## Installation

You'll need [Node.js](https://nodejs.org) 18 or later (which includes npm).
To check what you have:

```bash
node --version
npm --version
```

Then, from inside the `palette-ai` folder:

```bash
npm install
```

This downloads React, Vite, Tailwind, and the other packages listed in
`package.json` into a new `node_modules` folder. It only needs to be run
once (and again later if `package.json` changes).

## Running the development server

```bash
npm run dev
```

This starts Vite's dev server, usually at **http://localhost:5173**. Open
that URL in your browser. The page will automatically reload whenever you
edit and save a file — this is the command you'll use almost all the time
while working on the project.

Other available scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server with live reload |
| `npm run build` | Type-check the project, then build an optimized production bundle into `dist/` |
| `npm run preview` | Serve the production build from `dist/` locally, to sanity-check it before deploying |
| `npm run lint` | Type-check the project without building anything |

## How image analysis works

Everything lives behind one function in `src/services/analyzeImage.ts`:

```ts
analyzeImage(imageDataUrl: string): Promise<ColorProfile>
```

Nothing else in the app knows *how* that function works — every component
just receives a `ColorProfile` back.

**The primary path — real computer vision, entirely in your browser:**

1. **Face detection** (`vision/faceDetection.ts`): runs MediaPipe's
   FaceLandmarker model to find ~478 facial landmark points in the photo.
   From those, it works out where the forehead, left/right cheeks, and
   left/right iris actually are, plus a generous "candidate" area for hair
   — all expressed as a percentage of the *detected face's own size and
   position*, not a fixed guess at where a face usually sits in a photo.
2. **Hair segmentation** (`vision/hairSegmentation.ts`): runs a second
   MediaPipe model (a "multiclass selfie segmenter") that labels every
   pixel of the photo as background / hair / skin / clothes / other. This
   runs in parallel with face detection, since the two are independent.
3. **Sampling** (`vision/colourSampling.ts`): skin is sampled from the
   forehead + both cheeks and averaged; hair colour is sampled *only* from
   pixels inside the candidate area that the segmentation model actually
   labelled as hair (this is the fix for the original bug — hair colour no
   longer comes from whatever happens to be in a fixed rectangle, background
   included); eyes are sampled from the iris regions, discarding any sample
   that looks like a glare/highlight rather than pigment. All of these use a
   **trimmed mean** (the lightest/darkest 10% of pixels in a region are
   dropped before averaging) so a few stray pixels can't skew the result.
4. From there, the pipeline is unchanged from before: undertone / depth /
   contrast / season classification (`colorUtils.ts` + the scoring logic in
   `analyzeImage.ts`) work the same regardless of where the input colours
   came from.
5. **Confidence** is calculated from how much could actually be detected —
   face size, how much hair was found, how well the three skin samples
   agreed with each other, whether the eye samples looked usable, plus how
   clear-cut the season match was. Anything that pulls confidence down adds
   a plain-language note, surfaced on the results page.

**The fallback path — if any of the above fails:** no face detected, a
model fails to load, something times out, or an unexpected error occurs
anywhere in that pipeline — `analyzeImage` catches it and falls back to the
original V1 approach: fixed rectangles guessed from typical portrait
framing, unchanged from the first version of this app. The result is
returned with a clearly lower confidence and an explanatory note rather
than crashing or hanging.

## A note on testing

I do not have a way to run this app in an actual browser or test it against
real photos in the environment I built it in — no network access to
install `@mediapipe/tasks-vision` or run `npm install`/`npm run build`, and
no way to launch a browser. Everything above was written against MediaPipe's
official documentation (verified via web search rather than assumed from
memory, since this API has changed over time) and checked with TypeScript's
compiler as far as that's possible without the real package installed. The
logic was reviewed carefully, and the whole pipeline is wrapped in
try/catch with the original V1 sampling as a fallback specifically *because*
of this — a mistake in the new code should degrade to the old behaviour
rather than break the app. Still, **please treat this as untested until you
run it yourself** with `npm install && npm run dev` and try a few real
photos, including the original black-hair case.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, and `@mediapipe/tasks-vision`
(on-device face landmark detection + hair segmentation, running in the
browser via WebAssembly — no backend). No database, no account system, no
extra UI or state-management libraries.

## License

No license file is included yet. Add one (MIT is a common, simple choice
for a personal/learning project) if you plan to make the GitHub repo
public.
