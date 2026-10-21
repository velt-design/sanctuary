import { expect, test, type Page } from '@playwright/test';
import { guideHubItems, servicePaths } from '../apps/marketing/app/pergola-guides/content';

const route = '/pergola-guides';
const viewports = [
  { width: 320, height: 720 }, { width: 390, height: 844 }, { width: 820, height: 1180 },
  { width: 1265, height: 718 }, { width: 1440, height: 1000 }, { width: 2560, height: 1440 },
];
async function prepare(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
}

for (const viewport of viewports) test(`guide choices and real subject photos at ${viewport.width}`, async ({ page }) => {
  await prepare(page);
  await page.setViewportSize(viewport);
  await page.goto(route);
  const main = page.locator('[data-pergola-guide-hub]');
  await expect(page.getByRole('heading', { level: 1, name: 'Pergola guides.' })).toBeVisible();
  await expect(main.locator('[data-guide-link]')).toHaveCount(7);
  await expect(main.locator('[data-service-link]')).toHaveCount(3);
  await expect(main).not.toContainText('Editorial review:');
  const header = await page.locator('header.site').boundingBox();
  const eyebrow = await main.getByText('Ideas for your outdoor space').boundingBox();
  const firstQuestion = await main.locator('[data-guide-card] h3').first().boundingBox();
  expect(eyebrow!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
  expect(firstQuestion!.y + firstQuestion!.height).toBeLessThan(viewport.height - 80);
  await expect(main.locator('[data-hub-enquiry]')).toBeInViewport();
  for (const guide of guideHubItems) {
    const link = main.locator(`[data-guide-link][href="${guide.href}"]`);
    await link.scrollIntoViewIfNeeded();
    await expect(link).toContainText(guide.question);
    await expect.poll(() => link.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeLessThanOrEqual(660);
  }
  await expect(main.locator('[href="/acrylic-pergolas-vs-louvre-roofs"]')).toContainText('Sanctuary does not supply louvre roofs.');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Pergola Guides' })).toHaveAttribute('href', route);
});

test('cost, blinds and roof-form choices navigate and return without losing the hub', async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(route);
  for (const href of ['/pergola-cost-auckland', '/pergolas-with-blinds', '/gable-pergolas-auckland', '/pitched-pergolas-auckland']) {
    const link = page.locator(`[data-guide-link][href="${href}"]`);
    await link.scrollIntoViewIfNeeded();
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('main h1').last()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(link).toBeVisible();
  }
});

test('an undecided visitor can open the canonical help brief, return and open it again', async ({ page }) => {
  await prepare(page);
  await page.goto(route);
  for (const component of ['hero', 'final_cta']) {
    const link = page.locator(`[data-pergola-guide-hub] a[href*="source_component=${component}"]`);
    await link.click();
    await expect(page).toHaveURL(/\/contact\?.*enquiry_intent=help#contact-form$/);
    await expect(page.getByRole('heading', { name: 'Tell us about your space.', exact: true })).toBeVisible();
    const form = page.locator('form').filter({ has: page.locator('[name="enquiryContext"]') });
    await expect(form.locator('[name="phone"]')).toHaveAttribute('required', '');
    await expect(form.locator('[type="file"]')).toBeEnabled();
    expect(JSON.parse(await form.locator('[name="enquiryContext"]').inputValue())).toMatchObject({ source_path: route, source_component: component });
    await page.goBack();
    await expect(page.locator('[data-pergola-guide-hub]')).toBeVisible();
  }
});

test('canonical, indexation, all destinations, guide-only schema and retained brochure redirect', async ({ page, request }) => {
  await prepare(page);
  for (const item of [...guideHubItems, ...servicePaths]) expect((await request.get(item.href)).status(), item.href).toBe(200);
  await page.goto(route);
  await expect(page).toHaveTitle('Pergola Design Guides | Sanctuary Pergolas');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
  const schema = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap(s => JSON.parse(s));
  const list = schema.find(s => s['@type'] === 'ItemList');
  expect(list.numberOfItems).toBe(7);
  expect(list.itemListElement.map((i: { url: string }) => new URL(i.url).pathname)).toEqual(guideHubItems.map(g => g.href));
  expect((await (await request.get('/sitemap.xml')).text())).toContain(route);
  const oldBrochure = await request.get('/downloads/Sanctuary-Pergolas-Brochure.pdf', { maxRedirects: 0 });
  expect(oldBrochure.status()).toBe(308);
  expect(oldBrochure.headers()['x-robots-tag']).toContain('noindex');
});
