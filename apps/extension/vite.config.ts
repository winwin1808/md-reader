import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'chrome120',
    modulePreload: false,
    emptyOutDir: true,
    rollupOptions: {
      // content script build riêng ở vite.content.config.ts — MV3 không nạp ES module
      input: {
        // 1g2: app: 'src/app/index.html'
        // 1g1: worker: 'src/worker/index.ts'
        placeholder: 'src/shared/version.ts',
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
