# Conservative garment boundary treatment

## Restored baseline

The continuous feather, square local foreground/background matte and
compositing from `17c89de` are restored. The original tonal percentiles,
interior dye transformation, segmentation, mask lookup, consumer UI,
seasonal analysis and palettes are untouched. PNG output is retained.

Removed from execution: the later 3px / 13px coverage reconstruction,
outside-category connectivity/propagation, clipped-edge recovery, per-pixel
blend-space selection and the final appearance polish. No replacement alpha
fit, mask expansion, morphology or final-image blur has been added.

## Bright halo failure

The larger reconstruction disabled the earlier local matte. When its new fit
failed, a semantic garment pixel could keep nearly opaque feathered alpha but
have no foreground or background estimate. The compositor then interpreted
its mixed RGB as garment tone. A traced red-photo neckline pixel at (689,817)
had rejected-fit status, alpha 254/255 and no matte; source [241,181,170]
became pale cyan [237,246,249]. Background/skin brightness was being treated
as a fabric highlight on that fallback path. The reconstruction also made
coverage discontinuous through independent fits/rejections.

The latest screenshot's original shirt is WHITE, not red. Its bright edge
can also contain unrecoloured original-white pixels; not every white edge
pixel proves the luminance bug. The same restored feather/local matte is
used for it, without forcing neutral ambiguous pixels into a new contour.

## Small remaining correction

`sampleGarmentEdgeTone` is read-only. Eligibility requires:

- semantic garment side, within 3 photo pixels of its boundary;
- existing nonzero alpha and a valid ORIGINAL local background estimate;
- at least three nearby raw-garment samples with alpha and blur >=250/255;
- median reference RGB spread >=32 and HSL saturation >=25%;
- source hue within 8 degrees of that reference and saturation >=65% of it;
- reference hues agreeing within 12 degrees;
- enough hue separation from chromatic background (at least 14 degrees).

Reference lightness must be between 8 and 90. A source more than 15 HSL
lightness points below the reference is left alone to protect dark seams.
Achromatic white/black, missing evidence and ambiguous skin-coloured fabric
do not trigger source-hue suppression. Some residual source fringe is allowed.

Selected pixels use the componentwise median INTERIOR RGB as the input to
the unchanged fabric tone curve. They do not inherit mixed-pixel luminance.
Their original local background and soft alpha are recomposited unchanged.
Neighbour searches stop when leaving the garment side. Nothing propagates
outwards, and the correction cannot change geometry or background pixels.

## Verification

The development preview compares the restored baseline with the minimal
correction using the same source/mask. Its signed-distance maps are DEBUG ONLY.
`alphaChanged` must be zero. Normal-size viewing takes priority over 3× crops.

Node tests exercise the production compositor with an in-memory canvas sink,
plus immutable alpha/source/background, source-hue gating, skin/achromatic
rejection, dark seams, missing/inconsistent evidence, interior preservation,
continuous fractional coverage and mixed-brightness rejection. They do not
claim segmentation accuracy. Private regression photos are not committed.

Final rollback review (2026-09-30):

- Original red portrait → deep teal, taupe and pale cyan: normal-size and
  3× collar/shoulder review. 1,767 pixels have strong interior-tone evidence;
  zero alpha changes, zero interior differences, zero changes to zero-alpha pixels.
- Latest original WHITE portrait → deep teal and black: zero additional
  tone-reference pixels. The consumer deep-teal PNG matches the fresh
  regression renderer byte-for-byte. The broad bright/chopped edge is reduced.
- Controlled white→black and black→white fixtures reviewed in encoded and
  linear source blend modes. The neutral-source cases retain the baseline.
- `npm run lint`, all 26 tests, production build and diff whitespace checks pass.

This is deliberately not complete fringe removal. Thin residual source colour
can remain at 3×, particularly outside strong garment-side hue evidence.
Existing segmentation limitations (including other fabric in the scene) are
not corrected here. Preserving the restored silhouette takes priority.
