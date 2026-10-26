import { defineConfig } from 'vite'
import { builtinModules } from 'node:module'

export default defineConfig({
  ssr: { noExternal: ['@md-reader/core'] },
  build: {
    ssr: 'src/cli.ts',
    outDir: 'dist',
    target: 'node20',
    emptyOutDir: true,
    rollupOptions: {
      external: [/^@modelcontextprotocol\/sdk/, 'ws', 'zod', /^node:/, ...builtinModules],
      output: { entryFileNames: 'cli.js', banner: '#!/usr/bin/env node' },
    },
  },
})
