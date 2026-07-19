import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PORTAL_PLAYWRIGHT_PORT = 3011;
const DEFAULT_PORTAL_PLAYWRIGHT_DIST_DIR = '.next/playwright-fixture';

const port = Number.parseInt(process.env.PORTAL_PLAYWRIGHT_PORT ?? String(DEFAULT_PORTAL_PLAYWRIGHT_PORT), 10);
const baseURL = process.env.PORTAL_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const portalPlaywrightDistDir = process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() || DEFAULT_PORTAL_PLAYWRIGHT_DIST_DIR;
const useProductionPortal = process.env.PORTAL_PLAYWRIGHT_PRODUCTION === '1';

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
        command: useProductionPortal
          ? `npm --prefix apps/portal run start -- -p ${port}`
          : `npm --prefix apps/portal run dev:playwright -- -p ${port}`,
        env: {
          ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: '1',
          ...(useProductionPortal ? {} : { PORTAL_PLAYWRIGHT_DIST_DIR: portalPlaywrightDistDir }),
        },
        url: baseURL,
        reuseExistingServer: false,
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
      testMatch: /portal\.(drawing-workbench|workbench-snapshot|workbench-fixture|workbench-performance)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
});
