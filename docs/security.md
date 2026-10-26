# Security and privacy maintenance

## Application boundary

PaletteAI is a static browser application. It has no API credentials, database,
photo upload endpoint, analytics SDK or account system. `VITE_*` values become
public JavaScript; never use them for secrets. No environment variables are
needed. Vercel/GitHub credentials belong in provider-managed connections, never
in this repository or browser code.

Production CSP permits same-origin scripts/resources and WASM compilation.
Inline styles are permitted because swatches and image layouts use React style
attributes; inline scripts, external connections, frames, forms and objects are
not permitted. Camera permission is same-origin only; microphone, payment and
location are disabled. Avoid weakening the policy to add preview toolbars or
analytics. Test the actual host headers after deployment.

## Current audit (2026-10-26)

Fresh `npm audit --omit=dev --json` and `npm audit --json` both exit 0 and report
zero vulnerabilities. No dependency or lockfile changes were made in this
follow-up. Advisory-service results can change; this is the observed result,
not a claim that a new code fix was applied. The earlier build-only exception
is retained below as history, and CI continues to report the full tooling audit.

## Historical dependency review (2026-10-19)

The initial audit found 10 affected dependency nodes. Vite is upgraded from
unsupported 5.x to the supported 7.3 security/important-fix line; esbuild and CSS
tooling are patched. MediaPipe remains exactly 1.0.1 to preserve existing model
behavior. Its two model files are downloaded at build time with reviewed SHA-256
checksums; runtime requests are same-origin. CI fails on model checksum changes.

`npm audit --omit=dev` reports no vulnerabilities at this audit date. The full
audit at that time reported five affected nodes rooted in **braces <=3.0.3**
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). The
latest available braces release then was 3.0.3. Tailwind 3 uses it for build-time glob
patterns through chokidar/micromatch/fast-glob. No parser or development server
is served to visitors; the patterns here are fixed trusted source configuration.
Do not process untrusted glob patterns or expose the development server publicly.
Review the advisory at dependency updates and remove this exception when an
upstream compatible fix is released. A Tailwind 4 migration is a separate
design regression task, not silently applied by `npm audit fix --force`.

`postcss-selector-parser` 7.1.6 and `source-map-js` 1.2.2 are explicit overrides
for patched transitive tooling. The production build and visual review must
remain green when updating them. CI reports the full tooling audit separately;
its non-blocking status is not a claim that all dependencies are vulnerability-free.

## Operational safeguards

- Keep GitHub private; grant the Vercel GitHub App access only to this repository.
- Verify deployment protection on every preview. An unlisted URL is not private.
- The owner approved public launch. Keep Standard Protection enabled: public
  production domain, authenticated previews and generated deployment URLs.
- Never commit real test portraits, camera fixtures, browser auth state or traces
  containing photo data. Local fixtures go in ignored `tests/local/`.
- Avoid error-report payloads that serialize component state, canvas data,
  landmarks, colour measurements or data URLs. Current errors are handled locally.
- Restart drops photo/result references and releases still-image models.
  Browser memory reclamation is not secure erasure; public models may be cached.
- Re-run `npm run check`, runtime journey checks and dependency audits before
  deploying updates. See `deployment.md` and `final-launch-2026-10-22.md`.
