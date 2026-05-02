import { expect, test, type Page } from '@playwright/test';

async function expectAuthenticatedRoute(page: Page, route: string, heading: string) {
  await page.goto(route);

  const url = new URL(page.url());
  if (url.pathname.startsWith('/login')) {
    throw new Error(
      `Authenticated runtime preflight reached /login while opening ${route}. Confirm PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are valid for this portal environment.`,
    );
  }

  if (url.pathname.startsWith('/access-status')) {
    throw new Error(
      `Authenticated runtime preflight reached /access-status while opening ${route}. Confirm the staff test account has an active staff or admin portal role.`,
    );
  }

  await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 60_000 });
}

test.describe.configure({ mode: 'serial' });

test('authenticated portal runtime is ready for smoke and performance gates', async ({ page }) => {
  await expectAuthenticatedRoute(page, '/dashboard', 'Dashboard');
  await expectAuthenticatedRoute(page, '/staff/projects', 'Projects');

  const firstProjectLink = page.locator('a[href^="/staff/projects/proj_"]').first();
  await expect(
    firstProjectLink,
    'Authenticated runtime preflight requires at least one project visible to the staff test account for downstream smoke and performance coverage.',
  ).toBeVisible({ timeout: 60_000 });

  await expectAuthenticatedRoute(page, '/staff/contacts', 'Contacts');
  await expectAuthenticatedRoute(page, '/staff/schedule', 'Schedule');

  const readiness = await page.evaluate(async () => {
    const response = await fetch('/api/staff/v1/schedule/readiness');
    const text = await response.text();
    return {
      status: response.status,
      requestId: response.headers.get('x-portal-request-id'),
      bodyText: text,
    };
  });

  expect(
    readiness.status,
    `Authenticated runtime preflight requires schedule readiness to return 200, got ${readiness.status}.\n${readiness.bodyText}`,
  ).toBe(200);
  expect(readiness.requestId, 'Schedule readiness should include x-portal-request-id for diagnostics.').toBeTruthy();

  let body: { ok?: boolean };
  try {
    body = JSON.parse(readiness.bodyText) as { ok?: boolean };
  } catch (error) {
    throw new Error(`Schedule readiness returned non-JSON body. Original error: ${String(error)}\n${readiness.bodyText}`);
  }

  expect(body.ok, `Authenticated runtime preflight requires schedule readiness ok: true.\n${readiness.bodyText}`).toBe(true);
});
