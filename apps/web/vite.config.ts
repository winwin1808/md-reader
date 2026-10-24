import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist' },
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
      '/parties': { target: 'ws://localhost:8787', ws: true },
    },
  },
  test: { environment: 'jsdom' },
})
