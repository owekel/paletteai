# Launch candidate status

2026-10-21 — protected review candidate. Public launch is **not approved**.

## Candidate and access

- Private source: [owekel/paletteai](https://github.com/owekel/paletteai).
- Review branch: `codex/production-readiness`; application commit `512e57f`.
- [Protected Preview](https://paletteai-fi909aul4-owekel.vercel.app):
  `dpl_CrDQVj2pwkzUD1x2TqgxwqbSRYU4`, **READY**, Vite, 131 checks passed in the hosted build.
- Vercel project `paletteai` is connected to GitHub; the GitHub App installation
  is limited to this repository. Automatic delivery is confirmed: Vercel created
  [this Git preview](https://paletteai-587ifeoir-owekel.vercel.app) from `512e57f`
  with `source: git`, Preview and READY. Initial event delivery took several
  minutes. The main review URL above is the separately tested CLI build of the
  same application commit. [Draft review #1](https://github.com/owekel/paletteai/pull/1)
  remains unmerged; later documentation-only pushes do not change the app.
- Vercel Authentication remains enabled for **all** deployments. The temporary
  test credential created by `vercel curl` was revoked; zero automation bypass
  entries remained. No shareable bypass link was created.
- The initial CLI deployment was unexpectedly labelled Production despite a
  preview request. Its bootstrap aliases stayed sign-in protected. Later
  deployments explicitly use `--environment preview`. No public launch,
  custom domain, merge to `main`, or paid-plan upgrade was performed.

## Confirmed checks

- Existing source/history preserved; private `owekel/paletteai` repository created.
- Vercel project `paletteai` linked, with Authentication set to **all deployments**.
- Node 24 production build, TypeScript check and the existing `lint` command pass.
  `lint` is TypeScript validation; no separate ESLint configuration exists.
- 131 automated assertions pass across capture, finalist fallback, camera cleanup,
  model lifecycle, upload validation, Precision aggregation/lighting/sensitivity,
  results, palettes and conservative garment-edge behavior.
- Bundled models match the pinned hashes, both WASM runtimes exist, bundled fonts
  and license notices exist, and production output excludes developer fixtures,
  old CDN URLs and the Vercel credential variable.
- Chromium 155 local runtime probe successfully initialized face and segmentation
  models from the same origin, then released them. Native canvas blur worked.
  MediaPipe emitted its usual CPU-delegate/feedback warnings, not failed inference.
- [GitHub CI at `512e57f`](https://github.com/owekel/paletteai/actions/runs/39621190735)
  independently passed installation, checks, build and production audit.
- Hosted HTTP at `3401970`: authenticated app/privacy/WASM responses 200; both
  model hashes matched; missing model and `.env.local` returned 404. CSP,
  permissions policy, no-referrer, nosniff, frame denial and WASM MIME were present.
  Anonymous preview and bootstrap-alias requests redirected to Vercel sign-in.
- Hosted Chromium 155 upload → analysis → constrained results → actual try-on
  completed with the public-domain NASA Eileen Collins portrait distributed by
  scikit-image. The fixture is ignored locally, not committed or used as ground truth.
- Hosted palette/custom-hex selection, Original/Try-on toggle, restart and privacy
  navigation/direct refresh worked. No application exception or CSP error was
  observed; MediaPipe emits CPU/feedback warnings and an INFO message on stderr.
- Final application commit `512e57f` was rechecked on the hosted CLI preview:
  anonymous access redirected to sign-in; the mobile entry/upload screens,
  real model analysis, constrained result and actual try-on completed again.
- Viewport widths 320, 390, 768 and 1440 were verified in the actual browser;
  inspected result/try-on views had no horizontal overflow. This was emulation,
  not physical-device testing.
- Local deterministic Precision UI: three automatic captures reached review and
  a specific result; mixed lighting returned to capture with lighting guidance.
  These fixtures simulate camera/measurements and do not prove live capture.
- Local production analysis of the supplied full-interface screenshot showed
  technical retake guidance and no season/try-on. That is not a raw portrait test.

## Changes

Pinned, self-hosted model/WASM/font assets; bounded/retryable model initialization;
upload type/size/dimension validation; cancellation and memory/camera cleanup;
front/rear camera controls only when actual facing mode supports them; application recovery boundary;
lazy screen loading; privacy explanation; restrictive security headers;
repeatable GitHub checks and production-artifact verification.

Measurement formulas, season prototypes, palettes, recommendations, capture ranking,
Precision quality thresholds and garment rendering math have not been retuned.
Network/model failure now remains an infrastructure error rather than silently
falling back to approximate sampling and presenting that as a valid analysis.

## Privacy findings

Audited source uses local browser memory/canvas for photos, measurements,
results and recolouring. There is no application photo-upload endpoint, database,
analytics SDK or persistent photo storage. Runtime models/fonts are same-origin;
the deployed CSP restricts connections to that origin. Hosting authentication and
ordinary asset traffic are separate from photo processing.

A complete network/storage trace across a real hosted camera session has not
been captured. Source inspection and model HTTP checks do not replace that
remaining privacy check. Cleanup drops references; garbage collection is not
secure erasure.

## Remaining acceptance work — before public launch

- Complete real-camera three-photo Precision and Quick sessions on desktop, iPhone
  Safari and Android Chrome. Test permission denial/recovery, switching, backgrounding,
  manual/automatic capture, retake, restart and portrait orientation.
- Inspect real garment try-on on Safari and under repeated mobile sessions. A passing
  Chromium canvas probe is not Safari compatibility or a memory-pressure benchmark.
- Check slow/blocked hosted model requests and a full network/storage trace during
  actual camera use. Camera entry/cancel was inspected, but no live three-photo
  camera session was completed in the available testing environment.
- Recheck dependency advisories before launch. Production dependency audit is clean;
  the full tooling audit retains five affected nodes from an unpatched build-only
  braces advisory. See [security.md](security.md).

No user portraits, browser traces containing images, credentials or generated model
assets are committed. See [privacy architecture](privacy-architecture.md) for data
lifetime and [deployment instructions](deployment.md) for the release checklist.

The current Vercel account uses Hobby; no paid service was added. Browser inference
uses no paid AI API calls, but hosting bandwidth/build limits and intended-use
eligibility still apply. Free/unlimited hosting is not promised. See the cost
and operations section in deployment instructions.

Do not declare production readiness until the remaining journey checks are recorded.
Public availability requires the owner's separate approval, even after a green build.
