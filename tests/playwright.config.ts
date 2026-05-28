import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  use: {
    baseURL:       process.env.BASE_URL ?? 'http://localhost:5173',
    screenshot:    'only-on-failure',
    video:         'retain-on-failure',
    trace:         'retain-on-failure',
    headless:      true,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
