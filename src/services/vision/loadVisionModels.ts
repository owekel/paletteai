// Loads and caches the two MediaPipe models this app uses:
//
// - FaceLandmarker: locates a face and its landmarks (used to find the
//   forehead/cheek/eye regions without guessing fixed image coordinates).
// - ImageSegmenter (multiclass "selfie" model): labels every pixel as
//   background / hair / body-skin / face-skin / clothes / other, so hair
//   colour can be sampled from pixels actually identified as hair.
//
// Both models are downloaded from MediaPipe's own CDN the first time
// they're needed (not bundled with this app), and reused after that. This
// means the browser needs internet access the first time someone analyzes
// a photo in a session — after that, the models stay cached in memory.
// Your PHOTO itself is never sent anywhere; only these generic, public
// model files are fetched.

import { FilesetResolver, FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision'
import { CAPTURE_CONFIG } from '../../data/captureConfig'

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>

// Pinned to match the npm package version in package.json. These two need
// to stay in sync — if you bump the npm dependency, update this too.
const MEDIAPIPE_VERSION = '1.0.1'
const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`

const FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

// The "selfie multiclass" model — the one that includes a dedicated hair
// category (0 background, 1 hair, 2 body-skin, 3 face-skin, 4 clothes, 5 other).
const HAIR_SEGMENTER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite'

let filesetPromise: Promise<WasmFileset> | null = null
let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null
let hairSegmenterPromise: Promise<ImageSegmenter> | null = null

function getFileset(): Promise<WasmFileset> {
  if (filesetPromise) return filesetPromise

  const promise = FilesetResolver.forVisionTasks(WASM_BASE_URL)
  // If this fails (e.g. offline), let a later call try again instead of
  // being stuck with a permanently-broken cached failure.
  promise.catch(() => {
    filesetPromise = null
  })
  filesetPromise = promise
  return promise
}

export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (faceLandmarkerPromise) return faceLandmarkerPromise

  const promise = getFileset().then((fileset: WasmFileset) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        // CPU is slower than GPU but far more consistently correct across
        // browsers/devices for a one-off still-image analysis like this.
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      numFaces: 1,
      outputFaceBlendshapes: false,
    }),
  )
  promise.catch(() => {
    faceLandmarkerPromise = null
  })
  faceLandmarkerPromise = promise
  return promise
}

export function getHairSegmenter(): Promise<ImageSegmenter> {
  if (hairSegmenterPromise) return hairSegmenterPromise

  const promise = getFileset().then((fileset: WasmFileset) =>
    ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: HAIR_SEGMENTER_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    }),
  )
  promise.catch(() => {
    hairSegmenterPromise = null
  })
  hairSegmenterPromise = promise
  return promise
}

/** Owned and closed by the camera session. Never reconfigure the still-image model. */
export async function createCaptureLandmarker(): Promise<FaceLandmarker> {
  return FaceLandmarker.createFromOptions(await getFileset(), {
    baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL_URL, delegate: 'CPU' },
    runningMode: 'IMAGE',
    numFaces: 2,
    minFaceDetectionConfidence: CAPTURE_CONFIG.landmarkConfidence,
    minFacePresenceConfidence: CAPTURE_CONFIG.landmarkConfidence,
    outputFaceBlendshapes: false,
  })
}

// Runs a promise with a hard time limit, so a stuck model download or a
// stalled inference can never hang the app forever — analyzeImage.ts uses
// this to fall back to V1 sampling if computer vision takes too long.
export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}
