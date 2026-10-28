import { defineConfig } from '@playwright/test'
import { execFileSync } from 'node:child_process'

function freePort(): string {
  return execFileSync(
    process.execPath,
    ['-e', "const s=require('net').createServer();s.listen(0,'127.0.0.1',()=>{console.log(s.address().port);s.close()})"],
    { encoding: 'utf8' },
  ).trim()
}

// Workers inherit process.env, so specs read the same port via apiBase().
const PORT = (process.env.MDR_E2E_PORT ||= freePort())

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
      `rm -rf .wrangler-e2e && pnpm --filter @md-reader/api exec wrangler d1 migrations apply md-reader --local --persist-to .wrangler-e2e && pnpm --filter @md-reader/api exec wrangler dev --local --port ${PORT} --persist-to .wrangler-e2e`,
    cwd: '../api',
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 120000,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
})
