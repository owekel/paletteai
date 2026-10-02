# Guided Capture v1

Guided Capture changes photo acquisition only. The existing full analysis, image-quality gate, classification, palettes, recommendations and recolouring formulas are unchanged. Captured photos stay in the browser; model assets are downloaded as before.

## Modules

- `src/data/captureConfig.ts`: versioned provisional capture thresholds, timing and ranking weights.
- `src/services/capture/liveMeasurements.ts`: reduced-resolution photographic measurements, reusing existing face-landmark skin polygons.
- `captureQuality.ts`: prioritized blocking instructions and interpretable frame scores.
- `captureStability.ts` / `captureBuffer.ts`: stability window and bounded best-frame selection.
- `cameraRuntime.ts`: camera ownership, matching preview/capture crops, disposable two-face landmark model, frame encoding and cleanup.
- `verifyCapturePhoto.ts`: calls the existing full analysis once, with cancellation/timeout protection against stale UI updates.
- `src/hooks/useGuidedCapture.ts`: session lifecycle and capture/review state.
- `src/components/CameraCapture.tsx` / `guidedCapture.css`: responsive consumer flow.

The still-photo landmark detector is not reconfigured. Only its existing landmark-to-region geometry was extracted for reuse. Uploads retain their existing analysis flow; camera review passes its already-computed profile to Results instead of analysing twice.

## Live checks and blockers

The live loop samples at most four times per second at 360 × 480; it never runs the seasonal analysis. Auto-capture requires exactly one detected face, acceptable framing/pose, three usable skin regions, non-extreme exposure, no severe lighting imbalance, and known low motion.

Provisional limits:

| Signal | Auto-capture blocker |
| --- | --- |
| Face dimensions | Width outside 28–76% or height outside 25–66% of the portrait frame |
| Position | More than 14% of frame width/height from guide centre (50%, 43%) |
| Pose | Roll over 14°, nose/eye yaw ratio over 0.24, or nose/eye vertical ratio outside 0.23–0.85 |
| Skin information | Forehead/cheek polygon outside the image, fewer than 55 sampled pixels in a region, or under 50% usable pixels |
| Exposure | Over 30% near-black pixels, over 18% near-white pixels, or median encoded luminance outside 24–244 |
| Uneven light | Left/right cheek linear-light luminance difference over 1.4 stops |
| Mixed light risk | Normalized RGB chromaticity separation over 0.15, only with coherent regional colour and strong usable-pixel evidence |
| Motion | Landmark displacement over 4.5% of face width or mean face-patch difference over 0.075, normalized to a 250 ms interval |

Near-black/white codes are 12/248. These are clipping checks, not an ideal skin-brightness target. Usable pixels also exclude very dark regional samples relative to the face median. Weak white-balance evidence never blocks capture. Modest lighting imperfections and low sharpness lower ranking rather than demanding perfect capture conditions indefinitely.

Landmark visibility is a geometric/sampling proxy, **not** a validated hair/hand/occlusion detector. The live pass does not run hair segmentation. Mixed-light risk is a coarse bilateral chromaticity check, not the full illuminant estimator; makeup or genuine skin variation can confuse it. The full post-capture check remains important.

## Stability, buffering and ranking

Good conditions must persist for at least 1,100 ms and five consecutive measurements (normally six checks over approximately 1.25 seconds at the configured rate). A blocker cancels immediately, even while the displayed instruction is debounced. A gap above 650 ms or a hidden tab clears the stability window and frame buffer. Instructions change only after the new instruction persists for 500 ms.

The buffer holds at most **five** qualifying JPEG frames, no older than 1,500 ms, capped at six million encoded characters. Images use the same unmirrored 3:4 crop as the mirrored preview, with a maximum long edge of 1,280 px and JPEG quality 0.94. The low-resolution measurement and buffered JPEG come from the same source snapshot.

Each score is a weighted sum of bounded sub-scores: sharpness 23%, steadiness 22%, framing 16%, landmark/region plausibility 12%, exposure 15%, and bilateral lighting 12%. Choose the highest-scoring recent frame; ties choose the newer frame. Neither season probabilities nor colour-dimension confidence is available to the ranker. The manual shutter instead captures the frame at the user's tap, regardless of live guidance.

## Full verification and lifecycle

Capture stops the camera and live model, then runs the existing full-resolution analysis. Review offers **Use Photo** only when `imageQuality.status` is usable. Low classification certainty alone never requests a retake. Technical failures display existing issue-specific guidance; verification errors offer retry or retake.

Navigation, retake and unmount stop MediaStream tracks, close the capture-owned model, clear timers/listeners and release frame buffers/canvases. Late camera permission/model results are discarded and closed. Guidance-model loading has a 20-second limit; failure leaves manual capture available. Full verification has a 25-second UI timeout. Existing synchronous model inference cannot be interrupted mid-call; cancellation ignores late completion rather than modifying the shared analysis infrastructure.

## Debugging and verification

In development only, use `?debug=capture` to reveal live metrics, blockers, progress, buffered scores, selection reason and full-photo quality. Use `?preview=capture&debug=capture` for deterministic scenario controls. Its simulated camera/analysis is labelled explicitly. The optional local-photo probe uses real landmarks/measurements and full analysis, but repeats a still frame: it does not test real camera motion.

Automated capture checks cover blocking conditions, permissive ordinary lighting, debounce, stability/cancellation, long sampling gaps, best-frame ranking, buffer bounds, matching portrait crops, late permission cleanup and errors. Existing results and recolour tests remain in the suite.

Browser checks covered ideal auto-capture, uneven/dark/bright/moving/off-centre cases, ready-then-moving cancellation, manual capture, permission denial, technical retake, uncertain-but-usable acceptance and a 390 × 844 CSS mobile viewport. The actual camera path and a real local-photo probe both reached usable full-analysis review. Adverse-lighting scenarios are simulated regression checks, not a diverse physical-camera validation study.

All geometric, exposure, motion, sharpness and mixed-light thresholds and score weights remain provisional. Calibrate across devices, skin tones, face shapes, cameras and realistic lighting before claiming validated capture accuracy. No classifier or colour-measurement thresholds were changed.
