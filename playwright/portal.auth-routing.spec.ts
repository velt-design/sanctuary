import { expect, test, type Page, type Route } from '@playwright/test';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function delayNetworkResponse(page: Page, pattern: string) {
  const gate = deferred();
  const active = new Set<Promise<void>>();
  const handler = async (route: Route) => {
    const pending = (async () => {
      await gate.promise;
      await route.continue();
    })();
    active.add(pending);
    try {
      await pending;
    } finally {
      active.delete(pending);
    }
  };
  await page.route(pattern, handler);
  return {
    async resolve() {
      gate.resolve();
      await Promise.allSettled([...active]);
      await page.unroute(pattern, handler);
    },
  };
}

async function firstHref(page: Page, selector: string): Promise<string | null> {
  const link = page.locator(selector).first();
  const count = await link.count();
  if (!count) return null;
  await expect(link).toBeVisible({ timeout: 60_000 });
  return link.getAttribute('href');
}

function portalShellNavigation(page: Page) {
  return page.locator('[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]').first();
}

test.describe('portal auth routing public flows', () => {
  test.use({
    storageState: { cookies: [], origins: [] },
  });

  test('redirects a protected route to login and returns to the original destination', async ({ page }) => {
    const email = process.env.PORTAL_TEST_EMAIL?.trim();
    const password = process.env.PORTAL_TEST_PASSWORD?.trim();

    test.skip(!email || !password, 'PORTAL_TEST_EMAIL and PORTAL_TEST_PASSWORD are required for portal auth routing coverage.');

    await page.goto('/staff/projects?q=deck');
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible();

    await page.getByLabel('Email').fill(email!);
    await page.getByLabel('Password').fill(password!);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL((url) => url.pathname === '/staff/projects' && url.searchParams.get('q') === 'deck', {
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  });

  test('renders public login and access-status pages without portal navigation chrome', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible();
    await expect(page.locator('[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]')).toHaveCount(0);
    await expect(page.getByLabel('Sidebar reveal lab')).toHaveCount(0);

    await page.goto('/access-status?state=no-access&callbackUrl=%2Fdashboard');
    await expect(page.getByRole('heading', { name: 'Access not assigned' })).toBeVisible();
    await expect(page.locator('[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]')).toHaveCount(0);
    await expect(page.getByLabel('Sidebar reveal lab')).toHaveCount(0);
  });
});

test.describe('portal auth routing authenticated flows', () => {
  test('redirects authenticated /login visits to the callback destination', async ({ page }) => {
    await page.goto('/login?callbackUrl=%2Fstaff%2Fcontacts');
    await page.waitForURL((url) => url.pathname === '/staff/contacts', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
  });

  test('enforces the admin-only pricebook boundary for the authenticated portal session', async ({ page }) => {
    await page.goto('/pricebook');
    await page.waitForURL((url) => url.pathname === '/pricebook' || url.pathname === '/staff/calculator', { timeout: 30_000 });

    const pathname = new URL(page.url()).pathname;
    if (pathname === '/pricebook') {
      await expect(page.getByRole('tab', { name: 'Materials' })).toBeVisible();
      return;
    }

    expect(pathname).toBe('/staff/calculator');
    await expect(page.getByRole('heading', { name: 'Calculator' })).toBeVisible();
  });

  test('keeps the shell visible while the dashboard data is loading', async ({ page }) => {
    const gate = await delayNetworkResponse(page, '**/api/dashboard**');

    await page.goto('/dashboard');

    await expect(portalShellNavigation(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(page.locator('main[aria-label="Loading dashboard"]')).toHaveCount(0);

    await gate.resolve();

    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
  });

  test('shows real projects content immediately even while background queries are pending', async ({ page }) => {
    const gate = deferred();

    await page.route('**/rest/v1/projects**', async (route) => {
      const response = await route.fetch();
      await gate.promise;
      await route.fulfill({ response });
    });

    await page.route('**/rest/v1/contacts**', async (route) => {
      const response = await route.fetch();
      await gate.promise;
      await route.fulfill({ response });
    });

    await page.goto('/staff/projects');

    await expect(portalShellNavigation(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
    await expect(page.locator('main[aria-label="Loading projects"]')).toHaveCount(0);

    await gate.resolve();

    await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({ timeout: 60_000 });
  });

  test('shows the project detail frame on first load without waiting on the snapshot api route', async ({ page }) => {
    const gate = await delayNetworkResponse(page, '**/api/projects/*/snapshot');

    await page.goto('/staff/projects');
    const firstProjectLink = page.locator('a[href^="/staff/projects/proj_"]').first();
    await expect(firstProjectLink).toBeVisible({ timeout: 60_000 });
    const href = await firstProjectLink.getAttribute('href');
    if (!href) throw new Error('Expected a project link on the projects index.');

    await page.goto(`${href}?tab=quotes`);

    await expect(page.locator('[data-project-page-frame="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-project-active-tab="quotes"]')).toBeVisible();

    await gate.resolve();
  });

  test('shows real contacts content immediately while background queries are pending', async ({ page }) => {
    const gate = await delayNetworkResponse(page, '**/rest/v1/contacts**');

    await page.goto('/staff/contacts');

    await expect(portalShellNavigation(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
    await expect(page.locator('main[aria-label="Loading contacts"]')).toHaveCount(0);
    await expect(page.getByText('Loading contacts')).toHaveCount(0);

    await gate.resolve();

    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible({ timeout: 60_000 });
  });

  test('renders the schedule shell with the shared page chrome', async ({ page }) => {
    await page.goto('/staff/schedule');

    await expect(portalShellNavigation(page)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });
  });

  test('verifies the full schedule schema readiness contract through the authenticated app surface', async ({ page }) => {
    await page.goto('/staff/schedule');
    await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });

    const readiness = await page.evaluate(async () => {
      const res = await fetch('/api/staff/v1/schedule/readiness');
      const text = await res.text();
      return {
        status: res.status,
        requestId: res.headers.get('x-portal-request-id'),
        bodyText: text,
      };
    });

    expect(
      readiness.status,
      `Expected /api/staff/v1/schedule/readiness to return 200, got ${readiness.status}.\n${readiness.bodyText}`,
    ).toBe(200);
    expect(readiness.requestId).toBeTruthy();

    const body = JSON.parse(readiness.bodyText) as { ok?: boolean };
    expect(body.ok).toBe(true);
  });

  test('keeps the schedule board search and panel controls responsive', async ({ page }) => {
    await page.goto('/staff/schedule');

    await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });

    const collapse = page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ });
    await expect(collapse).toBeVisible();
    if ((await collapse.getAttribute('aria-expanded')) !== 'true') {
      await collapse.click();
      await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    }

    const search = page.getByPlaceholder('Search projects…');
    await expect(search).toBeVisible();
    await search.fill('alpha');
    await expect(search).toHaveValue('alpha');

    const initialExpanded = await collapse.getAttribute('aria-expanded');

    await collapse.click();
    await expect(collapse).toHaveAttribute('aria-expanded', initialExpanded === 'true' ? 'false' : 'true');
  });

  test('drags an unscheduled schedule job into a crew lane and keeps it scheduled after refresh', async ({ page }) => {
    test.skip(
      process.env.PORTAL_SCHEDULE_DRAG_SMOKE !== '1',
      'Set PORTAL_SCHEDULE_DRAG_SMOKE=1 against a disposable schedule dataset to run the mutating drag/drop smoke test.',
    );

    await page.goto('/staff/schedule');
    await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });

    const sourceCard = page.locator('aside[aria-label="Unscheduled jobs"] [data-schedule-card-id]').first();
    test.skip((await sourceCard.count()) === 0, 'No unscheduled jobs are available for schedule drag/drop smoke coverage.');

    const jobName = (await sourceCard.locator('[title]').first().getAttribute('title'))?.trim();
    test.skip(!jobName, 'The first unscheduled job did not expose a stable project title.');

    const targetLane = page.locator('section[aria-label^="Lane "]').first();
    await expect(targetLane).toBeVisible();

    const assignResponse = page.waitForResponse(
      (res) => res.url().includes('/api/staff/v1/schedule/job/assign') && res.request().method() === 'POST',
      { timeout: 60_000 },
    );
    await sourceCard.dragTo(targetLane);

    const response = await assignResponse;
    expect(response.ok(), `Assign request failed with status ${response.status()}: ${await response.text()}`).toBe(true);
    await expect(targetLane.getByText(jobName!, { exact: false })).toBeVisible({ timeout: 60_000 });

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('section[aria-label^="Lane "]').filter({ hasText: jobName! }).first()).toBeVisible({ timeout: 60_000 });
  });

  test('opens a contact detail page from the list without losing shell chrome', async ({ page }) => {
    await page.goto('/staff/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible({ timeout: 60_000 });

    const href = await firstHref(page, 'section[aria-label="Contacts list"] a[href^="/staff/contacts/"]');
    test.skip(!href, 'No contact detail links are available for smoke coverage.');

    await page.goto(href!);

    await expect(portalShellNavigation(page)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Project' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Contact ID:')).toBeVisible();
  });

  test('opens and closes the shared import modal cleanly', async ({ page }) => {
    await page.goto('/staff/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible({ timeout: 60_000 });

    await page.locator('input[type="file"][accept=".csv,text/csv"]').setInputFiles({
      name: 'contacts.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Name,Email,Phone\nAlice Example,alice@example.com,555-0100\n'),
    });

    const dialog = page.getByRole('dialog', { name: 'Import contacts from CSV' });
    await expect(dialog).toBeVisible({ timeout: 60_000 });

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
  });
});
