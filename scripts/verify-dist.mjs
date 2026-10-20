import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const dist = new URL('dist/', root)
const manifest = JSON.parse(await readFile(new URL('scripts/vision-assets.json', root), 'utf8'))
const html = await readFile(new URL('index.html', dist), 'utf8')
assert(html.includes('/assets/') && !html.includes('fonts.googleapis.com'), 'Production entry must use bundled assets')
for (const file of await readdir(new URL('assets/', dist))) {
  assert(!file.endsWith('.map'), 'Do not publish application source maps')
  if (!/\.(?:js|css)$/.test(file)) continue
  const text = await readFile(new URL(`assets/${file}`, dist), 'utf8')
  for (const forbidden of ['cdn.jsdelivr.net', 'storage.googleapis.com', 'fonts.googleapis.com', 'fonts.gstatic.com', 'Development runtime checks', 'Preview result state', 'Developer diagnostics', 'VERCEL_OIDC_TOKEN']) {
    assert(!text.includes(forbidden), `Unexpected production content: ${forbidden} in ${file}`)
  }
}
for (const model of manifest.models) {
  const bytes = await readFile(new URL(`vision/models/${model.file}`, dist))
  assert.equal(createHash('sha256').update(bytes).digest('hex'), model.sha256, `Deployed model differs: ${model.file}`)
}
for (const stem of ['vision_wasm_internal', 'vision_wasm_nosimd_internal']) {
  for (const extension of ['js', 'wasm']) {
    assert((await stat(new URL(`vision/wasm/${stem}.${extension}`, dist))).size > 0)
  }
}
for (const file of ['favicon.svg', 'third-party-notices.txt', 'licenses/MediaPipe.txt', 'licenses/Inter.txt', 'licenses/Fraunces.txt', 'licenses/React.txt', 'licenses/ReactDOM.txt', 'licenses/Scheduler.txt']) {
  assert((await stat(new URL(file, dist))).size > 0)
}
console.log('Production artifact checks passed: pinned models, both WASM runtimes, local fonts/assets, licenses, no developer fixtures or credential variable.')
