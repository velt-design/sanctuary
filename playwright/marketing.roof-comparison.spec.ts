import { expect, test, type Page } from '@playwright/test';
import { acrylicVsLouvreConfig, roofQuestions } from '../apps/marketing/app/acrylic-pergolas-vs-louvre-roofs/content';

const path = '/acrylic-pergolas-vs-louvre-roofs';
async function fence(page: Page, baseURL: string) {
  await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue() : route.abort());
  await page.route('**/api/enquiry**', route => route.abort());
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
}
test.beforeEach(async ({ page, baseURL }) => {
  await fence(page, baseURL!);
  await page.addInitScript(() => {
    localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 }));
  });
});

for (const width of [320, 390, 820, 1440, 2560]) test(`roof guide preserves SEO, useful responsive comparison, real imagery and keyboard states at ${width}`, async ({ page, request }, info) => {
  const imageResponses: { url: string; status?: number; error?: string | null }[] = [];
  page.on('response', response => { if (response.request().resourceType() === 'image') imageResponses.push({ url: response.url(), status: response.status() }); });
  page.on('requestfailed', request => { if (request.resourceType() === 'image') imageResponses.push({ url: request.url(), error: request.failure()?.errorText }); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
    await page.goto(path);
    await expect(page).toHaveTitle('Acrylic Pergolas vs Louvre Roofs | Auckland Guide');
    await expect(page.locator('h1')).toHaveText('An acrylic alternative.');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
    await expect(page.locator('meta[name=description]')).toHaveAttribute('content', acrylicVsLouvreConfig.description);
    await expect(page.locator('meta[name=robots]')).not.toHaveAttribute('content', /noindex/);
    await expect(page.locator('header.site')).toBeVisible(); await expect(page.locator('[data-site-footer]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const hero = page.getByRole('region', { name: 'An acrylic alternative.', exact: true });
    await expect(hero).toContainText('Sanctuary builds fixed acrylic, solid and combination pergolas. We do not supply louvre roofs.');
    await expect(hero.locator('svg[role="img"]')).toHaveCount(0);
    await expect(hero.locator('svg[data-arrow-icon]')).toHaveCount(2);
    await expect(hero.getByRole('link', { name: /Discuss a fixed-roof pergola/ })).toHaveAttribute('href', '#project-details');
    const primaryAction = hero.getByRole('link', { name: /Discuss a fixed-roof pergola/ });
    await primaryAction.focus(); await primaryAction.press('Tab');
    await expect(hero.getByRole('link', { name: /Explore the Dairy Flat pergola/ })).toBeFocused();
    await page.evaluate(() => window.scrollTo(0, 0));
    const heroPhoto = hero.getByRole('img', { name: /View through a fixed acrylic gable roof/ });
    await expect.poll(() => heroPhoto.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: info.outputPath(`roof-opening-${width}.png`) });
    const diagram = page.getByRole('region', { name: 'How the two roof types work' });
    expect((await diagram.boundingBox())!.y).toBeGreaterThan((await hero.boundingBox())!.y + (await hero.boundingBox())!.height);
    await expect(diagram.locator('div').filter({ has: page.getByRole('heading', { name: 'Tilting louvres', exact: true }) }).last()).toContainText('Other suppliers');
    const fixed = diagram.getByRole('img', { name: /Fixed clear acrylic roof/ });
    const fixedMarkup = await fixed.innerHTML();
    await page.evaluate(() => document.fonts.ready);
    const height = (await diagram.boundingBox())!.height;
    const closed = diagram.getByRole('button', { name: 'Closed', exact: true });
    await closed.focus(); await closed.press('Enter');
    await expect(closed).toBeFocused(); await expect(closed).toHaveAttribute('aria-pressed', 'true');
    await expect(diagram.getByRole('img', { name: /Solid tilting blades, closed/ })).toBeVisible();
    await expect(diagram.locator('[data-roof-blade]')).toHaveCount(7);
    expect(await fixed.innerHTML()).toBe(fixedMarkup);
    expect(Math.abs((await diagram.boundingBox())!.height - height)).toBeLessThan(1);
    await page.screenshot({ path: info.outputPath(`roof-diagram-${width}.png`) });
    const open = diagram.getByRole('button', { name: 'Open', exact: true });
    await open.focus(); await open.press('Space'); await expect(open).toHaveAttribute('aria-pressed', 'true');
    await expect(diagram.getByRole('img', { name: /Solid tilting blades, open/ })).toBeVisible();
    await expect(page.locator('#roof-comparison tbody tr')).toHaveCount(5);
    await page.locator('#roof-comparison').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`roof-comparison-${width}.png`) });
    for (const photo of await page.locator('main figure img').all()) {
      await photo.scrollIntoViewIfNeeded();
      try {
        await expect.poll(() => photo.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      } catch (error) {
        await info.attach('image-loading-diagnostic', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ width, imageResponses, image: await photo.evaluate(image => ({ src: image.getAttribute('src'), currentSrc: (image as HTMLImageElement).currentSrc, complete: (image as HTMLImageElement).complete, naturalWidth: (image as HTMLImageElement).naturalWidth })) }, null, 2)) });
        throw error;
      }
      await expect(photo).toHaveAttribute('sizes', /vw/);
      const box = (await photo.boundingBox())!; expect(box.width).toBeGreaterThan(240); expect(box.height).toBeGreaterThan(150);
    }
    await page.screenshot({ path: info.outputPath(`roof-material-${width}.png`) });
    await expect(page.getByRole('link', { name: /Explore the Dairy Flat pergola/ })).toHaveAttribute('href', '/projects/dairy-flat-estate');
    await expect(page.getByRole('navigation', { name: 'Related planning decisions' })).toBeVisible();
    const faq = page.locator('summary').filter({ hasText: roofQuestions[1].question });
    await faq.focus(); await faq.press('Enter'); await expect(page.getByText(roofQuestions[1].answer, { exact: true })).toBeVisible();
    await hero.getByRole('link', { name: /Discuss a fixed-roof pergola/ }).click();
    await expect(page.locator('#estimate-form-title')).toBeInViewport();
    await expect(page.locator('#estimate-form-title')).toHaveText('Let’s talk about a fixed roof.');
    await page.screenshot({ path: info.outputPath(`roof-enquiry-${width}.png`) });
  const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(text => JSON.parse(text));
  expect(schema.map(item => item['@type'])).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList', 'FAQPage', 'Organization', 'LocalBusiness']));
  expect(schema.map(item => item['@type'])).not.toContain('Service');
  expect(await (await request.get('/sitemap.xml')).text()).toContain(`https://www.sanctuarypergolas.co.nz${path}`);
  expect(await page.locator('main').innerText()).not.toMatch(/[\u2013\u2014]/);
});

for (const width of [390, 1440]) for (const entry of ['hero', 'planning'] as const) test(`enquiry anchor and project history restore the guide at ${width} from ${entry}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const query = '?enquiry_type=professional&source_path=%2Fpergola-guides&source_component=pathway';
  await page.goto(path + query);
  const action = entry === 'hero'
    ? page.getByRole('region', { name: 'An acrylic alternative.', exact: true }).getByRole('link', { name: 'Discuss a fixed-roof pergola', exact: true })
    : page.getByRole('region', { name: 'Start with your space.', exact: true }).getByRole('link', { name: 'Discuss a fixed-roof pergola', exact: true });
  await action.focus(); await action.press('Enter');
  await expect(page).toHaveURL(new RegExp(`${path}\\?.*#project-details$`));
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  await page.keyboard.press('Tab');
  await expect(page.locator('form.acrylic-form [name=enquiryType]')).toBeFocused();
  const anchorState = await page.evaluate(() => ({ pathname: location.pathname, hash: location.hash, appRouterEntry: Boolean(history.state?.__NA) }));
  await page.getByRole('link', { name: 'Explore the Dairy Flat pergola', exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/dairy-flat-estate$/);
  await expect(page.locator('h1')).toHaveText('Dairy Flat Estate');
  await page.goBack();
  await info.attach('anchor-history', { contentType: 'application/json', body: Buffer.from(JSON.stringify({ anchorState, returned: await page.evaluate(() => ({ pathname: location.pathname, hash: location.hash, title: document.title, heading: document.querySelector('h1')?.textContent })) })) });
  await expect(page).toHaveURL(path + query + '#project-details');
  await expect(page).toHaveTitle('Acrylic Pergolas vs Louvre Roofs | Auckland Guide');
  await expect(page.locator('h1')).toHaveText('An acrylic alternative.');
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  const form = page.locator('form.acrylic-form');
  await expect(form.locator('[name=name]')).toHaveValue('');
  await expect(form.locator('[name=email]')).toHaveValue('');
  await expect(form.locator('[name=phone]')).toHaveValue('');
  await expect(form.locator('[name=enquiryType]')).toHaveValue('professional');
  expect(JSON.parse(await form.locator('[name=enquiryContext]').inputValue())).toMatchObject({ enquiry_type: 'professional', source_path: '/pergola-guides' });
  await page.goForward();
  await expect(page).toHaveURL(/\/projects\/dairy-flat-estate$/);
  await expect(page.locator('h1')).toHaveText('Dairy Flat Estate');
  await page.goBack();
  await expect(page.locator('h1')).toHaveText('An acrylic alternative.');
  const historyLength = await page.evaluate(() => history.length);
  await action.focus(); await action.press('Enter');
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  expect((await page.locator('#estimate-form-title').boundingBox())!.y).toBeGreaterThanOrEqual((await page.locator('header.site').boundingBox())!.height);
  await page.keyboard.press('Tab');
  await expect(form.locator('[name=enquiryType]')).toBeFocused();
});

test('enquiry fragment links retain native navigation without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  const page = await context.newPage(); await fence(page, baseURL!);
  try {
    await page.goto(path);
    const action = page.getByRole('region', { name: 'An acrylic alternative.', exact: true }).getByRole('link', { name: 'Discuss a fixed-roof pergola', exact: true });
    await expect(action).toHaveAttribute('href', '#project-details');
    await action.click(); await expect(page.locator('#estimate-form-title')).toBeInViewport();
    await page.getByRole('link', { name: 'Explore the Dairy Flat pergola', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Dairy Flat Estate');
    await page.goBack(); await expect(page.locator('h1')).toHaveText('An acrylic alternative.');
    await expect(page.locator('form.acrylic-form [name=name]')).toHaveValue('');
  } finally { await context.close(); }
});

for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }]) test(`roof first visit identifies Sanctuary’s fixed-roof offer before the external comparison at ${viewport.width}`, async ({ browser, baseURL }, info) => {
  const context = await browser.newContext({ baseURL, viewport }); const page = await context.newPage();
  await fence(page, baseURL!);
  try {
    await page.goto(path);
    const banner = page.getByRole('region', { name: 'Cookie preferences', exact: true }); await expect(banner).toBeVisible();
    const hero = page.getByRole('region', { name: 'An acrylic alternative.', exact: true });
    const offer = hero.getByText(acrylicVsLouvreConfig.hero.intro, { exact: true });
    await expect(offer).toBeVisible();
    const bannerTop = (await banner.boundingBox())!.y;
    const offerBox = (await offer.boundingBox())!;
    expect(offerBox.y + offerBox.height).toBeLessThan(bannerTop);
    const action = hero.getByRole('link', { name: /Discuss a fixed-roof pergola/ });
    const actionBox = (await action.boundingBox())!;
    expect(actionBox.y + actionBox.height).toBeLessThan(bannerTop);
    const roof = hero.getByRole('img', { name: /View through a fixed acrylic gable roof/ });
    await expect.poll(() => roof.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const photoBox = (await roof.boundingBox())!;
    expect(photoBox.y).toBeGreaterThan(actionBox.y + actionBox.height);
    expect(photoBox.y + 60).toBeLessThan(bannerTop);
    await expect(hero.getByRole('button', { name: /Open|Closed/ })).toHaveCount(0);
    expect((await page.getByRole('region', { name: 'How the two roof types work' }).boundingBox())!.y).toBeGreaterThan(viewport.height);
    for (const label of ['Essential only', 'Accept all']) await expect(banner.getByRole('button', { name: label, exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`roof-first-visit-${viewport.width}.png`) });
  } finally { await context.close(); }
});

test('comparison enquiry retains audience, source, optional brief, validation and retry without attaching a fictitious design', async ({ page }) => {
  const payloads: Record<string, any>[] = [];
  await page.route('**/api/enquiry', route => { payloads.push(route.request().postDataJSON()); return route.fulfill({ status: payloads.length === 1 ? 503 : 200, json: payloads.length === 1 ? { error: 'Synthetic retry' } : { ok: true } }); });
  await page.goto(`${path}?enquiry_type=professional&source_path=%2Fprojects%2Fdairy-flat-estate&source_component=project_cta&source_project=dairy-flat-estate`);
  const form = page.locator('form.acrylic-form');
  await expect(form.locator('[name=enquiryType]')).toHaveValue('professional');
  const context = JSON.parse(await form.locator('[name=enquiryContext]').inputValue());
  expect(context).toMatchObject({ enquiry_type: 'professional', source_path: '/projects/dairy-flat-estate', source_project: 'dairy-flat-estate' });
  await form.locator('[name=name]').fill('Synthetic roof guide'); await form.locator('[name=email]').fill('roof-guide@example.invalid');
  await form.locator('[name=message]').fill('Keep daylight in the kitchen.');
  await form.getByRole('button', { name: 'Send project brief' }).click();
  expect(payloads).toHaveLength(0); await expect(form.locator('[name=phone]')).toHaveAttribute('aria-invalid', 'true');
  await form.locator('[name=phone]').fill('0210000000');
  await form.getByText('Add optional project details', { exact: true }).click();
  await form.locator('[name=externalProposal]').selectOption('Initial proposal');
  await form.locator('[name=comparisonPriorities]').fill('Daylight and an open sky view');
  await form.locator('[name=widthM]').fill('5.4');
  await form.locator('[name=roofPreference]').selectOption('Combination roofing');
  await form.getByRole('button', { name: 'Send project brief' }).click();
  await expect.poll(() => payloads.length).toBe(1);
  await expect(form.getByText('Your details are still here. Please try again.')).toBeVisible();
  await expect(form.locator('[name=comparisonPriorities]')).toHaveValue('Daylight and an open sky view');
  await form.getByRole('button', { name: 'Send project brief' }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ submissionId: payloads[0].submissionId, enquiryType: 'professional', enquiryContext: context, message: 'Keep daylight in the kitchen.', dimensions: { widthM: '5.4' }, roofMaterials: ['acrylic', 'timber'], projectDetails: { externalProposal: 'Initial proposal', comparisonPriorities: 'Daylight and an open sky view' } });
  expect(payloads[1].customerDesign).toBeUndefined();
  await expect(form.getByRole('button', { name: 'Project brief sent' })).toBeDisabled();
});

test('comparison optional attachments reject unsafe files, can be removed, and native fallback retains safe context', async ({ page, browser, baseURL }) => {
  await page.goto(path); const form = page.locator('form.acrylic-form');
  const files = form.locator('[name=files]');
  await expect(files).toBeEnabled();
  await files.setInputFiles({ name: 'unsafe.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('synthetic invalid file') });
  await expect(files).toHaveAttribute('aria-invalid', 'true');
  await files.setInputFiles({ name: 'roof-plan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 synthetic only') });
  await expect(form.getByRole('list', { name: 'Selected files' })).toContainText('roof-plan.pdf');
  await form.getByRole('button', { name: 'Remove roof-plan.pdf' }).click();
  await expect(form.getByRole('list', { name: 'Selected files' })).toHaveCount(0);
  const native = await browser.newContext({ baseURL, javaScriptEnabled: false }); const nativePage = await native.newPage(); await fence(nativePage, baseURL!);
  const bodies: string[] = [];
  await nativePage.route('**/api/enquiry/fallback', route => { bodies.push(route.request().postData() ?? ''); return route.fulfill({ contentType: 'text/html', body: '<p>Simulated native receipt</p>' }); });
  try {
    await nativePage.goto(`${path}?enquiry_type=commercial&source_path=%2Fpergola-guides&source_component=pathway`);
    const nativeForm = nativePage.locator('form.acrylic-form');
    await expect(nativeForm.locator('[name=enquiryType]')).toHaveValue('commercial');
    await expect(nativeForm.locator('[name=phone]')).toHaveAttribute('required');
    await expect(nativeForm.locator('[name=files]')).toBeDisabled();
    await nativeForm.locator('[name=name]').fill('Synthetic native'); await nativeForm.locator('[name=email]').fill('native@example.invalid');
    await nativeForm.getByRole('button', { name: 'Send project brief' }).click(); expect(bodies).toHaveLength(0);
    await nativeForm.locator('[name=phone]').fill('0210000000'); await nativeForm.getByRole('button', { name: 'Send project brief' }).click();
    await expect.poll(() => bodies.length).toBe(1);
    const payload = new URLSearchParams(bodies[0]); expect(payload.get('enquiryType')).toBe('commercial');
    expect(JSON.parse(payload.get('enquiryContext')!)).toMatchObject({ enquiry_type: 'commercial', source_path: '/pergola-guides' });
  } finally { await native.close(); }
});
