import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import deployment from './vercel.json'

// See https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Keep deployed CSP/permissions active when reviewing a production build.
  preview: { headers: Object.fromEntries(deployment.headers[0].headers.map(h => [h.key, h.value])) },
  build: { target: ['chrome109', 'safari16.4', 'firefox115'], sourcemap: false },
})
