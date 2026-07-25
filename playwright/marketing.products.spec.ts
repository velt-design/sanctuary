import { expect, test, type Locator, type Page } from '@playwright/test';
import { products } from '../apps/marketing/data/products';
import { buildEnquiryHref } from '../apps/marketing/lib/enquiryContext';

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
const mobileRefinementRoutes = [
  {
    route: '/products',
    maximumHeightAt390: 10_258,
    disclosureKinds: ['form-comparison', 'planning-guides'],
  },
  {
    route: '/products/pergolas/gable',
    maximumHeightAt390: 7_200,
    disclosureKinds: [
      'fit-and-definition',
      'specification-and-tradeoffs',
      'related-support',
    ],
  },
  {
    route: '/products/screens-walls/drop-down-blinds',
    maximumHeightAt390: 7_200,
    disclosureKinds: [
      'fit-and-definition',
      'specification-and-tradeoffs',
      'related-support',
    ],
  },
  {
    route: '/products/lighting-heating/patio-heaters',
    maximumHeightAt390: 7_200,
    disclosureKinds: [
      'fit-and-definition',
      'specification-and-tradeoffs',
      'related-support',
    ],
  },
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
  const images = main.locator('img');
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  let visibleCount = 0;

  for (let index = 0; index < count; index += 1) {
    const image = images.nth(index);
    const isVisible = await image.evaluate((element) => (
      element.checkVisibility()
      && !element.closest('details:not([open])')
    ));
    if (!isVisible) continue;
    visibleCount += 1;
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element) => {
      const candidate = element as HTMLImageElement;
      return candidate.complete ? candidate.naturalWidth : 0;
    })).toBeGreaterThan(0);
  }
  expect(visibleCount).toBeGreaterThan(0);
}

async function expectMinimumTouchTargets(main: Locator) {
  const undersized = await main.locator('a:visible, button:visible, summary:visible')
    .evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        label:
          element.getAttribute('aria-label') ??
          element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60) ??
          element.tagName,
        width: Math.round(rect.width),
      };
    }).filter(({ height, width }) => height < 44 || width < 44));

  expect(undersized).toEqual([]);
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
      const product = products.find((candidate) => candidate.route === route);
      const expectedEnquiryHref = buildEnquiryHref({
        sourcePath: route,
        sourceComponent: 'product_cta',
        ...(product ? { sourceProduct: product.slug } : {}),
      });
      await expect(h1).toHaveCount(1);
      await expect(h1).toBeVisible();
      await expect(main.getByRole('link', { name: 'Send your project details' }).first())
        .toHaveAttribute('href', expectedEnquiryHref);
      await expect(main).not.toContainText('[[VERIFY]]');
      await expect(main).not.toContainText('—');
      const emDashDecorationCount = await main.locator('*').evaluateAll((elements) =>
        elements.reduce((count, element) => {
          const before = getComputedStyle(element, '::before').content;
          const after = getComputedStyle(element, '::after').content;
          return count + Number(before.includes('—')) + Number(after.includes('—'));
        }, 0),
      );
      expect(emDashDecorationCount).toBe(0);
      await expectNoOverflowOrNestedScroll(page, main);
      await expectVisibleImagesLoaded(main);
    });
  }
}

test('the refined mobile journey is shorter, scannable and touch safe at target widths', async ({
  page,
}) => {
  test.slow();
  await preparePage(page, true);

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    for (const routeCase of mobileRefinementRoutes) {
      await page.goto(routeCase.route, { waitUntil: 'networkidle' });
      const main = page.locator('main[data-marketing-foundation-page]:visible').last();
      const disclosures = main.locator('details[data-product-mobile-disclosure]');

      await expect(main.locator('h1:visible')).toHaveCount(1);
      await expect(disclosures).toHaveCount(routeCase.disclosureKinds.length);
      await expect(disclosures.evaluateAll((items) => items.map(
        (item) => item.getAttribute('data-product-mobile-disclosure'),
      ))).resolves.toEqual([...routeCase.disclosureKinds]);
      for (const disclosure of await disclosures.all()) {
        await expect(disclosure).not.toHaveAttribute('open', '');
        expect((await disclosure.locator(':scope > summary').boundingBox())?.height ?? 0)
          .toBeGreaterThanOrEqual(44);
      }

      const callsToAction = main.getByRole('link', {
        name: 'Send your project details',
      });
      await expect(callsToAction).toHaveCount(2);
      expect((await callsToAction.first().boundingBox())?.y ?? 844)
        .toBeLessThan(844);

      if (routeCase.route === '/products') {
        const categoryNav = main.locator('[data-product-category-nav]');
        await expect(categoryNav).toBeVisible();
        await expect(categoryNav.locator('a')).toHaveCount(3);
      } else {
        const galleries = main.locator('[data-product-gallery]');
        await expect(galleries).toHaveCount(1);
        await expect(galleries).toHaveAttribute('data-product-gallery', 'primary');
        await expect(galleries.locator('[data-responsive-gallery]')).toHaveCount(1);
      }

      if (width === 390) {
        expect((await main.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
          .toBeLessThanOrEqual(routeCase.maximumHeightAt390);
      }

      await expectNoOverflowOrNestedScroll(page, main);
      await expectMinimumTouchTargets(main);
    }
  }
});

test('all ten product routes retain the complete mobile content contract', async ({ page }) => {
  test.slow();
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);

  for (const product of products) {
    const response = await page.goto(product.route, { waitUntil: 'networkidle' });
    expect(response?.ok(), `${product.route} should resolve`).toBe(true);

    const main = page.locator('main[data-product-detail]:visible').last();
    await expect(main.locator('h1:visible')).toHaveCount(1);
    await expect(main.locator('[data-product-gallery="primary"]')).toHaveCount(1);
    await expect(main.locator('[data-responsive-gallery]')).toHaveCount(1);
    await expect(
      main.locator('details[data-product-mobile-disclosure]').evaluateAll((items) => items.map(
        (item) => item.getAttribute('data-product-mobile-disclosure'),
      )),
    ).resolves.toEqual([
      'fit-and-definition',
      'specification-and-tradeoffs',
      'related-support',
    ]);
    await expect(main.getByText(product.decision.worksWhen[0], { exact: true }))
      .toBeVisible();
    await expect(main.getByText(product.decision.resolve[0], { exact: true }))
      .toBeVisible();
    await expect(main).not.toContainText('—');
    await expect(main.getByRole('link', { name: 'Send your project details' }))
      .toHaveCount(2);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${product.route}`,
    );

    const schemaTypes = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).flatMap((script) => {
      const parsed = JSON.parse(script) as
        | Record<string, unknown>
        | Array<Record<string, unknown>>;
      return (Array.isArray(parsed) ? parsed : [parsed]).map((node) => node['@type']);
    });
    expect(schemaTypes).toEqual(expect.arrayContaining([
      'Product',
      'BreadcrumbList',
      'FAQPage',
    ]));

    const emDashDecorationCount = await main.locator('*').evaluateAll((elements) =>
      elements.reduce((count, element) => {
        const before = getComputedStyle(element, '::before').content;
        const after = getComputedStyle(element, '::after').content;
        return count + Number(before.includes('—')) + Number(after.includes('—'));
      }, 0),
    );
    expect(emDashDecorationCount).toBe(0);
    await expectNoOverflowOrNestedScroll(page, main);
  }
});

test('mobile product disclosures are keyboard operable and desktop content stays expanded', async ({
  page,
}) => {
  await preparePage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products/pergolas/gable', { waitUntil: 'networkidle' });

  const main = page.locator('main[data-product-detail]:visible').last();
  const specificationAndTradeoffs = main.locator(
    'details[data-product-mobile-disclosure="specification-and-tradeoffs"]',
  );
  const summary = specificationAndTradeoffs.locator('summary');

  await expect(specificationAndTradeoffs).not.toHaveAttribute('open', '');
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(specificationAndTradeoffs).toHaveAttribute('open', '');
  await expect(
    specificationAndTradeoffs.getByText('Structure and materials', {
      exact: true,
    }),
  )
    .toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(specificationAndTradeoffs).toHaveAttribute('open', '');
  await expect(summary).toBeHidden();
  await expect(
    specificationAndTradeoffs.getByText('Care', { exact: true }),
  ).toBeVisible();
});

test('collapsed mobile decision content remains server rendered', async ({ request }) => {
  const response = await request.get('/products/pergolas/gable');
  expect(response.ok()).toBe(true);
  const html = await response.text();

  expect(html).toMatch(
    /<details[^>]*data-product-mobile-disclosure="specification-and-tradeoffs"[^>]*open=""/,
  );
  expect(html).toContain('Structure and materials');
  expect(html).toContain('Volume versus visual presence');
  expect(html).toContain('Ridge height, eave height and the view from inside the house.');
});

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

test('product details render one controlled gallery sequence', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  const product = products.find((item) => item.slug === 'gable');
  if (!product) throw new Error('Missing representative gable product');
  await page.goto(product.route);

  const main = page.locator('main[data-product-detail]:visible').last();
  const hero = main.locator('section').first();
  expect((await hero.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(890);
  await expect(hero.locator('img').first()).toHaveCSS('object-position', '50% 18%');

  const gallerySection = main.locator('[data-product-gallery="primary"]');
  const gallery = gallerySection.locator('[data-responsive-gallery]');
  await expect(gallerySection).toHaveCount(1);
  await expect(gallery).toHaveCount(1);
  await expect(gallery.locator('img')).toHaveCount(1);
  await expect(gallery).toHaveAttribute('data-gallery-position', `1/${product.gallery.length}`);
  await expect(gallery).toHaveAccessibleName(`${product.name} project gallery`);

  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gallery).toHaveAttribute('data-gallery-position', `2/${product.gallery.length}`);
  await expect(gallery.locator('img')).toHaveAttribute(
    'alt',
    product.gallery[1].alt,
  );
});

test('unpublished heater evidence is labelled rather than inferred from context imagery', async ({ page }) => {
  await preparePage(page);
  await page.goto('/products/lighting-heating/patio-heaters');

  const main = page.locator('main[data-product-detail]:visible').last();
  await expect(main).not.toContainText('—');
  await expect(page.getByRole('heading', {
    name: 'No named heater installation is published yet.',
  })).toBeVisible();
  await expect(page.locator('p:visible').filter({
    hasText: 'Context photography must not be read as heater-product evidence.',
  }).first()).toBeVisible();
  await expect(main.locator('a[href="/products/lighting-heating/downlights"]'))
    .toHaveCount(1);
  await expect(main.locator('a[href="/products/screens-walls/drop-down-blinds"]'))
    .toHaveCount(1);
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
