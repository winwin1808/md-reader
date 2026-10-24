import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e-pw',
  testMatch: 'collab.spec.ts',
  workers: 1,
  globalTeardown: './e2e-pw/collab.teardown.ts',
  retries: 0,
  timeout: 60000,
  reporter: 'list',
  webServer: {
    command:
      'rm -rf .wrangler-e2e && pnpm --filter @md-reader/api exec wrangler d1 migrations apply md-reader --local --persist-to .wrangler-e2e && pnpm --filter @md-reader/api exec wrangler dev --local --port 8787 --persist-to .wrangler-e2e',
    cwd: '../api',
    url: 'http://localhost:8787/api/health',
    reuseExistingServer: false,
    timeout: 120000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
})
