import { expect, test, type Page } from '@playwright/test';
import { pitchedPergolasConfig as config, pitchedQuestions } from '../apps/marketing/app/pitched-pergolas-auckland/content';

const path = '/pitched-pergolas-auckland';
async function fence(page: Page, baseURL: string) {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
}
test.beforeEach(async ({ page, baseURL }) => {
  await fence(page, baseURL!);
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
});

for (const width of [320, 390, 820, 1440, 2560]) test(`pitched profile photograph, built roofs and enquiry remain usable at ${width}`, async ({ page, request }, info) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page).toHaveTitle('Pitched Pergolas Auckland | Mono-Pitch Roof Guide');
  await expect(page.locator('h1')).toHaveText(config.hero.title);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('header.site')).toBeVisible();
  await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  const photos = page.locator('main figure img');
  await expect(photos).toHaveCount(4);
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(photo).toHaveAttribute('sizes', /vw/);
    expect((await photo.boundingBox())!.width).toBeGreaterThan(240);
  }
  const roofProfile = page.getByRole('img', { name: /The complete freestanding Velskov roof slopes/ });
  await roofProfile.scrollIntoViewIfNeeded(); await expect(roofProfile).toBeVisible();
  await expect(page.locator('#pitched-section').getByText('High edge', { exact: true })).toBeVisible();
  await expect(page.locator('#pitched-section').getByText('Low edge', { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath(`pitched-section-${width}.png`) });
  await expect(page.getByRole('link', { name: 'See Tindalls Bay' })).toHaveAttribute('href', '/projects/tindalls-bay-pavilion');
  await expect(page.getByRole('link', { name: 'See Velskov Forest' })).toHaveAttribute('href', '/projects/velskov-forest');
  await expect(page.getByRole('link', { name: 'Explore pitched options and 3D' })).toHaveAttribute('href', '/products/pergolas/pitched');
  const answer = page.locator('summary').filter({ hasText: pitchedQuestions[2].question });
  await answer.focus(); await answer.press('Enter');
  await expect(page.getByText(pitchedQuestions[2].answer, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => JSON.parse(text));
  expect(schema.map(item => item['@type'])).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'FAQPage', 'Organization', 'LocalBusiness']));
  expect(schema.map(item => item['@type'])).not.toContain('Service');
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`https://www.sanctuarypergolas.co.nz${path}`);
  expect(await page.locator('main').innerText()).not.toMatch(/[\u2013\u2014]|KiwiRail|115\s*m²/);
});

for (const width of [390, 1440]) test(`pitched enquiry focus and project return preserve context at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const query = '?enquiry_type=professional&source_path=%2Fpergola-guides&source_component=pathway';
  await page.goto(path + query);
  await page.getByRole('link', { name: 'Discuss your pergola', exact: true }).press('Enter');
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  await page.keyboard.press('Tab'); await expect(page.locator('[name=enquiryType]')).toBeFocused();
  await page.getByRole('link', { name: 'See Tindalls Bay' }).click();
  await expect(page.locator('h1')).toHaveText('Tindalls Bay - Patio & Carport');
  await page.goBack();
  await expect(page).toHaveURL(path + query + '#project-details');
  await expect(page.locator('[name=enquiryType]')).toHaveValue('professional');
  await expect(page.locator('form [name=name]')).toHaveValue('');
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Talk through your house connection' }).press('Enter');
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  await page.keyboard.press('Tab'); await expect(page.locator('[name=enquiryType]')).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test('pitched enquiry retains required phone and the optional house brief through retry', async ({ page }) => {
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({ status: payloads.length === 1 ? 503 : 200, json: payloads.length === 1 ? { error: 'Synthetic retry' } : { ok: true } });
  });
  await page.goto(path);
  const form = page.locator('form.acrylic-form');
  await expect(form).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(form.locator('[name=phone]')).toHaveAttribute('required', '');
  await form.locator('[name=name]').fill('Synthetic Pitched Review');
  await form.locator('[name=email]').fill('pitched-review@example.invalid');
  await form.getByRole('button', { name: config.form.submitLabel }).click();
  expect(payloads).toHaveLength(0);
  await form.locator('[name=phone]').fill('021 000 0000');
  await form.locator('details.acrylic-form__optional > summary').click();
  await form.locator('#acrylic-enquiry-highEdgeContext').fill('Doors and eaves above the patio');
  await form.locator('#acrylic-enquiry-roof').selectOption('Combination roofing');
  await expect(form.locator('[name=files]')).toBeEnabled();
  await form.getByRole('button', { name: config.form.submitLabel }).click();
  await expect.poll(() => payloads.length).toBe(1);
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Pitched Review');
  await form.getByRole('button', { name: config.form.submitLabel }).click();
  await expect(form.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[1]).toMatchObject({ page: path, roofMaterials: ['acrylic', 'timber'], projectDetails: { highEdgeContext: 'Doors and eaves above the patio' }, enquiryContext: { source_path: path, source_component: 'embedded_form' } });
});
