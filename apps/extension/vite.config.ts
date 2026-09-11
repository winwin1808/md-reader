import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'chrome120',
    modulePreload: false,
    emptyOutDir: false,
    rollupOptions: {
      // content script build riêng ở vite.content.config.ts — MV3 không nạp ES module
      input: {
        app: 'src/app/index.html',
        worker: 'src/worker/index.ts',
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
})
