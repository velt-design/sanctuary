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

test('selected and restored professional enquiries retain their audience through every new entry', async ({ page, browser }) => {
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
  const noJs = await browser.newContext({ javaScriptEnabled: false });
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

test('unavailable estimates remain honest and retry without shifting the next roofline', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  let recover = false;
  await page.route('**/api/configurator-price', route => route.fulfill({ json: recover
    ? { status: 'priced', amountIncGst: 12000, breakdown: [] }
    : { status: 'unavailable' } }));
  await page.goto('/');
  const first = page.locator('[data-product-type="pitched"]');
  await expect(first.getByText('Estimate unavailable', { exact: true })).toBeVisible();
  await expect(first.locator('[data-priced="true"]')).toHaveCount(0);
  const next = page.locator('[data-product-type="gable"]');
  const before = await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  recover = true;
  await first.getByRole('button', { name: 'Retry estimate' }).click();
  await expect(first.locator('[data-priced="true"]')).toHaveText('$12,000');
  const after = await next.evaluate(element => element.getBoundingClientRect().top + window.scrollY);
  expect(Math.abs(after - before)).toBeLessThan(2);
});
