# Garment boundary matting

This change is limited to the clothing boundary. Detection, garment tonal
percentiles, interior fabric transformation, seasonal analysis, palettes and
the consumer try-on UI are unchanged.

## Cause of the red rim

The image-sized category mask is not a photographic alpha matte: the current
model infers on a 256×256 grid. In the red-shirt regression, actual garment
pixels were outside the categorical silhouette, including a dark neckline seam.
The previous repair searched only three photo pixels. Its outside references
could themselves be red fabric; its shading fits also rejected dark seams and
clipped/highlighted red mixed pixels. Rejected pixels fell back to zero/low
coverage, so the original colour survived. Accepted pixels used an additive
colour replacement that preserved the RGB fitting residual, including its hue.
The output is already lossless PNG; output JPEG compression was not the cause.

## Treatment

- Build a signed-distance trimap. The uncertainty search radius is two inference
  cells plus three photo pixels of antialias/chroma-interpolation uncertainty.
  On a 1280×960 photo this is 13 pixels. This is **not** an expanded opacity mask:
  most of the search band is excluded, and no pixels beyond it are newly edited.
- Sample local garment/exterior endpoints on opposite sides. Continue past
  inset-mask "background" references whose chromaticity still matches fabric.
  Require fabric-like saturation or a garment-hued outlier against a >60%
  non-garment-hued exterior majority; do not discard a consistently blue-grey
  backdrop merely because the shirt is blue.
- Fit photographic coverage in both encoded RGB and linear light. Allow
  constrained multiplicative/additive fabric shading, favour simpler fits,
  and recover the original garment component before measuring its tone.
- For clipped/chroma-interpolated saturated edges, use a guarded colour-prior
  fit with physically valid in-gamut foreground recovery. Do not carry an RGB
  residual into the final image.
- Outside-category recovery needs a connection to resolved garment. Low alpha
  can taper outward for at most two extra, monotonically decreasing steps.
- Isolated ambiguous seam pixels can use already-resolved opaque garment
  components within three photo pixels. They must still fit the local colour
  model; exterior matches and unrelated colours are not filled morphologically.
- Apply the existing fabric transform to the recovered garment tone, then
  compose `coverage × new garment + (1 − coverage) × unchanged exterior` in the
  fitted blend space. Pure non-garment pixels are copied byte-for-byte.

The old square-average matte now runs only in the developer comparison path,
not underneath the new production matte. No extra erosion, dilation or blur
has been added. Indistinguishable foreground/background colours, grossly wrong
segmentation and occluding objects remain inherently ambiguous; this bounded
repair does not try to solve those by tinting surrounding pixels.

## Developer inspection

Run `npm run dev` and open `/?preview=recolor` (development builds only).
Upload a local original portrait: original pixels are used directly by default.
Source-dye simulation is opt-in and explicitly labelled, not photographic
ground truth. A saved previous PNG can be supplied for the selected target.

The page shows original/baseline/refined output at 3× collar and shoulder zoom,
with adjustable photo-relative crop centres, plus:

- original categorical clothing mask;
- confident garment interior;
- uncertain trimap band;
- pixels selected for colour decontamination.

Metrics include rejected-reference/fit/connectivity counts, sample pixels,
preparation timings and confident-interior differences. For synthetic fixtures,
exterior comparisons use known coverage. For real photos the passthrough count
is only a compositing check, **not** a ground-truth segmentation accuracy claim.
The prepared photo matte is reused when only the target colour changes.

## Regression checks

`npm test` includes encoded/linear-light tests for red→taupe, red→cyan,
blue→coral, white→black and black→white, plus inset segmentation, dark seams,
clipped red boundary pixels, fractional antialiasing, unchanged skin shadows,
unrelated/indistinguishable colours, unchanged confident interior/exterior,
and residual-free compositing. The private regression portrait is not stored
in the repository.
