import { expect, test, type Page } from '@playwright/test';
import { LANDING_PRICE_CELLS } from '../apps/marketing/lib/landingPriceTable';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from '../apps/marketing/lib/configuratorPriceLease';

const path = '/aluminium-pergolas-auckland';
const events = (page: Page) => page.evaluate(() => (window as unknown as { captured: { name: string; properties: Record<string, unknown> }[] }).captured);
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
  await page.route('**/api/landing-price-table', route => route.fulfill({ json: { status: 'ready', leaseMs: 30000, table: { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 1, currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) } } }));
  await page.route('**/api/configurator-price', route => route.fulfill({ headers: { [CONFIGURATOR_PRICE_LEASE_HEADER]: '30000', [CONFIGURATOR_PRICE_PUBLICATION_HEADER]: 'b'.repeat(64) }, json: { status: 'priced', amountIncGst: 16665, calculationRef: 'cf1.synthetic-browser-fixture', currency: 'NZD', includesGst: true, breakdown: [{ label: 'Synthetic fixture structure and selected options', amountIncGst: 16665 }] } }));
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: true, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
    const target = window as unknown as { captured: unknown[]; gtag: (...args: unknown[]) => void };
    target.captured = []; target.gtag = (kind, name, properties) => { if (kind === 'event') target.captured.push({ name, properties }); };
  });
});

for (const width of [390, 1440]) test(`aluminium optional enquiry and complete 3D return at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: 503, json: { ok: false, error: 'Synthetic retry fixture' } }); });
  await page.goto(path);
  await expect(page.locator('h1')).toHaveText('Aluminium pergolas.Made to belong.');
  await expect(page.locator('header.site')).toHaveCount(1);
  await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
  expect((await page.title()).match(/Sanctuary/g)).toHaveLength(1);
  await expect(page.locator('[data-estimate-state]')).toHaveAttribute('data-estimate-state', 'priced');
  expect((await events(page)).filter(event => event.name.startsWith('design_'))).toEqual([]);
  const projectBounds = await page.locator('#roof-options article > a').evaluateAll(links => links.map(link => {
    const box = link.getBoundingClientRect(); const img = link.querySelector('img')!.getBoundingClientRect();
    return { display: getComputedStyle(link).display, position: getComputedStyle(link).position, width: box.width, height: box.height, imageContained: img.top >= box.top - 1 && img.bottom <= box.bottom + 1 };
  }));
  for (const bounds of projectBounds) expect(bounds).toMatchObject({ position: 'relative', imageContained: true });
  await page.getByRole('link', { name: 'Explore roof options', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Daylight, warmth, or a little of both.' })).toBeInViewport();
  await page.getByRole('link', { name: 'Discuss your pergola', exact: true }).click();
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('[name=name]').fill('Synthetic Aluminium Browser');
  await form.locator('[name=email]').fill('aluminium@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.locator('[name=phone]').fill('bad');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(form.getByText('Enter a valid phone number.', { exact: true })).toBeVisible();
  expect(payloads).toHaveLength(0);
  await form.locator('[name=phone]').fill('');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0].customerDesign).toBeUndefined();
  await expect(form.getByRole('alert')).toBeFocused();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('radio', { name: 'Mixed + timber', exact: true }).check();
  await page.locator('summary').filter({ hasText: /^Review your design$/ }).click();
  await page.getByRole('link', { name: 'Customise in 3D', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await expect(dialog).toBeVisible();
  if (width < 720) {
    await dialog.getByRole('button', { name: 'Set your size', exact: true }).click();
    await dialog.getByRole('button', { name: 'Add sides & lighting', exact: true }).click();
    await dialog.getByRole('button', { name: 'Next side configuration', exact: true }).click();
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.getByRole('button', { name: 'Review your design', exact: true }).click();
    await dialog.getByRole('button', { name: 'Enquire', exact: true }).click();
  } else {
    await expect(dialog.locator('canvas')).toBeVisible();
    await dialog.getByRole('checkbox', { name: 'Gable infills', exact: true }).check();
    await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
    await dialog.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  }
  await expect(dialog).not.toBeVisible();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Aluminium Browser');
  await expect(page.getByText('Your selected design is included', { exact: true })).toBeVisible();
  await expect(page.locator('[data-estimate-state]')).toHaveAttribute('data-estimate-state', 'priced');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ phone: '', page: path, customerDesign: { input: { widthMm: 5400 }, roof: { finish: { material: 'combination' } } } });
  if (width >= 720) expect(payloads[1].customerDesign.roof.infills).toBe(true);
  else expect(payloads[1].customerDesign.roof.blinds.length).toBeGreaterThan(0);
  for (const name of ['design_start', 'design_review', 'design_enquiry_open']) expect((await events(page)).filter(event => event.name === name)).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.4');
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Aluminium Browser');
  await page.getByRole('link', { name: 'Customise in 3D', exact: true }).click();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('aluminium unavailable pricing preserves direct enquiry and all phone research targets', async ({ page }, info) => {
  await page.route('**/api/*price*', route => route.fulfill({ json: { status: 'unavailable' } }));
  await page.goto(path);
  await expect(page.locator('[data-estimate-state]')).toHaveAttribute('data-estimate-state', 'unavailable');
  await expect(page.getByRole('button', { name: 'Send my enquiry' })).toBeEnabled();
  for (const width of [320, 390, 820, 1440, 2560]) {
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    const answer = page.locator('summary').filter({ hasText: 'What if my home is near the coast?' });
    await answer.click(); await expect(answer.locator('..')).toContainText('actual exposure'); await answer.click();
    await page.screenshot({ path: info.outputPath(`aluminium-${width}.png`), fullPage: true });
  }
});

test('aluminium native form retains optional phone and project-discussion intent without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage(); let body = '';
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => { body = route.request().postData() ?? ''; return route.fulfill({ contentType: 'text/plain', body: 'Synthetic native receipt. No delivery.' }); });
  try {
    await page.goto(path);
    const form = page.locator('form[data-inline-enquiry]');
    await form.locator('[name=name]').fill('Synthetic Native'); await form.locator('[name=email]').fill('native@example.invalid'); await form.locator('[name=suburb]').fill('Albany');
    await expect(form.locator('[name=phone]')).not.toHaveAttribute('required');
    await expect(form.locator('[name=files]')).toBeDisabled();
    await form.getByRole('button', { name: 'Send my enquiry' }).click();
    await expect.poll(() => body).toContain('requestType=project-discussion');
    const payload = new URLSearchParams(body); expect(payload.get('page')).toBe(path); expect(payload.get('phone')).toBe(''); expect(payload.has('customerDesign')).toBe(false);
  } finally { await context.close(); }
});

test('aluminium optional photos validate, remove and recover from a failed upload before enquiry', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ json: { ok: true } }); });
  await page.route('**/api/enquiry/attachments/sign', route => route.fulfill({ status: 503, json: { error: 'Synthetic unavailable signing' } }));
  await page.goto(path);
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('summary').filter({ hasText: 'Add photos or plans (optional)' }).click();
  const picker = form.locator('[name=files]');
  await picker.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('synthetic') });
  await expect(form.locator('#contact-files-error')).toContainText('Attachments must be PDF, JPG, PNG, or WebP');
  const picture = { name: 'site.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) };
  await picker.setInputFiles(picture);
  await expect(form.locator('#contact-files-error')).toHaveCount(0);
  await expect(form.getByRole('alert')).toHaveCount(0);
  await form.getByRole('button', { name: 'Remove site.png' }).click();
  await expect(form.getByRole('list', { name: 'Selected files' })).toHaveCount(0);
  await picker.setInputFiles(picture);
  await form.locator('[name=name]').fill('Synthetic Attachment');
  await form.locator('[name=email]').fill('attachments@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(form.getByRole('alert')).toContainText('We could not upload your attachments');
  expect(payloads).toHaveLength(0);
  await expect(form.getByRole('button', { name: 'Remove site.png' })).toBeVisible();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Attachment');
  // Storage is deliberately denied in this review runtime. The real signed-upload
  // handoff is exercised with a mocked Storage client in configuredFormRecovery.
  await form.getByRole('button', { name: 'Remove site.png' }).click();
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({ phone: '', files: [], uploadSessionToken: null });
  expect(payloads[0].customerDesign).toBeUndefined();
});
