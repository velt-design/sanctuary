import { expect, test } from '@playwright/test';

const path = '/pergola-cost-auckland';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/landing-price-table', route => route.fulfill({ status: 503, json: { status: 'unavailable' } }));
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, version: 1, updatedAt: new Date().toISOString() })));
  await page.route('**/api/configurator-price', route => route.fulfill({ json: { status: 'priced', amountIncGst: 12345, currency: 'NZD', includesGst: true, breakdown: [], versionNumber: 2, calculationRef: 'synthetic-cost-test' } }));
});

for (const width of [320, 390, 768, 1440]) test(`cost answer, responsive content and focus at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(path);
  const main = page.locator('main[data-seo-landing="pergola-cost-auckland"]');
  await expect(main.locator('h1')).toHaveText('What will yourpergola cost?');
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  const amount = page.locator('#explore-options strong').filter({ hasText: '$12,345' });
  expect((await amount.boundingBox())!.y).toBeLessThan(650);
  await expect(page.locator('header.site')).not.toHaveAttribute('data-hero-navigation', 'overlay');
  await expect(page.locator('#cost-projects img')).toHaveCount(2);
  await page.locator('#cost-projects').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#cost-projects img').evaluateAll(images => images.every(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(page.locator('#cost-projects')).toContainText('not prices or standard packages');
  await expect(page.getByRole('navigation', { name: 'Related planning decisions' })).toBeVisible();
  const question = page.locator('#pergola-cost-faq summary').first();
  expect((await question.boundingBox())!.height).toBeLessThan(105);
  await question.click();
  await expect(page.locator('#pergola-cost-faq details').first()).toContainText('The estimator above gives an initial installed price');
  await expect(page.locator('#pergola-cost-faq details').first().locator('p')).toBeVisible();
  await question.click();
  await expect(page.locator('form.acrylic-form')).toContainText('Google Ads and Meta');
  await page.getByRole('radio', { name: 'Pitched', exact: true }).focus();
  await expect(page.getByRole('radio', { name: 'Pitched', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toBeChecked();
  expect(await page.getByRole('radio', { name: 'Gable', exact: true }).evaluate(input => getComputedStyle(input.parentElement!).outlineStyle)).not.toBe('none');
  await expect(page.locator('#explore-options')).toContainText('$12,345');
  const overflow = await main.evaluate(element => [...element.querySelectorAll<HTMLElement>('*')].filter(node => node.checkVisibility() && !node.closest('[aria-hidden="true"], .acrylic-form__honeypot')).filter(node => { const rect = node.getBoundingClientRect(); return rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1); }).map(node => node.tagName));
  expect(overflow).toEqual([]);
});

test('cost canonical, research schema and native enquiry remain available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(path);
  await expect(page).toHaveTitle('Pergola Cost Auckland | Estimate Your Pergola');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${path}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('form.acrylic-form')).toHaveAttribute('action', '/api/enquiry/fallback');
  await expect(page.getByRole('button', { name: 'Send project brief' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'the project enquiry form', exact: true })).toBeVisible();
  const schemas = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(text => JSON.parse(text));
  expect(schemas.filter(node => node['@type'] === 'WebPage')).toHaveLength(1);
  expect(schemas.filter(node => node['@type'] === 'BreadcrumbList')).toHaveLength(1);
  expect(schemas.filter(node => ['Offer', 'Service'].includes(node['@type']))).toHaveLength(0);
  const source = JSON.parse(await page.locator('input[name="enquiryContext"]').inputValue());
  expect(source).toMatchObject({ source_path: path, source_component: 'embedded_form' });
  expect(await (await page.request.get('/sitemap.xml')).text()).toContain(`https://www.sanctuarypergolas.co.nz${path}`);
  await context.close();
});

test('cost and Auckland share exploration but use the destination page for enquiry and return', async ({ page }) => {
  await page.goto('/pergolas-auckland');
  await page.getByRole('radio', { name: 'Gable', exact: true }).check();
  await page.getByRole('textbox', { name: 'Width in metres' }).fill('5.4');
  await page.getByRole('textbox', { name: 'Width in metres' }).press('Enter');
  await page.getByRole('radio', { name: 'Mixed + timber', exact: true }).check();
  await page.getByRole('link', { name: 'What shapes the cost', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Gable', exact: true })).toBeChecked();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('5.4');
  await expect(page.getByRole('radio', { name: 'Mixed + timber', exact: true })).toBeChecked();
  await page.getByRole('link', { name: 'Enquire about this design', exact: true }).click();
  await expect(page).toHaveURL(/source_path=%2Fpergola-cost-auckland/);
  await expect(page.getByRole('link', { name: /Back to website/ })).toHaveAttribute('href', path);
});
