import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: 'line',
  retries: 0,
  testDir: './e2e',
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.FRONTEND_BASE_URL ?? 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  workers: 1,
})
