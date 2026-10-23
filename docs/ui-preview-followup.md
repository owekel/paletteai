# Privacy footer and selfie-preview follow-up — 2026-10-21

This is a protected review-branch update, not public-launch acceptance. The
existing draft [PR #1](https://github.com/owekel/paletteai/pull/1) records the
exact updated commit, protected deployment and hosted verification.

## Changes and boundaries

- `/privacy` now groups its two native footer links in a labelled navigation
  with wrapping flex layout, 24px column gap and 8px row gap. This survives the
  existing mobile footer's block layout. Links retain their destinations,
  keyboard order, visible focus outline and 44px minimum target height.
- Live video uses a separate `mirrorPreview` flag. Explicit track facing mode
  wins. If it is absent, recognizable front/FaceTime/MacBook/built-in camera
  labels enable selfie mirroring. Back/rear/environment labels veto fallback;
  unknown cameras stay unmirrored. Requested facing mode is only a preference
  and never proves that a rear camera is a front camera. No device labels are
  stored or transmitted, and no extra device enumeration was added.
- Facing-mode switching still requires actual supported track metadata.
  Removed the stylesheet's unconditional default mirror; the video element's
  preview flag is the single mirror decision. Review images remain unmirrored.
- Capture canvas drawing, measured pixels, landmarks, analysis inputs,
  Precision/Quick selection, quality thresholds, try-on and cleanup logic are
  unchanged. The guide is symmetric about x=0.5, uses the same centered 3:4
  crop as capture, and centering/pose gates are reflection-invariant. No dynamic
  landmark overlay or directional left/right movement instruction is drawn.

## Verification

- 135 automated checks pass (four additional checks covering camera direction
  and missing metadata, runtime fallback/teardown, reflected guidance, and
  native privacy-link markup). TypeScript, existing lint, production build and
  production-asset/privacy audit pass.
- Actual Chromium browser rendering at widths 320, 390, 768 and 1440: links
  wrap at 320, retain a 24px horizontal gap where space permits, have no
  horizontal overflow, remain reachable in order by keyboard, and show focus.
- Synthetic asymmetric red/blue camera stream in the production build:
  FaceTime with missing facingMode mirrors; explicit iPhone-style front
  metadata mirrors; explicit rear, rear Continuity-style labels without
  metadata and unknown USB labels do not mirror. Screenshot pixel checks
  confirm visible orientation, beyond checking a CSS declaration.
- Manual capture from the mirrored FaceTime simulation produces an unmirrored
  JPEG and review image. Pixel checks confirm original left/right orientation;
  all camera tracks are ended at review. The guide stays untransformed and
  centered. No browser page exception occurred.

These are automated Chromium simulations, including simulated iPhone metadata;
none is physical Mac webcam, Safari, or iPhone browser acceptance.

## Physical-device acceptance still required

On the updated protected preview, test Mac built-in webcam in Safari and Chrome:
raise a hand or hold readable text, confirm natural selfie movement and centered
face guidance, capture, and confirm the saved photo returns to camera orientation.
Complete automatic and manual Quick and three-photo Precision sessions, retake,
restart, background/resume and permission denial/recovery; confirm the camera
indicator stops after leaving/capture. Repeat on iPhone Safari and Chrome with
front/rear switching where offered, including portrait/orientation changes.
Confirm rear preview is unmirrored and try-on/Original controls still work.

The existing live-session network/storage privacy trace, repeated mobile
sessions, Android acceptance and other launch gates in launch-readiness.md
remain outstanding. No public launch, merge, protection change or paid service
is part of this update.
