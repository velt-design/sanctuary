import { expect, test, type Page } from '@playwright/test';

const route = '/contact?configurator=preview';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: '2026-09-09T00:00:00.000Z', version: 1 })));
  await page.route('**/api/simple-cover-price', async request => {
    const input = request.request().postDataJSON();
    await request.fulfill({ json: { ok: true, status: 'priced', input, areaM2: input.widthMm * input.projectionMm / 1e6,
      price: { fromIncGst: 11500, currency: 'NZD' }, calculationRef: `sc1.preview-${input.widthMm}-${input.projectionMm}`,
      configuration: { versionNumber: 23 }, plan: { postPositions: [0, .5, 1], rafterPositions: [0, 1] }, postCount: 3, postSpacingMm: 3000 } });
  });
  // Never create real leads from the browser review.
  await page.route('**/api/enquiry', request => request.fulfill({ json: { ok: true } }));
});

async function fillDetails(page: Page) {
  await page.getByLabel('Name Required').fill('Preview Test');
  await page.getByLabel('Phone Required').fill('021 234 5678');
  await page.getByLabel('Email Required').fill('preview@example.com');
}

for (const width of [360, 390, 1440]) test(`fixed viewer and project questions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 360 ? 740 : 900 });
  await page.goto(route);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /position/);
  const viewer = page.getByRole('region', { name: 'Pergola views' });
  const before = (await viewer.boundingBox())!;
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tell us about your space.' })).toBeInViewport();
  await fillDetails(page);
  expect((await viewer.boundingBox())!.y).toBeCloseTo(before.y, 0);
  expect((await viewer.boundingBox())!.height).toBeCloseTo(before.height, 0);
  const scroll = await page.getByRole('complementary', { name: 'Your pergola choices' }).evaluate(el => el.scrollTop);
  expect(scroll).toBeGreaterThan(200);
  expect(await page.evaluate(() => window.scrollY + document.body.scrollTop)).toBe(0);
  await page.getByRole('link', { name: 'Design', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toBeInViewport();
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await expect(page.getByLabel('Name Required')).toHaveValue('Preview Test');
  await expect(page.getByLabel('Design included with your enquiry')).toContainText('Gable acrylic pergola');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
});

for (const family of ['Pitched', 'Gable', 'Box perimeter']) test(`${family}: current design reaches the existing enquiry endpoint`, async ({ page }) => {
  const submissions: Record<string, unknown>[] = [];
  await page.route('**/api/enquiry', async request => { submissions.push(request.request().postDataJSON()); await request.fulfill({ json: { ok: true } }); });
  await page.goto(route);
  await page.getByRole('radio', { name: family, exact: true }).check();
  const width = page.getByRole('textbox', { name: 'Width in metres' });
  await width.fill('7.0'); await width.press('Enter');
  if (family === 'Gable') {
    await page.getByRole('radio', { name: 'Away from house', exact: true }).check();
    await page.getByLabel('Gable infills', { exact: true }).check();
  }
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await fillDetails(page);
  await page.locator('#contact-message').fill('Keep the garden view open.');
  const submit = page.locator('#contact-form button[type="submit"]');
  if (family === 'Pitched') await expect(submit).toHaveText('Request a site measure');
  await submit.click();
  await expect(page.locator('.contact-success')).toBeVisible();
  expect(submissions).toHaveLength(1);
  const payload = submissions[0]!;
  expect(payload).toMatchObject({ enquiryType: 'residential', name: 'Preview Test', roofMaterials: ['acrylic'],
    style: family === 'Pitched' ? 'pitched' : family === 'Gable' ? 'gable' : 'perimeter',
    calculationRef: family === 'Pitched' ? 'sc1.preview-7000-3000' : null,
    dimensions: { widthM: family === 'Pitched' ? null : 7, depthM: family === 'Pitched' ? null : 3, heightM: null } });
  expect(payload.message).toContain('Keep the garden view open.');
  expect(payload.message).toContain('7.0 m wide');
  if (family === 'Gable') { expect(payload.message).toContain('Dutch-gable fascia'); expect(payload.message).toContain('Gable infills included'); }
  expect(page.url()).not.toMatch(/preview@example|7000|sc1\./);
});

test('pricing failure and enquiry retry retain details and the submission identity', async ({ page }) => {
  await page.route('**/api/simple-cover-price', request => request.fulfill({ status: 503, json: { ok: false, status: 'unavailable', message: 'Unavailable' } }));
  const submissions: Record<string, unknown>[] = [];
  await page.route('**/api/enquiry', async request => { submissions.push(request.request().postDataJSON()); await request.fulfill({ status: submissions.length === 1 ? 503 : 200, json: submissions.length === 1 ? { ok: false, error: 'Please try again.' } : { ok: true } }); });
  await page.goto(route);
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await page.locator('#contact-form button[type="submit"]').click();
  await expect(page.locator('#contact-error-summary')).toBeFocused();
  await fillDetails(page);
  await page.locator('#contact-form button[type="submit"]').click();
  await expect(page.getByRole('heading', { name: 'Your enquiry was not sent.' })).toBeVisible();
  await expect(page.getByLabel('Name Required')).toHaveValue('Preview Test');
  await page.locator('#contact-form button[type="submit"]').click();
  await expect(page.locator('.contact-success')).toBeVisible();
  expect(submissions[1]?.submissionId).toBe(submissions[0]?.submissionId);
  expect(submissions[1]).toMatchObject({ calculationRef: null, simpleCoverStatus: 'unavailable', dimensions: { widthM: 6, depthM: 3 } });
});

test('mobile expansion and attachment detail preserve the enquiry layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera', /position/);
  await page.getByRole('button', { name: 'Expand view', exact: true }).click();
  expect((await page.getByRole('region', { name: 'Pergola views' }).boundingBox())!.height).toBeGreaterThan(700);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Expand view', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'About Soffit brackets attachment', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Soffit brackets attachment detail' })).toBeVisible();
  await page.getByRole('button', { name: 'Close attachment detail' }).click();
  await page.setViewportSize({ width: 667, height: 375 });
  const viewer = (await page.getByRole('region', { name: 'Pergola views' }).boundingBox())!;
  expect(viewer.height).toBeGreaterThan(240);
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tell us about your space.' })).toBeInViewport();
});
