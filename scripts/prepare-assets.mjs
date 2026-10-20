import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('scripts/vision-assets.json', root), 'utf8'))
const pkg = JSON.parse(await readFile(new URL('node_modules/@mediapipe/tasks-vision/package.json', root), 'utf8'))
if (pkg.version !== manifest.mediapipeVersion) throw new Error('MediaPipe version differs from the reviewed asset manifest.')
const wasm = new URL('public/vision/wasm/', root)
const models = new URL('public/vision/models/', root)
await mkdir(wasm, { recursive: true })
await mkdir(models, { recursive: true })
// Both SIMD and non-SIMD runtimes are required for browser capability fallback.
for (const stem of ['vision_wasm_internal', 'vision_wasm_nosimd_internal']) {
  for (const extension of ['js', 'wasm']) {
    const file = `${stem}.${extension}`
    await copyFile(new URL(`node_modules/@mediapipe/tasks-vision/wasm/${file}`, root), new URL(file, wasm))
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
for (const asset of manifest.models) {
  const destination = new URL(asset.file, models)
  const existing = await readFile(destination).catch(() => null)
  if (existing && hash(existing) === asset.sha256) continue
  // Only build-time public resources are downloaded. Browser photos never
  // participate in this script. Fail closed if the upstream bytes change.
  const response = await fetch(asset.url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`Could not download ${asset.file}: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (hash(bytes) !== asset.sha256) throw new Error(`Checksum mismatch for ${asset.file}; review before updating the manifest.`)
  await writeFile(destination, bytes)
}
console.log(`Verified MediaPipe ${pkg.version} assets in ${fileURLToPath(new URL('public/vision/', root))}`)
