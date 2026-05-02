import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.PORTAL_PLAYWRIGHT_PORT ?? '3001', 10);
const baseURL = process.env.PORTAL_BASE_URL?.trim() || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './playwright',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: process.env.PORTAL_BASE_URL
    ? undefined
    : {
        command: 'npm run dev:portal',
        env: {
          ENABLE_SANCTUARY_GEOMETRY_WORKBENCH: '1',
          ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: '1',
        },
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
  projects: [
    {
      name: 'setup',
      testMatch: /portal\.auth\.setup\.ts/,
    },
    {
      name: 'portal-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/portal-staff.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'portal-fixture',
      testMatch: /portal\.drawing-workbench\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
