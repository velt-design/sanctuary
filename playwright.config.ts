import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { nativeTarget } from './playwright/support/portalPerformanceCausal';

const DEFAULT_PORTAL_PLAYWRIGHT_PORT = 3011;
const DEFAULT_PORTAL_PLAYWRIGHT_DIST_DIR = '.next/playwright-fixture';

const port = Number.parseInt(process.env.PORTAL_PLAYWRIGHT_PORT ?? String(DEFAULT_PORTAL_PLAYWRIGHT_PORT), 10);
const baseURL = process.env.PORTAL_BASE_URL?.trim() || `http://127.0.0.1:${port}`;
const portalPlaywrightDistDir = process.env.PORTAL_PLAYWRIGHT_DIST_DIR?.trim() || DEFAULT_PORTAL_PLAYWRIGHT_DIST_DIR;
const useProductionPortal = process.env.PORTAL_PLAYWRIGHT_PRODUCTION === '1';
const portalStaffStorageState = process.env.PORTAL_STAFF_STORAGE_STATE?.trim() || 'playwright/.auth/portal-staff.json';
const portalVercelProtectionBypass = process.env.PORTAL_VERCEL_PROTECTION_BYPASS?.trim();
const fixtureSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'http://127.0.0.1:1';
const fixtureSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || 'portal-fixture-anon-key';
const performanceDiagnostics = process.env.PORTAL_PERF_DIAGNOSTICS === '1';
const nativeCausal = process.env.PORTAL_PERF_NATIVE_CAUSAL === '1';
if (nativeCausal) {
  nativeTarget(process.env);
  process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
}
if (performanceDiagnostics) {
  let target: URL;
  try { target = new URL(baseURL); } catch { throw new Error('Performance diagnostics require the CI loopback production-timing target.'); }
  if (process.env.CI !== 'true' || !useProductionPortal || !Number.isInteger(port) || port < 1024 || port > 65535 ||
    !['127.0.0.1', 'localhost'].includes(target.hostname) || target.protocol !== 'http:' || Number(target.port) !== port ||
    target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Performance diagnostics require the CI loopback production-timing target.');
  }
}
const diagnosticPreload = path.resolve(__dirname, 'playwright/support/portalPerformanceServer.cjs');

export default defineConfig({
  testDir: './playwright',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: nativeCausal ? 0 : process.env.CI ? 1 : 0,
  reporter: nativeCausal ? [['./playwright/support/portalPerformanceCausal.ts']] : [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    ...(portalVercelProtectionBypass
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': portalVercelProtectionBypass,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
    trace: nativeCausal ? 'off' : 'on-first-retry',
    screenshot: nativeCausal ? 'off' : 'only-on-failure',
    video: nativeCausal ? 'off' : 'retain-on-failure',
  },
  webServer: process.env.PORTAL_BASE_URL
    ? undefined
    : {
        command: useProductionPortal
          ? `npm --prefix apps/portal run start -- -p ${port}`
          : `npm --prefix apps/portal run dev:playwright -- -p ${port}`,
        ...(nativeCausal ? { stdout: 'ignore' as const, stderr: 'ignore' as const } : {}),
        env: {
          ...(nativeCausal ? { PORTAL_PERF_DIAGNOSTICS: '0', PORTAL_PERF_SERVER_OBSERVER: '0' } : {}),
          ENABLE_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES: '1',
          ENABLE_PORTAL_QA_FIXTURES: '1',
          NEXT_PUBLIC_SUPABASE_URL: fixtureSupabaseUrl,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: fixtureSupabaseAnonKey,
          PORTAL_PLAYWRIGHT_DIST_DIR: portalPlaywrightDistDir,
          ...(performanceDiagnostics ? {
            NODE_OPTIONS: [process.env.NODE_OPTIONS, `--require=${JSON.stringify(diagnosticPreload)}`].filter(Boolean).join(' '),
            PORTAL_PERF_DIAGNOSTICS: '1',
            PORTAL_PERF_SERVER_OBSERVER: '1',
            PORTAL_PLAYWRIGHT_PRODUCTION: '1',
            PORTAL_PLAYWRIGHT_PORT: String(port),
          } : {}),
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
        /portal\.(performance-clock|marketing-visuals|ai-activity-fixture|command-centre|project-stories|commercial-workflow-fixture|design-booklet-workbench|drawing-workbench|email-preview-workbench|enquiry-qualification-fixture|invoice-artifact-preview-fixture|invoice-draft-editor-fixture|project-journey-actions|project-work-queue-fixture|schedule-board-confidence-fixture|workbench-snapshot|workbench-fixture|workbench-performance|project-mutation-performance)\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1600, height: 1000 },
      },
    },
  ],
});
