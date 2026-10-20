// Model assets and the matching WASM runtime ship from this site's origin.
// Only generic model files are fetched; photos stay in the browser.
import { FilesetResolver, FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'
import { CAPTURE_CONFIG } from '../../data/captureConfig'
import { createModelCache, throwIfAborted } from './modelLifecycle'

export { describeAnalysisError } from './modelLifecycle'

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
const WASM_BASE_URL = '/vision/wasm'
const FACE_LANDMARKER_MODEL_URL = '/vision/models/face_landmarker.task'
// Categories: background, hair, body-skin, face-skin, clothes, other.
const HAIR_SEGMENTER_MODEL_URL = '/vision/models/selfie_multiclass_256x256.tflite'
const timeoutMs = CAPTURE_CONFIG.modelTimeoutMs

const fileset = createModelCache<WasmFileset>(
  () => FilesetResolver.forVisionTasks(WASM_BASE_URL),
  { label: 'Photo tools', timeoutMs },
)
const faceLandmarker = createModelCache<FaceLandmarker>(async signal => {
  const runtime = await fileset.get(signal)
  throwIfAborted(signal)
  return FaceLandmarker.createFromOptions(runtime, {
    baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    numFaces: 1,
    outputFaceBlendshapes: false,
  })
}, { label: 'Face model', timeoutMs, dispose: model => model.close() })

const hairSegmenter = createModelCache<ImageSegmenter>(async signal => {
  const runtime = await fileset.get(signal)
  throwIfAborted(signal)
  return ImageSegmenter.createFromOptions(runtime, {
    baseOptions: { modelAssetPath: HAIR_SEGMENTER_MODEL_URL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    outputCategoryMask: true,
    outputConfidenceMasks: false,
  })
}, { label: 'Segmentation model', timeoutMs, dispose: model => model.close() })

export function getFaceLandmarker(signal?: AbortSignal): Promise<FaceLandmarker> {
  return faceLandmarker.get(signal)
}

export function getHairSegmenter(signal?: AbortSignal): Promise<ImageSegmenter> {
  return hairSegmenter.get(signal)
}

/** Release only still-image resources; camera sessions own their own model. */
export function releaseStillVisionModels(): void {
  faceLandmarker.release()
  hairSegmenter.release()
}

/** Owned and closed by the camera session. Never reconfigure the still model. */
export function createCaptureLandmarker(): Promise<FaceLandmarker> {
  return createModelCache<FaceLandmarker>(async signal => {
    const runtime = await fileset.get(signal)
    throwIfAborted(signal)
    return FaceLandmarker.createFromOptions(runtime, {
      baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      numFaces: 2,
      minFaceDetectionConfidence: CAPTURE_CONFIG.landmarkConfidence,
      minFacePresenceConfidence: CAPTURE_CONFIG.landmarkConfidence,
      outputFaceBlendshapes: false,
    })
  }, { label: 'Camera guidance model', timeoutMs, dispose: model => model.close() }).get()
}
