# Privacy architecture

This document describes the application code and configuration reviewed on
2026-10-20. It does not certify a deployed service: runtime network inspection
and physical-device acceptance remain pending. Vercel SSO protection is
configured for all deployments, but its enforcement still needs verification
on the first hosted preview.

## Processing boundary

PaletteAI is a static browser application. Camera capture, photo decoding,
face landmarks, segmentation, colour measurements, seasonal comparison,
palette selection and clothing recolouring execute on the visitor's device.
There is no application server endpoint, account system, database, analytics
SDK or remote inference API in this implementation.

The consumer privacy page is at `/privacy`. `App.tsx` checks that exact pathname;
other app screens use React state, not a client router. Vercel's `/privacy`
rewrite serves `index.html` so a direct visit can load the same app.

## Personal data during a session

| Data | Application use and lifetime |
| --- | --- |
| Selected file | Read locally with `FileReader`; temporary decode object URLs are revoked after success, failure, timeout or cancellation |
| Camera stream | Attached to the local video element while capture is active; tracks stop when capture finishes, is replaced, is left, or the page is hidden |
| Candidate camera JPEGs | Held in a bounded in-memory capture buffer for recent-frame selection; the buffer is cleared on selection/reset/teardown |
| Precision captures | Accepted photos and measurements remain in component state during the multi-photo session; a reference photo and the combined profile proceed to Results |
| Photo and colour profile | Retained in React state for Results and Try-On until the session is restarted or the document is discarded |
| Try-on pixels and masks | Held in memory for local canvas rendering; component cleanup drops the session references and pending application timer |
| Recoloured preview | Generated locally as a PNG data URL for display |

The app does not write these photos, measurements or profiles to cookies,
`localStorage`, `sessionStorage` or IndexedDB. A data URL is an in-memory
representation here; it is not an upload.

Starting over clears the application's current photo/profile state and
requests release of the cached still-image models. Reloading discards the
application session. Camera cleanup stops tracks, detaches its video, closes
the camera-owned model and clears its canvases. Models that arrive after their
session is stopped are closed rather than adopted.

JavaScript reference cleanup is not secure erasure. Browsers control garbage
collection, process memory, history and cache behavior. Existing synchronous
inference cannot be interrupted in the middle of a call; cancellation prevents
stale results from becoming the current UI state and releases resources when
the operation can finish.

## Network activity

There are two separate stages:

| Stage | Expected external activity |
| --- | --- |
| Installation/build | The build environment retrieves npm dependencies and pinned public model files; no visitor photo is involved |
| Browser runtime | The visitor downloads the application, bundled fonts, WASM runtimes and public models from the site's origin |

`scripts/vision-assets.json` pins the face-landmarker and selfie-multiclass
segmenter files with explicit URLs and SHA-256 hashes.
`scripts/prepare-assets.mjs` verifies those hashes and copies the SIMD and
non-SIMD runtimes from the locked `@mediapipe/tasks-vision` package, version
`1.0.1`. Runtime paths are `/vision/wasm/` and `/vision/models/`.

No photo, facial measurement, result or user colour selection is included in
those asset requests. The model files are generic public resources, not a
personal model trained from the visitor's images. Font files are bundled
locally; the app does not request Google Fonts at runtime.

The configured host, Vercel, necessarily receives ordinary connection metadata
when serving the website, such as the visitor's IP address and requested asset
URLs. Hosting access controls, provider logging and retention are separate
from application photo processing and must be reviewed in the actual account.
The code does not establish a provider's log-retention period. A protected
preview may also involve provider authentication and cookies.

## Public caching and persistence

The browser or hosting CDN may retain public app files and models. Hashed
`/assets/` files use immutable caching; `/vision/` files are configured to
revalidate because their paths are stable. These caches contain application
resources, not a server-side photo history.

PaletteAI does not implement a service worker or an offline-installation
guarantee. Previously downloaded resources may help a later load, but a cold
session needs network access to retrieve the app and models. Model-load failure
and retry are handled separately from a photo's technical suitability.

## Enforced boundaries and limits

`vercel.json` restricts runtime connections to the same origin, disallows
embedding, and limits camera permission to the same origin. Microphone,
geolocation and payment access are disabled. Inline styles remain allowed for
the interface, and WASM compilation is permitted for MediaPipe. The local
production-preview configuration reuses the common security headers; deployed
headers still need to be inspected on the actual host.

Local file selection accepts still JPG, PNG and WebP images. It rejects empty
files, unsupported formats, mismatched declared formats, and images above
15 MiB compressed, 20 million pixels, or 8,192 pixels on either side. Dimensions
are checked before decoding and again after the browser decodes the file.
The accepted original bytes are retained without upload-time resizing or
re-encoding. These limits reduce accidental memory exhaustion; they do not
claim that every accepted image is inexpensive on every phone.

There are no required environment variables. `VITE_*` values are compiled into
public JavaScript and must never contain secrets. Provider credentials belong
in provider-managed authentication, not browser source or committed files.

Application errors are handled locally. The root recovery boundary does not
submit exceptions to a reporting service. If telemetry is introduced later,
it requires a fresh data-flow review: component state, data URLs, canvas
pixels, landmarks and colour profiles must not be serialized into reports.

## Verification and maintenance

Source inspection and automated tests support the intended boundaries but
cannot prove the behavior of a future deployment. Before release, inspect the
actual HTTPS candidate while completing capture, upload, analysis, Try-On,
restart and failure/retry journeys. Verify network request destinations and
payloads, browser storage, security headers, camera shutdown and resource
cleanup on the target devices.

Keep real portraits and traces that may contain photo data outside Git and
shared build artifacts. Use ignored `tests/local/` for consented local fixtures.
Do not add analytics, external scripts, storage or remote analysis without
updating this document and the consumer privacy page to match the new behavior.

See [deployment acceptance](deployment.md#pending-manual-acceptance) and
[security maintenance](security.md). Public launch still requires the owner's
approval; this document records architecture, not launch readiness.
