import { useState } from 'react'
import { getFaceLandmarker, getHairSegmenter, releaseStillVisionModels } from '../services/vision/loadVisionModels'

/** Local-only browser capability probe. Never imported by a production build. */
export default function RuntimeChecks() {
  const [lines, setLines] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  async function run() {
    setBusy(true)
    const log: string[] = [navigator.userAgent, `Secure context: ${isSecureContext}`, `WASM: ${typeof WebAssembly !== 'undefined'}`]
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20
    const ctx = canvas.getContext('2d')!
    ctx.filter = 'blur(2px)'; ctx.fillStyle = '#fff'; ctx.fillRect(8, 8, 4, 4)
    const outsideAlpha = ctx.getImageData(6, 10, 1, 1).data[3]
    log.push(`Native canvas blur works: ${outsideAlpha > 0} (outside alpha ${outsideAlpha})`)
    canvas.width = canvas.height = 0
    setLines([...log])
    try {
      await getFaceLandmarker(); log.push('Face model initialized: PASS'); setLines([...log])
      await getHairSegmenter(); log.push('Segmentation model initialized: PASS')
    } catch (error) { log.push(`Model initialization: FAIL (${error instanceof Error ? error.message : 'unknown'})`) }
    finally {
      releaseStillVisionModels()
      log.push('Still-image model release requested')
      const requests = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
      log.push(...requests.filter(r => /^https?:/.test(r.name)).map(r => `${r.initiatorType}: ${new URL(r.name).origin}${new URL(r.name).pathname}`))
      setLines([...log]); setBusy(false)
    }
  }
  return <main className="page-shell"><h1 className="ui-title">Development runtime checks</h1><p className="ui-copy">Capability and asset checks only; no camera or personal photo is used.</p><button className="ui-button ui-button-primary mt-5" disabled={busy} onClick={() => void run()}>{busy ? 'Checking…' : 'Run runtime checks'}</button><pre className="mt-5 whitespace-pre-wrap" role="status">{lines.join('\n')}</pre></main>
}
