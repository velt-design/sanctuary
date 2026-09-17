import { expect, test } from '@playwright/test';

// These intercept the vendor boundary; real dashboard/replay receipt is separate.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
  await page.route('https://www.clarity.ms/tag/**', route => route.fulfill({ contentType: 'application/javascript', body: `
    window.__clarityCalls = window.clarity.q || [];
    window.clarity = (...args) => window.__clarityCalls.push(args);
  ` }));
});

test('analytics consent gates load and withdrawal stops the replay runtime', async ({ page }) => {
  const tags: string[] = [];
  page.on('request', request => { if (request.url().includes('clarity.ms/tag/')) tags.push(request.url()); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Manage choices' })).toBeVisible();
  expect(tags).toEqual([]);
  await page.getByRole('button', { name: 'Manage choices' }).click();
  await page.getByRole('checkbox', { name: 'Analytics cookies' }).check();
  await page.getByRole('button', { name: 'Save choices' }).click();
  await expect.poll(() => tags.length).toBe(1);
  await page.getByRole('link', { name: 'Privacy', exact: true }).click();
  await page.getByRole('button', { name: 'Manage cookie preferences' }).click();
  await page.getByRole('button', { name: 'Essential only' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __clarityCalls: unknown[][] }).__clarityCalls.some(row => row[0] === 'stop'))).toBe(true);
  expect(tags).toHaveLength(1);
});

test('private/staff URLs never load Clarity even with analytics allowed', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: true, marketing: false, version: 1, updatedAt: new Date().toISOString() })));
  const tags: string[] = [];
  page.on('request', request => { if (request.url().includes('clarity.ms/tag/')) tags.push(request.url()); });
  await page.goto('/design-enquiry?staff_project=synthetic-private');
  await expect(page.locator('body')).toBeVisible();
  await expect(page.locator('#sp-clarity')).toHaveCount(0);
  expect(tags).toEqual([]);
});

for (const width of [390, 1440]) test(`public design controls and stage labels work at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: true, marketing: false, version: 1, updatedAt: new Date().toISOString() })));
  await page.goto('/');
  await expect(page.locator('#sp-clarity')).toHaveCount(1);
  await page.getByRole('radio', { name: /Sanctuary’s 3D designer/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('slider', { name: 'Width', exact: true }).press('ArrowLeft');
  await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __clarityCalls: unknown[][] }).__clarityCalls.filter(row => row[0] === 'event').map(row => row[1]))).toEqual(expect.arrayContaining(['design_start', 'design_edit', 'design_review']));
  await dialog.getByRole('link', { name: 'Enquire about this design ↗' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
  expect(page.url()).toContain('project_direction=cover');
  await expect(page.locator('form[data-clarity-mask="true"]')).toHaveCount(1);
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Synthetic verification');
  await expect.poll(() => page.evaluate(() => (window as unknown as { sanctuaryClarityActive: boolean }).sanctuaryClarityActive)).toBe(true);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue('Synthetic verification');
  await expect(page.locator('body')).toBeVisible();
});
