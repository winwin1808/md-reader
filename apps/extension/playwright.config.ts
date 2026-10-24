import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e-pw',
  testIgnore: 'collab.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
})
