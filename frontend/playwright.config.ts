import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/e2e',
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER === 'true' ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:5173',
  },
})
