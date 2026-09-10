import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'chrome120',
    emptyOutDir: false, // app build chạy trước, đừng xoá
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: { content: 'src/content/index.ts' },
      output: {
        format: 'iife', // MV3 content script KHÔNG nạp ES module
        inlineDynamicImports: true, // không sinh chunk chia sẻ
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
})
