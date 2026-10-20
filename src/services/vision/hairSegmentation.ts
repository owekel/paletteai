// Runs the multiclass selfie segmentation model, which labels every pixel
// of the photo with one of: background, hair, body-skin, face-skin,
// clothes, other. We only care about "hair" here — this is what lets
// colourSampling.ts sample hair colour from pixels that are ACTUALLY hair,
// instead of a guessed rectangle.

import { getHairSegmenter } from './loadVisionModels'
import { throwIfAborted } from './modelLifecycle'

// Category indices as defined by the selfie_multiclass_256x256 model.
export const BACKGROUND_CATEGORY = 0
export const HAIR_CATEGORY = 1
// This model already labels clothing as its own category — reused by the
// colour try-on feature (see services/clothingRecolor.ts) rather than
// adding a second segmentation model.
export const CLOTHES_CATEGORY = 4

export interface HairMask {
  categories: Uint8Array
  width: number
  height: number
}

export async function detectHairMask(image: HTMLImageElement, signal?: AbortSignal): Promise<HairMask | null> {
  throwIfAborted(signal)
  const segmenter = await getHairSegmenter(signal)
  throwIfAborted(signal)
  const result = segmenter.segment(image)
  const mask = result.categoryMask

  if (!mask) return null

  try {
    throwIfAborted(signal)
    // .slice() makes a plain JS-owned copy. This matters: MediaPipe's array
    // may be a live view into WASM memory, and mask.close() below can free
    // that memory — copying first guarantees the data we return stays valid
    // no matter how the underlying binding behaves.
    const categories = mask.getAsUint8Array().slice()
    return { categories, width: mask.width, height: mask.height }
  } finally {
    // MediaPipe mask objects wrap native/WASM memory — release it once
    // we've copied out the plain array we actually need.
    mask.close()
  }
}

// The segmentation mask's resolution rarely matches the original photo's
// resolution, so lookups are done by relative position (0..1 of the image)
// rather than assuming any particular pixel size.
export function isHairAtRelativePosition(mask: HairMask, relativeX: number, relativeY: number): boolean {
  return categoryAtRelativePosition(mask, relativeX, relativeY) === HAIR_CATEGORY
}

export function categoryAtRelativePosition(mask: HairMask, relativeX: number, relativeY: number): number {
  const mx = Math.min(mask.width - 1, Math.max(0, Math.floor(relativeX * mask.width)))
  const my = Math.min(mask.height - 1, Math.max(0, Math.floor(relativeY * mask.height)))
  return mask.categories[my * mask.width + mx]
}

// Same lookup as isHairAtRelativePosition, checking the clothes category
// instead — reuses the exact same mask data the segmenter already produced.
export function isClothesAtRelativePosition(mask: HairMask, relativeX: number, relativeY: number): boolean {
  return categoryAtRelativePosition(mask, relativeX, relativeY) === CLOTHES_CATEGORY
}
