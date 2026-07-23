import { expect, test, type Locator, type Page } from '@playwright/test';
import { products } from '../apps/marketing/data/products';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const representativeRoutes = [
  '/products',
  '/products/pergolas/gable',
  '/products/screens-walls/drop-down-blinds',
] as const;
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

async function preparePage(page: Page, reducedMotion = false) {
  await page.emulateMedia({ reducedMotion: reducedMotion ? 'reduce' : 'no-preference' });
  await page.addInitScript(() => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  });
}

async function expectNoOverflowOrNestedScroll(page: Page, main: Locator) {
  const evidence = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>('main[data-marketing-foundation-page]');
    const nestedScrollers = root
      ? [...root.querySelectorAll<HTMLElement>('*')]
          .filter((element) => {
            const style = getComputedStyle(element);
            const scrolls = /(auto|scroll)/.test(style.overflowY);
            return scrolls && element.scrollHeight > element.clientHeight + 1;
          })
          .map((element) => ({
            tag: element.tagName,
            className: element.className,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
          }))
      : [];

    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      nestedScrollers,
    };
  });

  await expect(main).toBeVisible();
  expect(evidence.documentScrollWidth).toBeLessThanOrEqual(evidence.documentClientWidth);
  expect(evidence.bodyScrollWidth).toBeLessThanOrEqual(evidence.bodyClientWidth);
  expect(evidence.nestedScrollers).toEqual([]);
}

async function expectVisibleImagesLoaded(main: Locator) {
  const images = main.locator('img:visible');
  const count = await images.count();
  expect(count).toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element) => {
      const candidate = element as HTMLImageElement;
      return candidate.complete ? candidate.naturalWidth : 0;
    })).toBeGreaterThan(0);
  }
}

test('the product catalogue owns all ten canonical routes and the sitemap exposes them', async ({ page }) => {
  await preparePage(page);
  await page.goto('/products');

  const main = page.locator('main[data-products-index]');
  await expect(main.locator('h1')).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(
    'Cover the deck. Keep the light.',
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicOrigin}/products`,
  );

  const productHrefs = await main.locator('a[href^="/products/"]').evaluateAll(
    (links) => [...new Set(
      links
        .map((link) => link.getAttribute('href'))
        .filter((href): href is string => Boolean(href)),
    )],
  );
  expect(productHrefs.sort()).toEqual(products.map((product) => product.route).sort());

  await page.goto('/sitemap.xml');
  const sitemap = await page.locator('body').innerText();
  for (const product of products) {
    expect(sitemap).toContain(`${publicOrigin}${product.route}`);
  }
});

for (const viewport of viewports) {
  for (const route of representativeRoutes) {
    test(`${route} is accessible and responsive at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await preparePage(page);
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.ok(), `${route} should resolve`).toBe(true);

      const main = page.locator('main[data-marketing-foundation-page]:visible').last();
      const h1 = main.locator('h1:visible');
      await expect(h1).toHaveCount(1);
      await expect(h1).toBeVisible();
      await expect(main.getByRole('link', { name: 'Send your project details' }).first())
        .toHaveAttribute('href', '/contact?enquiry=residential#contact-form');
      await expect(main).not.toContainText('[[VERIFY]]');
      await expectNoOverflowOrNestedScroll(page, main);
      await expectVisibleImagesLoaded(main);
    });
  }
}

test('a pergola form and an accessory preserve metadata, structured data and evidence', async ({ page }) => {
  await preparePage(page);

  for (const product of [
    products.find((item) => item.slug === 'gable'),
    products.find((item) => item.slug === 'drop-down-blinds'),
  ]) {
    if (!product) throw new Error('Missing representative product');
    await page.goto(product.route);

    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${product.route}`,
    );
    await expect(page).toHaveTitle(new RegExp(product.metadata.title));
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      product.metadata.description,
    );

    const schemaTypes = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).flatMap((script) => {
      const parsed = JSON.parse(script) as Record<string, unknown> | Array<Record<string, unknown>>;
      return (Array.isArray(parsed) ? parsed : [parsed]).map((node) => node['@type']);
    });
    expect(schemaTypes).toContain('Product');
    expect(schemaTypes).toContain('BreadcrumbList');
    expect(schemaTypes).toContain('FAQPage');
    await expect(page.getByText('Built evidence', { exact: true }).first()).toBeVisible();
  }
});

test('unpublished heater evidence is labelled rather than inferred from context imagery', async ({ page }) => {
  await preparePage(page);
  await page.goto('/products/lighting-heating/patio-heaters');

  await expect(page.getByRole('heading', {
    name: 'No named heater installation is published yet.',
  })).toBeVisible();
  await expect(page.locator('p:visible').filter({
    hasText: 'Context photography must not be read as heater-product evidence.',
  }).first()).toBeVisible();
});

test('product media motion is removed when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page, true);
  await page.goto('/products');

  const firstCardImage = page.locator('main[data-products-index] article img').first();
  await expect(firstCardImage).toBeVisible();
  expect(await firstCardImage.evaluate((image) => getComputedStyle(image).transitionDuration))
    .toBe('0s');
});
