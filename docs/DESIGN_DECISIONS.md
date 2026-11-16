# PaletteAI — Design decisions and trade-offs

**Type:** Retrospective product decision record, assembled in November 2026  
**Status:** Explains the direction of the shipped application; not a claim that these were all written as formal design proposals before implementation.

## How to read this document

This document combines two kinds of evidence:

- **Product reasoning reconstructed from development discussions and informal testing.** These are the problems and priorities the project owner discussed while iterating on PaletteAI. They are paraphrased, not verbatim quotes.
- **Implementation evidence in the repository.** Links to engineering notes and source code substantiate what the application actually does.

The distinction matters: a feature's presence in the source code verifies implementation, not the exact words, timestamps, or people responsible for the original idea. No private chat transcripts, tester names, personal photographs, or unverified quantitative success claims are published here.

## D01 — Treat lighting reliability as a product problem, not only a classifier problem

**Problem.** Early hands-on testing surfaced inconsistent analysis under differing lighting and photographic conditions. A polished result screen could not compensate for untrustworthy input.

**Product choice.** Prioritize the photographic acquisition experience and transparent reliability assessment as part of the analysis product. The app should guide people toward usable photographs and acknowledge when the evidence is insufficient.

**Implemented response.** The camera flow checks framing, pose, exposure, motion and uneven illumination. More expensive full-photo checks evaluate buffered candidates before a photograph proceeds. Technical failures receive retake guidance; uncertainty about a colour season is represented downstream rather than automatically treated as an invalid photograph.

**Trade-off.** More guidance and gating can increase time-to-result and sometimes reject workable images. The manual shutter and upload path mitigate friction. Conversely, permissive capture can produce misleadingly polished results.

**Outcome and evidence.** The feature is implemented and has automated test coverage, but there is no published measured improvement in classification accuracy or conversion. See [Guided Capture](guided-capture.md), [Precision Analysis](precision-analysis.md) and **src/services/capture/**.

## D02 — Use guided automatic capture and a bounded best-frame buffer

**Problem.** Asking a user to hold still, evaluate the lighting and press a shutter at exactly the right moment makes the camera experience unnecessarily demanding. Informal feedback from an early tester helped make automatic capture an explicit usability priority.

**Product choice.** Automatically collect a photo after a stable suitability window, but retain manual control and explain what the user can do when conditions are not suitable.

**Implemented response.** Lightweight live checks operate separately from season analysis. Recent qualifying photos enter a bounded buffer. The system applies a second, more detailed photographic check to finalists and selects the best qualifying image. Camera resources are cleaned up when leaving the flow.

**Important constraint.** Selection uses **photographic quality**, not which frame produces the most appealing classification or strongest season score. Otherwise, the camera could bias the conclusion it is supposed to measure.

**Trade-off.** Waiting for stability may feel slower than an immediate shutter; running the full analysis continuously would be wasteful. Buffered selection balances responsiveness and capture quality, with a manual override.

**Evidence.** [Guided Capture](guided-capture.md) details the implemented gates and ranking strategy. The tester feedback is recorded only as a generalized motivation; no person is identified.

## D03 — Offer three-photo Precision Analysis without claiming three photos solve calibration

**Problem.** One photograph can reflect camera white balance, local shadows or an atypical lighting moment. Repeating the measurement gives additional evidence about consistency.

**Product choice.** Make a multi-photo flow the recommended path while retaining Quick and upload options. Treat repeatability as a question to evaluate, not as proof of correctness.

**Implemented response.** Precision requests three separately accepted photographic moments. It checks for recurring strong lighting risk across the session, combines continuous measurements using quality/reliability-sensitive robust aggregation, and classifies **once** from the combined profile. It does not majority-vote independently assigned season labels. A deliberate two-photo fallback can appear when obtaining the third usable image becomes difficult.

**Alternatives and constraints.** A simple voting scheme would be easier to explain but throws away distance, quality and dimension reliability. More aggressive capture rejection could trap users indefinitely; accepting two good moments with an explicit reliability penalty is a compromise.

**Trade-off.** Precision requires greater effort, and photographs taken moments apart can share the same systematic camera or lighting bias. Multiple photos may improve repeatability without establishing objective colour truth.

**Evidence.** [Precision Analysis](precision-analysis.md) describes the implemented aggregation, lighting policy, two-photo fallback and limitations. It does **not** establish a validated accuracy improvement.

## D04 — Show uncertainty honestly instead of forcing an exact “season”

**Problem.** Testing and review repeatedly exposed ambiguity among nearby colour profiles. Presenting an exact category regardless of evidence risks turning a styling suggestion into false precision.

**Product choice.** Present only what the photo supports: a specific season when sufficiently distinguished, a candidate group when dimensions or season ranking remain uncertain, a broad profile when evidence is limited, or a technical retake when the photograph cannot be processed reliably.

**Implemented response.** Results use provisional reliability checks and candidate-affinity rules. Uncertain results can show a weighted consensus palette and comparisons across unresolved dimensions. If no measured dimension is reliable, the app identifies its palette as non-personalized exploration.

**Trade-off.** A qualified answer can feel less exciting than a definitive label. But making uncertainty useful—through shared shades and try-on—better serves the underlying goal of helping someone choose colours.

**Evidence.** [README](../README.md), [Precision Analysis](precision-analysis.md), and **src/components/ResultsPage.tsx**. All heuristic scores remain uncalibrated; their presentation is not evidence of scientific certainty.

## D05 — Protect garment appearance when recolouring

**Problem.** A clothing-colour try-on is less useful if recolouring spills onto skin/background, creates unnatural borders, or removes original shading. Visual testing raised concerns about edge fringes and convincing fabric appearance.

**Product choice.** Favour a conservative image edit that preserves the original garment silhouette, tonal detail and surrounding pixels—even if a subtle remnant of source hue survives difficult edges.

**Implemented response.** Recolouring operates on a segmentation-based clothing mask with boundary treatment. An optional targeted hue correction applies only where there is strong evidence for an interior garment colour, avoiding unsupported changes to skin, seams or neutral fabric.

**Alternatives and constraints.** Erasing every edge artefact might look cleaner at extreme zoom but can damage real clothing boundaries or adjacent image content. The safer correction intentionally accepts some residual fringe.

**Evidence.** [Garment boundary matting](garment-boundary-matting.md), **src/services/clothingRecolor.ts**, **src/services/clothingEdgeMatte.ts**. The documented regression photos were kept out of Git; fixture-based tests do not validate every garment or pose.

## D06 — Make the interface feel like a styling product, not a laboratory dashboard

**Problem.** Interface iterations showed that functionality alone did not make the product inviting or easy to navigate. The owner wanted a more distinctive fashion-editorial identity without sacrificing clear results.

**Product choice.** Use understated typography, warm neutrals, one muted accent and colour/portrait imagery as the main visual content. Give Precision capture a clear primary path and keep technical diagnostics out of the consumer result.

**Implemented response.** The consumer visual system uses restrained section hierarchy, swatches, comparison pairs, a stronger editorial reveal, consistent controls and responsive behavior. Accessibility features include labelled swatches, visible focus and reduced-motion support.

**Trade-off.** Decorative sophistication can compete with legibility or make uncertain results seem more authoritative. Editorial elements are therefore concentrated in a few moments; technical caveats and comparison choices remain readable.

**Evidence.** [Consumer visual system](consumer-design.md), **src/components/ResultsPage.tsx**, **src/index.css**. This is a qualitative design decision, not a claim of user-tested conversion gains.

## D07 — Keep portraits local and communicate the boundary accurately

**Problem.** A personal photo is more sensitive than a typical preference input. Privacy is part of whether people can comfortably try the experience.

**Product choice.** Keep capture, vision inference, profile construction and garment recolouring on-device; avoid an application photo backend and avoid creating persistent accounts or photo histories.

**Implemented response.** The project is a static React/TypeScript app. Models and WASM load as public same-origin assets, while photos/profile data remain in browser application memory for the session. The consumer privacy page explains this model.

**Trade-off.** Browser inference depends on device capability, model download and memory limits. The hosting provider still sees normal website requests. Releasing object references does not guarantee secure erasure.

**Evidence and open audit limit.** [Privacy architecture](privacy-architecture.md), [Public launch verification](final-launch-2026-10-22.md), [Security](security.md). The release report expressly notes that a full anonymous post-analysis network/storage trace was not completed; this document does not claim otherwise.

## What changed from exploratory project to live product

The project evolved from proving that an AI-assisted personal-colour experience could work into addressing the reliability of the input, the honesty of the result, and the usefulness of what came after it. The owner directed feature priorities, reviewed real outputs under varied conditions, incorporated informal tester feedback, and requested iteration until the experience was suitable for a public launch.

The public website launched in October 2026. Its engineering release record reports automated checks and browser/device acceptance with named limitations. Those checks establish a functioning implementation, **not** a controlled evaluation of colour-analysis validity, end-user outcomes or market adoption.

For the division of work between the owner and AI coding tools, see [AI-assisted development](AI_DEVELOPMENT.md). For exact current behavior and architecture, see [Product specification](SPEC.md).

## Future evidence worth collecting

- Consented, diverse lighting and device sessions with a documented repeatability protocol.
- User-observed usefulness of comparisons and try-on, separated from season-label agreement.
- Clear before/after records of changes and reproducible testing criteria.
- Coverage of the remaining release privacy/network verification cases.

These are recommendations, **not claims that the tests or outcomes have already been achieved**.
