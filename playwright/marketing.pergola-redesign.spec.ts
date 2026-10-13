import { expect, test } from '@playwright/test';
import { ADVERTISING_DISCLOSURE_VERSION } from '../apps/marketing/lib/advertisingDisclosure';

const comparison = process.env.PERGOLA_COMPARISON_TEST === 'true';
const path = comparison ? '/pergolas-auckland/redesign' : '/pergolas-auckland';
const draftKey = 'sanctuary.pergolas-auckland-design.v1';
const price = { status: 'priced', amountIncGst: 12345, currency: 'NZD', includesGst: true, breakdown: [], versionNumber: 2, calculationRef: 'synthetic-test-only' };
test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(marketing => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing, updatedAt: new Date().toISOString(), version: 1 })), testInfo.title.endsWith('marketing true'));
  await page.route('**/api/configurator-price', route => route.fulfill({ json: price }));
});

for (const width of [390, 1440]) test(`comparison, full designer, enquiry editing and saved return at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/configurator-preview?open=1#design=1.mono.4300.2400.ground.fascia.parallel.0');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? '{}').input?.widthMm)).toBe(4300);
  await page.goto(path);
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('radio', { name: 'Mixed + timber', exact: true }).check();
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  if (comparison) {
  await page.getByRole('link', { name: 'View original page' }).click();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.4');
  await expect(page.getByRole('radio', { name: /^Gable/ })).toBeChecked();
  await page.getByRole('link', { name: 'View new design' }).click();
  await expect(page.getByRole('radio', { name: 'Mixed + timber', exact: true })).toBeChecked();
  } else {
    await expect(page.getByRole('navigation', { name: 'Page comparison' })).toHaveCount(0);
  }
  await page.getByRole('link', { name: 'Customise in 3D', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) ?? '{}').input?.widthMm, draftKey)).toBe(5400);
  await page.getByRole('button', { name: 'Close configurator' }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('#explore-options')).toContainText('Your saved exploration');
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('source_path=' + encodeURIComponent(path)));
  await page.getByRole('link', { name: /Edit my design/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const input = page.getByRole('textbox', { name: 'Width in metres' });
  if (!await input.isVisible()) {
    await page.getByRole('button', { name: 'Edit design', exact: true }).click();
    await page.getByRole('button', { name: /Size/ }).first().click();
  }
  await input.fill('5.5'); await input.press('Enter');
  await page.getByRole('button', { name: 'Close configurator' }).click();
  await page.reload();
  await page.getByRole('link', { name: /Back to website/ }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.locator('#explore-options')).toContainText('5.5 × 3.0 m');
  await expect(page.locator('#explore-options')).toContainText('ThermoPine');
  // Synthetic saved extras exercise the whole saved draft, rather than reconstructing only the three landing fields.
  await page.evaluate(key => {
    const draft = JSON.parse(sessionStorage.getItem(key)!); draft.roof.infills = true; draft.input.level = 'elevated';
    sessionStorage.setItem(key, JSON.stringify(draft)); localStorage.setItem(key, JSON.stringify(draft));
  }, draftKey);
  await page.reload();
  await expect(page.locator('#explore-options')).toContainText('Acrylic infills');
  await expect(page.locator('#explore-options')).toContainText('Elevated');
  if (comparison) {
  await page.getByRole('link', { name: 'View original page' }).click();
  await expect(page.locator('#explore-options')).toContainText('Acrylic infills');
  await page.getByRole('link', { name: 'View new design' }).click();
  await expect(page.locator('#explore-options')).toContainText('Elevated');
  }
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1')!).input.widthMm)).toBe(4300);
});

for (const width of [320, 390, 1440]) test(`populated design remains stable through preparation, pricing and retry at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  const section = page.locator('#explore-options');
  await expect(section).toContainText('$12,345');
  await page.evaluate(() => document.fonts.ready);
  const measure = () => section.evaluate(element => {
    const scroll = window.scrollY + (document.scrollingElement === document.body ? 0 : document.body.scrollTop);
    const action = element.querySelector('a[href^="/design-enquiry"], a[href="#project-details"]')!;
    return { action: action.getBoundingClientRect().top + scroll, bottom: element.getBoundingClientRect().bottom + scroll };
  });
  const baseline = await measure();
  const samples = [{ state: 'priced', ...baseline }];
  const stable = async (state: string) => {
    const value = await measure(); samples.push({ state, ...value });
    expect(Math.abs(value.action - baseline.action)).toBeLessThan(1);
    expect(Math.abs(value.bottom - baseline.bottom)).toBeLessThan(1);
    await expect(section).not.toContainText('$12,345');
  };
  let releaseOptions!: () => void, releasePrice!: () => void;
  const optionsGate = new Promise<void>(resolve => { releaseOptions = resolve; });
  const priceGate = new Promise<void>(resolve => { releasePrice = resolve; });
  await page.route('**/api/pergola-selection', async route => { const response = await route.fetch(); await optionsGate; await route.fulfill({ response }); });
  await page.route('**/api/configurator-price', async route => { await priceGate; await route.fulfill({ json: { status: 'unavailable' } }); });
  try {
    await page.getByRole('radio', { name: 'Gable', exact: true }).check();
    await expect(section).toContainText('Preparing your options…'); await stable('preparing');
    releaseOptions(); await expect(section).toContainText('Updating estimate…'); await stable('updating');
    releasePrice(); await expect(page.getByRole('button', { name: 'Retry estimate' })).toBeVisible(); await stable('retry');
    await page.route('**/api/configurator-price', route => route.fulfill({ json: { ...price, amountIncGst: 14000 } }));
    await page.getByRole('button', { name: 'Retry estimate' }).click();
    await expect(section).toContainText('$14,000'); await stable('recovered');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
  } finally { releaseOptions(); releasePrice(); await test.info().attach('redesign-layout', { body: JSON.stringify(samples), contentType: 'application/json' }); }
});

test('failed options recover, oversize keeps direct help and keyboard changes the roofline', async ({ page }) => {
  await page.route('**/api/pergola-selection', route => route.fulfill({ status: 503, json: { error: 'unavailable' } }));
  await page.goto(path);
  await expect(page.getByRole('button', { name: 'Retry options' })).toBeVisible();
  await expect(page.locator('#explore-options').getByRole('link', { name: 'Discuss your project' })).toBeVisible();
  await page.unroute('**/api/pergola-selection');
  await page.getByRole('button', { name: 'Retry options' }).click();
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  await page.getByRole('radio', { name: 'Pitched', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toBeChecked();
  await page.getByRole('radio', { name: 'Box', exact: true }).check();
  await page.getByRole('radio', { name: 'Solid + timber', exact: true }).check();
  await page.getByRole('textbox', { name: 'Projection in metres' }).fill('6');
  await page.getByRole('textbox', { name: 'Projection in metres' }).press('Enter');
  await expect(page.locator('#explore-options')).toContainText('Check the projection');
  await expect(page.locator('#explore-options')).not.toContainText('$12,345');
  await page.locator('#explore-options').getByRole('link', { name: 'Discuss your project' }).click();
  await expect(page.locator('#project-details').getByRole('button', { name: 'Send enquiry' })).toBeVisible();
});

test('no javascript retains direct enquiry and the route has appropriate indexing', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  await page.goto(path);
  await expect(page.locator('form.acrylic-form')).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', comparison ? 'noindex, nofollow' : 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/pergolas-auckland$/);
  await context.close();
});

test('storage unavailable still carries the selected design and returns to the new page', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error('denied'); }; Storage.prototype.getItem = () => { throw new Error('denied'); }; });
  await page.goto(path);
  await page.getByRole('radio', { name: 'Box', exact: true }).check();
  await expect(page.locator('#explore-options')).toContainText('Your browser cannot save choices');
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('source_path=' + encodeURIComponent(path)));
  await page.getByText('View design details', { exact: true }).click();
  await expect(page.getByLabel('Your design', { exact: true })).toContainText('Box perimeter');
  await expect(page.getByRole('link', { name: /Back to website/ })).toHaveAttribute('href', path);
});

test('direct help accepts unknown dimensions through the existing form and source contract', async ({ page }) => {
  let payload: { enquiryContext?: { source_path: string }; customerDesign?: unknown; submissionId?: string; advertisingDisclosureVersion?: string } = {};
  await page.route('**/api/enquiry/fallback', route => route.abort());
  await page.route('**/api/enquiry', route => { payload = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } }); });
  await page.goto(path);
  await page.getByRole('link', { name: 'Talk about your project', exact: true }).click();
  await expect(page.locator('form.acrylic-form')).toHaveAttribute('novalidate', '');
  await expect(page.locator('form.acrylic-form')).toContainText('measure enquiries and sales with Google Ads');
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.locator('#acrylic-enquiry-error-summary')).toBeVisible();
  await page.locator('#acrylic-enquiry-name').fill('[Agent Scenario] landing-preview');
  await page.locator('#acrylic-enquiry-phone').fill('0210000000');
  await page.locator('#acrylic-enquiry-email').fill('landing-preview@example.invalid');
  await page.getByRole('button', { name: 'Send enquiry', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Project brief sent', exact: true })).toBeVisible();
  expect(payload.enquiryContext?.source_path).toBe(path);
  expect(payload.customerDesign).toBeUndefined();
  expect(payload.advertisingDisclosureVersion).toBe(ADVERTISING_DISCLOSURE_VERSION);
  expect(payload.submissionId).toMatch(/^[a-f0-9-]{36}$/);
});
for (const marketing of [false, true]) test(`selected enquiry retains choices, source and retry identity with marketing ${marketing}`, async ({ page }) => {
  const origin = new URL(test.info().project.use.baseURL as string).origin;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  await page.route('**/api/enquiry/fallback', route => route.abort());
  const payloads: { submissionId: string; advertisingDisclosureVersion: string; customerDesign: { input: { widthMm: number } }; enquiryContext: { source_path: string; source_product: string }; attribution: { utm: Record<string, string>; consent: { marketing: boolean } } }[] = [];
  await page.route('**/api/enquiry', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill(payloads.length === 1 ? { status: 503, json: { ok: false, error: 'temporarily_unavailable' } } : { json: { ok: true } });
  });
  await page.goto(`${path}?utm_source=google&utm_campaign=synthetic-landing-preview`);
  await page.getByRole('radio', { name: /^Gable/ }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page.locator('form')).toContainText('measure enquiries and sales with Google Ads');
  await page.locator('#contact-name').fill('[Agent Scenario] landing-preview');
  await page.locator('#contact-email').fill('landing-preview@example.invalid');
  await page.locator('#contact-suburb').fill('Auckland');
  await page.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.locator('form').getByRole('alert')).toBeVisible();
  await expect(page.locator('#contact-name')).toHaveValue('[Agent Scenario] landing-preview');
  await page.getByRole('button', { name: 'Send my enquiry' }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(payloads).toHaveLength(2);
  expect(payloads[0].submissionId).toBe(payloads[1].submissionId);
  expect(payloads[1].customerDesign.input.widthMm).toBe(5400);
  expect(payloads[1].advertisingDisclosureVersion).toBe(ADVERTISING_DISCLOSURE_VERSION);
  expect(payloads[1].enquiryContext).toMatchObject({ source_path: path, source_product: 'gable' });
  expect(payloads[1].attribution.consent.marketing).toBe(marketing);
  expect(payloads[1].attribution.utm).toEqual(marketing ? { utm_source: 'google', utm_campaign: 'synthetic-landing-preview' } : {});
});



for (const width of [320, 390, 1440]) test(`material changes keep the estimate and next actions still at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  await page.evaluate(() => document.fonts.ready);
  const measure = () => page.locator('#explore-options').evaluate(section => {
    const button = section.querySelector('a[href^="/design-enquiry"]')!;
    const detail = section.querySelector('[class*="materialDetail"]')!;
    const scroll = window.scrollY + (document.scrollingElement === document.body ? 0 : document.body.scrollTop);
    return { action: button.getBoundingClientRect().top + scroll, detail: detail.getBoundingClientRect().height, bottom: section.getBoundingClientRect().bottom + scroll };
  });
  const first = await measure();
  const samples = [first];
  for (const material of ['Solid + timber', 'Mixed + timber', 'Acrylic']) {
    await page.getByRole('radio', { name: material, exact: true }).check();
    await expect(page.locator('#explore-options')).toContainText('$12,345');
    const current = await measure(); samples.push(current);
    // The actual text grid reserves the same space for every choice at this width.
    expect(Math.abs(current.detail - first.detail)).toBeLessThan(1);
    expect(Math.abs(current.action - first.action)).toBeLessThan(1);
    expect(Math.abs(current.bottom - first.bottom)).toBeLessThan(1);
    await expect(page.locator('[class*="materialDetail"] > span[aria-hidden="false"]')).toHaveCount(1);
  }
  await test.info().attach('material-layout', { body: JSON.stringify(samples), contentType: 'application/json' });
});

test('public promotion retains canonical SEO, redirects old comparison links and keeps guided context', async ({ page }) => {
  test.skip(comparison, 'Production route contract is exercised with the comparison flag off.');
  await page.goto('/pergolas-auckland/redesign?utm_source=google&focus=daylight#explore-options');
  await expect(page).toHaveURL(/\/pergolas-auckland\?utm_source=google&focus=daylight#explore-options$/);
  await expect(page).toHaveTitle('Pergolas Auckland | Design, Build & Installation');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.sanctuarypergolas.co.nz/pergolas-auckland');
  await expect(page.getByRole('navigation', { name: 'Page comparison' })).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Room to live.Outside.');
  const nodes = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(text => JSON.parse(text));
  for (const type of ['WebPage', 'Service', 'BreadcrumbList']) expect(nodes.filter(node => node['@type'] === type)).toHaveLength(1);
  expect(nodes.find(node => node['@type'] === 'Service').url).toBe('https://www.sanctuarypergolas.co.nz/pergolas-auckland');
  expect(nodes.find(node => node['@type'] === 'Offer')).toBeUndefined();
  await expect(page.locator('[data-guided-journey-context]')).toHaveAttribute('data-guided-focus', 'daylight');
  const context = JSON.parse(await page.locator('input[name="enquiryContext"]').inputValue());
  expect(context).toMatchObject({ source_path: '/pergolas-auckland', source_focus: 'daylight', source_experience: 'guided-home-v1' });
});

for (const width of [390, 1440]) test(`direct designer edits return immediately with all details at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/configurator-preview?open=1#design=1.mono.4300.2400.ground.fascia.parallel.0');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? '{}').input?.widthMm)).toBe(4300);
  await page.goto(path);
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  const designer = page.getByRole('link', { name: 'Customise in 3D', exact: true });
  const href = await designer.getAttribute('href');
  expect(new URL(href!, 'http://localhost').hash).toMatch(/^#design=/);
  await designer.click();
  await expect(page).toHaveURL(/\/configurator-preview\?/);
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.pergolas-auckland-selection.v1')!).explore)).toBe(false);
  if (width < 800) await page.getByRole('button', { name: 'Edit Size & structure', exact: true }).click();
  const size = page.getByRole('textbox', { name: 'Width in metres' });
  await size.fill('5.7'); await size.press('Enter');
  if (width < 800) {
    await page.getByRole('button', { name: 'All sections', exact: true }).click();
    await page.getByRole('button', { name: /Connection & design options/ }).click();
  }
  await page.getByRole('checkbox', { name: 'Gable infills', exact: true }).check();
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(path+'$'));
  const landing = page.locator('#explore-options');
  for (const text of ['Your saved exploration', '5.7 × 3.0 m', 'Acrylic infills', '$12,345']) await expect(landing).toContainText(text);
  await page.reload();
  for (const text of ['Your saved exploration', '5.7 × 3.0 m', 'Acrylic infills', '$12,345']) await expect(landing).toContainText(text);
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await page.getByText('View design details', { exact: true }).click();
  await expect(page.getByLabel('Your design', { exact: true })).toContainText('Acrylic infills');
  await expect.poll(() => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).input.widthMm, draftKey)).toBe(5700);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1')!).input.widthMm)).toBe(4300);
  await test.info().attach('direct-designer-route', { body: JSON.stringify({ href, entry:'full route navigation, hash consumed on arrival', changedWidthMm:5700, infills:true }), contentType:'application/json' });
});

for (const product of [{ type:'gable', label:'Gable' }, { type:'box-perimeter', label:'Box' }]) test(`fresh tab restores ${product.type} source from the saved draft`, async ({ page, context }) => {
  await page.goto(path);
  await page.getByRole('radio', { name: product.label, exact: true }).check();
  await page.getByRole('link', { name: 'Customise in 3D', exact: true }).click();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{}').roof?.family, draftKey)).toBe(product.type === 'gable' ? 'gable' : 'box');
  const fresh = await context.newPage();
  await fresh.route('**/api/configurator-price', route => route.fulfill({ json: price }));
  await fresh.goto(path);
  expect(await fresh.evaluate(() => sessionStorage.getItem('sanctuary.pergolas-auckland-selection.v1'))).toBeNull();
  expect(await fresh.evaluate(key => sessionStorage.getItem(key), draftKey)).toBeNull();
  await expect(fresh.locator('#explore-options')).toContainText('Your saved exploration');
  await expect(fresh.locator('#explore-options')).toContainText('$12,345');
  for (const label of ['Enquire about this design', 'Continue your design']) {
    const href = await fresh.getByRole('link', { name:label, exact:true }).getAttribute('href');
    expect(new URL(href!, 'http://localhost').searchParams.get('source_product')).toBe(product.type);
  }
  await fresh.getByRole('link', { name:'Enquire about this design', exact:true }).click();
  await expect(fresh).toHaveURL(new RegExp('source_product='+product.type));
});
