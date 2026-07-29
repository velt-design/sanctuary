import { defineConfig, devices } from '@playwright/test';

const DEFAULT_PORTAL_PLAYWRIGHT_PORT = 3011;
const DEFAULT_PORTAL_PLAYWRIGHT_DIST_DIR = '.next/playwright-fixture';

const port = Number.parseInt(process.env.PORTAL_PLAYWRIGHT_PORT ?? String(DEFAULT_PORTAL_PLAYWRIGHT_PORT), 10);
const baseURL = process.env.PORTAL_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const portalPlaywrightDistDir = process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() || DEFAULT_PORTAL_PLAYWRIGHT_DIST_DIR;
const useProductionPortal = process.env.PORTAL_PLAYWRIGHT_PRODUCTION === '1';
const portalStaffStorageState = process.env.PORTAL_STAFF_STORAGE_STATE?.trim() || 'playwright/.auth/portal-staff.json';

export default defineConfig({
  testDir: './playwright',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
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
          ENABLE_PORTAL_QA_FIXTURES: '1',
          PORTAL_PLAYWRIGHT_DIST_DIR: portalPlaywrightDistDir,
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
        storageState: portalStaffStorageState,
      },
      dependencies: ['setup'],
    },
    {
      name: 'portal-fixture',
      testMatch:
        /portal\.(command-centre|commercial-workflow-fixture|drawing-workbench|email-preview-workbench|invoice-artifact-preview-fixture|workbench-snapshot|workbench-fixture|workbench-performance|project-mutation-performance)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
});
