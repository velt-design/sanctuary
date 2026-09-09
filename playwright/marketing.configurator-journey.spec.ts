import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: '2026-09-09T00:00:00.000Z', version: 1 }));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (url: string) => { (window as unknown as { copiedDesign: string }).copiedDesign = url; } } });
  });
  await page.route('**/api/simple-cover-price', async request => {
    const input = request.request().postDataJSON();
    await request.fulfill({ json: { ok: true, status: 'priced', input, areaM2: input.widthMm * input.projectionMm / 1e6,
      price: { fromIncGst: 11500, currency: 'NZD' }, calculationRef: `sc1.fresh-${input.widthMm}-${input.projectionMm}`,
      configuration: { versionNumber: 23 }, plan: { postPositions: [0, .5, 1], rafterPositions: [0, 1] }, postCount: 3, postSpacingMm: 3000 } });
  });
  await page.route('**/api/enquiry', request => request.fulfill({ json: { ok: true } }));
});

for (const width of [360, 390, 1440]) test(`reachable action, roof guidance and compact enquiry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/configurator-preview?open=1');
  const next = page.getByRole('link', { name: 'Continue with this design' });
  await expect(next).toBeInViewport();
  const before = (await next.boundingBox())!;
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toHaveAccessibleDescription(/raised centre/);
  await expect(page.getByText('A raised centre brings extra height and an airy feel.')).toBeVisible();
  await page.getByRole('radio', { name: 'Elevated', exact: true }).check();
  expect((await next.boundingBox())!.y).toBeCloseTo(before.y, 0);
  await expect(next).toBeInViewport();
  await next.click();
  await page.getByRole('link', { name: 'Project details ↓', exact: true }).click();
  await expect(page.getByLabel('Project suburb Optional')).toBeInViewport();
  const details = page.getByLabel('Design included with your enquiry').locator('details');
  await expect(details).not.toHaveAttribute('open');
  await details.locator('summary').click();
  await expect(details).toContainText('Elevated');
  await page.getByRole('link', { name: 'Edit your design ↑', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
});

test('copy link opens the exact design in an independent browser and edits survive refresh', async ({ page, browser }) => {
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('radio', { name: 'Away from house', exact: true }).check();
  await page.getByLabel('Gable infills', { exact: true }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.2');
  await page.getByRole('button', { name: 'Copy design link', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toBeVisible();
  const url = await page.evaluate(() => (window as unknown as { copiedDesign: string }).copiedDesign);
  expect(url).toContain('#design=1.gable.7200.3000.ground.facade.away.1');
  const recipient = await browser.newContext();
  try {
    const opened = await recipient.newPage();
    await opened.goto(url);
    await expect(opened.getByRole('radio', { name: 'Gable', exact: true })).toBeChecked();
    await expect(opened.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('7.2');
    await expect(opened.getByLabel('Gable infills', { exact: true })).toBeChecked();
    expect(opened.url()).not.toContain('#design=');
    await opened.getByRole('textbox', { name: 'Width in metres' }).fill('6.4');
    await opened.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
    await opened.reload();
    await expect(opened.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.4');
  } finally { await recipient.close(); }
});

test('shared pitched link wins over an existing draft and requests only its fresh estimate', async ({ page }) => {
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('radio', { name: 'Box perimeter', exact: true }).check();
  const prices: unknown[] = [];
  page.on('request', req => { if (req.url().endsWith('/api/simple-cover-price')) prices.push(req.postDataJSON()); });
  await page.goto('/configurator-preview?open=1#design=1.mono.6400.3200.ground.facade.parallel.0');
  await expect(page.getByRole('region', { name: 'Estimated price' })).toContainText('$11,500');
  expect(prices).toEqual([{ widthMm: 6400, projectionMm: 3200, level: 'ground', connection: 'facade' }]);
  await page.getByRole('link', { name: 'Continue with this design' }).click();
  await expect(page.getByLabel('Design included with your enquiry')).toContainText('6.4 m wide');
});

test('invalid links preserve the current draft and clipboard denial offers a selectable link', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new DOMException('Denied', 'NotAllowedError'); } } }));
  await page.goto('/configurator-preview?open=1#design=2.bad-data');
  await expect(page.getByText('This design link could not be opened.', { exact: false })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.0');
  await page.getByRole('button', { name: 'Copy design link', exact: true }).click();
  await expect(page.getByLabel('Design link', { exact: true })).toHaveValue(/#design=1.mono.6000/);
});

test('native sharing receives the current design and cancellation remains quiet', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async (data: ShareData) => {
    (window as unknown as { sharedDesign: ShareData }).sharedDesign = data;
    throw new DOMException('Cancelled', 'AbortError');
  } }));
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('button', { name: 'Share…', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { sharedDesign: ShareData }).sharedDesign.url)).toContain('#design=1.mono.6000.3000');
  await expect(page.getByLabel('Design link', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Share menu opened.', { exact: true })).toHaveCount(0);
});
