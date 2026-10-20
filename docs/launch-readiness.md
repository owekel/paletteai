# Launch candidate status

Work in progress — 2026-10-20. Public launch is **not approved**.

## Confirmed locally

- Existing source/history preserved; private `owekel/paletteai` repository created.
- Vercel project `paletteai` linked, with Authentication set to **all deployments**.
- Node 24 production build, TypeScript check and the existing `lint` command pass.
  `lint` is TypeScript validation; no separate ESLint configuration exists.
- 130 automated assertions pass across capture, finalist fallback, camera cleanup,
  model lifecycle, upload validation, Precision aggregation/lighting/sensitivity,
  results, palettes and conservative garment-edge behavior.
- Bundled models match the pinned hashes, both WASM runtimes exist, bundled fonts
  and license notices exist, and production output excludes developer fixtures,
  old CDN URLs and the Vercel credential variable.
- Chromium 155 local runtime probe successfully initialized face and segmentation
  models from the same origin, then released them. Native canvas blur worked.
  MediaPipe emitted its usual CPU-delegate/feedback warnings, not failed inference.
- Production homepage, entry navigation and upload rendered; the supplied screenshot
  was accepted as a local PNG. Full hosted journey verification remains pending.

## Changes

Pinned, self-hosted model/WASM/font assets; bounded/retryable model initialization;
upload type/size/dimension validation; cancellation and memory/camera cleanup;
front/rear camera controls when supported; application recovery boundary;
lazy screen loading; privacy explanation; restrictive security headers;
repeatable GitHub checks and production-artifact verification.

Measurement formulas, season prototypes, palettes, recommendations, capture ranking,
Precision quality thresholds and garment rendering math have not been retuned.
Network/model failure now remains an infrastructure error rather than silently
falling back to approximate sampling and presenting that as a valid analysis.

## Remaining acceptance work

- Record the protected preview's actual URL, commit, hosted build and anonymous
  access-denial response. No deployed preview is claimed in this checkpoint.
- Finish the Vercel ↔ GitHub login/repository connection for automatic branch previews.
- Verify actual hosted model downloads, CSP, privacy navigation and photo workflow.
- Complete real-camera three-photo Precision and Quick sessions on desktop, iPhone
  Safari and Android Chrome. Test permission denial/recovery, switching, backgrounding,
  manual/automatic capture, retake, restart and portrait orientation.
- Inspect real garment try-on on Safari and under repeated mobile sessions. A passing
  Chromium canvas probe is not Safari compatibility or a memory-pressure benchmark.
- Viewport emulation is not physical-device testing. Record which sizes actually
  took effect; do not infer responsive coverage from a requested viewport override.
- Recheck dependency advisories before launch. Production dependency audit is clean;
  the full tooling audit retains five affected nodes from an unpatched build-only
  braces advisory. See [security.md](security.md).

No user portraits, browser traces containing images, credentials or generated model
assets are committed. See [privacy architecture](privacy-architecture.md) for data
lifetime and [deployment instructions](deployment.md) for the release checklist.

Do not declare production readiness until the remaining journey checks are recorded.
Public availability requires the owner's separate approval, even after a green build.
