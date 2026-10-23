# Pre-launch audit

Audited 2026-10-19 against `e569bef`, the existing application in this repository.
This records the findings **before hardening**; see `launch-readiness.md` for
the eventual implementation and verification status.

## Architecture confirmed

- React 18, TypeScript, Vite 5, Tailwind 3. A single-page state machine;
  there are no server endpoints, accounts, database or client router.
- Camera → rolling JPEG buffer → lightweight quality checks → full-resolution
  finalists → three accepted captures → session lighting gate → robust
  aggregation/sensitivity → direct 12-season results → recommendations/try-on.
- Upload and Quick Analysis use the same single-photo analysis. Segmentation
  and face landmarks run through MediaPipe/WASM, followed by local TypeScript
  measurements. Rendering uses local canvases.
- Existing tests cover measurement presentation, edge compositing, capture
  scoring/fallback, aggregation, sensitivity, and session lighting. They are
  not physical-device or hosted journey verification.

## Fix before launch

| Finding | Risk / action |
| --- | --- |
| Unbounded, unvalidated uploads and unhandled FileReader rejection | Validate raster type, size/dimensions, decode/read errors and stale selections. Native-size image buffers can exhaust mobile memory. |
| Unbounded try-on model preparation | Bound initialization, distinguish model/network failure from an unusable portrait, and provide retry. |
| Mutable segmenter URL and mismatched package/runtime pinning policy | Freeze the existing model bytes and matching WASM package. Serve reviewed static resources from the application origin. |
| No application recovery boundary | Catch rendering failures without logging images; provide a fresh start. |
| No production headers/CI/deployment settings | Add restrictive resource/security policy, build checks, explicit Vercel configuration and deployment instructions. |
| Old build dependencies | npm audit found 10 affected dependency nodes (7 high, 3 moderate), all in development/build tooling. Upgrade compatible patched packages; document any advisory without a safe patch. |
| Incomplete secret ignore rules | Ignore every local `.env*`, Vercel metadata and local photo/test artifacts. Current tracked files/history scans contain no detected credential or portrait assets. |
| Safari canvas filter uncertainty | Verify the real browser path. Do not infer try-on parity from compilation or rewrite the compositor without a demonstrated defect. |
| No deployment connection | No Git remote, GitHub/Vercel CLI, or connected provider initially. Establish private source and protected preview before any launch. |

## Privacy trace

Camera JPEGs and upload data URLs live in component state/refs. Precision keeps
its accepted photos until it returns one reference photo and summaries. Try-on
keeps original pixel/mask buffers and generated PNGs in memory. Restart/unmount
drops application references; camera cleanup stops tracks, closes its model,
detaches video and clears canvases. Browser memory reclamation is not secure
erasure. Still-image models were cached for the page lifetime.

Source and production-bundle inspection found no photo upload, application API,
analytics, beacon, localStorage, sessionStorage or IndexedDB writes. Existing
third-party requests were Google Fonts, jsDelivr loader/WASM, and Google Storage
models. They expose normal network metadata. Actual network behavior must also
be inspected in the production candidate; this source audit alone cannot prove
deployed privacy behavior.

## Scope guard

Preserve measurement formulas, classifier/prototypes, palettes/recommendations,
best-frame ranking, Precision aggregation/lighting policy, and garment
compositing. Only fix demonstrated reliability, security, lifecycle or browser
integration defects. Deployment success alone is not launch acceptance.
