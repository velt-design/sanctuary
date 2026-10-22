import { expect, test } from '@playwright/test';

const path = '/pergolas-auckland';
test.beforeEach(async ({ page }, testInfo) => {
  await page.addInitScript(marketing => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing, updatedAt: new Date().toISOString(), version: 1 })), testInfo.title.endsWith('marketing true'));
  await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'priced', amountIncGst: 12345, currency: 'NZD', includesGst: true, breakdown: [], versionNumber: 2, calculationRef: 'synthetic-test-only' } }));
});

for (const width of [390, 1440]) test(`landing selection, enquiry, edit, return and prior draft at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/configurator-preview?open=1#design=1.mono.4300.2400.ground.fascia.parallel.0');
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? '{}').input?.widthMm)).toBe(4300);
  await page.goto(path);
  await page.getByRole('radio', { name: /^Gable/ }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('7.3');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('radio', { name: 'Mixed + timber', exact: true }).check();
  await expect(page.getByRole('link', { name: 'Enquire about this design', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page).toHaveURL(/design-enquiry.*design_scope=pergolas-auckland/);
  await page.getByText('View design details', { exact: true }).click();
  await expect(page.getByLabel('Your design', { exact: true })).toContainText('7.3');
  await page.getByRole('link', { name: /Edit my design/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const widthInput = page.getByRole('textbox', { name: 'Width in metres' });
  if (!await widthInput.isVisible()) {
    await page.getByRole('button', { name: 'Edit design', exact: true }).click();
    await page.getByRole('button', { name: /Size/ }).first().click();
  }
  await widthInput.fill('7.4'); await widthInput.press('Enter');
  await page.getByRole('button', { name: 'Close configurator' }).click();
  await page.reload();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.pergolas-auckland-design.v1') ?? '{}').input?.widthMm)).toBe(7400);
  await page.goto(path);
  await expect(page.getByText('Pick up where you left off.')).toBeVisible();
  await expect(page.getByText('7.4 × 3 m', { exact: true })).toBeVisible();
  await expect(page.locator('#explore-options')).toContainText('ThermoPine');
  await expect(page.locator('#explore-options')).toContainText('Ground level');
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1')!).input.widthMm)).toBe(4300);
  await page.getByRole('link', { name: 'Return to your other saved design' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1')!).input.widthMm)).toBe(4300);
});

test('price failure never displays an old amount and can retry without blocking enquiry', async ({ page }) => {
  await page.goto(path);
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'unavailable' } }));
  await page.getByRole('radio', { name: /^Gable/ }).check();
  await expect(page.locator('#explore-options')).not.toContainText('$12,345');
  await expect(page.getByRole('button', { name: 'Retry estimate' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enquire about this design', exact: true })).toBeVisible();
  await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'priced', amountIncGst: 14000, currency: 'NZD', includesGst: true, breakdown: [], versionNumber: 2, calculationRef: 'synthetic' } }));
  await page.getByRole('button', { name: 'Retry estimate' }).click();
  await expect(page.locator('#explore-options')).toContainText('$14,000');
});

test('direct enquiry is present without javascript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(path);
  await expect(page.locator('form.acrylic-form')).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Name Required' })).toBeVisible();
  await context.close();
});

for (const marketing of [false, true]) test(`selected enquiry retains choices, source and retry identity with marketing ${marketing}`, async ({ page }) => {
  const origin = new URL(test.info().project.use.baseURL as string).origin;
  await page.route('**/*', route => new URL(route.request().url()).origin === origin ? route.fallback() : route.abort());
  await page.route('**/api/enquiry/fallback', route => route.abort());
  const payloads: { submissionId: string; customerDesign: { input: { widthMm: number } }; enquiryContext: { source_path: string; source_product: string }; attribution: { utm: Record<string, string>; consent: { marketing: boolean } } }[] = [];
  await page.route('**/api/enquiry', route => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill(payloads.length === 1 ? { status: 503, json: { ok: false, error: 'temporarily_unavailable' } } : { json: { ok: true } });
  });
  await page.goto(`${path}?utm_source=google&utm_campaign=synthetic-landing-preview`);
  await page.getByRole('radio', { name: /^Gable/ }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
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
  expect(payloads[1].enquiryContext).toMatchObject({ source_path: path, source_product: 'gable' });
  expect(payloads[1].attribution.consent.marketing).toBe(marketing);
  expect(payloads[1].attribution.utm).toEqual(marketing ? { utm_source: 'google', utm_campaign: 'synthetic-landing-preview' } : {});
});

for (const width of [390, 1440]) test(`estimate actions stay in place through option and price updates at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  const selector = page.locator('#explore-options');
  await expect(selector).toContainText('$12,345');
  await page.getByRole('textbox', { name: 'Width in metres' }).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const positions = () => selector.evaluate(section => {
    const action = [...section.querySelectorAll('a,button')].find(item => item.textContent?.trim() === 'Enquire about this design')!;
    // Mobile overflow rules allow body scrolling in addition to the root scroller.
    const scrollTop = window.scrollY + (document.scrollingElement === document.body ? 0 : document.body.scrollTop);
    return { actionTop: action.getBoundingClientRect().top + scrollTop, sectionBottom: section.getBoundingClientRect().bottom + scrollTop, sectionTop: section.getBoundingClientRect().top + scrollTop };
  });
  const baseline = await positions();
  const samples = [{ state: 'priced', ...baseline }];
  const stable = async (state: string) => {
    const current = await positions();
    samples.push({ state, ...current });
    expect(Math.abs(current.actionTop - baseline.actionTop), 'enquiry action position').toBeLessThan(1);
    expect(Math.abs(current.sectionBottom - baseline.sectionBottom), 'following section position').toBeLessThan(1);
  };
  let releaseOptions!: () => void, releasePrice!: () => void;
  const optionsGate = new Promise<void>(resolve => { releaseOptions = resolve; });
  const priceGate = new Promise<void>(resolve => { releasePrice = resolve; });
  await page.route('**/api/pergola-selection', async route => {
    const response = await route.fetch();
    await optionsGate;
    await route.fulfill({ response });
  });
  await page.route('**/api/configurator-price', async route => {
    await priceGate;
    await route.fulfill({ json: { status: 'unavailable' } });
  });
  try {
    await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
    await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
    await expect(selector.getByText('Preparing your options…', { exact: true })).toBeVisible();
    await stable('preparing-options');
    releaseOptions();
    await expect(selector.getByText('Updating estimate…', { exact: true })).toBeVisible();
    await stable('updating-estimate');
    releasePrice();
    await expect(selector.getByRole('button', { name: 'Retry estimate' })).toBeVisible();
    await stable('retry-available');
    await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'priced', amountIncGst: 14000, currency: 'NZD', includesGst: true, breakdown: [], versionNumber: 2, calculationRef: 'synthetic' } }));
    await selector.getByRole('button', { name: 'Retry estimate' }).click();
    await expect(selector).toContainText('$14,000');
    await stable('priced-after-retry');
  } finally {
    releaseOptions(); releasePrice();
    await test.info().attach('estimate-position-samples', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' });
  }
});

for (const width of [320, 1440]) test(`seeded designer Close restores the rendered source and scroll after a native fragment at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/pergolas-auckland?utm_source=synthetic-return');
  await page.getByRole('link', { name: 'Explore your pergola', exact: true }).click();
  const heading = page.getByRole('heading', { level: 1 });
  const title = await heading.innerText();
  for (let round = 0; round < 2; round++) {
    const open = page.getByRole('link', { name: /^(Customise in 3D|Continue your design)$/ });
    await open.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => Math.max(window.scrollY, document.body.scrollTop));
    await open.click();
    await expect(page.getByRole('dialog', { name: 'Design your pergola', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
    await expect(page).toHaveURL('/pergolas-auckland?utm_source=synthetic-return#explore-options');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect.poll(async () => Math.abs(await page.evaluate(() => Math.max(window.scrollY, document.body.scrollTop)) - before)).toBeLessThan(4);
  }
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
});
