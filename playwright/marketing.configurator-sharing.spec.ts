import { expect, test } from '@playwright/test';

const key = 'sanctuary.configurator-preview.v1';
const popup = '/configurator-preview?open=1';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: '2026-09-09T00:00:00.000Z', version: 1 })));
  await page.route('**/api/simple-cover-price', async request => {
    const input = request.request().postDataJSON();
    await request.fulfill({ json: { ok: true, status: 'priced', input, areaM2: input.widthMm * input.projectionMm / 1e6,
      price: { fromIncGst: 11500, currency: 'NZD' }, calculationRef: `sc1.fresh-${input.widthMm}-${input.projectionMm}`,
      configuration: { versionNumber: 23 }, plan: { postPositions: [0, .5, 1], rafterPositions: [0, 1] }, postCount: 3, postSpacingMm: 3000 } });
  });
  await page.route('**/api/enquiry', request => request.fulfill({ json: { ok: true } }));
});

for (const width of [390, 1440]) test(`design follows both previews, refresh and browser back at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(popup);
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('radio', { name: 'Away from house', exact: true }).check();
  await page.getByLabel('Gable infills', { exact: true }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.2');
  await page.getByRole('textbox', { name: 'Projection in metres' }).fill('4.1');
  await page.getByRole('radio', { name: 'Elevated', exact: true }).check();
  await page.getByRole('link', { name: 'Continue with this design' }).click();
  await expect(page).toHaveURL(/contact\?configurator=preview/);
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('7.2');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Projection in metres' })).toHaveValue('4.1');
  await expect(page.getByRole('radio', { name: 'Away from house', exact: true })).toBeChecked();
  await expect(page.getByLabel('Gable infills', { exact: true })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Elevated', exact: true })).toBeChecked();
  await expect(page.getByLabel('Design included with your enquiry')).toContainText('7.2 m wide');
  await page.getByRole('radio', { name: 'Box perimeter', exact: true }).check();
  await page.getByRole('link', { name: 'Back to exploring' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Box perimeter', exact: true })).toBeChecked();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('6.8');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.goBack();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.8');
  await expect(page.getByRole('radio', { name: 'Box perimeter', exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  expect(await page.evaluate(() => window.scrollY + document.body.scrollTop)).toBe(0);
});

test('last size edit carries across and only a fresh estimate enters the enquiry', async ({ page }) => {
  await page.goto(popup);
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.0');
  // Clicking Continue commits the focused field via blur without an explicit Enter.
  await page.getByRole('link', { name: 'Continue with this design' }).click();
  await expect(page).toHaveURL(/contact\?configurator=preview/);
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('7.0');
  const prices: unknown[] = [];
  page.on('request', request => { if (request.url().endsWith('/api/simple-cover-price')) prices.push(request.postDataJSON()); });
  await page.reload();
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('$11,500');
  expect(prices).toEqual([{ widthMm: 7000, projectionMm: 3000, level: 'ground', connection: 'facade' }]);
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await page.getByLabel('Name Required').fill('Preview Test');
  await page.getByLabel('Phone Required').fill('021 234 5678');
  await page.getByLabel('Email Required').fill('preview@example.com');
  const submission = page.waitForRequest('**/api/enquiry');
  await page.locator('#contact-form button[type="submit"]').click();
  expect((await submission).postDataJSON()).toMatchObject({ calculationRef: 'sc1.fresh-7000-3000' });
  const saved = await page.evaluate(key => sessionStorage.getItem(key), key);
  expect(JSON.parse(saved!)).toEqual({ version: 1, input: { widthMm: 7000, projectionMm: 3000, connection: 'facade', level: 'ground' }, roof: { family: 'mono', orientation: 'parallel', infills: false } });
});

test('corrupt saved data starts a usable default design', async ({ page }) => {
  await page.addInitScript(key => sessionStorage.setItem(key, '{broken json'), key);
  await page.goto(popup);
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.0');
  await expect(page.getByText('cannot be saved for a page refresh', { exact: false })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('6.2');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  expect(await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).input.widthMm, key)).toBe(6200);
});

test('blocked storage keeps design in memory through both preview links', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } }));
  await page.goto(popup);
  await page.getByRole('radio', { name: 'Box perimeter', exact: true }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('6.4');
  await page.getByRole('link', { name: 'Continue with this design' }).click();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.4');
  await expect(page.getByRole('radio', { name: 'Box perimeter', exact: true })).toBeChecked();
  await expect(page.getByText('cannot be saved for a page refresh', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Back to exploring' }).click();
  await expect(page.getByRole('radio', { name: 'Box perimeter', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.4');
});
