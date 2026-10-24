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
  build: {
    target: 'chrome120',
    emptyOutDir: false,
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: { content: 'src/content/index.ts' },
      output: {
        format: 'iife',
        inlineDynamicImports: true,
        entryFileNames: '[name].js',
        assetFileNames: '[name][extname]',
      },
    },
  },
})
