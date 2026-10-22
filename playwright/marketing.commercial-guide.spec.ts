import { expect, test } from '@playwright/test';
import { commercialPergolasConfig as config } from '../apps/marketing/app/commercial-pergolas-auckland/content';

const path = config.route;
test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL!).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
});

for (const width of [320, 390, 820, 1440, 2560]) test(`commercial work, brief action and readable photos at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
  await page.goto(path);
  await expect(page.locator('h1')).toHaveText(config.hero.title);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Discuss your project', exact: true })).toBeInViewport();
  await expect(page.locator('header.site')).toBeVisible();
  await expect(page.locator('[data-site-footer]')).toHaveCount(1);
  const photos = page.locator('main figure img');
  await expect(photos).toHaveCount(5);
  for (const photo of await photos.all()) {
    await photo.scrollIntoViewIfNeeded();
    await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(photo).toHaveAttribute('sizes', /vw/);
    expect((await photo.boundingBox())!.width).toBeGreaterThan(240);
  }
  await expect(page.locator('main')).not.toContainText(/115\s*m²|guaranteed|all.weather|uninterrupted operation/i);
  await expect(page.locator('main')).toContainText('Landscaping, furniture and unrelated building work are separately agreed.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  const heroWidth = (await page.locator('main > header').boundingBox())!.width;
  expect(heroWidth).toBeLessThanOrEqual(1440);
  for (const action of await page.locator('main > header a').all()) expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  for (const article of await page.locator('section[aria-labelledby="commercial-other-work"] article').all()) {
    const photo = (await article.locator('figure').boundingBox())!;
    const heading = (await article.locator('h3').boundingBox())!;
    expect(heading.y - photo.y - photo.height).toBeGreaterThanOrEqual(16);
  }
});

for (const width of [390, 1440]) test(`commercial brief focus, project return and professional attribution at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const query = '?enquiry_type=professional&source_path=%2Farchitects-designers-builders&source_component=pathway';
  const expectCanonicalFormFocus = async () => {
    await expect(page.locator('#estimate-form-title')).toBeInViewport();
    for (const name of ['Call 022 854 5633', 'Email Sanctuary']) {
      await page.keyboard.press('Tab');
      await expect(page.locator('#project-details').getByRole('link', { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press('Tab');
    await expect(page.locator('[name=enquiryType]')).toBeFocused();
  };
  await page.goto(path + query);
  await page.getByRole('link', { name: 'Discuss your project', exact: true }).press('Enter');
  await expectCanonicalFormFocus();
  await expect(page.locator('[name=enquiryType]')).toHaveValue('professional');
  await page.getByRole('link', { name: 'Explore The Good Home', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('The Good Home Takanini');
  await page.goBack();
  await expect(page).toHaveURL(path + query + '#project-details');
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Talk through your brief', exact: true }).press('Enter');
  await expectCanonicalFormFocus();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  const context = JSON.parse(await page.locator('input[name=enquiryContext]').inputValue());
  expect(context).toMatchObject({ enquiry_type: 'professional', source_path: '/architects-designers-builders', source_component: 'pathway' });
});

test('commercial brief retains optional site details, required phone and retry without losing context', async ({ page }) => {
  const payloads: Record<string, unknown>[] = [];
  await page.route('**/api/enquiry', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({ status: payloads.length === 1 ? 503 : 200, json: payloads.length === 1 ? { error: 'Synthetic retry' } : { ok: true } });
  });
  await page.goto(path);
  const form = page.locator('form.acrylic-form');
  await expect(form).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(form.locator('[name=phone]')).toHaveAttribute('required', '');
  await form.locator('[name=name]').fill('Synthetic Commercial Review');
  await form.locator('[name=email]').fill('commercial-review@example.invalid');
  await form.getByRole('button', { name: config.form.submitLabel }).click();
  expect(payloads).toHaveLength(0);
  await form.locator('[name=phone]').fill('021 000 0000');
  await form.locator('details.acrylic-form__optional > summary').click();
  await form.locator('#acrylic-enquiry-siteAddress').fill('Synthetic Auckland site');
  await form.locator('#acrylic-enquiry-projectStage').selectOption('Concept design');
  await form.locator('#acrylic-enquiry-professionalInvolvement').fill('Architect and landlord');
  await form.locator('#acrylic-enquiry-operatingConstraints').fill('Keep the service route clear; agree installation access.');
  await form.locator('#acrylic-enquiry-roof').selectOption('Combination roofing');
  await expect(form.locator('[name=files]')).toBeEnabled();
  await form.getByRole('button', { name: config.form.submitLabel }).click();
  await expect.poll(() => payloads.length).toBe(1);
  await expect(form.locator('[name=name]')).toHaveValue('Synthetic Commercial Review');
  await form.getByRole('button', { name: config.form.submitLabel }).click();
  await expect(form.getByRole('heading', { name: 'Project brief sent.' })).toBeVisible();
  expect(payloads[1]).toMatchObject({ enquiryType: 'commercial', page: path, roofMaterials: ['acrylic', 'timber'], projectDetails: { siteAddress: 'Synthetic Auckland site', projectStage: 'Concept design', professionalInvolvement: 'Architect and landlord', operatingConstraints: 'Keep the service route clear; agree installation access.' }, enquiryContext: { enquiry_type: 'commercial', source_path: path, source_component: 'embedded_form' } });
});

test('commercial SEO and the adjacent Professional presentation retain their owners', async ({ page, request }) => {
  await page.goto(path);
  await expect(page).toHaveTitle('Commercial Pergolas Auckland | Design & Build');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => JSON.parse(text));
  expect(schema.map(item => item['@type'])).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'Service']));
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`https://www.sanctuarypergolas.co.nz${path}`);
  const customHandoff = page.locator('section[aria-labelledby="commercial-planning"]').getByRole('link', { name: 'Explore custom pergola design', exact: true });
  await expect(customHandoff).toHaveAttribute('href', '/custom-pergolas-auckland');
  await expect(customHandoff.locator('svg')).toHaveCount(1);
  expect((await customHandoff.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await customHandoff.click();
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://www.sanctuarypergolas.co.nz/custom-pergolas-auckland');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(config.hero.title);
  await page.getByRole('link', { name: 'Working with a project team', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Bring us into the design.');
  await expect(page.locator('#professional-projects article')).toHaveCount(3);
  await expect(page.locator('[name=enquiryType]')).toHaveValue('professional');
  await page.goBack(); await expect(page.locator('h1')).toHaveText(config.hero.title);
});
