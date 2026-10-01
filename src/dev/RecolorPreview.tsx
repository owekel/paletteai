import { useEffect, useRef, useState } from 'react'
import { applyClothingColor, buildFeatheredAlphaMask, type ClothingRecolorSession } from '../services/clothingRecolor'
import { clothingEdgeFixture, EDGE_CASES } from './clothingEdgeFixtures'
import { detectHairMask, type HairMask } from '../services/vision/hairSegmentation'

function png(data: ImageData) {
  const canvas = document.createElement('canvas'); canvas.width = data.width; canvas.height = data.height
  canvas.getContext('2d')!.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}
async function decode(url: string) {
  const image = new Image(); image.src = url; await image.decode()
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
function makeSession(image: ImageData, mask: ReturnType<typeof buildFeatheredAlphaMask>): ClothingRecolorSession {
  return { imageWidth: image.width, imageHeight: image.height, originalImageData: image,
    featheredAlpha: mask.alpha, edgeBackground: mask.edgeBackground, edgeForeground: mask.edgeForeground,
    referenceLightness: mask.referenceLightness, shadowLightness: mask.shadowLightness, highlightLightness: mask.highlightLightness, hasClothing: mask.hasClothing }
}

export default function RecolorPreview() {
  const [index, setIndex] = useState(0)
  const [linear, setLinear] = useState(false)
  const [photo, setPhoto] = useState<{ image: ImageData; mask: HairMask }>()
  const [simulate, setSimulate] = useState(false)
  const [previous, setPrevious] = useState<string>()
  const preparedRef = useRef<{ image: ImageData; oldMask: ReturnType<typeof buildFeatheredAlphaMask>; mask: ReturnType<typeof buildFeatheredAlphaMask> }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState<'collar' | 'shoulder'>('collar')
  const [collarPoint, setCollarPoint] = useState({ x: 0.583, y: 0.82 })
  const [shoulderPoint, setShoulderPoint] = useState({ x: 0.31, y: 0.738 })
  const [result, setResult] = useState<{ caseName: string; original: string; before: string; after: string; raw: string; interior: string; band: string; selected: string; metrics: string; width: number; height: number }>()
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const started = performance.now()
      setPending(true)
      const fixture = clothingEdgeFixture(index, linear)
      let image = new ImageData(fixture.pixels, fixture.width, fixture.height)
      if (photo) {
        image = photo.image
        if (simulate) {
        const sourceMask = buildFeatheredAlphaMask(photo.mask, photo.image, photo.image.width, photo.image.height)
        // Simulate the source dye colour on a real portrait, then hold the
        // same detected mask fixed for both edge-compositing comparisons.
        image = await decode(applyClothingColor(makeSession(photo.image, sourceMask), EDGE_CASES[index].original)!)
        }
      }
      const detected = photo?.mask ?? fixture.mask
      const oldMask = preparedRef.current?.image === image ? preparedRef.current.oldMask : buildFeatheredAlphaMask(detected, image, image.width, image.height, false)
      const baselinePrepared = performance.now()
      const probes = photo ? [collarPoint, shoulderPoint].map(p => [Math.min(image.width - 1, Math.floor(p.x * image.width)), Math.min(image.height - 1, Math.floor(p.y * image.height))]) : []
      const mask = preparedRef.current?.image === image ? preparedRef.current.mask : buildFeatheredAlphaMask(detected, image, image.width, image.height, true, true)
      preparedRef.current = { image, oldMask, mask }
      const mattePrepared = performance.now()
      const baseline = applyClothingColor(makeSession(image, oldMask), EDGE_CASES[index].target)!
      const before = previous ?? baseline
      const after = applyClothingColor(makeSession(image, mask), EDGE_CASES[index].target)!
      const unpolished = applyClothingColor(makeSession(image, mask), EDGE_CASES[index].target, false)!
      const [oldPixels, newPixels, unpolishedPixels] = await Promise.all([decode(baseline), decode(after), decode(unpolished)])
      let polishChangedPixels = 0, polishMaxChannelDelta = 0, polishExteriorChanged = 0, polishInteriorChanged = 0
      let oldExterior = 0, newExterior = 0, interiorChanged = 0, tagged = 0, linearTagged = 0
      let oldPartial = 0, newPartial = 0
      for (let i = 0; i < mask.alpha.length; i++) {
        const k = i * 4
        const oldChanged = [0, 1, 2].some(c => oldPixels.data[k + c] !== image.data[k + c])
        const newChanged = [0, 1, 2].some(c => newPixels.data[k + c] !== image.data[k + c])
        if (photo ? oldMask.alpha[i] === 0 && mask.alpha[i] === 0 : fixture.coverage[i] === 0) { if (oldChanged) oldExterior++; if (newChanged) newExterior++ }
        const polishDelta = Math.max(...[0, 1, 2].map(c => Math.abs(newPixels.data[k + c] - unpolishedPixels.data[k + c])))
        if (polishDelta) {
          polishChangedPixels++; polishMaxChannelDelta = Math.max(polishMaxChannelDelta, polishDelta)
          if (photo ? mask.alpha[i] === 0 : fixture.coverage[i] === 0) polishExteriorChanged++
          if (mask.boundaryDiagnostics!.trimap[i] === 255) polishInteriorChanged++
        }
        if (mask.edgeForeground?.[k + 3]) { tagged++; if (mask.edgeForeground[k + 3] === 2) linearTagged++ }
        if (oldMask.alpha[i] === 255 && mask.alpha[i] === 255 && oldMask.edgeBackground[k + 3] === 0 && !mask.edgeForeground?.[k + 3]
          && [0, 1, 2].some(c => oldPixels.data[k + c] !== newPixels.data[k + c])) interiorChanged++
        if (!photo && fixture.coverage[i] === 1 && oldMask.alpha[i] < 250) {
          if (oldMask.alpha[i] < 250) oldPartial++
          if (mask.alpha[i] < 250) newPartial++
        }
      }
      const raw = new ImageData(image.width, image.height), selected = new ImageData(image.width, image.height)
      const interior = new ImageData(image.width, image.height), band = new ImageData(image.width, image.height)
      const rejected = [0, 0, 0, 0, 0]
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const i = y * image.width + x, k = i * 4
        const label = detected.categories[Math.floor(y * detected.height / image.height) * detected.width + Math.floor(x * detected.width / image.width)]
        raw.data[k] = raw.data[k + 1] = raw.data[k + 2] = label === 4 ? 255 : 0; raw.data[k + 3] = 255
        selected.data[k] = selected.data[k + 1] = selected.data[k + 2] = mask.edgeForeground?.[k + 3] ? 255 : 0; selected.data[k + 3] = 255
        const debug = mask.boundaryDiagnostics!
        rejected[debug.rejected[i]]++
        for (const [data, show] of [[interior, debug.trimap[i] === 255], [band, debug.trimap[i] === 128]] as const) {
          data.data[k] = data.data[k + 1] = data.data[k + 2] = show ? 255 : 0; data.data[k + 3] = 255
        }
      }
      if (!cancelled) { setPending(false); setResult({ caseName: EDGE_CASES[index].name, original: png(image), before, after, raw: png(raw), interior: png(interior), band: png(band), selected: png(selected), width: image.width, height: image.height, metrics: JSON.stringify({
        case: EDGE_CASES[index].name, mode: photo ? simulate ? 'real photo with simulated source dye' : 'unaltered original photo' : 'controlled coverage', maskWidth: detected.width, maskHeight: detected.height, linear, tagged, linearTagged,
        trimapRadius: mask.boundaryDiagnostics?.bandRadius,
        timingsMs: { baseline: Math.round(baselinePrepared - started), boundaryPreparation: Math.round(mattePrepared - baselinePrepared), total: Math.round(performance.now() - started) },
        skipped: { exteriorMatch: rejected[1], missingReferences: rejected[2], ambiguousFit: rejected[3], disconnected: rejected[4] },
        ...(probes.length ? { regressionProbes: probes.map(([x, y]) => {
          const i = y * image.width + x, k = i * 4
          return { x, y, distance: mask.boundaryDiagnostics!.signedDistance[i], status: mask.boundaryDiagnostics!.rejected[i],
            alpha: mask.alpha[i], source: Array.from(image.data.slice(k, k + 3)), output: Array.from(newPixels.data.slice(k, k + 3)),
            foreground: Array.from(mask.edgeForeground!.slice(k, k + 4)), background: Array.from(mask.edgeBackground.slice(k, k + 4)) }
        }) } : {}),
        oldExteriorChanged: oldExterior, newExteriorChanged: newExterior, interiorChanged,
        appearancePolish: { changedPixels: polishChangedPixels, maxChannelDelta: polishMaxChannelDelta,
          exteriorChanged: polishExteriorChanged, confidentInteriorChanged: polishInteriorChanged },
        ...(photo ? {} : { fullyGarmentUndercoveredBefore: oldPartial, fullyGarmentUndercoveredAfter: newPartial }),
      }, null, 2) }) }
    })().catch(() => { if (!cancelled) { setPending(false); setError('Could not prepare this comparison.') } })
    return () => { cancelled = true }
  }, [index, linear, photo, simulate, previous, collarPoint, shoulderPoint])
  function zoomImage(url: string, label: string, location: 'collar' | 'shoulder') {
    if (!result) return null
    const p = photo ? location === 'collar' ? collarPoint : shoulderPoint : location === 'collar' ? { x: 0.5, y: 0.44 } : { x: 0.23, y: 0.405 }
    return <div className="relative mt-3 h-48 overflow-hidden"><img alt={label} src={url} className="absolute max-w-none" style={{ width: result.width * 3, left: '50%', top: '50%', transform: `translate(${-p.x * result.width * 3}px,${-p.y * result.height * 3}px)` }} /></div>
  }
  return <main className="mx-auto max-w-7xl p-6 text-ink">
    <h1 className="font-display text-3xl">Clothing edge regression preview</h1>
    <p className="mt-2 text-sm">{photo ? 'Original portrait pixels by default; fixed detected mask. Simulated source colours are labelled separately.'
      : 'Controlled collar/shoulder, textured fabric, known skin/background coverage; coarse inset mask. Synthetic QA only.'}</p>
    <div className="my-5 flex gap-6">
      <label>Transition <select aria-label="Colour transition" disabled={pending} value={index} onChange={e => { setPrevious(undefined); setIndex(Number(e.target.value)) }}>{EDGE_CASES.map((c, i) => <option value={i} key={c.name}>{c.name}</option>)}</select></label>
      <label><input aria-label="Linear-light edge fixture" type="checkbox" disabled={!!photo} checked={linear} onChange={e => setLinear(e.target.checked)} /> Linear-light source edge</label>
    </div>
    <label className="block text-sm">Optional local test portrait (original pixels used directly; segmentation is reused){' '}
      <input type="file" aria-label="Edge test portrait" accept="image/png,image/jpeg" onChange={e => {
        const file = e.target.files?.[0]
        if (!file) return
        setError('')
        const reader = new FileReader()
        reader.onload = () => { void (async () => {
          const image = new Image(); image.src = String(reader.result); await image.decode()
          const mask = await detectHairMask(image)
          if (!mask) throw new Error('No mask')
          setPrevious(undefined)
          setPhoto({ image: await decode(image.src), mask })
        })().catch(() => setError('Could not load or segment this photo.')) }
        reader.readAsDataURL(file)
      }} />
    </label>
    {photo && <label><input aria-label="Simulate source dye" type="checkbox" checked={simulate} onChange={e => setSimulate(e.target.checked)} /> Simulate source dye for other transitions (not a real original)</label>}
    <label className="block text-sm">Optional saved previous render (for the selected target only) <input aria-label="Previous rendered result" type="file" accept="image/png" onChange={e => {
      const file = e.target.files?.[0]; if (!file) return
      const reader = new FileReader(); reader.onload = () => setPrevious(String(reader.result)); reader.readAsDataURL(file)
    }} /></label>
    {photo && <button onClick={() => setPhoto(undefined)} className="my-3 border p-2 text-sm">Use controlled fixture</button>}
    {photo && <div className="my-3 flex flex-wrap gap-6 text-xs">{(['collar', 'shoulder'] as const).map(location => {
      const point = location === 'collar' ? collarPoint : shoulderPoint
      const update = location === 'collar' ? setCollarPoint : setShoulderPoint
      return <fieldset key={location}><legend>{location} zoom centre (fraction of photo)</legend>{(['x', 'y'] as const).map(axis => <label key={axis} className="mr-3">{axis} <input aria-label={`${location} zoom ${axis}`} className="w-20" type="number" min="0" max="1" step="0.005" value={point[axis]} onChange={e => update({ ...point, [axis]: Math.max(0, Math.min(1, Number(e.target.value))) })} /></label>)}</fieldset>
    })}</div>}
    {error && <p role="alert">{error}</p>}
    {pending && <p role="status" className="my-3">Preparing boundary comparison…</p>}
    {result && <><p className="my-3">Rendered transition: {result.caseName}</p><div className="grid gap-4 md:grid-cols-3">{[['Original', result.original], ['Previous composite', result.before], ['Refined composite', result.after]].map(([label, url]) =>
      <figure key={label}><figcaption>{label}</figcaption><img alt={label} src={url} className="mt-2 w-full" />
        <p className="mt-3 text-xs">{label} · neckline at 3×</p>
        {zoomImage(url, `${label} collar zoom`, 'collar')}
        <p className="mt-3 text-xs">{label} · shoulder at 3×</p>
        {zoomImage(url, `${label} shoulder zoom`, 'shoulder')}
      </figure>)}</div><details open className="my-6"><summary>Developer boundary diagnostics</summary>
        <label>Diagnostic zoom <select aria-label="Diagnostic zoom" value={zoom} onChange={e => setZoom(e.target.value as typeof zoom)}><option value="collar">Right collar</option><option value="shoulder">Left shoulder</option></select></label>
        <p className="my-2 text-xs">White = selected pixels; black = excluded. Trimap is a search band, not an expanded mask.</p>
        <div className="grid gap-4 md:grid-cols-4">{[['Original clothing mask', result.raw], ['Confident garment interior', result.interior], ['Uncertain boundary band', result.band], ['Selected decontamination pixels', result.selected]].map(([label, url]) => <figure key={label}><figcaption>{label}</figcaption><img alt={label} src={url} className="w-full" />
          {zoomImage(url, `${label} zoom`, zoom)}
        </figure>)}</div>
      </details><pre aria-label="Edge regression metrics" className="mt-6 overflow-auto text-xs">{result.metrics}</pre></>}
  </main>
}
