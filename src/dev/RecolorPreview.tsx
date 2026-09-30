import { useEffect, useState } from 'react'
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
  const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0)
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
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ original: string; before: string; after: string; metrics: string }>()
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const fixture = clothingEdgeFixture(index, linear)
      let image = new ImageData(fixture.pixels, fixture.width, fixture.height)
      if (photo) {
        const sourceMask = buildFeatheredAlphaMask(photo.mask, photo.image, photo.image.width, photo.image.height)
        // Simulate the source dye colour on a real portrait, then hold the
        // same detected mask fixed for both edge-compositing comparisons.
        image = await decode(applyClothingColor(makeSession(photo.image, sourceMask), EDGE_CASES[index].original)!)
      }
      const detected = photo?.mask ?? fixture.mask
      const oldMask = buildFeatheredAlphaMask(detected, image, image.width, image.height, false)
      const mask = buildFeatheredAlphaMask(detected, image, image.width, image.height)
      const before = applyClothingColor(makeSession(image, oldMask), EDGE_CASES[index].target)!
      const after = applyClothingColor(makeSession(image, mask), EDGE_CASES[index].target)!
      const [oldPixels, newPixels] = await Promise.all([decode(before), decode(after)])
      let oldExterior = 0, newExterior = 0, interiorChanged = 0, tagged = 0, linearTagged = 0
      let oldPartial = 0, newPartial = 0
      for (let i = 0; i < mask.alpha.length; i++) {
        const k = i * 4
        const oldChanged = [0, 1, 2].some(c => oldPixels.data[k + c] !== image.data[k + c])
        const newChanged = [0, 1, 2].some(c => newPixels.data[k + c] !== image.data[k + c])
        if (photo ? oldMask.alpha[i] === 0 && mask.alpha[i] === 0 : fixture.coverage[i] === 0) { if (oldChanged) oldExterior++; if (newChanged) newExterior++ }
        if (mask.edgeForeground?.[k + 3]) { tagged++; if (mask.edgeForeground[k + 3] === 2) linearTagged++ }
        if (oldMask.alpha[i] === 255 && mask.alpha[i] === 255 && oldMask.edgeBackground[k + 3] === 0 && !mask.edgeForeground?.[k + 3]
          && [0, 1, 2].some(c => oldPixels.data[k + c] !== newPixels.data[k + c])) interiorChanged++
        if (!photo && fixture.coverage[i] === 1 && oldMask.alpha[i] < 250) {
          if (oldMask.alpha[i] < 250) oldPartial++
          if (mask.alpha[i] < 250) newPartial++
        }
      }
      if (!cancelled) setResult({ original: png(image), before, after, metrics: JSON.stringify({
        case: EDGE_CASES[index].name, mode: photo ? 'real photo with simulated source dye' : 'controlled coverage', linear, tagged, linearTagged,
        oldExteriorChanged: oldExterior, newExteriorChanged: newExterior, interiorChanged,
        ...(photo ? {} : { fullyGarmentUndercoveredBefore: oldPartial, fullyGarmentUndercoveredAfter: newPartial }),
      }, null, 2) })
    })().catch(() => { if (!cancelled) setError('Could not prepare this comparison.') })
    return () => { cancelled = true }
  }, [index, linear, photo])
  return <main className="mx-auto max-w-7xl p-6 text-ink">
    <h1 className="font-display text-3xl">Clothing edge regression preview</h1>
    <p className="mt-2 text-sm">{photo ? 'Real portrait with simulated source dye; fixed detected mask. Compare the compositing at collar and shoulder boundaries.'
      : 'Controlled collar/shoulder, textured fabric, known skin/background coverage; coarse inset mask. Synthetic QA only.'}</p>
    <div className="my-5 flex gap-6">
      <label>Transition <select aria-label="Colour transition" value={index} onChange={e => setIndex(Number(e.target.value))}>{EDGE_CASES.map((c, i) => <option value={i} key={c.name}>{c.name}</option>)}</select></label>
      <label><input aria-label="Linear-light edge fixture" type="checkbox" disabled={!!photo} checked={linear} onChange={e => setLinear(e.target.checked)} /> Linear-light source edge</label>
    </div>
    <label className="block text-sm">Optional local test portrait (source dye is simulated; segmentation is reused){' '}
      <input type="file" aria-label="Edge test portrait" accept="image/png,image/jpeg" onChange={e => {
        const file = e.target.files?.[0]
        if (!file) return
        setError('')
        const reader = new FileReader()
        reader.onload = () => { void (async () => {
          const image = new Image(); image.src = String(reader.result); await image.decode()
          const mask = await detectHairMask(image)
          if (!mask) throw new Error('No mask')
          setPhoto({ image: await decode(image.src), mask })
        })().catch(() => setError('Could not load or segment this photo.')) }
        reader.readAsDataURL(file)
      }} />
    </label>
    {photo && <button onClick={() => setPhoto(undefined)} className="my-3 border p-2 text-sm">Use controlled fixture</button>}
    {error && <p role="alert">{error}</p>}
    {result && <><div className="grid gap-4 md:grid-cols-3">{[['Original', result.original], ['Previous composite', result.before], ['Refined composite', result.after]].map(([label, url]) =>
      <figure key={label}><figcaption>{label}</figcaption><img alt={label} src={url} className="mt-2 w-full" />
        <div className="mt-3 h-48 overflow-hidden"><img alt={`${label} collar zoom`} src={url} className="max-w-none" style={{ width: 1152, transform: photo ? 'translate(-400px,-430px)' : 'translate(-384px,-320px)' }} /></div>
        <div className="mt-3 h-40 overflow-hidden"><img alt={`${label} shoulder zoom`} src={url} className="max-w-none" style={{ width: 1152, transform: photo ? 'translate(-180px,-475px)' : 'translate(-96px,-400px)' }} /></div>
      </figure>)}</div><pre aria-label="Edge regression metrics" className="mt-6 overflow-auto text-xs">{result.metrics}</pre></>}
  </main>
}
