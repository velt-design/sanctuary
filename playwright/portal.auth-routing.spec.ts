import { expect, test, type Page } from '@playwright/test';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function delayNetworkResponse(page: Page, pattern: string) {
  const gate = deferred();
  await page.route(pattern, async (route) => {
    const response = await route.fetch();
    await gate.promise;
    await route.fulfill({ response });
  });
  return gate;
}

async function firstHref(page: Page, selector: string): Promise<string | null> {
  const link = page.locator(selector).first();
  const count = await link.count();
  if (!count) return null;
  await expect(link).toBeVisible({ timeout: 60_000 });
  return link.getAttribute('href');
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
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  });

  test('renders public login and access-status pages without portal navigation chrome', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Staff Login' })).toBeVisible();
    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toHaveCount(0);
    await expect(page.getByLabel('Sidebar reveal lab')).toHaveCount(0);

    await page.goto('/access-status?state=no-access&callbackUrl=%2Fdashboard');
    await expect(page.getByRole('heading', { name: 'Access not assigned' })).toBeVisible();
    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toHaveCount(0);
    await expect(page.getByLabel('Sidebar reveal lab')).toHaveCount(0);
  });
});

test.describe('portal auth routing authenticated flows', () => {
  test('redirects authenticated /login visits to the callback destination', async ({ page }) => {
    await page.goto('/login?callbackUrl=%2Fstaff%2Fcontacts');
    await page.waitForURL((url) => url.pathname === '/staff/contacts', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  });

  test('keeps the shell visible while the dashboard data is loading', async ({ page }) => {
    const gate = await delayNetworkResponse(page, '**/api/dashboard**');

    await page.goto('/dashboard');

    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('main[aria-label="Loading dashboard"]')).toHaveCount(0);

    gate.resolve();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });
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

    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    await expect(page.locator('main[aria-label="Loading projects"]')).toHaveCount(0);

    gate.resolve();

    await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 60_000 });
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

    gate.resolve();
  });

  test('shows the shared list skeleton for contacts while queries are pending', async ({ page }) => {
    const gate = await delayNetworkResponse(page, '**/rest/v1/contacts**');

    await page.goto('/staff/contacts');

    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible();
    await expect(page.locator('main[aria-label="Loading contacts"]')).toBeVisible();
    await expect(page.getByText('Loading contacts')).toHaveCount(0);

    gate.resolve();

    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible({ timeout: 60_000 });
  });

  test('renders the schedule shell with the shared page chrome', async ({ page }) => {
    await page.goto('/staff/schedule');

    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible({ timeout: 60_000 });
  });

  test('keeps the schedule board search and panel controls responsive', async ({ page }) => {
    await page.goto('/staff/schedule');

    await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible({ timeout: 60_000 });

    const search = page.getByPlaceholder('Search projects…');
    await expect(search).toBeVisible();
    await search.fill('alpha');
    await expect(search).toHaveValue('alpha');

    const collapse = page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ });
    const initialExpanded = await collapse.getAttribute('aria-expanded');

    await collapse.click();
    await expect(collapse).toHaveAttribute('aria-expanded', initialExpanded === 'true' ? 'false' : 'true');
  });

  test('opens a contact detail page from the list without losing shell chrome', async ({ page }) => {
    await page.goto('/staff/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible({ timeout: 60_000 });

    const href = await firstHref(page, 'a[href^="/staff/contacts/"]');
    test.skip(!href, 'No contact detail links are available for smoke coverage.');

    await page.goto(href!);

    await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create Project' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Contact ID:')).toBeVisible();
  });

  test('opens and closes the shared import modal cleanly', async ({ page }) => {
    await page.goto('/staff/contacts');
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible({ timeout: 60_000 });

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
