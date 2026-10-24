import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e-pw',
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: 'list',
})
