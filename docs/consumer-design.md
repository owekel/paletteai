# Consumer visual system

PaletteAI uses a warm neutral canvas, charcoal controls and a single dusty-rose
brand accent. Photography and recommended colours supply the visual variety;
the interface does not compete with them. This is original styling, not a
reproduction of a retailer's identity.

## Small shared system

- `src/styles/tokens.css`: semantic colours, spacing, type sizes, content widths,
  motion and radii. Tailwind aliases reference these same colour channels.
- `src/index.css`: shared page, header, button, input, disclosure, palette,
  profile and try-on primitives.
- `SiteHeader`: consistent wordmark and quiet back/new-analysis action.
- `ProcessingMark`: three understated moving swatches; reduced motion supported.
- `guidedCapture.css`: camera-specific layout and mobile shutter dock.

Inter is the main typeface. Existing Fraunces is used only for a small editorial
emphasis on the home page. Controls are at least 44px tall, primary actions 48px.
Colour swatches are rectangular, named, keyboard accessible and labelled for
copying or trying on. Focus remains visible. Content is bounded at 68rem, with
a narrower 46rem entry/review layout. Surfaces use dividers and space instead
of repeated floating cards. Camera/photo rounding is purposeful.

## Presentation boundaries

The existing analysis model continues to own season selection, uncertainty,
recommendations and palettes. The UI presents that model without changing its
thresholds or calculations. Constrained headings lead with an already supported
dimension, followed by all supported qualities; they do not invent a winner.
Starter sets retain their non-personalized discovery explanation. Retakes show
the actual capture guidance, with consumer-friendly headings.

Result order: supported profile → recommended colours → practical explanation
→ nearby palettes/comparisons → try-on → optional wardrobe/colour check.
Technical diagnostics stay in development-only, collapsed, distinctly bordered
sections. No percentage or prototype detail appears in the production view.

Try-on controls sit outside the photograph. Segmentation, boundary treatment,
recolouring, requests, debounce and before/after processing are unchanged. Capture
stability, best-frame selection, manual override, three-photo aggregation,
sensitivity and session-lighting decisions are also unchanged. Only presentation
and screen-change scroll restoration were adjusted.

## Verification

`npm test` includes consumer server-render checks for all 12 exact palettes,
constrained, broad, starter and technical-retake states alongside the existing
analysis, capture and recolour suites. Use `?preview=results` and
`?preview=capture&mode=precision` during development to exercise the real
components with labelled synthetic fixtures. These fixtures are not evidence
of colour-analysis accuracy or physical-camera performance.

Review both phone widths (320/390 CSS px), tablet (768px) and desktop. Diagnostic
tables scroll inside their own containers; they must not widen the page.
Physical iOS/Android camera permission prompts and safe-area behavior deserve
a final real-device review before release.

## Editorial evolution

The second pass preserves those foundations but introduces a recurring graphic
language: small burgundy squares, compact chapter labels, rectangular colour
strips and numbered colour fields. Type scale is deliberately concentrated in
the home headline, Precision introduction, result reveal and scan completion.
Other headings remain modest. Results use a larger original portrait alongside
a two-line season title; the horizontal band repeats the existing palette in
its existing order, without deriving recommendations or confidence from size.

Strong colours have an asymmetric lookbook grid. Everyday neutrals use a quiet
continuous neutral field; comparison pairs retain equal areas so composition
does not favour one option. Hex codes appear on hover, keyboard focus or copy
feedback, and remain in accessible button names. On phones the headline owns
its row rather than squeezing a season word alongside the portrait.

Precision's charcoal introductory spread gives the recommended flow clear
priority. Live progress uses numbered square-edged chips: a current burgundy
chip and saved checkmarks. Readiness changes only existing visual feedback;
no timing, capture acceptance or measurement logic is affected. Completion
uses a short typographic reveal, not confetti. Try-on gives more width to the
photo and treats its unchanged controls as clothing colourways.

Explanations, retake guidance, permission failures, custom inputs and developer
diagnostics intentionally remain restrained. Motion remains brief and is
disabled by the existing reduced-motion rules. No external visual dependencies,
stock imagery, gradients or glass effects were added.
