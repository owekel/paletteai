import assert from 'node:assert/strict'
import { CAPTURE_CONFIG as C } from '../src/data/captureConfig'
import { captureFixture, type CaptureScenario } from '../src/dev/captureFixtures'
import { evaluateCaptureQuality } from '../src/services/capture/captureQuality'
import { CaptureStability } from '../src/services/capture/captureStability'
import { CaptureBuffer } from '../src/services/capture/captureBuffer'
import { browserCaptureRuntime, describeCameraError, drawCaptureFrame } from '../src/services/capture/cameraRuntime'
import { faceRegionsFromLandmarks } from '../src/services/vision/faceDetection'
import type { CaptureFrame, CaptureIssue } from '../src/types/capture'

let passed = 0
async function test(name: string, run: () => void | Promise<void>) { await run(); passed++; console.log(`✓ ${name}`) }
const quality = (scenario: CaptureScenario = 'ideal') => evaluateCaptureQuality(captureFixture(scenario))
const frame = (id: number, timestamp: number, score: number): CaptureFrame => ({ id, timestamp, image: `photo-${id}`, quality: { ...quality(), score } })

await test('Every major live capture failure supplies a specific blocking instruction', () => {
  const cases: [CaptureScenario, CaptureIssue][] = [['uneven','uneven'],['dark','dark'],['bright','bright'],['moving','motion'],['off-center','center'],['too-far','closer'],['too-close','back'],['tilted','pose'],['covered','visibility'],['multiple-faces','multiple-faces'],['no-face','no-face'],['mixed','mixed']]
  for (const [scenario, blocker] of cases) assert.equal(quality(scenario).blocker, blocker, scenario)
  assert.equal(quality().blocker, null)
})
await test('Ordinary skin brightness and weak colour-cast evidence do not require studio lighting', () => {
  for (const brightness of [35, 65, 110, 180, 225]) {
    const m = captureFixture(); m.medianLuma = brightness; m.mixedChromaDistance = .2; m.mixedEvidence = false
    assert.equal(evaluateCaptureQuality(m).blocker, null)
  }
  const m = captureFixture(); m.sharpness = 12; m.cheekStops = .8
  assert.equal(evaluateCaptureQuality(m).blocker, null)
  assert.ok(evaluateCaptureQuality(m).score < quality().score)
})
await test('One good frame cannot capture; readiness needs both elapsed time and consecutive frames', () => {
  const s = new CaptureStability()
  assert.equal(s.update(null, 0).ready, false)
  for (const t of [250, 500, 750, 1000]) assert.equal(s.update(null, t).ready, false)
  assert.equal(s.update(null, 1250).ready, true)
  const sparse = new CaptureStability()
  for (const t of [0, 600, 1200, 1800]) assert.equal(sparse.update(null, t).ready, false)
  assert.equal(sparse.update(null, 2400).ready, true)
})
await test('Moving during the confirmation window cancels immediately despite a debounced message', () => {
  const s = new CaptureStability()
  for (const t of [0, 250, 500, 750]) s.update(null, t)
  const moved = s.update('motion', 1000)
  assert.equal(moved.guidance, 'ready')
  assert.equal(moved.progress, 0); assert.equal(moved.ready, false); assert.equal(moved.resetBuffer, true)
  for (const t of [1250, 1500, 1750, 2000, 2250]) assert.equal(s.update(null, t).ready, false)
  assert.equal(s.update(null, 2500).ready, true)
})
await test('Jitter does not flicker the instruction; sustained failure updates it after 500 ms', () => {
  const s = new CaptureStability()
  for (const t of [0, 250, 500, 750]) s.update(null, t)
  for (const [t,b] of [[1000,'center'],[1250,null],[1500,'center'],[1750,null]] as const) assert.equal(s.update(b,t).guidance, 'ready')
  s.update('dark', 2000); s.update('dark', 2250)
  assert.equal(s.update('dark', 2500).guidance, 'dark')
})
await test('A suspended tab or stalled sample cannot complete an old ready window', () => {
  const s = new CaptureStability()
  for (const t of [0,250,500,750]) s.update(null,t)
  const resumed = s.update(null, 2000)
  assert.equal(resumed.resetBuffer, true); assert.equal(resumed.progress, 0); assert.equal(resumed.stableFrames, 1)
  s.reset(); assert.equal(s.update(null, 2300).ready, false)
})
await test('Selection chooses the strongest recent frame, not necessarily the last one', () => {
  const b = new CaptureBuffer()
  b.push(frame(1, 0, .65)); b.push(frame(2,250,.95)); b.push(frame(3,500,.7))
  assert.equal(b.best(600)?.frame.id, 2)
  b.push(frame(4,750,.95)); assert.equal(b.best(800)?.frame.id, 4)
  assert.equal(b.best(4000), null)
})
await test('The buffer bounds count, age and encoded memory and excludes blocked frames', () => {
  const b = new CaptureBuffer()
  for (let i = 0; i < 20; i++) b.push(frame(i,i*250,.7))
  assert.equal(b.summary().length,C.bufferFrames)
  b.push({ ...frame(25,5000,1), quality: quality('moving') }); assert.equal(b.summary().length,5)
  b.push({ ...frame(26,5000,1), image: 'x'.repeat(C.bufferMaxCharacters + 1) }); assert.equal(b.summary().length,0)
  b.clear(); assert.equal(b.best(5000),null)
})
await test('Photo score has named bounded sub-scores and contains no season evidence', () => {
  const q = quality()
  assert.deepEqual(Object.keys(q.subscores).sort(),Object.keys(C.weights).sort())
  assert.ok(q.score >= 0 && q.score <= 1)
  assert.equal(Object.values(C.weights).reduce((a,b)=>a+b,0),1)
  for (const n of Object.values(q.subscores)) assert.ok(n >= 0 && n <= 1)
  assert.equal('season' in q,false)
})
await test('Full-quality capture and live guide use the same unmirrored portrait crop', () => {
  let drawn: unknown[] = []
  const canvas = { width:0, height:0, getContext:()=>({drawImage:(...args:unknown[])=>{drawn=args}}) } as unknown as HTMLCanvasElement
  const video = { videoWidth:1920, videoHeight:1080, readyState:2 } as HTMLVideoElement
  drawCaptureFrame(video,canvas)
  assert.equal(canvas.width,810); assert.equal(canvas.height,1080)
  assert.deepEqual(drawn.slice(1),[555,0,810,1080,0,0,810,1080])
})
await test('Selfie reflection preserves symmetric centering and pose guidance', () => {
  for (const centerX of [0.15, 0.36, 0.5, 0.64, 0.85]) {
    const metrics = { ...captureFixture(), centerX, rollDegrees: 8 }
    const raw = evaluateCaptureQuality(metrics)
    const reflected = evaluateCaptureQuality({ ...metrics, centerX: 1 - centerX, rollDegrees: -8 })
    assert.equal(raw.blocker, reflected.blocker)
    assert.ok(Math.abs(raw.subscores.framing - reflected.subscores.framing) < 1e-12)
    assert.ok(Math.abs(raw.score - reflected.score) < 1e-12)
  }
})
await test('A camera permission promise resolving after cancellation releases every track', async () => {
  let resolve!: (value: unknown) => void, stops = 0
  const original = Object.getOwnPropertyDescriptor(globalThis,'navigator')
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r})}}})
  try {
    const abort = new AbortController()
    const pending = browserCaptureRuntime.open({} as HTMLVideoElement,abort.signal)
    abort.abort(); resolve({getTracks:()=>[{stop:()=>stops++},{stop:()=>stops++}]})
    await assert.rejects(pending,{name:'AbortError'}); assert.equal(stops,2)
  } finally { if (original) Object.defineProperty(globalThis,'navigator',original); else delete (globalThis as {navigator?: unknown}).navigator }
})
await test('Permission/device errors are actionable and missing landmarks remain unavailable', () => {
  assert.match(describeCameraError({name:'NotAllowedError'}),/browser settings/)
  assert.match(describeCameraError({name:'NotFoundError'}),/find a camera/)
  assert.match(describeCameraError({name:'NotReadableError'}),/another app/)
  assert.equal(faceRegionsFromLandmarks(),null); assert.equal(faceRegionsFromLandmarks([]),null)
})
console.log(`\n${passed} guided capture checks passed.`)
