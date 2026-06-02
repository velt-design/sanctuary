import { expect, type Page, type TestInfo } from '@playwright/test';

export interface PortalBrowserEvidence {
  consoleMessages: Array<{ type: string; text: string }>;
  failedRequests: Array<{ method: string; url: string; failureText: string | null }>;
  pageErrors: string[];
}

export interface OpenPortalPageOptions {
  heading?: string | RegExp;
  timeout?: number;
}

export function installPortalBrowserEvidence(page: Page): PortalBrowserEvidence {
  const evidence: PortalBrowserEvidence = {
    consoleMessages: [],
    failedRequests: [],
    pageErrors: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      evidence.consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });

  page.on('pageerror', (error) => {
    evidence.pageErrors.push(error.stack ?? error.message);
  });

  page.on('requestfailed', (request) => {
    evidence.failedRequests.push({
      method: request.method(),
      url: request.url(),
      failureText: request.failure()?.errorText ?? null,
    });
  });

  return evidence;
}

export async function attachPortalBrowserEvidence(
  testInfo: TestInfo,
  page: Page,
  evidence: PortalBrowserEvidence,
) {
  await testInfo.attach('portal-browser-evidence', {
    body: JSON.stringify(
      {
        currentUrl: page.url(),
        title: await page.title().catch(() => null),
        viewport: page.viewportSize(),
        consoleMessages: evidence.consoleMessages,
        failedRequests: evidence.failedRequests,
        pageErrors: evidence.pageErrors,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  });
}

export async function openPortalPage(page: Page, route: string, options: OpenPortalPageOptions = {}) {
  const timeout = options.timeout ?? 60_000;

  await page.goto(route);

  const url = new URL(page.url());
  if (url.pathname.startsWith('/login')) {
    throw new Error(
      `Authenticated portal access reached /login while opening ${route}. Confirm PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are valid for this portal environment.`,
    );
  }

  if (url.pathname.startsWith('/access-status')) {
    throw new Error(
      `Authenticated portal access reached /access-status while opening ${route}. Confirm the staff test account has an active staff or admin portal role.`,
    );
  }

  await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible({ timeout });

  if (options.heading) {
    await expect(page.getByRole('heading', { name: options.heading })).toBeVisible({ timeout });
  }

  return url;
}

export async function expectVisiblePortalProject(page: Page) {
  const firstProjectLink = page.locator('a[href^="/staff/projects/proj_"]').first();
  await expect(
    firstProjectLink,
    'Authenticated portal access requires at least one project visible to the staff test account.',
  ).toBeVisible({ timeout: 60_000 });
}
