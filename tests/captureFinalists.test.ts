import assert from 'node:assert/strict'
import { CAPTURE_CONFIG as C } from '../src/data/captureConfig'
import { captureFixture } from '../src/dev/captureFixtures'
import { resultFixture } from '../src/dev/resultsFixtures'
import { evaluateCaptureQuality } from '../src/services/capture/captureQuality'
import { capturePhotoEvidence, chooseCaptureFinalists, evaluateCaptureFinalist } from '../src/services/capture/captureFinalists'
import type { CaptureFrame } from '../src/types/capture'

let passed = 0
async function test(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`) }
const frame = (id: number, score = .9): CaptureFrame => ({ id, timestamp: id * 250, image: `${id}`, quality: { ...evaluateCaptureQuality(captureFixture()), score } })
function profile(delta = .02, consistency = .9) {
  const p = resultFixture('indeterminate')
  const m = p.shadowMeasurements
  m.skinDiagnostics.consistencyScore = consistency
  m.skinDiagnostics.regions.forEach((r, i) => { r.representative.l = .65 + (i === 0 ? delta : 0); r.reliability = .9 })
  m.features.skin.clippedFraction = .01
  m.stabilityDiagnostics.exposure.reliability = .9
  return p
}
const signal = () => new AbortController().signal

await test('Similarly good finalists are all checked; the newer equally good frame wins', async () => {
  const seen: string[] = []
  const r = await chooseCaptureFinalists([frame(1),frame(2),frame(3),frame(4),frame(5)], async image => { seen.push(image); return profile() }, signal())
  assert.deepEqual(seen,['5','4','3']); assert.equal(r.winner?.frame.id,5)
  assert.equal(r.selection.bufferedCandidateCount,5); assert.equal(r.selection.finalists?.length,C.finalists.count)
})
await test('An excellent nearby frame beats mediocre passing finalists rather than trusting the first score', async () => {
  const r = await chooseCaptureFinalists([frame(1,.99),frame(2,.98),frame(3,.97)],async image => image === '2' ? profile() : profile(.12,.3),signal())
  assert.equal(r.winner?.frame.id,2)
  assert.ok(r.selection.finalists!.every(f=>f.passed))
})
await test('Forehead↔cheek imbalance rejects the top live candidate, automatically choosing another', async () => {
  const bad = profile(.2,.05)
  assert.equal(bad.analysis.quality.imageQuality.status,'usable') // Live/general usability can miss this case.
  const r = await chooseCaptureFinalists([frame(1,.99),frame(2,.95),frame(3,.9)],async image => image === '1' ? bad : profile(),signal())
  const rejected = r.selection.finalists![0]
  assert.equal(rejected.passed,false); assert.ok(Math.abs(rejected.maximumRegionalDeltaL! - .2) < 1e-9)
  assert.ok(rejected.rejectionReasons.some(r=>r.code==='capture-regional-lighting'))
  assert.equal(r.winner?.frame.id,3)
})
await test('If the first three fail, the remaining buffered frames are checked before returning to camera', async () => {
  const seen: string[] = []
  const r = await chooseCaptureFinalists([1,2,3,4,5].map(id=>frame(id,1-id*.01)),async image => {
    seen.push(image); return Number(image)<=3 ? profile(.2) : profile(Number(image)===5 ? .01 : .09)
  },signal())
  assert.equal(seen.length,5); assert.equal(r.winner?.frame.id,5)
})
await test('No acceptable candidate returns actual lighting guidance, with no forced review result', async () => {
  const r = await chooseCaptureFinalists([1,2,3,4,5].map(id=>frame(id)),async()=>profile(.2,.05),signal())
  assert.equal(r.winner,undefined); assert.equal(r.selection.selectedId,null)
  assert.equal(r.selection.finalists!.length,5); assert.equal(r.problem?.code,'capture-regional-lighting')
})
await test('Existing full-photo technical failures reject a finalist; classification uncertainty does not', () => {
  const good = profile()
  assert.equal(good.analysis.quality.classificationCertainty.status,'indeterminate')
  assert.equal(evaluateCaptureFinalist(frame(1),capturePhotoEvidence(good)).passed,true)
  assert.equal(evaluateCaptureFinalist(frame(1),capturePhotoEvidence(resultFixture('retake'))).passed,false)
  good.shadowMeasurements.skinDiagnostics.regions[0].retainedPixelCount = 0
  assert.ok(evaluateCaptureFinalist(frame(1),capturePhotoEvidence(good)).rejectionReasons.some(r=>r.code==='capture-regions-unusable'))
})
await test('Very poor diagnosed lighting consistency rejects moderate lightness imbalance; colour variation alone does not', () => {
  const p = profile(.11,.05)
  p.shadowMeasurements.skinDiagnostics.likelyCause = 'regional-variation'
  assert.equal(evaluateCaptureFinalist(frame(1),capturePhotoEvidence(p)).passed,true)
  p.shadowMeasurements.skinDiagnostics.likelyCause = 'uneven-lighting'
  assert.ok(evaluateCaptureFinalist(frame(1),capturePhotoEvidence(p)).rejectionReasons.some(r=>r.code==='capture-regional-lighting'))
})
await test('Season probabilities, colour scores and dimension reliability cannot affect finalist ranking', () => {
  const p = profile(), before = evaluateCaptureFinalist(frame(1),capturePhotoEvidence(p))
  for (const d of ['temperature','value','chroma','contrast'] as const) { p.shadowMeasurements[d].score = 1; p.shadowMeasurements[d].reliability = 1 }
  p.shadowSeasonClassification.topThree.reverse()
  p.shadowSeasonClassification.topThree.forEach(c=>{ c.probability = .99 })
  p.analysis.quality.classificationCertainty.status = 'full'
  assert.deepEqual(evaluateCaptureFinalist(frame(1),capturePhotoEvidence(p)),before)
})
await test('A transient check error falls back to the next frame; cancellation stops further work', async () => {
  const r = await chooseCaptureFinalists([frame(1,.99),frame(2)],async image=>{ if(image==='1')throw Error('Unavailable'); return profile() },signal())
  assert.equal(r.winner?.frame.id,2); assert.equal(r.selection.finalists![0].detailedScore,null)
  const abort = new AbortController(), seen: string[] = []
  await assert.rejects(chooseCaptureFinalists([frame(1),frame(2)],async image=>{seen.push(image);abort.abort();return profile()},abort.signal),{name:'AbortError'})
  assert.equal(seen.length,1)
})
await test('Brief forehead lighting changes lower lightweight ranking without changing live blockers', () => {
  const m = captureFixture(), before = evaluateCaptureQuality(m)
  m.regions[0].linearLuma = .7
  const after = evaluateCaptureQuality(m)
  assert.equal(after.blocker,null); assert.ok(after.subscores.lighting < before.subscores.lighting)
})
await test('Blocked motion frames cannot enter finalist selection and detailed weights remain normalized', async () => {
  const moving = { ...frame(1),quality:evaluateCaptureQuality(captureFixture('moving')) }
  const r = await chooseCaptureFinalists([moving,frame(2)],async()=>profile(),signal())
  assert.equal(r.selection.bufferedCandidateCount,1); assert.equal(r.winner?.frame.id,2)
  assert.ok(Math.abs(Object.values(C.finalists.weights).reduce((a,b)=>a+b,0)-1)<1e-9)
})
await test('A stalled later check cannot discard a passing frame or multiply the selection time limit', async () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout
  let expire!: () => void, cleared = false, calls = 0
  // Advance the batch deadline deterministically, without a 25-second test wait.
  globalThis.setTimeout = ((callback: () => void) => { expire = callback; return 1 }) as unknown as typeof setTimeout
  globalThis.clearTimeout = (() => { cleared = true }) as typeof clearTimeout
  try {
    const r = await chooseCaptureFinalists([frame(1,.99),frame(2,.9),frame(3,.8)],async (_image, batchSignal)=>{
      calls++
      if(calls===1)return profile()
      return new Promise((_resolve,reject)=>{
        batchSignal.addEventListener('abort',()=>reject(new DOMException('Timed out','AbortError')),{once:true})
        expire()
      })
    },signal())
    assert.equal(r.winner?.frame.id,1); assert.equal(r.selection.selectionTimedOut,true)
    assert.equal(calls,2); assert.equal(cleared,true)
  } finally { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear }
})
console.log(`\n${passed} capture finalist checks passed.`)
