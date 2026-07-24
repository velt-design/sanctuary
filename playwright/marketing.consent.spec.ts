import { expect, test, type Page } from '@playwright/test';

const OPTIONAL_RUNTIME_PATHS = [
  '/runtime-ga.js',
  '/runtime-meta.js',
  '/runtime-archipro.js',
];

async function recordOptionalRequests(page: Page): Promise<string[]> {
  const requests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (
      OPTIONAL_RUNTIME_PATHS.some((path) => url.includes(path))
      || url.includes('googletagmanager.com')
      || url.includes('google-analytics.com')
      || url.includes('connect.facebook.net')
      || url.includes('facebook.com/tr')
      || url.includes('pixel.archipro.co.nz')
    ) {
      requests.push(url);
    }
  });
  return requests;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
  await context.addInitScript(() => localStorage.removeItem('sp_consent_v1'));
});

test('sends no optional vendor requests before an explicit choice or after essential-only', async ({ page }) => {
  const requests = await recordOptionalRequests(page);
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Cookie preferences' })).toBeVisible();
  await page.waitForTimeout(4_000);
  expect(requests).toEqual([]);

  await page.getByRole('button', { name: 'Essential only' }).click();
  await page.waitForTimeout(4_000);
  expect(requests).toEqual([]);
  await expect(page.locator('iframe[src*="googletagmanager.com"]')).toHaveCount(0);
});

test('loads analytics and marketing vendors only after both categories are accepted', async ({ page }) => {
  const requests = await recordOptionalRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Accept all' }).click();

  await expect.poll(() => requests.some((url) => url.includes('googletagmanager.com/gtm.js'))).toBe(true);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-ga.js'))).toBe(true);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-meta.js'))).toBe(true);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-archipro.js'))).toBe(true);
});

test('respects category-specific choices', async ({ page }) => {
  const requests = await recordOptionalRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage choices' }).click();
  await page.getByRole('checkbox', { name: 'Analytics cookies' }).check();
  await page.getByRole('button', { name: 'Save choices' }).click();

  await expect.poll(() => requests.some((url) => url.includes('/runtime-ga.js'))).toBe(true);
  await page.waitForTimeout(4_000);
  expect(requests.some((url) => url.includes('/runtime-meta.js'))).toBe(false);
  expect(requests.some((url) => url.includes('/runtime-archipro.js'))).toBe(false);
  expect(requests.some((url) => url.includes('googletagmanager.com/gtm.js'))).toBe(true);
});
