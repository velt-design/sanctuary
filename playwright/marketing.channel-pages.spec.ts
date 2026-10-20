import { expect, test, type Page } from '@playwright/test';

const channels = ['/ads/outdoor-living', '/ads/acrylic-pergolas', '/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas', '/pergolas-auckland', '/acrylic-roof-pergolas-auckland'];
async function events(page: Page) {
  return page.evaluate(() => (window as unknown as { captured: { name: string; properties: Record<string, unknown> }[] }).captured);
}
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', r => new URL(r.request().url()).origin === new URL(baseURL!).origin ? r.continue() : r.abort());
  await page.route('**/api/enquiry**', r => r.abort()); // Includes native fallback, installed before any input.
  await page.route('**/api/tracking-region', r => r.fulfill({ json: { policy: 'consent_required' } }));
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: true, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
    const target = window as unknown as { captured: unknown[]; gtag: (...args: unknown[]) => void };
    target.captured = [];
    target.gtag = (kind, name, properties) => { if (kind === 'event') target.captured.push({ name, properties }); };
  });
});

for (const route of channels) test(`${route}: correct channel, deliberate inline review and responsive layout`, async ({ page }, info) => {
  await page.goto(route);
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toBeEnabled();
  await expect(page.locator('[data-estimate-state]').first()).toHaveAttribute('data-estimate-state', 'priced');
  await expect(page).toHaveURL(route);
  const seo = !route.startsWith('/ads/');
  await expect(page.locator('header.site')).toHaveCount(seo ? 1 : 0);
  await expect(page.locator('[data-site-footer]')).toHaveCount(seo ? 1 : 0);
  if (route === '/acrylic-roof-pergolas-auckland' || route === '/ads/facebook/acrylic-pergolas') {
    const hero = page.locator('[aria-labelledby="acrylic-hero-title"]');
    await expect(hero.getByText('PERGOLAS', { exact: true })).toHaveCount(seo ? 0 : 1);
  }
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
  if (!seo) await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, nofollow');
  else await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
  expect((await page.title()).match(/Sanctuary/g)?.length ?? 0).toBeLessThanOrEqual(1);
  expect((await events(page)).filter(e => e.name.startsWith('design_'))).toEqual([]);
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  const review = page.locator('summary').filter({ hasText: /^Review your design$/ });
  await expect(review).toBeVisible();
  await review.click(); await review.click(); await review.click();
  await expect(review.locator('..')).toContainText('5.4');
  for (const name of ['design_start', 'design_review']) expect((await events(page)).filter(e => e.name === name)).toHaveLength(1);
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : width === 820 ? 1180 : 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath(`channel-${width}.png`), fullPage: true });
  }
});

test('SEO standalone designer retains page-scoped draft, real review and deduplication on return', async ({ page }) => {
  await page.goto('/pergolas-auckland');
  await page.getByRole('radio', { name: /Gable/ }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('link', { name: 'Customise in 3D' }).click();
  await expect(page).toHaveURL(/configurator-preview.*design_scope=pergolas-auckland/);
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await expect(dialog).toBeVisible();
  expect((await events(page)).filter(e => e.name === 'design_review')).toHaveLength(0);
  await dialog.getByRole('checkbox', { name: 'Gable infills', exact: true }).check();
  await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
  const reviewed = (await events(page)).filter(e => e.name === 'design_review');
  expect(reviewed).toHaveLength(1);
  expect(reviewed[0].properties).toMatchObject({ source_path: '/pergolas-auckland', source_channel: 'seo', source_surface: 'full_designer' });
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(page).toHaveURL('/pergolas-auckland');
  await expect(page.getByText('Your design, kept together.', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Continue your design', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Gable infills', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: '3 Review', exact: true }).click();
  expect((await events(page)).filter(e => e.name === 'design_review')).toEqual(reviewed);
  await dialog.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page).toHaveURL(/design-enquiry.*source_path=%2Fpergolas-auckland/);
  await expect(page.locator('body')).toContainText('Acrylic infills');
});

for (const route of ['/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas']) test(`${route}: direct and configured blank-phone retry with overlay return`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', r => { payloads.push(r.request().postDataJSON()); return r.fulfill({ status: 503, json: { ok: false, error: 'Synthetic retry fixture' } }); });
  await page.goto(route);
  await expect(page.getByRole('radio', { name: 'Acrylic', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'Tell us about your space', exact: true }).click();
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('[name=name]').fill('Synthetic channel test');
  await form.locator('[name=email]').fill('channel@example.invalid');
  await form.locator('[name=suburb]').fill('Albany');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0].customerDesign).toBeUndefined();
  expect(payloads[0].page).toBe(route);
  expect(payloads[0].phone).toBe('');
  const quote = (await events(page)).find(e => e.name === 'journey_decision_click');
  expect(quote?.properties).not.toHaveProperty('configured_design');
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.getByRole('link', { name: 'Explore your design in 3D', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Design your pergola' });
  await dialog.getByRole('button', { name: 'Set your size', exact: true }).click();
  await dialog.getByRole('button', { name: 'Add sides & lighting', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next side configuration', exact: true }).click();
  await dialog.getByRole('button', { name: 'Review your design', exact: true }).click();
  await dialog.getByRole('button', { name: 'Enquire', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic channel test');
  await page.getByRole('link', { name: 'Not sure yet? Tell us about your space', exact: true }).click();
  expect((await events(page)).filter(e => e.name === 'journey_decision_click').at(-1)?.properties).not.toHaveProperty('configured_design');
  await form.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1].customerDesign.input.widthMm).toBe(5400);
  expect(payloads[1].customerDesign.roof.blinds.length).toBeGreaterThan(0);
  for (const name of ['design_start', 'design_review', 'design_enquiry_open']) expect((await events(page)).filter(e => e.name === name)).toHaveLength(1);
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1')!));
  expect(saved.input.widthMm).toBe(5400);
  expect(saved.roof.blinds.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('radio', { name: 'Acrylic', exact: true })).toBeEnabled();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.4');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1')!))).toEqual(saved);
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic channel test');
});

test('denied analytics suppresses real channel actions without preventing the journey', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.goto('/ads/facebook/acrylic-pergolas');
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Tab');
  await page.locator('summary').filter({ hasText: /^Review your design$/ }).click();
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page.getByText('Your selected design is included', { exact: true })).toBeVisible();
  expect((await events(page)).filter(e => e.name.startsWith('design_') || e.name === 'journey_decision_click')).toEqual([]);
});

test.describe('new Facebook native fallback', () => {
  test.use({ javaScriptEnabled: false });
  for (const route of ['/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas']) test(`${route}: native direct form carries route and discussion intent`, async ({ page }) => {
    let submitted: URLSearchParams | undefined;
    await page.route('**/api/enquiry/fallback', r => { submitted = new URLSearchParams(r.request().postData()!); return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>Simulated native receipt</p>' }); });
    await page.goto(route);
    const form = page.locator('form[data-inline-enquiry]');
    await form.locator('[name=name]').fill('Synthetic native channel');
    await form.locator('[name=email]').fill('native-channel@example.invalid');
    await form.locator('[name=suburb]').fill('Albany');
    await form.getByRole('button', { name: 'Send my enquiry' }).click();
    await expect(page.getByText('Simulated native receipt')).toBeVisible();
    expect(submitted?.get('page')).toBe(route);
    expect(submitted?.get('requestType')).toBe('project-discussion');
    expect(submitted?.get('phone')).toBe('');
    expect(submitted?.has('customerDesign')).toBe(false);
  });
});
