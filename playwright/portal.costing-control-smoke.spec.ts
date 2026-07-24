import { expect, test } from '@playwright/test';

test.skip(
  process.env.PORTAL_TEST_ROLE?.trim().toLowerCase() !== 'admin',
  'Set PORTAL_TEST_ROLE=admin and use an admin test account for costing-control browser coverage.',
);

test('Pricebook opens the admin costing control centre without runtime errors', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/pricebook');

  await expect(page).toHaveURL(/\/admin\/costing$/);
  await expect(page.getByRole('heading', { name: 'Costing control centre', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Version history', level: 2 })).toBeVisible();
  await expect(page.getByLabel('Pricing configuration status')).toContainText('Active pricing');
  await expect(page.getByRole('link', { name: 'Costing control centre', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Calculator', exact: true })).toBeVisible();

  const configurationResponse = await page.request.get('/api/admin/costing/configurations');
  expect(configurationResponse.status()).toBe(200);
  expect(configurationResponse.headers()['cache-control']).toContain('no-store');

  const estimatesResponse = await page.request.get('/api/admin/costing/estimates');
  expect(estimatesResponse.status()).toBe(200);
  expect(estimatesResponse.headers()['cache-control']).toContain('no-store');

  expect(pageErrors).toEqual([]);

  const screenshotPath = process.env.COSTING_SCREENSHOT_PATH;
  if (screenshotPath) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
});
