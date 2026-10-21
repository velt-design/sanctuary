import { expect, test, type Page } from '@playwright/test';
import { gablePergolasConfig as config, gableQuestions } from '../apps/marketing/app/gable-pergolas-auckland/content';
import { parsePreviewDesign } from '../apps/marketing/components/configurator-prototype/previewShare';

const path = '/gable-pergolas-auckland';
async function fence(page: Page, baseURL: string) {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
}
test.beforeEach(async ({ page, baseURL }) => {
  await fence(page, baseURL!);
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
});

for (const width of [320, 390, 820, 1440, 2560]) test(`gable form, real roofs and useful answers remain readable at ${width}`, async ({ page, request }, info) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page).toHaveTitle('Gable Pergolas Auckland | Roof Form Guide');
  await expect(page.locator('h1')).toHaveText(config.hero.title);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
  await expect(page.locator('header.site')).toBeVisible(); await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  const hero = page.locator('main figure img').first();
  await expect.poll(() => hero.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: info.outputPath(`gable-opening-${width}.png`) });
  for (const photo of await page.locator('main figure img').all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(photo).toHaveAttribute('sizes', /vw/);
    const rect = (await photo.boundingBox())!;
    expect(rect.width).toBeGreaterThan(240); expect(rect.height).toBeGreaterThan(180);
  }
  const diagram = page.getByRole('img', { name: /The height and proportions of a gable/ });
  await diagram.scrollIntoViewIfNeeded(); await expect(diagram).toBeVisible();
  await page.screenshot({ path: info.outputPath(`gable-section-${width}.png`) });
  await expect(page.getByRole('link', { name: 'Explore the Dairy Flat project' })).toHaveAttribute('href', '/projects/dairy-flat-estate');
  await expect(page.getByRole('link', { name: 'Explore the Warkworth project' })).toHaveAttribute('href', '/projects/warkworth-outdoor-room');
  await expect(page.getByRole('link', { name: 'Explore the Riverhead project' })).toHaveAttribute('href', '/projects/riverhead-gable-pavilion');
  const answer = page.locator('summary').filter({ hasText: gableQuestions[3].question });
  await answer.focus(); await answer.press('Enter');
  await expect(page.getByText(gableQuestions[3].answer[0], { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Related planning decisions' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => JSON.parse(text));
  expect(schema.map(item => item['@type'])).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'FAQPage', 'Organization', 'LocalBusiness']));
  expect(schema.map(item => item['@type'])).not.toContain('Service');
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`https://www.sanctuarypergolas.co.nz${path}`);
  expect(await page.locator('main').innerText()).not.toMatch(/[\u2013\u2014]/);
});

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }]) test(`gable first visit exposes its enquiry and real roof before normal consent at ${viewport.width}`, async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, viewport }); const page = await context.newPage();
  await fence(page, baseURL!);
  try {
    await page.goto(path);
    const banner = page.getByRole('region', { name: 'Cookie preferences', exact: true }); await expect(banner).toBeVisible();
    const bannerTop = (await banner.boundingBox())!.y;
    const action = page.getByRole('link', { name: 'Discuss your gable pergola', exact: true }).first();
    const box = (await action.boundingBox())!; expect(box.y + box.height).toBeLessThan(bannerTop);
    const photo = page.locator('main figure img').first();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    expect((await photo.boundingBox())!.y + 60).toBeLessThan(bannerTop);
    await expect(banner.getByRole('button', { name: 'Essential only', exact: true })).toBeVisible();
    await expect(banner.getByRole('button', { name: 'Accept all', exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`gable-first-visit-${viewport.width}.png`) });
  } finally { await context.close(); }
});

for (const width of [390, 1440]) test(`gable enquiry keyboard, project Back and repeat anchor preserve context at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const query = '?enquiry_type=professional&source_path=%2Fpergola-guides&source_component=pathway';
  await page.goto(path + query);
  const actions = page.getByRole('link', { name: 'Discuss your gable pergola', exact: true });
  await actions.first().focus(); await actions.first().press('Enter');
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  await page.keyboard.press('Tab'); await expect(page.locator('[name=enquiryType]')).toBeFocused();
  await page.getByRole('link', { name: 'Explore the Dairy Flat project' }).click();
  await expect(page.locator('h1')).toHaveText('Dairy Flat Estate'); await page.goBack();
  await expect(page).toHaveURL(path + query + '#project-details');
  await expect(page.locator('h1')).toHaveText(config.hero.title);
  await expect(page.locator('[name=enquiryType]')).toHaveValue('professional');
  await expect(page.locator('form [name=name]')).toHaveValue('');
  await page.goForward(); await expect(page.locator('h1')).toHaveText('Dairy Flat Estate'); await page.goBack();
  const historyLength = await page.evaluate(() => history.length);
  await actions.last().focus(); await actions.last().press('Enter');
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.keyboard.press('Tab'); await expect(page.locator('[name=enquiryType]')).toBeFocused();
});

test('gable direct brief preserves reference, required phone, optional roof choices and retry', async ({ page }) => {
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: payloads.length === 1 ? 503 : 200, json: payloads.length === 1 ? { error: 'Synthetic retry' } : { ok: true } }); });
  await page.goto(`${path}?enquiry_type=professional&source_path=%2Fprojects%2Fdairy-flat-estate&source_component=project_cta&source_project=dairy-flat-estate`);
  const form = page.locator('form.acrylic-form');
  await expect(form.locator('[name=files]')).toBeEnabled();
  const context = JSON.parse(await form.locator('[name=enquiryContext]').inputValue());
  expect(context).toMatchObject({ enquiry_type: 'professional', source_project: 'dairy-flat-estate' });
  await form.locator('[name=name]').fill('Synthetic gable guide'); await form.locator('[name=email]').fill('gable@example.invalid');
  await form.locator('[name=message]').fill('Keep a view of the garden.');
  await form.getByRole('button', { name: 'Send your enquiry' }).click();
  expect(payloads).toHaveLength(0); await expect(form.locator('[name=phone]')).toHaveAttribute('aria-invalid', 'true');
  await form.locator('[name=phone]').fill('0210000000');
  await form.getByText('Add optional project details', { exact: true }).click();
  await form.locator('[name=gableRelationship]').fill('Relate to the house roof');
  await form.locator('[name=gableEndPreference]').selectOption('Compare both');
  await form.locator('[name=widthM]').fill('5.4');
  await form.locator('[name=roofPreference]').selectOption('Combination roofing');
  await form.getByRole('button', { name: 'Send your enquiry' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  await expect(form.getByText('Your details are still here. Please try again.')).toBeVisible();
  await expect(form.locator('[name=gableRelationship]')).toHaveValue('Relate to the house roof');
  await form.getByRole('button', { name: 'Send your enquiry' }).click(); await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ submissionId: payloads[0].submissionId, enquiryType: 'professional', enquiryContext: context, dimensions: { widthM: '5.4' }, roofMaterials: ['acrylic', 'timber'], projectDetails: { gableRelationship: 'Relate to the house roof', gableEndPreference: 'Compare both' } });
  expect(payloads[1].customerDesign).toBeUndefined();
  await expect(form.getByRole('button', { name: 'Project brief sent' })).toBeDisabled();
});

test('gable attachments and native enquiry keep their canonical boundaries', async ({ page, browser, baseURL }) => {
  await page.goto(path); const form = page.locator('form.acrylic-form'); const files = form.locator('[name=files]');
  await expect(files).toBeEnabled();
  await files.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic invalid file') });
  await expect(files).toHaveAttribute('aria-invalid', 'true');
  await files.setInputFiles({ name: 'gable-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic only') });
  await expect(form.getByRole('list', { name: 'Selected files' })).toContainText('gable-plan.pdf');
  await form.getByRole('button', { name: 'Remove gable-plan.pdf' }).click(); await expect(form.getByRole('list', { name: 'Selected files' })).toHaveCount(0);
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false }); const native = await context.newPage(); await fence(native, baseURL!);
  const bodies: string[] = []; await native.route('**/api/enquiry/fallback', route => { bodies.push(route.request().postData() ?? ''); return route.fulfill({ contentType: 'text/html', body: '<p>Simulated native receipt</p>' }); });
  try {
    await native.goto(`${path}?enquiry_type=commercial&source_path=%2Fpergola-guides&source_component=pathway`);
    await native.getByRole('link', { name: 'Discuss your gable pergola', exact: true }).first().click();
    await expect(native.locator('#estimate-form-title')).toBeInViewport();
    const nativeForm = native.locator('form.acrylic-form');
    await expect(nativeForm.locator('[name=enquiryType]')).toHaveValue('commercial');
    await expect(nativeForm.locator('[name=files]')).toBeDisabled();
    await nativeForm.locator('[name=name]').fill('Synthetic native'); await nativeForm.locator('[name=email]').fill('native@example.invalid');
    await nativeForm.getByRole('button', { name: 'Send your enquiry' }).click(); expect(bodies).toHaveLength(0);
    await nativeForm.locator('[name=phone]').fill('0210000000'); await nativeForm.getByRole('button', { name: 'Send your enquiry' }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const body = new URLSearchParams(bodies[0]);
    expect(body.get('page')).toBe('/pergola-guides'); expect(body.get('enquiryType')).toBe('commercial');
    expect(JSON.parse(body.get('enquiryContext')!)).toMatchObject({ source_path: '/pergola-guides' });
    await expect(native.getByText('Simulated native receipt')).toBeVisible();
  } finally { await context.close(); }
});

test('optional gable product journey keeps an existing selection through designer, enquiry and guide return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products/pergolas/gable');
  const width = page.getByRole('textbox', { name: 'Width in metres' });
  await width.fill('7.4'); await width.press('Enter'); await expect(width).toHaveValue('7.4');
  await page.getByRole('tab', { name: /02 \/ Roof/ }).click();
  await page.getByRole('radio', { name: 'Mixed + timber', exact: true }).check();
  await page.getByRole('tab', { name: /03 \/ Sides/ }).click();
  await page.getByRole('radio', { name: 'Left blind', exact: true }).check();
  await page.goto(path);
  await page.getByRole('link', { name: 'Explore gable options and 3D' }).click();
  await expect(width).toHaveValue('7.4');
  const enquiry = page.getByRole('link', { name: 'Enquire', exact: true });
  const href = await enquiry.getAttribute('href'); expect(href).toContain('#design=');
  const expected = parsePreviewDesign(href!.split('#design=')[1].split('&estimate=')[0]);
  expect(expected?.roof.family).toBe('gable');
  expect(expected?.roof.finish?.material).toBe('combination');
  expect(expected?.roof.blinds).toHaveLength(1);
  await page.getByRole('link', { name: 'Customise further' }).click(); await expect(page).toHaveURL(/configurator-preview/);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? 'null'))).toEqual(expected);
  await page.goBack(); await expect(width).toHaveValue('7.4');
  await enquiry.click(); await expect(page).toHaveURL(/design-enquiry/);
  await page.locator('summary').filter({ hasText: 'View design details' }).click(); await expect(page.locator('main')).toContainText('7.4');
  await page.goBack(); await page.reload(); await expect(width).toHaveValue('7.4');
  await page.goBack(); await expect(page.locator('h1')).toHaveText(config.hero.title);
  await page.reload(); await expect(page.locator('form [name=name]')).toHaveValue('');
});
