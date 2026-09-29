import { expect, test, type Page } from '@playwright/test';
import { products } from '../apps/marketing/data/products';
import { formatComparisonEstimate } from '../apps/marketing/lib/estimateDisplay';

async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.route(/google-analytics|googletagmanager|facebook\.com/, route => route.abort());
  await page.route(/\/api\/(enquiry|contact)(?:\?|$)/, route => route.abort());
}

for (const width of [320, 390, 820, 1100, 1440]) test(`overview compares all rooflines accessibly at ${width}`, async ({ page }) => {
  await prepare(page); await page.setViewportSize({ width, height: 900 });
  await page.goto('/products');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pergolas.');
  const cards = page.locator('[data-product-form-grid] > article');
  await expect(cards).toHaveCount(3);
  await expect(cards.locator('[data-priced]')).toHaveCount(3);
  for (const card of await cards.all()) {
    await expect(card.getByText('Including installation', { exact: true })).toBeVisible();
    await expect(card.getByRole('link', { name: /^Explore / })).toHaveAttribute('href', /\/products\/pergolas\//);
  }
  for (const radio of await page.getByRole('radio').all()) {
    const box = await radio.boundingBox(); expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  if (width <= 760) {
    const overview = page.getByRole('navigation', { name: 'Explore the three rooflines' });
    await expect(overview.getByRole('link')).toHaveCount(3);
    expect((await overview.boundingBox())!.y + (await overview.boundingBox())!.height).toBeLessThan(650);
    await overview.getByRole('link', { name: /Box/ }).click();
    await expect(page.locator('#compare-box-perimeter h2')).toBeInViewport();
    await expect(page.locator('#compare-pitched')).toBeVisible();
  } else {
    const positions = await cards.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top));
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
    if (width === 1440) for (const link of await cards.getByRole('link').all()) { const box = (await link.boundingBox())!; expect(box.y + box.height).toBeLessThanOrEqual(900); }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('shared size changes show only matching approved responses and keyboard selection', async ({ page }) => {
  await prepare(page);
  const requests: Array<{ width: number; family: string; connection: string }> = [];
  await page.route('**/api/configurator-price', async route => {
    const draft = route.request().postDataJSON();
    requests.push({ width: draft.input.widthMm, family: draft.roof.family, connection: draft.input.connection });
    await new Promise(resolve => setTimeout(resolve, draft.input.widthMm === 3000 ? 500 : 80));
    await route.fulfill({ json: { status: 'priced', amountIncGst: draft.input.widthMm + ({ mono: 11000, gable: 12000, box: 13000 }[draft.roof.family as 'mono' | 'gable' | 'box']), breakdown: [] } });
  });
  await page.goto('/products');
  const cards = page.locator('[data-product-form-grid]');
  await expect(cards.locator('[data-priced]')).toHaveCount(3);
  await page.getByRole('radio', { name: '3 × 3 m', exact: true }).check();
  await expect(cards.locator('[data-priced]')).toHaveCount(0);
  await page.waitForTimeout(260);
  await page.getByRole('radio', { name: '9 × 3 m', exact: true }).check();
  await expect(cards.locator('[data-example-width="9000"]')).toHaveCount(3);
  await expect(cards.locator('[data-priced]')).toHaveCount(3);
  await page.waitForTimeout(550);
  await expect(cards.locator('[data-priced]').first()).toContainText(formatComparisonEstimate(20000));
  const nine = page.getByRole('radio', { name: '9 × 3 m', exact: true });
  await nine.focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('radio', { name: '6 × 3 m', exact: true })).toBeChecked();
  expect(requests.some(request => request.family === 'box' && request.connection === 'facade')).toBe(true);
  expect(requests.filter(request => request.family !== 'box').every(request => request.connection === 'fascia')).toBe(true);
});

for (const width of [320, 820, 1440]) test(`overview price failure and recovery keep actions stable at ${width}`, async ({ page }) => {
  await prepare(page); await page.setViewportSize({ width, height: 1000 });
  let fail = true;
  await page.route('**/api/configurator-price', route => route.fulfill({ json: fail ? { status: 'unavailable' } : { status: 'priced', amountIncGst: 14551, breakdown: [] } }));
  await page.goto('/products');
  const cards = page.locator('[data-product-form-grid] > article');
  await expect(cards.getByRole('button', { name: /^Retry / })).toHaveCount(3);
  const before = await cards.getByRole('link').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top + scrollY));
  fail = false;
  for (const title of ['Pitched', 'Gable', 'Box']) await cards.getByRole('button', { name: `Retry ${title} 6 × 3 m estimate`, exact: true }).click();
  await expect(cards.locator('[data-priced]')).toHaveCount(3);
  const after = await cards.getByRole('link').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().top + scrollY));
  after.forEach((top, index) => expect(Math.abs(top - before[index])).toBeLessThanOrEqual(2));
});

test('overview preserves saved product choice and support routes', async ({ page }) => {
  await prepare(page);
  await page.addInitScript(() => sessionStorage.setItem('sanctuary:pitched-product:v1', JSON.stringify({ widthMm: 4900, projectionMm: 3000, material: 'acrylic', sides: 'open', orientation: 'parallel' })));
  await page.goto('/products');
  await page.getByRole('radio', { name: '9 × 3 m', exact: true }).check();
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary:pitched-product:v1')!).widthMm)).toBe(4900);
  await page.getByRole('link', { name: 'Explore Pitched', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('4.9');
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pergolas.');
  for (const product of products.filter(product => product.categorySlug !== 'pergolas')) {
    await expect(page.locator(`[data-product-option-gateway] a[href="${product.route}"]`)).toHaveCount(1);
  }
  await expect(page.getByRole('link', { name: /^Discuss a bespoke design/ })).toHaveAttribute('href', /enquiry_intent=bespoke/);
  await expect(page.locator('a[href="/pergola-cost-auckland"]')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.sanctuarypergolas.co.nz/products');
  await page.getByText('Compare rooflines in more detail', { exact: false }).first().click();
  await expect(page.getByRole('table', { name: 'Pergola form comparison' })).toBeVisible();
});
