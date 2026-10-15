import { expect, test } from '@playwright/test';

test.use({ actionTimeout: 15000 });

const path = '/auckland-outdoor-living';
const taggedPath = `${path}?utm_source=facebook&utm_medium=paid_social&utm_campaign=auckland_residential&utm_content=riverhead&fbclid=synthetic-campaign-click`;

test.beforeEach(async ({ page, baseURL }) => {
  // Intercept every external request. Tests must not create provider evidence.
  await page.route('**/*', route => {
    if (new URL(route.request().url()).origin !== new URL(baseURL!).origin) return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return route.continue();
  });
  await page.route('**/api/*price*', route => route.fulfill({ json: { status: 'unavailable' } }));
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
});

for (const width of [320, 390, 1440]) {
  test(`campaign page and direct enquiry recover at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(taggedPath);
    await page.getByRole('button', { name: 'Essential only', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make roomfor life outside.');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`campaign-${width}.png`), fullPage: true });

    await page.getByRole('link', { name: 'Tell us about your space', exact: true }).click();
    const form = page.locator('form[data-inline-enquiry]');
    await expect(form.locator('[name=enquiryType]')).toHaveValue('residential');
    let submitted: Record<string, any> | undefined;
    let attempts = 0;
    await page.route('**/api/enquiry', route => {
      attempts++;
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: attempts === 1 ? 503 : 200, json: { ok: attempts > 1 } });
    });
    await form.getByRole('button', { name: 'Send my enquiry', exact: true }).click();
    await expect(form.getByRole('alert')).toBeFocused();
    expect(attempts).toBe(0);
    await form.locator('[name=name]').fill('Synthetic Campaign Test');
    await form.locator('[name=phone]').fill('0210000000');
    await form.locator('[name=email]').fill('synthetic@example.test');
  await form.locator('[name=suburb]').fill('Albany');
    await form.locator('[name=suburb]').fill('Auckland');
    await form.locator('[name=message]').fill('Synthetic local test. Do not send.');
    await form.getByRole('button', { name: 'Send my enquiry', exact: true }).click();
    await expect(form.getByRole('alert')).toBeVisible();
    await expect(form.locator('[name=name]')).toHaveValue('Synthetic Campaign Test');
    const submissionId = submitted!.submissionId;
    await form.getByRole('button', { name: 'Send my enquiry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
    expect(submitted!.submissionId).toBe(submissionId);
    expect(submitted!.page).toBe(path);
    expect(submitted!.enquiryContext).toMatchObject({ source_path: path, enquiry_type: 'residential', source_component: 'embedded_form' });
    expect(submitted!.attribution.utm).toEqual({});
    expect(submitted!.attribution.meta).toBeUndefined();
    await expect(form).toHaveCount(0);
  });
}

test('accepted campaign attribution survives optional designer exploration and browser return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(taggedPath);
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('sanctuary.campaign-context.v1'))).not.toBeNull();
  const before = await page.evaluate(() => sessionStorage.getItem('sanctuary.campaign-context.v1'));
  await page.getByRole('link', { name: 'Explore your design in 3D', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Design your pergola' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('sanctuary.campaign-context.v1'))).toBe(before);
  await page.getByRole('button', { name: 'Close configurator', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make roomfor life outside.');
  let payload: Record<string, any> | undefined;
  await page.route('**/api/enquiry', route => { payload = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } }); });
  const form = page.locator('form[data-inline-enquiry]');
  await form.locator('[name=name]').fill('Synthetic Test');
  await form.locator('[name=phone]').fill('0210000000');
  await form.locator('[name=email]').fill('synthetic@example.test');
  await form.locator('[name=suburb]').fill('Albany');
  await form.getByRole('button', { name: 'Send my enquiry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your enquiry has been sent.' })).toBeVisible();
  expect(payload!.attribution.utm).toMatchObject({ utm_source: 'facebook', utm_medium: 'paid_social', utm_campaign: 'auckland_residential', utm_content: 'riverhead' });
  expect(payload!.attribution.landingPage).toMatch(/\/auckland-outdoor-living$/);
  expect(payload!.attribution.meta.fbc).toContain('synthetic-campaign-click');
});

test('Clarity keeps the campaign route consent gated and refuses private query values', async ({ page }) => {
  await page.goto(taggedPath);
  await expect(page.getByRole('region', { name: 'Cookie preferences' })).toBeVisible();
  await expect(page.locator('#sp-clarity')).toHaveCount(0);
  await page.getByRole('button', { name: 'Accept all', exact: true }).click();
  await expect(page.locator('#sp-clarity')).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { sanctuaryClarityActive: boolean }).sanctuaryClarityActive)).toBe(true);
  await page.goto(`${path}?email=private@example.test`);
  await expect(page.locator('#sp-clarity')).toHaveCount(0);
});

test('no-JavaScript visitors retain the canonical fallback and explicit campaign source', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseURL}${path}`);
  const form = page.locator('form[data-inline-enquiry]');
  await expect(form).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(form).toHaveAttribute('method', 'post');
  await expect(form.locator('input[name="page"]')).toHaveValue(path);
  await expect(form.locator('[name=name]')).toHaveAttribute('required', '');
  await expect(form.locator('[name=phone]')).not.toHaveAttribute('required');
  await expect(form.getByRole('button', { name: 'Send my enquiry' })).toBeEnabled();
  await context.close();
});

test('reduced-motion keyboard visitors can open and close useful answers', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  await page.getByRole('button', { name: 'Essential only', exact: true }).click();
  const question = page.locator('summary').filter({ hasText: 'What will my pergola cost?' });
  await question.focus();
  await page.keyboard.press('Enter');
  await expect(question.locator('..')).toHaveAttribute('open', '');
  await expect(page.getByRole('link', { name: 'See what shapes the cost' })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(question.locator('..')).not.toHaveAttribute('open');
  await expect(question).toBeFocused();
});
