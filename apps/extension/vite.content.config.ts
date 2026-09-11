import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const preactPath = path.dirname(require.resolve('preact/package.json'));

export default defineConfig({
  resolve: {
    alias: {
      'react-dom/client': path.resolve(preactPath, 'compat/client.mjs'),
      'react-dom': path.resolve(preactPath, 'compat/dist/compat.module.js'),
      'react/jsx-runtime': path.resolve(preactPath, 'jsx-runtime/dist/jsxRuntime.module.js'),
      'react': path.resolve(preactPath, 'compat/dist/compat.module.js'),
    }
  },
  plugins: [
    {
      name: 'mock-core',
      enforce: 'pre',
      resolveId(source) {
        if (source === '@md-reader/core') return '\0mock-core'
        return null
      },
      load(id) {
        if (id === '\0mock-core') return `export const parseMarkdown = () => ({ tree: {} }); export const renderToHtml = () => ({ html: '', toc: [] });`
        return null
      }
    }
  ],
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
