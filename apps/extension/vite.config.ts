import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'chrome120',
    modulePreload: false,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // 1g2: app: 'src/app/index.html'
        // 1g1: worker: 'src/worker/index.ts'
        // 1h1: content: 'src/content/index.ts'
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
