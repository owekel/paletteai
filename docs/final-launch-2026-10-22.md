# Public launch verification

Launched October 22, 2026 (Toronto; October 23 UTC). Report completed during
the October 26 follow-up. The owner explicitly approved public release and
reported successful real-device Mac and iPhone testing, including the camera
mirroring and privacy-footer fixes. No material launch blocker was identified.
The evidence and remaining coverage limits below must not be conflated.

## Release identity

| Item | Verified release |
| --- | --- |
| Public website | [paletteai-sepia.vercel.app](https://paletteai-sepia.vercel.app) |
| Repository | Private [owekel/paletteai](https://github.com/owekel/paletteai) |
| Review | [PR #1](https://github.com/owekel/paletteai/pull/1), merged into main |
| Latest application changes | 035a111a8c2e83569997e52d3190dfbc394e795a |
| Initial public production commit | c7a55283a1272ae1bcfe33fd8b9869ce17395199 (merge; identical application tree) |
| Initial public deployment | dpl_E5HELe9GzAcQ7dy6vL7pK8dwMjpK, Production, Git source, READY; build approximately 26 seconds |
| Generated deployment URL | paletteai-deplkia3a-owekel.vercel.app (authenticated) |
| Tested preview | paletteai-1ly275sux-owekel.vercel.app, READY, application commit 035a111 (authenticated) |
| Vercel project / team | paletteai / owekel; existing project, no duplicate infrastructure |
| Protection | Vercel Authentication, **Standard Protection**; zero automation bypass entries |
| Git delivery | main is production; other branches create protected previews |

The October 26 follow-up reconfirmed this deployment, private repository,
successful main CI, public root/privacy responses and protected deployment URLs.
This record identifies the original tested application release. A later
documentation-only commit can redeploy the same application; consult GitHub
and Vercel for the current SHA rather than treating it as an application change.

## Scope

The readiness work preserved analysis formulas, Precision aggregation,
classifier calibration, recommendations, palettes and garment rendering. It
added pinned same-origin model/WASM/font assets, bounded upload validation,
model-load failure/retry handling, cancellation/resource cleanup, camera error
handling, a recovery boundary, lazy loading, privacy copy, security headers,
CI and production-artifact verification.

The latest application commit fixes privacy-footer spacing and live selfie
preview mirroring. Mirroring uses track direction or a recognized front-webcam
label when direction is absent; rear labels veto that fallback. It changes
CSS preview presentation, not captured pixels. Unknown cameras stay unmirrored.
The final launch/report pass made no application code changes.

## Automated and hosted verification

- Fresh October 26 `npm run check`: TypeScript, **135 passing checks across
  11 suites**, production build (96 modules) and artifact verification.
  `npm run lint` passes; it is TypeScript validation, not a separate ESLint suite.
- [GitHub CI for the production merge](https://github.com/owekel/paletteai/actions/runs/39894470757)
  passed. Vercel independently ran the full check and deployed that exact commit.
- Anonymous HTTPS: public root and direct /privacy return 200. The preview
  and generated production URL redirect to Vercel sign-in. Chrome Incognito
  also reached the public app and was redirected to Vercel login for the preview.
- Both public models returned 200 and matched their pinned SHA-256 hashes.
  SIMD/non-SIMD WASM returned 200 with application/wasm; local fonts loaded.
  Missing-model and /.env.local probes returned 404.
- Live CSP, same-origin camera policy, disabled microphone/location/payment,
  no-referrer, nosniff and frame denial were verified on public responses.
- Actual public-origin Chromium journey: upload the public-domain NASA Eileen
  Collins portrait distributed by scikit-image; run real face/segmentation
  models; reach a constrained colour profile, recommendations and palette;
  recolour the garment with Ice Blue and a custom dark teal; switch Original /
  Try-on; start over; open and directly refresh privacy. No synthetic profile
  was substituted. The local test photo is ignored, not committed.
- Desktop 1280px and mobile 390px upload/results/try-on were inspected. Privacy
  was checked at 320px, 768px and desktop widths. No document overflow was found.
  These are browser viewport tests, not physical phones.
- Precision and Quick camera entry/guidance were inspected on the public site,
  including the permission-waiting state. The agent did **not** complete a fresh
  physical-camera three-photo session after launch. Earlier deterministic
  capture tests and the owner's real-device acceptance are separate evidence.
- No application exception or CSP failure was observed in the hosted journey.
  MediaPipe emits CPU delegate/feedback/OpenGL diagnostic warnings, including
  an INFO message on stderr; these did not prevent inference.

## Privacy and security evidence

Source and built-output review found no application photo-upload endpoint,
remote inference, analytics SDK, photo/result storage API or secret in the
frontend. Photos, landmarks, measurements, profiles and try-on pixels are
processed locally in memory. Start-over clears session references; camera and
model cleanup paths are covered by tests. Garbage collection is not secure
erasure, and public application/model resources may be browser-cached.

Common credential patterns were absent from the 21 reachable commits examined
at release review. No user portraits or private keys were tracked. Production
artifact checks excluded developer fixtures, diagnostic markers, source maps,
old external CDN/font URLs and credential variables. This is a bounded scan,
not a guarantee against every possible secret or future dependency behavior.

Runtime evidence was collected at two different scopes:

1. **Incognito entry/capture/upload-screen baseline:** localStorage and
   sessionStorage each had zero entries, no JavaScript-readable cookie,
   no IndexedDB database and no Cache Storage entry. All ten resource-timing
   entries inspected were same-origin application/font assets.
2. **Hosted functional session:** Vercel request-log inspection returned 52
   records, all GET/HEAD, for app assets, models, WASM, privacy and deliberate
   missing-file probes. No POST/upload/result endpoint or 5xx response appeared.
   The static app produced no function runtime-log entries.

**Limit:** a full browser network/storage trace through upload, analysis,
try-on and restart in one fresh anonymous session was not completed. Native
Chrome automation encountered hidden-window animation suspension and a
disabled file-picker Open control. The successful functional journey ran in
the in-app Chromium browser; its provider login state means it is not proof
of an entirely anonymous session. Anonymous access itself was independently
verified. CDN logs do not expose all possible outbound browser traffic, and
the baseline storage check is not a post-analysis storage check. No packet
capture of physical-camera use is claimed. Keep this as remaining audit
coverage, not an observed data leak or a fabricated pass.

The enforced same-origin CSP and source data-flow review support the intended
local-processing boundary. Vercel still receives ordinary connection metadata
when serving files. No analytics or error-reporting service was added; client
errors are not centrally monitored. Photo-bearing traces stay outside Git.

### Dependency audit history

At launch, `npm audit --omit=dev` reported **zero vulnerabilities**. The full
audit then reported **five high-severity development dependency nodes** rooted in
the documented braces/Tailwind 3 glob-parser denial-of-service advisory.
These build-only parsers process fixed repository configuration, not visitor
input, and are not shipped as the app runtime. The full audit was not clean
at that time. The bounded exception is preserved in [security.md](security.md).

On October 26, fresh production-only **and full** npm audits both exited 0 and
reported **zero vulnerabilities**, without changing the lockfile or dependencies.
This records the current registry response, not a claim that a code fix was
applied or that all future vulnerabilities are ruled out. Continue checking
advisories; do not expose the dev server or accept untrusted build-time globs.

## Acceptance limits and operations

- Mac and iPhone functional acceptance, including mirroring/footer fixes, is
  **owner-reported**, not an independent agent device test. Exact versions and
  every permission/lifecycle permutation were not recorded. Android remains
  unverified; repeated-session mobile memory pressure needs ongoing observation.
- The seasonal model remains provisional, not scientifically validated.
  HEIC/HEIF is intentionally unsupported; conversion guidance is provided.
- Hosting uses the existing active **Hobby** team (verified at launch), with no
  upgrade, purchase, paid AI API, application database or added recurring service.
  Hosting/build quotas and plan terms still apply; this is not unlimited hosting
  or a promise of zero future cost. Check usage as traffic grows.
- Non-main branch pushes generate protected previews. Review/test there, then
  merge to main for automatic production deployment. Vercel's build runs the
  full check; GitHub CI runs independently, not as a configured deployment gate.
- Keep Standard Protection: `prod_deployment_urls_and_all_previews`. Never
  disable protection globally merely to make a preview test easier.
- Initial public deployment dpl_E5HELe9GzAcQ7dy6vL7pK8dwMjpK is the known tested
  production checkpoint for subsequent changes, while retained by Vercel.
  Recheck availability before rollback, then repeat affected hosted checks.
  Vercel rollback can suspend automatic domain assignment until promotion.

The release is public under the owner's authorization with the above explicit
coverage limits. No analysis, capture, try-on or design change was made to
work around the browser-audit environment.
