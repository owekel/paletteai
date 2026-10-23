import { build } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'

const entries = (await readdir(new URL('../tests/', import.meta.url)))
  .filter(name => /\.test\.tsx?$/.test(name)).sort().map(name => `tests/${name}`)
for (const entry of entries) {
  const bundle = await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', write: false,
    external: ['react', 'react-dom/server'], loader: { '.css': 'empty' }, define: { 'import.meta.env.DEV': 'false' } })
  const result = spawnSync(process.execPath, ['--input-type=module'], { input: bundle.outputFiles[0].text, stdio: ['pipe', 'inherit', 'inherit'] })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
