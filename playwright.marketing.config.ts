import { defineConfig, devices } from '@playwright/test';

const port = Number.parseInt(process.env.MARKETING_PLAYWRIGHT_PORT ?? '3010', 10);
const baseURL = process.env.MARKETING_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const distDir = process.env.MARKETING_PLAYWRIGHT_DIST_DIR?.trim()
  || '.next/playwright-marketing';

export default defineConfig({
  testDir: './playwright',
  testMatch: /marketing\.(?:consent|contact|foundation|acrylic-foundation|acrylic-copy-variant|guide-cluster-final-refinement|guide-hub|hero-navigation|homepage|mobile-content-density|phase-(?:three|four|five)|products|projects(?:-phase-two)?|seo-copy-hygiene|seo-landing|seo-programme|shared-header|touch-motion)\.spec\.ts/,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'on-first-retry', screenshot: 'only-on-failure' },
  webServer: process.env.MARKETING_BASE_URL ? undefined : {
    command: `npm --prefix apps/marketing run dev:playwright -- -p ${port}`,
    env: { MARKETING_PLAYWRIGHT_DIST_DIR: distDir },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
