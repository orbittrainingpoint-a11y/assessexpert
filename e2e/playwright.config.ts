import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright config for AssessExpert E2E tests.
 *
 * Run modes:
 * - `npm test`         — headless against local backend + portal (default)
 * - `npm run test:ui`  — interactive UI, watch mode
 * - `BASE_URL=https://staging.assessexpert.com npm test` — against staging
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,            // shared DB state; serial is safer for CRUD
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 8_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // WebRTC tests need fake media + permissions auto-granted.
        launchOptions: {
          args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
        permissions: ['camera', 'microphone'],
      },
    },
  ],
})
