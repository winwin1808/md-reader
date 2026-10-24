import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'chrome120',
    modulePreload: false,
    emptyOutDir: false,
    rollupOptions: {
      // content script build riêng ở vite.content.config.ts — MV3 không nạp ES module
      input: {
        app: 'app.html',
      },
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], include: ['src/**/*.test.{ts,tsx}'], exclude: ['e2e-pw/**', 'node_modules/**', 'dist/**'] },
})
