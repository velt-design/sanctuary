import { expect, test } from '@playwright/test';

test.skip(process.env.HOMEPAGE_CHALLENGER_PREVIEW !== '1', 'Requires an explicitly selected challenger preview.');

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({
    analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1,
  })));
  // Never send an enquiry or load a vendor while verifying preview navigation.
  await page.route(/\/api\/(enquiry|contact)(?:\?|$)/, route => route.abort());
  await page.route(/google-analytics|googletagmanager|facebook\.net|clarity\.ms/, route => route.abort());
});

for (const width of [320, 390, 1440]) {
  test(`complete challenger remains readable and navigable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-homepage-preview]')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.getByRole('link', { name: 'Find your pergola', exact: true }).click();
    for (const type of ['pitched', 'gable', 'box-perimeter']) {
      const card = page.locator(`[data-product-type="${type}"]`);
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('img')).toBeVisible();
      await expect.poll(() => card.locator('img').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      await expect(card.locator('h3 a')).toHaveAttribute('href', `/products/pergolas/${type}`);
    }
    await expect(page.getByText('Installed estimates include GST. Subject to site confirmation.', { exact: false })).toBeVisible();
    await page.getByText('Estimate details & illustrations').click();
    await expect(page.getByText(/Product links preserve your saved choices/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore this project' })).toHaveAttribute('href', '/projects/warkworth-outdoor-room');
    await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', /enquiry_type=residential/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width < 760) expect(await page.getByText('Installed estimates include GST.', { exact: false }).evaluate(e => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(14);
    else {
      const color = await page.locator('header .nav-cta').evaluate(e => getComputedStyle(e).color);
      expect(color).not.toBe('rgb(255, 255, 255)');
    }
  });
}

test('selected and restored professional enquiries retain their audience through every new entry', async ({ page, browser }, testInfo) => {
  await page.goto('/');
  await page.locator('button[data-project-direction="commercial-professional"]').click();
  await page.locator('button[data-professional-path="architects-designers"]').click();
  const hero = page.getByRole('link', { name: 'Enquire about your space' });
  await expect(hero).toHaveAttribute('href', /enquiry_type=professional/);
  await expect(hero).toHaveAttribute('href', /project_professional_path=architects-designers/);
  await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'The whole space. Every detail.' })).toHaveCount(0);
  const restoredURL = page.url();
  await page.reload();
  await expect(hero).toHaveAttribute('href', /enquiry_type=professional/);
  await hero.click();
  await expect(page).toHaveURL(/enquiry_type=professional/);
  await page.goBack();
  await expect(hero).toHaveAttribute('href', /project_professional_path=architects-designers/);
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    extraHTTPHeaders: testInfo.project.use.extraHTTPHeaders,
  });
  const initial = await noJs.newPage();
  await initial.goto(restoredURL);
  await expect(initial.getByRole('link', { name: 'Enquire about your space' })).toHaveAttribute('href', /enquiry_type=professional/);
  await noJs.close();
  await page.getByRole('button', { name: 'Start again', exact: true }).click();
  await expect(hero).toHaveAttribute('href', /enquiry_type=residential/);
  await expect(hero).not.toHaveAttribute('href', /project_professional_path/);
  await expect(page.getByRole('link', { name: 'Discuss your project' })).toHaveAttribute('href', /enquiry_type=residential/);
});

test('legacy and bespoke saved priorities survive reload, Back and reset', async ({ page }) => {
  for (const direction of ['cover', 'bespoke']) {
    await page.goto(`/?project=${direction}&priorities=daylight`);
    await expect(page.locator('[data-project-finder-result]')).toHaveAttribute('data-project-finder-result', direction);
    await expect(page.locator('[data-project-priority="daylight"]')).toBeChecked();
    const hero = page.getByRole('link', { name: 'Enquire about your space' });
    await expect(hero).toHaveAttribute('href', /project_priorities=daylight/);
    await page.reload();
    await expect(page.locator('[data-project-priority="daylight"]')).toBeChecked();
    await hero.click();
    await expect(page).toHaveURL(/\/contact\?/);
    await page.goBack();
    await expect(hero).toHaveAttribute('href', new RegExp(`project_direction=${direction}`));
    await page.getByRole('button', { name: 'Start again', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Discuss your project' })).toBeVisible();
    await expect(hero).not.toHaveAttribute('href', /project_priorities/);
  }
});

test('nine size-price pairs load and recover independently without moving the comparison', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  let recover = false;
  const requests: string[] = [];
  let release!: () => void;
  const loading = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/configurator-price', async route => {
    const { input, roof } = route.request().postDataJSON();
    requests.push(`${roof.family}:${input.widthMm}:${input.projectionMm}`);
    await loading;
    await route.fulfill({ json: recover
      ? { status: 'priced', amountIncGst: input.widthMm + 5000, breakdown: [] }
      : { status: 'unavailable' } });
  });
  await page.goto('/');
  const first = page.locator('[data-product-type="pitched"] [data-price-example="4000"]');
  await expect(page.getByText('Updating…', { exact: true })).toHaveCount(9);
  await expect.poll(() => requests.length).toBe(9);
  expect(new Set(requests).size).toBe(9);
  const next = page.locator('[data-product-type="gable"]');
  const before = await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  release();
  await expect(page.getByRole('button', { name: /estimate unavailable. Retry/ })).toHaveCount(9);
  await expect(page.locator('[data-priced="true"]')).toHaveCount(0);
  expect(Math.abs(await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY) - before)).toBeLessThan(2);
  recover = true;
  await first.getByRole('button', { name: 'Pitched 4 × 3 m estimate unavailable. Retry' }).click();
  await expect(first.locator('[data-priced="true"]')).toHaveText('$9,000');
  await expect(page.getByRole('button', { name: /estimate unavailable. Retry/ })).toHaveCount(8);
  for (const row of await page.locator('[data-price-example]').all()) {
    if (await row.getByRole('button').count()) await row.getByRole('button').click();
  }
  await expect(page.locator('[data-priced="true"]')).toHaveCount(9);
  for (const type of ['pitched', 'gable', 'box-perimeter']) {
    for (const [width, price] of [[4000, '$9,000'], [6000, '$11,000'], [8000, '$13,000']] as const) {
      const row = page.locator(`[data-product-type="${type}"] [data-price-example="${width}"]`);
      await expect(row.locator('dt')).toHaveText(`${width / 1000} × 3 m`);
      await expect(row.locator('[data-priced="true"]')).toHaveText(price);
    }
  }
  const after = await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(2);
  expect(requests).toHaveLength(18);
});

test('roofline entry preserves a saved product size rather than applying an example', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('sanctuary:pitched-product:v1', JSON.stringify({ widthMm: 7400, projectionMm: 3000, material: 'acrylic', sides: 'open', orientation: 'parallel' })));
  await page.goto('/');
  await page.locator('[data-product-type="pitched"] h3 a').click();
  await expect(page).toHaveURL(/\/products\/pergolas\/pitched/);
  await expect(page.getByRole('textbox', { name: /width/i })).toHaveValue('7.4');
  await page.goBack();
  await expect(page.locator('[data-product-type="pitched"] [data-price-example]')).toHaveCount(3);
});
