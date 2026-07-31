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

test('keeps first-visit consent early in keyboard order and clear of the homepage action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const banner = page.getByRole('region', { name: 'Cookie preferences' });
  const primaryAction = page.getByRole('link', { name: 'Find a relevant project' });
  await expect(banner).toBeVisible();
  await expect(primaryAction).toBeVisible();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(banner.getByRole('link', { name: 'Privacy Policy' })).toBeFocused();

  const clearance = await Promise.all([
    primaryAction.boundingBox(),
    banner.boundingBox(),
  ]);
  expect(clearance[0]).not.toBeNull();
  expect(clearance[1]).not.toBeNull();
  expect(clearance[0]!.y + clearance[0]!.height)
    .toBeLessThanOrEqual(clearance[1]!.y - 8);

  for (const button of await banner.getByRole('button').all()) {
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
});

test('moves focus into reopened consent preferences and restores the opener', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/privacy');
  await page.getByRole('button', { name: 'Essential only' }).click();

  const opener = page.getByRole('button', { name: 'Manage cookie preferences' });
  await opener.click();
  await expect(page.getByRole('button', { name: 'Essential only' })).toBeFocused();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(opener).toBeFocused();
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
  expect(requests.some((url) => url.includes('/runtime-ga.js'))).toBe(false);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-meta.js'))).toBe(true);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-archipro.js'))).toBe(true);
});

test('gives NZ visitors a bannerless automatic tracking experience', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-vercel-ip-country': 'NZ' });
  const requests = await recordOptionalRequests(page);
  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Cookie preferences' })).toHaveCount(0);
  await expect.poll(() => requests.some((url) => url.includes('googletagmanager.com/gtm.js'))).toBe(true);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-meta.js'))).toBe(true);
  await expect.poll(() => requests.some((url) => url.includes('/runtime-archipro.js'))).toBe(true);
});

test('respects category-specific choices', async ({ page }) => {
  const requests = await recordOptionalRequests(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Manage choices' }).click();
  await page.getByRole('checkbox', { name: 'Analytics cookies' }).check();
  await page.getByRole('button', { name: 'Save choices' }).click();

  await expect.poll(() => requests.some((url) => url.includes('googletagmanager.com/gtm.js'))).toBe(true);
  await page.waitForTimeout(4_000);
  expect(requests.some((url) => url.includes('/runtime-ga.js'))).toBe(false);
  expect(requests.some((url) => url.includes('/runtime-meta.js'))).toBe(false);
  expect(requests.some((url) => url.includes('/runtime-archipro.js'))).toBe(false);
  expect(requests.some((url) => url.includes('googletagmanager.com/gtm.js'))).toBe(true);
});
