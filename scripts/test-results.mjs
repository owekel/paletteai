import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'

const bundle = await build({ entryPoints: ['tests/results.test.ts'], bundle: true, platform: 'node', format: 'esm', write: false })
const result = spawnSync(process.execPath, ['--input-type=module'], { input: bundle.outputFiles[0].text, stdio: ['pipe', 'inherit', 'inherit'] })
process.exit(result.status ?? 1)
