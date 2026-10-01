import assert from 'node:assert/strict'
import { sampleGarmentEdgeTone, edgeToLinear, edgeToSrgb } from '../src/services/clothingEdgeMatte'
import { applyClothingColor, type ClothingRecolorSession } from '../src/services/clothingRecolor'
import { rgbToHsl } from '../src/services/colorUtils'
import { EDGE_CASES } from '../src/dev/clothingEdgeFixtures'

let checks = 0
function check(name: string, run: () => void) { run(); checks++; console.log(`✓ ${name}`) }
function scene(garment = [189, 40, 52], exterior = [230, 230, 230]) {
  const width = 36, height = 18, boundary = 14
  const source = new Uint8ClampedArray(width * height * 4)
  const raw = new Uint8ClampedArray(source.length), blurred = new Uint8ClampedArray(source.length)
  const alpha = new Uint8ClampedArray(width * height), background = new Uint8ClampedArray(source.length)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, k = i * 4
    const a = x < boundary ? 0 : Math.min(1, (x - boundary + 1) / 4)
    alpha[i] = Math.round(a * 255); raw[k + 3] = x >= boundary ? 255 : 0
    blurred[k + 3] = x >= boundary + 4 ? 255 : x < boundary ? 0 : 180
    for (let c = 0; c < 3; c++) { source[k + c] = a * garment[c] + (1 - a) * exterior[c]; background[k + c] = exterior[c] }
    source[k + 3] = 255
    if (a > 0 && a < 1) background[k + 3] = 255
  }
  return { width, height, boundary, source, raw, blurred, alpha, background }
}
function sample(f: ReturnType<typeof scene>) {
  return sampleGarmentEdgeTone(f.source, f.raw, f.blurred, f.alpha, f.background, f.width, f.height, 2)
}
function rgb(buffer: ArrayLike<number>, i: number) { return Array.from({length: 3}, (_, c) => buffer[i * 4 + c]) }

check('Source-hue suppression reads nearby interior tone, never mixed-pixel brightness', () => {
  const f = scene(), i = 8 * f.width + f.boundary + 1, refs = sample(f)
  assert.equal(refs[i * 4 + 3], 1)
  assert.deepEqual(rgb(refs, i), [189, 40, 52])
  const hsl = (v: number[]) => rgbToHsl({r:v[0],g:v[1],b:v[2]})
  assert.ok(hsl(rgb(f.source, i)).l > hsl(rgb(refs, i)).l + 10)
})
check('Correction cannot change alpha, background, source data, or the mask geometry', () => {
  const f = scene(), arrays = [f.source,f.raw,f.blurred,f.alpha,f.background], before = arrays.map(a => a.slice())
  const refs = sample(f)
  arrays.forEach((a,i) => assert.deepEqual(a,before[i]))
  for (let i=0;i<f.alpha.length;i++) if (refs[i*4+3]) {
    assert.ok(f.alpha[i] > 0 && f.raw[i*4+3])
    assert.ok(i%f.width >= f.boundary && i%f.width < f.boundary+3)
  }
})
check('Confident exterior and source-coloured pixels outside the semantic garment are not expanded into clothing', () => {
  const f=scene(), i=8*f.width+f.boundary-1
  f.source.set([189,40,52,255],i*4); f.alpha[i]=150; f.background[i*4+3]=255
  assert.equal(sample(f)[i*4+3],0)
  assert.equal(f.alpha[i],150)
})
check('Skin, background colours and achromatic white/black do not provide strong source-hue evidence', () => {
  for (const garment of [[240,237,230],[24,24,24],[220,170,140]]) {
    const f=scene(garment, garment[0]===220 ? [220,170,140] : [230,230,230])
    assert.ok(sample(f).every(v=>v===0))
  }
  const f=scene(), i=8*f.width+f.boundary+1
  f.source.set([220,170,140,255],i*4)
  assert.equal(sample(f)[i*4+3],0)
})
check('Real dark collar seams are not lifted into a bright reconstructed band', () => {
  const f=scene(), i=8*f.width+f.boundary+1
  f.source.set([65,1,5,255],i*4)
  assert.equal(sample(f)[i*4+3],0)
})
check('Insufficient or inconsistent interior evidence leaves the restored edge alone', () => {
  const f=scene()
  f.blurred.fill(0)
  assert.ok(sample(f).every(v=>v===0))
  const inconsistent=scene()
  for (let i=0;i<inconsistent.alpha.length;i++) if (i%inconsistent.width>=inconsistent.boundary+4 && Math.floor(i/inconsistent.width)<8) inconsistent.source.set([25,130,190,255],i*4)
  const i=8*inconsistent.width+inconsistent.boundary+1
  assert.equal(sample(inconsistent)[i*4+3],0)
})

// Test the actual production renderer with an in-memory canvas sink. This
// verifies pixel maths/compositing, not browser rasterisation or segmentation.
let rendered: Uint8ClampedArray
globalThis.document = { createElement: () => ({
  width: 0, height: 0, getContext: () => ({
    createImageData: (width: number,height: number) => ({data:new Uint8ClampedArray(width*height*4)}),
    putImageData: (image: {data:Uint8ClampedArray}) => { rendered=image.data.slice() },
  }), toDataURL: () => 'data:image/png;test-sink',
}) } as unknown as Document
function render(f: ReturnType<typeof scene>, target: string, refs?: Uint8ClampedArray) {
  const session: ClothingRecolorSession = {imageWidth:f.width,imageHeight:f.height,originalImageData:{data:f.source} as ImageData,
    featheredAlpha:f.alpha,edgeBackground:f.background,edgeForeground:refs,
    shadowLightness:25,referenceLightness:45,highlightLightness:65,hasClothing:true}
  assert.ok(applyClothingColor(session,target))
  return rendered.slice()
}
check('All six target transitions retain the same interior rendering and unchanged outside pixels', () => {
  for (const target of EDGE_CASES) {
    const f=scene(), refs=sample(f), before=render(f,target.target), after=render(f,target.target,refs)
    for(let i=0;i<f.alpha.length;i++) {
      if (!f.alpha[i]) assert.deepEqual(rgb(after,i),rgb(f.source,i),target.name)
      if (!refs[i*4+3]) assert.deepEqual(rgb(after,i),rgb(before,i),target.name)
    }
  }
})
check('Bright mixed source pixels cannot become a white/cyan highlight when interior tone is available', () => {
  const f=scene(), refs=sample(f), output=render(f,'#B8E5F1',refs), y=8
  const inside=rgb(output,y*f.width+f.boundary+5)
  for(let x=f.boundary+1;x<f.boundary+3;x++) {
    const i=y*f.width+x, a=f.alpha[i]/255
    assert.equal(refs[i*4+3],1)
    for(let c=0;c<3;c++) assert.ok(Math.abs(output[i*4+c]-((1-a)*230+a*inside[c]))<=2)
  }
})
check('Fractional coverage remains a natural continuous composite for deep teal, taupe and pale cyan', () => {
  for (const target of ['#1F5C56','#9C8C80','#B8E5F1']) {
    const f=scene(), refs=sample(f), y=8, i=y*f.width+f.boundary+1
    const dyed=rgb(render(f,target,refs),y*f.width+f.boundary+5)
    for(const alpha of [0,12,32,64,96,128,180,230,255]) {
      f.alpha[i]=alpha
      for(let c=0;c<3;c++) f.source[i*4+c]=(1-alpha/255)*230+alpha/255*[189,40,52][c]
      const pixel=rgb(render(f,target,refs),i)
      for(let c=0;c<3;c++) assert.ok(Math.abs(pixel[c]-((1-alpha/255)*230+alpha/255*dyed[c]))<=2)
    }
  }
})
check('Light-to-dark and dark-to-light remain on the unchanged smooth-matte path', () => {
  for(const [original,target] of [[[240,237,230],'#191B22'],[[24,24,24],'#F6F1E4']] as const) {
    const f=scene([...original]), refs=sample(f)
    assert.ok(refs.every(v=>v===0))
    assert.deepEqual(render(f,target,refs),render(f,target))
  }
})
check('sRGB conversion used by regression fixtures remains invertible', () => {
  for(const v of [0,0.01,0.1,0.5,1]) assert.ok(Math.abs(edgeToSrgb(edgeToLinear(v))-v)<1e-8)
})
console.log(`\n${checks} conservative clothing-edge checks passed.`)
