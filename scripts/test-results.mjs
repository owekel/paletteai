import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'

for (const entry of ['tests/results.test.ts', 'tests/clothingEdge.test.ts', 'tests/capture.test.ts', 'tests/captureFinalists.test.ts']) {
  const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', write: false })
  const result = spawnSync(process.execPath, ['--input-type=module'], { input: bundle.outputFiles[0].text, stdio: ['pipe', 'inherit', 'inherit'] })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
