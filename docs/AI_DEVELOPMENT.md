# PaletteAI — AI-assisted development and review

**Document status:** Retrospective account (November 2026).  
**Purpose:** Explain who did what, how product requirements were translated into implementation, and what evidence was used to accept or reject changes.

## Contribution model

PaletteAI was developed with substantial assistance from AI coding tools, including Codex / ChatGPT Work. The project owner led **product direction, requirements, prioritization, hands-on testing, feedback, and acceptance of changes**. AI coding tools performed significant source-code generation, modification, refactoring, test authoring and technical investigation.

This project should **not** be represented as a wholly hand-coded React/TypeScript application by the owner. The source code is available for inspection, and the owner should be able to discuss its overall architecture and major decisions honestly.

Specific contribution shares, code-line authorship percentages and complete model-specific prompt histories have not been established. Git commits and authored documentation can show code changes, but do not, by themselves, prove who independently conceived each feature or manually wrote its source.

## The working loop

1. **Notice a product problem:** Compare the live experience with the desired user outcome, often by trying capture, analysis or try-on under imperfect real-world conditions.
2. **Define an observable requirement:** Specify what should change, what must not regress, how errors should behave and what a successful user journey looks like.
3. **Delegate implementation to AI coding tools:** Ask the assistant to inspect existing modules, propose or implement a bounded change, preserve agreed constraints and add targeted regression checks.
4. **Inspect the result:** Compare the new behavior with the actual product goal, not merely with whether the build passes.
5. **Revise, accept or roll back:** Provide follow-up feedback when the effect is inconsistent, difficult to use or visually wrong. Preserve known-good behavior rather than adding complexity indiscriminately.
6. **Prepare the release:** Review browser experience, privacy behavior, CI, model loading, deployment protections and remaining limitations before making the website publicly reachable.

This workflow is descriptive, not a claim that every change followed a perfect formal process or had the same level of review.

## Three representative development episodes

### Example A — Photographic reliability and guided capture

**Observed problem:** Changes in lighting and image acquisition could undermine repeated colour analyses.

**Human direction:** Improve how photographs are obtained and evaluated; do not simply insist users capture a perfect image; preserve a usable manual path and clear error explanations. Informal early-tester feedback also influenced the desire for automated photography.

**AI-assisted technical work:** Implement live suitability checks, stability timing, a bounded frame buffer, photographic finalist selection and regression tests. Later build a multi-photo Precision flow that robustly aggregates continuous measurements while preserving uncertainty.

**Review standard:** Prefer genuinely better input and clearer uncertainty over a more flattering season label. Avoid ranking candidate photos by predicted season, and do not silently treat low classifier certainty as a technical photo failure.

**Where to verify:** [Guided Capture](guided-capture.md), [Precision Analysis](precision-analysis.md), **src/services/capture/**, **src/services/precisionAggregation.ts**.

### Example B — Clothing recolour boundaries

**Observed problem:** Some recolouring attempts left visible original-colour fringes or risked changing parts of the photo outside the garment.

**Human direction:** Prioritize realistic, recognizable clothing, consistent texture and a protected silhouette; compare normal-size outputs rather than chasing perfection at extreme zoom.

**AI-assisted technical work:** Investigate segmentation and boundary handling, create controlled regression fixtures, and implement a narrowly gated treatment for strongly supported source garment hue.

**Review standard:** Reject changes that distort body/garment boundaries or alter unaffected image content. Accept limited residual fringe rather than damaging the image.

**Where to verify:** [Garment boundary matting](garment-boundary-matting.md), **src/services/clothingRecolor.ts**, **src/services/clothingEdgeMatte.ts**.

### Example C — Product experience and launch readiness

**Observed problem:** A technically functioning tool was not automatically a compelling or trustworthy consumer product. Late testing also identified practical preview and privacy-footer issues.

**Human direction:** Give the interface a more distinctive fashion-editorial design, emphasize practical recommendations, preserve an honest treatment of uncertainty, and fix device-specific usability problems before launch.

**AI-assisted technical work:** Refine visual components/styles, correct front-camera preview mirroring without changing captured pixels, fix privacy-footer spacing, add regression coverage and carry out production-readiness verification.

**Review standard:** Confirm the live journey remains usable and changes do not affect underlying analysis, privacy, or camera-data orientation inadvertently. The owner separately tested on Mac/iPhone and approved launch.

**Where to verify:** [Consumer design](consumer-design.md), [UI follow-up](ui-preview-followup.md), [Public launch verification](final-launch-2026-10-22.md).

## How the prompts were structured

The owner's actual directions varied by task. Many iterations were conversational rather than formal prompts. A useful pattern was:

- **Context:** What the current feature does and what real-world behavior is disappointing.
- **Desired outcome:** What the person using the product should experience instead.
- **Constraints:** Which algorithms, UI behaviors, privacy guarantees or edge cases must remain unchanged.
- **Acceptance criteria:** What specific evidence should demonstrate that the change works, and which tests should be run.
- **Follow-up:** What was actually observed, including failures, visual regressions and unexpected behavior.

### Illustrative prompt excerpts — not verbatim chat quotes

The following are **reconstructed examples** of the kind of direction used during development. They are deliberately *not* presented as copy-pasted original messages or as complete AI execution transcripts.

> The current results vary too much with photographic conditions. Improve capture quality and consistency before changing the season thresholds. Keep a manual path and explain when lighting is unsuitable.

> For a three-photo result, combine reliable continuous colour measurements first, then classify the combined profile. Do not have each photograph vote for a season, and do not hide disagreement between images.

> When correcting colour fringe around the garment, preserve the original mask geometry, fabric shading and background. A slight residual edge is better than visible damage to the silhouette.

> Fix the live selfie preview to look natural on built-in front cameras without mirroring the pixels that are actually analyzed or changing rear-camera behavior.

For exact prompt citations in the future, retain and verify original user-authored messages or exported task logs **before** presenting quoted text as archival evidence. Avoid uploading whole private conversations or confidential photos to a public repository.

## Validation approach

**What was checked at release:** The October 2026 launch record describes 135 passing automated checks across 11 suites; TypeScript validation and a production build; checks of model assets, security headers, upload/results/try-on in hosted Chromium; and owner-reported real-device acceptance.

**What this does not prove:** Automated fixtures do not establish scientific validity or quantified colour-season accuracy. The launch report notes remaining coverage gaps for a complete fresh anonymous network/storage trace and a fresh physical-camera three-photo trace after release. No adoption metric or statistically powered user study is claimed.

Refer to [Public launch verification](final-launch-2026-10-22.md), [Privacy architecture](privacy-architecture.md) and [Security](security.md) for the evidence and limitations.

## What a reviewer can evaluate

- **Product thinking:** [Design decisions](DESIGN_DECISIONS.md) explains why features exist and their trade-offs.
- **Requirements:** [Product specification](SPEC.md) describes the expected user journeys and nonfunctional constraints.
- **Implementation:** The repository source and existing technical notes show how the product currently works.
- **Verification:** Tests, CI and release notes show what was checked, what failed previously, and what remains uncertain.

This separation is intentional. The project's value is not simply “AI wrote an app”; it is the iterative process of identifying useful behavior, expressing constraints, evaluating outputs and owning the decision to release.

## Responsible disclosure

- Acknowledge AI-assisted coding directly in resume/interview descriptions.
- Do not claim independent implementation of libraries or algorithms that were primarily generated by tools.
- Understand enough of the final architecture to explain major modules, failure modes and engineering trade-offs.
- Use generic “early testers” references instead of identifying friends, roommates or partners or including their private messages/photos.
- Keep private repository credentials, service tokens, external prompt history and sensitive test data out of public-facing documentation.
