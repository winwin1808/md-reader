import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(new URL('./test/cloudflare-workers-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    testTimeout: 30000,
    server: { deps: { inline: [/partyserver/, /y-partyserver/] } },
  },
})
