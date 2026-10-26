# Deployment and release

This document describes the current configuration and update procedure. The
[public launch record](final-launch-2026-10-22.md) distinguishes verified checks,
owner-reported device acceptance and remaining coverage. The earlier
[readiness report](launch-readiness.md) is historical.

## Public release — verified October 26, 2026

| Item | Recorded state |
| --- | --- |
| Source repository | Private [`owekel/paletteai`](https://github.com/owekel/paletteai) |
| Hosting project | Existing Vercel project `paletteai`; local checkout linked |
| Project ID | `prj_pC1sAOSErJjzSV2W7WY515BmDZNx` |
| Team ID | `team_TVv8mejjkym3InSYKZAray6v` |
| Deployment protection | Vercel Authentication **Standard Protection**: public production domain; authenticated previews/generated deployment URLs |
| Review branch | `codex/production-readiness`, PR #1 merged; latest application checkpoint `035a111` |
| Protected preview | [paletteai-1ly275sux-owekel.vercel.app](https://paletteai-1ly275sux-owekel.vercel.app) |
| Git connection | `owekel/paletteai` connected; GitHub App limited to this repository |
| Production branch | `main`; initial public merge `c7a55283a1272ae1bcfe33fd8b9869ce17395199` |
| Production domain | [paletteai-sepia.vercel.app](https://paletteai-sepia.vercel.app), public; no purchased custom domain |
| Release acceptance | Owner approved public launch and reported successful Mac/iPhone testing; see explicit verification limits in the launch record |

Confirm provider state before each release. The initial public deployment was
`dpl_E5HELe9GzAcQ7dy6vL7pK8dwMjpK`, Git source, Production, READY, from `c7a55283`.
Its generated URL remains authenticated. The protection API setting is
`prod_deployment_urls_and_all_previews`; zero automation bypass entries remained
at the final check. Do not disable deployment protection globally.

GitHub Actions independently verifies pushes. Vercel's Git integration creates
protected previews for non-main branches and production deployments for main.
Its build command also runs the full checks. GitHub CI is not configured as a
separate deployment gate: inspect both CI and Vercel status before accepting a
release. [Release review #1](https://github.com/owekel/paletteai/pull/1) is merged.
Use a feature branch and pull request for future application changes; test the
preview, then merge only the intended reviewed commit to main.

## Build configuration

The project is a static Vite application. There are no server functions,
database migrations, application API keys, or runtime environment variables.

| Setting | Value |
| --- | --- |
| Repository root | Repository root directory |
| Framework | Vite |
| Node.js | `24.x` |
| Install command | `npm ci` |
| Build command | `npm run check` |
| Output directory | `dist` |
| Application environment variables | None |

`vercel.json` records the framework, install/build commands and output directory.
`.nvmrc` and `package.json` record Node.js 24. Confirm that the hosting project
uses the same values and has no stale dashboard overrides.

Run locally from a reviewed checkout:

```sh
npm ci
npm run check
npm run preview
```

`check` runs TypeScript validation, the complete automated test suite, and the
production build. `preview` serves `dist/` locally and applies the common
security headers from `vercel.json`; it does not verify Vercel's live routing,
cache headers, access protection, or TLS.

## Fonts and model assets

Fonts are bundled from the locked Fontsource packages. MediaPipe is pinned to
`1.0.1`. Before development and production builds,
`scripts/prepare-assets.mjs`:

1. Checks that the installed MediaPipe version matches
   `scripts/vision-assets.json`.
2. Copies the package's SIMD and non-SIMD JavaScript/WASM runtimes into
   `public/vision/wasm/`.
3. Reuses an existing model only when its SHA-256 hash matches the manifest;
   otherwise downloads the pinned public model and checks its hash before
   writing it into `public/vision/models/`.

Builds need access to the package registry and, when verified model files are
not already present, the public model download host. A checksum mismatch stops
the build. Review the upstream change before changing the manifest; do not
bypass the check to make a release pass.

`public/vision/` is generated and ignored by Git. Vite includes those assets in
`dist/`; visitors then load them from the deployed website's origin. The app
does not depend on a visitor contacting Google Fonts, jsDelivr or Google
Storage at runtime.

## Routing, headers and caching

`App.tsx` uses in-memory screen state, with no client router. The exact
`/privacy` path renders the privacy page. The only configured rewrite maps
`/privacy` to `/index.html`; no additional application routes are defined.

`vercel.json` includes a restrictive Content Security Policy, `no-referrer`,
MIME-sniffing protection and frame denial. Camera access is limited to the
same origin; microphone, geolocation and payment permissions are disabled.
Inline styles are allowed for React styling, and WASM compilation is allowed
for MediaPipe.

Hashed `/assets/` files receive long-lived immutable caching. `/vision/` files
use revalidation because their URLs are stable. These policies apply to public
application assets, not personal photos. Verify the actual deployed response
headers rather than treating configuration files as proof of enforcement.

## CI and release process

`.github/workflows/verify.yml` runs on pushes, pull requests and manual dispatch.
It installs locked dependencies, runs `npm run check`, and checks production
dependency advisories. The full build-tool audit is reported separately with
its reviewed exception documented in [security.md](security.md). This workflow
contains no deployment command and requires no deployment secrets.

Continue release work in this order:

1. Confirm the intended repository, Vercel team, project and reviewed commit.
   Keep the GitHub repository private and scope any GitHub App access to it.
2. Verify the repository connection and deployment-protection settings before
   creating a preview. A private repository or unlisted URL does not make a
   website private. Connecting Git or pushing a configured production branch
   can trigger a release; inspect the settings before doing either.
3. Create the authorized preview and record its actual URL, environment,
   commit and build result. Keep it protected while review is pending.
4. Run the hosted and device checks below. Record failures and limitations
   against that exact candidate.
5. Merge approved updates to main for the existing automatic production flow.
   Recheck the actual production commit, READY status, public site, protected
   preview and affected runtime journeys. A successful build alone is not QA.

The owner authorized this public launch. This document does not grant authority
for unrelated publications, custom-domain purchases or paid-plan changes.
Deployment commands and workflow behavior should be checked against the
[current Vercel deployment documentation](https://vercel.com/docs/deployments)
when executing a release.

## Device acceptance checklist

Automated checks and viewport resizing do not replace physical-device testing.
Mac/iPhone acceptance is owner-reported; Android and the complete anonymous
network/storage trace remain unverified. Use this checklist for future changes
and record exactly which cases/device versions were exercised:

- Open the actual HTTPS preview and refresh `/privacy` directly. Confirm
  fonts, scripts, both model files and WASM load under the deployed CSP.
- Grant, deny and revoke camera permission; exercise a missing/busy camera,
  manual capture, retake, front/rear switching where supported, backgrounding
  and returning, and leaving the capture screen. Confirm the camera indicator
  stops and captured photos have the expected orientation.
- Complete Quick Analysis and a three-photo Precision session. Exercise
  automatic selection, its manual override, the two-photo fallback and
  recovery from invalid capture conditions.
- Select supported JPG/PNG/WebP portraits, an HEIC file, an oversized image
  and a damaged file. Check recovery, cancellation and a replacement photo.
- Test a cold model load, a blocked/failed model request, a timeout and retry.
  Confirm failures are explained without presenting an unsupported result.
- Inspect Results and Try-On with actual clothing. Compare white-to-black and
  black-to-white, smooth edges, folds, texture, before/after controls and
  portrait orientation, particularly on Safari.
- Inspect network requests and browser storage during the full journey.
  Confirm photo bytes, measurements and results are not transmitted or
  persisted by the app. Distinguish hosting protection traffic from app
  behavior.
- Start another analysis and repeat a session on a phone. Confirm prior
  photos/results do not carry over, the app remains responsive, and no
  unexplained console errors or continuing camera activity occur.

Use consented local test photos. Keep portraits and browser traces containing
photo data out of Git and shared CI artifacts; `tests/local/` is ignored.
Record untested cases explicitly. The configured compilation targets are not
a claim that this device matrix has passed.

## Costs and operations

Inference runs on the visitor's device, so this implementation makes no paid
AI inference API calls and has no application database or server-compute
workload. Hosting is still subject to provider plan terms, asset delivery and
build usage. Model/WASM downloads can make uncached visits materially larger
than a text-only site. Private-repository CI, optional protection features and
any future custom domain can also affect costs.

The active team was verified as Hobby at launch; no upgrade or purchase was
made. This is not a price estimate or a promise of unlimited/free hosting.
Periodically verify the account's plan, intended-use eligibility, included usage,
overage behavior, access-protection features and spending controls against
[Vercel pricing](https://vercel.com/pricing) and
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Those terms can change; no fixed prices or quotas are relied on here.

Record each accepted release's commit and deployment identity. If a regression
requires rollback, select a previously verified deployment in the intended
project, then repeat the affected hosted checks. The first verified public
checkpoint is `dpl_E5HELe9GzAcQ7dy6vL7pK8dwMjpK` at `c7a55283`; confirm it is
still retained before using it. Rollback can disable automatic domain assignment
until a subsequent promotion restores it. Do not silently select an older
bootstrap deployment that lacks the accepted camera/footer fixes.
