import { defineConfig } from 'vite'

// Service worker build riêng: không dùng điều kiện 'browser' để các package
// có export "browser" dựa trên DOM sẽ resolve về bản không-DOM.
export default defineConfig({
  publicDir: false,
  resolve: {
    conditions: ['worker', 'module', 'import', 'default'],
  },
  build: {
    target: 'chrome120',
    emptyOutDir: false,
    modulePreload: false,
    rollupOptions: {
      input: { worker: 'src/worker/index.ts' },
      output: {
        format: 'es',
        inlineDynamicImports: true,
        entryFileNames: 'worker.js',
      },
    },
  },
})
