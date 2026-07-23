import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.MARKETING_PLAYWRIGHT_PORT ?? '3010', 10);
const baseURL = process.env.MARKETING_BASE_URL?.trim() || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './playwright',
  testMatch: /marketing\.(?:consent|foundation|acrylic-foundation|acrylic-copy-variant|guide-cluster-final-refinement|guide-hub|hero-navigation|home-v2|projects|seo-copy-hygiene|seo-landing|seo-programme|shared-header)\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: process.env.MARKETING_BASE_URL ? undefined : {
    command: `npm --prefix apps/marketing run dev:playwright -- -p ${port}`,
    env: { MARKETING_PLAYWRIGHT_DIST_DIR: '.next/playwright-marketing' },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
