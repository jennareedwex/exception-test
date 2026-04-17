import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/ — pin root to this file’s directory (project root with index.html)
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
})
