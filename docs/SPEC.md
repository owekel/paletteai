# PaletteAI — Product specification

**Status:** Implemented product, documented retrospectively in November 2026.  
**Live demo:** https://paletteai-sepia.vercel.app  
**Scope:** Browser-based personal colour exploration, guided photography, recommendations, and clothing-colour try-on.

> **Evidence boundary:** This is a readable description of the shipped application, not the original document from which it was built. It is grounded in the current repository and existing engineering documentation. Product motivations were reconstructed from development discussions; exact original wording and dates of individual requirements are not asserted. PaletteAI is an experimental styling tool, **not a scientifically validated method for determining a person's colour season**.

## 1. User problem and product intent

Personal colour analysis is often presented as a definitive label despite significant variation in photography, device processing, lighting and the visibility of skin, hair and eyes. A useful digital experience must help people explore wearable colours without implying that a single imperfect image establishes an objective truth.

**Target user:** Someone curious about personal colour palettes and how suggested clothing colours might look on them, using a browser and their own portrait.

**Product goals**

1. Make photo acquisition understandable and low-friction.
2. Use photographic evidence responsibly rather than forcing a confident season classification.
3. Turn results into practical colours, comparisons and a visual try-on.
4. Minimize the privacy cost of supplying a portrait by keeping processing on the device.
5. Provide a visually polished, accessible experience that also works when some sensors or models fail.

**Explicit non-goals:** Clinical or scientifically validated colour/undertone diagnosis; guaranteed cross-device or cross-lighting consistency; identifying a person; remote image analysis; social accounts; cloud photo histories; measuring purchases, retention or conversion (none are currently tracked).

## 2. Core journeys and requirements

### 2.1 Entry and photograph acquisition

- **FR-01 — Flexible input:** Offer a recommended **Precision Analysis** camera flow, a **Quick Analysis** camera flow and a portrait upload path. File uploads accept JPEG, PNG and WebP within documented safety limits.
- **FR-02 — Live guidance:** During supported camera sessions, provide actionable feedback about face framing, pose, exposure, motion and uneven facial illumination.
- **FR-03 — Guided auto-capture:** Select a photograph automatically after a stable suitability window; use a bounded buffer of recent candidates and select according to photographic quality. Do not select a frame because it produces a preferred season.
- **FR-04 — Recovery:** Preserve a manual shutter option. Show specific retake or error guidance when camera access, model loading or technical photo checks fail. Release camera resources when leaving capture.
- **FR-05 — Precision captures:** Request three independently captured moments. Allow a user-initiated two-photo fallback when documented capture difficulties persist, and allow review/replacement of accepted moments. Do not generate a one-photo “Precision” result.

**Implementation evidence:** [Guided Capture](guided-capture.md), [Precision Analysis](precision-analysis.md), and the camera/capture services and components under **src/**.

### 2.2 Analysis and representation of uncertainty

- **FR-06 — Photo measurement:** Analyze relevant colour signals from the portrait using local MediaPipe landmarks/segmentation, image sampling and colour calculations.
- **FR-07 — Robust multi-photo interpretation:** For Precision, combine continuous temperature/value/chroma/contrast measurements across accepted photographs, account for their quality and agreement, and classify the resulting aggregate once. Do **not** majority-vote season names assigned to individual photographs.
- **FR-08 — Lighting suitability:** Identify repeated strong photographic lighting concerns within a Precision session; if the session fails the documented policy, request a fresh session rather than silently presenting it as reliable.
- **FR-09 — Calibrated presentation, not fabricated certainty:** Distinguish a specific season result, a group of candidates, a broad supported profile and a technical retake. Present uncertainty without implying that provisional affinity scores are scientifically validated probabilities.
- **FR-10 — Honest fallback:** If no dimension is reliable, offer an explicitly non-personalized exploration palette rather than inventing a personal diagnosis. Weak season evidence is not by itself grounds for a photo retake.

**Implementation evidence:** [Precision Analysis](precision-analysis.md), **src/services/**, and the result policies described in [README](../README.md).

### 2.3 Practical recommendations and visual try-on

- **FR-11 — Unified palette:** Keep visible recommendations, wardrobe suggestions, colour-checking and try-on consistent with the same selected season or consensus palette.
- **FR-12 — Useful unresolved results:** For uncertain classifications, favour shared/weighted consensus colours and side-by-side comparisons that help a person explore open dimensions.
- **FR-13 — Clothing-colour visualization:** Permit selection of suggested or custom colours and display the recoloured garment in the supplied portrait, with the ability to compare against the original.
- **FR-14 — Conservative visual composition:** Prefer preserving garment shape, shading, seams, skin and background over aggressive fringe removal that would damage the image.

**Implementation evidence:** [Garment boundary matting](garment-boundary-matting.md), **src/services/clothingRecolor.ts**, **src/components/ColorTryOn.tsx**, **src/components/ResultsPage.tsx**.

### 2.4 Usability and visual presentation

- **FR-15 — Clear hierarchy:** Prioritize the supported profile, recommended colours, practical explanation, optional comparisons and try-on. Keep developer diagnostic data out of the consumer experience.
- **FR-16 — Accessible controls:** Use visible keyboard focus, labelled colour choices and responsive layouts. Respect reduced-motion preferences.
- **FR-17 — Product identity:** Present a restrained fashion-editorial visual system using a warm neutral background, quiet typographic hierarchy and a small recurring accent language without letting decoration overpower portraits or colours.

**Implementation evidence:** [Consumer visual system](consumer-design.md).

## 3. Privacy, safety and operations

- **NFR-01 — Local image processing:** Photo decoding, capture, analysis, segmentation and recolouring run in the visitor's browser. The implementation has no application photo-upload endpoint, account, backend, database or remote inference API.
- **NFR-02 — Session-limited personal data:** Portraits and profiles remain in browser application memory while needed. The application does not intentionally persist them to cookies, Web Storage or IndexedDB; browser garbage collection is not secure deletion.
- **NFR-03 — Bounded inputs:** Validate still-image format, file size and dimensions before analysis; handle corrupt and oversized files safely.
- **NFR-04 — Local model assets:** Serve pinned public vision models, WASM and font assets from the website origin; do not confuse ordinary host connection logs with uploaded portraits.
- **NFR-05 — Quality and release checks:** Use TypeScript checks, automated regression coverage, production builds and focused device/browser acceptance. Do not claim that synthetic fixtures prove real-world colour-analysis accuracy.

**Implementation evidence:** [Privacy architecture](privacy-architecture.md), [Security](security.md), [Deployment](deployment.md), [Public launch verification](final-launch-2026-10-22.md).

## 4. Technical shape (high-level)

PaletteAI is a static React/TypeScript single-page application built with Vite. The browser runs MediaPipe vision tasks and local canvas/image processing. Navigation between entry, capture, loading and results is state-based, with a separately addressable privacy page. The current runtime does not require an AI API key or an inference server.

The processing route, in broad terms:

1. Acquire or upload a portrait.
2. Assess technical photo suitability and measure visible colour features.
3. For Precision, assess session lighting and aggregate independent photographic measurements.
4. Interpret supported colour qualities and candidate seasons using provisional rules.
5. Choose a season, weighted consensus or unpersonalized exploration palette according to evidence.
6. Display recommendations and allow local garment-colour preview.

The project currently uses heuristic policies and versioned thresholds. **Their numerical values are engineering settings, not measured clinical accuracy, confidence intervals or an externally calibrated quality guarantee.** Refer to the linked engineering notes for precise algorithms and thresholds.

## 5. Verification and remaining limitations

- The October 2026 launch record reported **135 automated checks across 11 suites** and owner-reported real-device Mac/iPhone acceptance; that is historical release evidence, not a new test execution for this document.
- Automated fixtures and hosted browser tests support expected software behavior, but do not establish correct season labels across diverse people, lighting or cameras.
- A complete fresh anonymous post-analysis browser network/storage trace and physical-camera packet trace were **not completed** in the release record. The documented local-processing design should not be inflated into evidence that every possible runtime scenario has been exhaustively audited.
- Landmark visibility, hair/iris sampling, illumination inference and garment segmentation are inherently fallible; photographs can contain mixed light, makeup, unusual processing or other confounders.
- The experience is a styling aid. It should not imply users must avoid colours they personally enjoy.

## 6. Related documents

- [Design decisions and trade-offs](DESIGN_DECISIONS.md) — why notable product directions were chosen.
- [AI-assisted development](AI_DEVELOPMENT.md) — division of human and AI-tool responsibilities, representative directions, and review practices.
- [Guided capture engineering](guided-capture.md) and [Precision Analysis engineering](precision-analysis.md) — implementation-level detail.
- [Privacy architecture](privacy-architecture.md) and [Public launch verification](final-launch-2026-10-22.md) — evidence and limitations.
