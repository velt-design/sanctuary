import { parsePreviewDesign } from '../apps/marketing/components/configurator-prototype/previewShare';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { products } from '../apps/marketing/data/products';
import { buildAssistedEnquiryHref } from '../apps/marketing/lib/configuratorEntry';
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
    maximumHeightAt390: 8_500,
    disclosureKinds: [],
  },
  {
    route: '/products/pergolas/gable',
    maximumHeightAt390: 6_000,
    disclosureKinds: [
      'fit-and-definition',
      'specification-and-tradeoffs',
      'related-support',
    ],
  },
  {
    route: '/products/screens-walls/drop-down-blinds',
    maximumHeightAt390: 6_000,
    disclosureKinds: [
      'fit-and-definition',
      'specification-and-tradeoffs',
      'related-support',
    ],
  },
  {
    route: '/products/lighting-heating/patio-heaters',
    maximumHeightAt390: 6_000,
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

test('the overview exposes standard rooflines and accessories while the sitemap retains all ten routes', async ({ page }) => {
  await preparePage(page);
  await page.goto('/products');

  const main = page.locator('main[data-products-index]');
  await expect(main.locator('h1')).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveText(
    'Pergolas.',
  );
  await expect(main.locator('[data-product-form-grid] > article')).toHaveCount(3);
  await expect(main.getByRole('radio')).toHaveCount(6);
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
  expect(productHrefs.sort()).toEqual(products.filter((product) => product.slug !== 'hip').map((product) => product.route).sort());

  await page.goto('/sitemap.xml');
  const sitemap = await page.locator('body').innerText();
  for (const product of products) {
    expect(sitemap).toContain(`${publicOrigin}${product.route}`);
  }
});

test('the overview connects all three installed offers and actions above the desktop fold', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page);
  await page.goto('/products', { waitUntil: 'domcontentloaded' });
  const section = page.locator('#pergola-forms');
  await expect(section.getByRole('heading', { level: 1, name: 'Pergolas.' })).toBeVisible();
  await expect(section.getByRole('radio')).toHaveCount(6);
  await expect(section.locator('[data-priced="true"]')).toHaveCount(3);
  for (const card of await section.locator('[data-product-form-grid] > article').all()) {
    await expect(card.getByRole('img')).toBeVisible();
    await expect(card.getByText('Including installation', { exact: true })).toBeVisible();
    const action = card.getByRole('link', { name: /^Explore/ });
    await expect(action).toBeVisible();
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(900);
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
      if (route === '/products') {
        await expect(main.getByRole('link', { name: /Discuss a bespoke design/ }))
          .toHaveAttribute('href', buildAssistedEnquiryHref({ sourcePath: route, sourceComponent: 'product_cta' }, 'bespoke'));
      } else if (product?.slug === 'gable') {
        const action = main.getByRole('link', { name: viewport.width <= 760 ? /^Enquire$/ : /Enquire about this design/ });
        await expect(action).toBeVisible();
        const href = await action.getAttribute('href');
        expect(href).toContain('/design-enquiry');
        const url = new URL(href!, publicOrigin);
        expect(url.searchParams.get('source_product')).toBe('gable');
        expect(parsePreviewDesign(url.hash.split('#design=')[1].split('&estimate=')[0])).not.toBeNull();
      } else {
        await expect(main.getByRole('link', { name: 'Send project brief' }).first())
          .toHaveAttribute('href', expectedEnquiryHref);
      }
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

test('the editorial mobile journey is scannable and touch safe at target widths', async ({
  page,
}) => {
  test.slow();
  await preparePage(page, true);

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    for (const routeCase of mobileRefinementRoutes) {
      await page.goto(routeCase.route, { waitUntil: 'networkidle' });
      const main = page.locator('main[data-marketing-foundation-page]:visible').last();
      const disclosures = main.locator('details');

      await expect(main.locator('h1:visible')).toHaveCount(1);
      if (routeCase.route !== '/products') expect(await disclosures.count()).toBeGreaterThanOrEqual(2);
      for (const disclosure of await disclosures.all()) {
        await expect(disclosure).not.toHaveAttribute('open', '');
        expect((await disclosure.locator(':scope > summary').boundingBox())?.height ?? 0)
          .toBeGreaterThanOrEqual(44);
      }

      const callsToAction = main.getByRole('link', {
        name: 'Send project brief',
      });

      if (routeCase.route === '/products') {
        const overview = main.getByRole('navigation', { name: 'Explore the three rooflines' });
        await expect(overview.getByRole('link')).toHaveCount(3);
        for (const link of await overview.getByRole('link').all()) {
          await expect(link).toBeVisible();
          expect((await link.boundingBox())?.y ?? 844).toBeLessThan(844);
        }
        await expect(main.getByRole('radio')).toHaveCount(6);
        await expect(main.getByRole('link', { name: /Discuss a bespoke design/ })).toHaveCount(1);

        const formGrid = main.locator('[data-product-form-grid]');
        await expect(formGrid.locator(':scope > article')).toHaveCount(3);
        expect((await formGrid.boundingBox())?.y ?? Number.POSITIVE_INFINITY)
          .toBeLessThan(844 * 2.5);
        await expect(main.locator('[data-product-option-gateway]'))
          .toHaveCount(2);
        await expect(main.locator('[data-product-option-gateway] img'))
          .toHaveCount(0);
        await expect(main.locator('[data-product-project-grid] > a'))
          .toHaveCount(1);
      } else {
        if (routeCase.route === '/products/pergolas/gable') {
          await expect(main.getByRole('link', { name: /^Enquire$/ })).toHaveCount(1);
          await expect(main.locator('summary').filter({ hasText: 'Compare acrylic, solid and mixed roofing' })).toBeVisible();
        } else {
          await expect(callsToAction).toHaveCount(1);
          await expect(main.getByRole('link', { name: /Explore the details/ })).toBeVisible();
        }

        const galleries = main.locator('[data-product-gallery]');
        await expect(galleries).toHaveCount(1);
        await expect(galleries).toHaveAttribute('data-product-gallery', 'primary');
        await expect(galleries.locator('[data-responsive-gallery]')).toHaveCount(1);
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
    const interactive = ['pitched', 'gable', 'box-perimeter'].includes(product.slug);
    await expect(main.locator('[data-responsive-gallery]')).toHaveCount(interactive ? 2 : 1);
    expect(await main.locator('details').count()).toBeGreaterThanOrEqual(2);
    if (interactive) await main.locator('summary').filter({ hasText: 'Is this roofline right for your home?' }).click();
    for (const tradeoff of product.tradeoffs) await expect(main.getByText(tradeoff.tension, { exact: true })).toBeVisible();
    await expect(main.getByText(product.decision.worksWhen[0], { exact: true }))
      .toBeVisible();
    await expect(main.getByText(product.decision.resolve[0], { exact: true }))
      .toBeVisible();
    await expect(main).not.toContainText('—');
    const enquiryLabel = ['pitched', 'gable', 'box-perimeter'].includes(product.slug)
      ? /^Enquire$/
      : 'Send project brief';
    await expect(main.getByRole('link', { name: enquiryLabel }))
      .toHaveCount(1);
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
      'WebPage',
      'BreadcrumbList',
    ]));
    expect(schemaTypes).not.toContain('FAQPage');
    expect(schemaTypes).not.toContain('Product');

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

test('editorial specification disclosures support keyboard and preserve state across widths', async ({ page }) => {
  await preparePage(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/products/pergolas/gable');
  const details = page.locator('main details').filter({ has: page.locator('summary', { hasText: 'Structure and roofing' }) });
  const summary = details.locator('summary');
  await expect(details).not.toHaveAttribute('open', '');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  const product = products.find(item => item.slug === 'gable')!;
  await expect(details.getByText(product.details.howItWorks!, { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(details).toHaveAttribute('open', '');
  await expect(summary).toBeVisible();
  await summary.focus(); await page.keyboard.press('Space');
  await expect(details).not.toHaveAttribute('open', '');
});

test('editorial specification and decision content remains server rendered', async ({ request }) => {
  const response = await request.get('/products/pergolas/gable');
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('Structure and roofing');
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
    expect(schemaTypes).toContain('WebPage');
    expect(schemaTypes).not.toContain('Product');
    expect(schemaTypes).toContain('BreadcrumbList');
    expect(schemaTypes).not.toContain('FAQPage');
    await expect(page.getByText(/^See it built/).first()).toBeVisible();
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
  await expect(hero.locator('h1')).toHaveText('Gable.');
  await expect(hero.getByRole('group', {name:'Model view'})).toBeVisible();

  const gallerySection = main.locator('[data-product-gallery="primary"]');
  const gallery = gallerySection.locator('[data-responsive-gallery]');
  await expect(gallerySection).toHaveCount(1);
  await expect(gallery).toHaveCount(1);
  expect(await gallery.locator('[data-gallery-frame] img').count()).toBeGreaterThanOrEqual(1);
  expect(await gallery.locator('[data-gallery-frame] img').count()).toBeLessThanOrEqual(3);
  await expect(gallery.locator('[data-gallery-frame-active]')).toHaveCount(1);
  await expect(gallery).toHaveAttribute('data-gallery-position', `1/${(product.builtGallery ?? product.gallery).length}`);
  await expect(gallery).toHaveAccessibleName(`${product.name} project gallery`);

  await gallery.focus();
  await page.keyboard.press('ArrowRight');
  await expect(gallery).toHaveAttribute('data-gallery-position', `2/${(product.builtGallery ?? product.gallery).length}`);
  await expect(gallery.locator('[data-gallery-frame-active] img')).toHaveAttribute(
    'alt',
    (product.builtGallery ?? product.gallery)[1].alt,
  );
});

test('product gallery keeps adjacent media cold until proximity activation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  const product = products.find((item) => item.slug === 'gable');
  if (!product) throw new Error('Missing representative gable product');
  const galleryFileNames = (product.builtGallery ?? product.gallery).map((item) => item.src.split('/').at(-1) ?? item.src);
  const requestedGalleryFiles = new Set<string>();
  page.on('request', (request) => {
    if (request.resourceType() !== 'image') return;
    const decodedUrl = decodeURIComponent(request.url());
    if (Number(new URL(request.url()).searchParams.get('w')) <= 384) return;
    const matchingFile = galleryFileNames.find((fileName) => decodedUrl.includes(fileName));
    if (matchingFile) requestedGalleryFiles.add(matchingFile);
  });

  await page.goto(product.route, { waitUntil: 'networkidle' });
  const gallery = page.locator('main[data-product-detail]:visible')
    .last()
    .locator('[data-product-gallery="primary"] [data-responsive-gallery]');
  const viewport = gallery.locator(':scope > div').first();
  await expect(gallery.locator('[data-gallery-frame]')).toHaveCount(1);
  await expect(viewport).not.toHaveAttribute('data-gallery-adjacent-ready', 'true');
  expect(requestedGalleryFiles.size).toBeLessThanOrEqual(1);

  await gallery.scrollIntoViewIfNeeded();
  await expect(viewport).toHaveAttribute('data-gallery-adjacent-ready', 'true');
  await expect(gallery.locator('[data-gallery-frame]')).toHaveCount(3);
  await expect.poll(() => requestedGalleryFiles.size).toBe(3);
  expect(requestedGalleryFiles.size).toBeLessThanOrEqual(3);
});

for (const width of [430, 390, 360] as const) {
  test(`product gallery directly follows touch intent at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: true,
      viewport: { width, height: width === 430 ? 932 : 844 },
    });
    const page = await context.newPage();
    await preparePage(page);
    const product = products.find((item) => item.slug === 'gable');
    if (!product) throw new Error('Missing representative gable product');
    await page.goto(product.route);

    const gallery = page.locator('main[data-product-detail]:visible')
      .last()
      .locator('[data-product-gallery="primary"] [data-responsive-gallery]');
    const viewport = gallery.locator(':scope > div').first();
    await gallery.scrollIntoViewIfNeeded();
    await expect(viewport).toHaveAttribute('data-gallery-adjacent-ready', 'true');
    await expect(gallery.locator('[data-gallery-frame]')).toHaveCount(3);
    await expect(gallery.locator('[data-gallery-frame-active]')).toHaveCount(1);
    await expect(gallery.locator('[data-gallery-frame][aria-hidden="true"]')).toHaveCount(2);
    await expect(gallery.locator('[data-gallery-frame][aria-hidden="true"] img').first())
      .toHaveAttribute('alt', '');

    const dispatchPointer = async (
      type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
      clientX: number,
      clientY: number,
    ) => viewport.dispatchEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      isPrimary: true,
      pointerId: 41,
      pointerType: 'touch',
    });

    await dispatchPointer('pointerdown', width - 40, 200);
    await dispatchPointer('pointermove', width - 64, 203);
    await expect(viewport).toHaveAttribute('data-gallery-gesture', 'dragging-horizontal');
    await expect.poll(() => viewport.evaluate((element) => (
      element.style.getPropertyValue('--gallery-drag-x')
    ))).not.toBe('0px');
    await expect(gallery).toHaveAttribute('data-gallery-position', `1/${(product.builtGallery ?? product.gallery).length}`);

    await dispatchPointer('pointerup', width - 150, 205);
    await expect(gallery).toHaveAttribute('data-gallery-position', `2/${(product.builtGallery ?? product.gallery).length}`);
    await expect(gallery.locator('[role="status"]'))
      .toHaveText(`Image 2 of ${(product.builtGallery ?? product.gallery).length}`);
    await expect(gallery.locator('[data-gallery-frame-active] img'))
      .toHaveAttribute('alt', (product.builtGallery ?? product.gallery)[1].alt);

    await dispatchPointer('pointerdown', 200, 100);
    await dispatchPointer('pointermove', 196, 132);
    await dispatchPointer('pointerup', 190, 220);
    await expect(gallery).toHaveAttribute('data-gallery-position', `2/${(product.builtGallery ?? product.gallery).length}`);
    await expect(viewport).toHaveAttribute('data-gallery-gesture', 'idle');

    await dispatchPointer('pointerdown', 200, 100);
    await dispatchPointer('pointermove', 180, 102);
    await dispatchPointer('pointerup', 180, 102);
    await expect(viewport).toHaveAttribute('data-gallery-gesture', 'idle');
    await expect(gallery).toHaveAttribute('data-gallery-position', `2/${(product.builtGallery ?? product.gallery).length}`);

    await expectNoOverflowOrNestedScroll(
      page,
      page.locator('main[data-product-detail]:visible').last(),
    );
    await context.close();
  });
}

test('product gallery recovers from reversal, cancellation, resize and reduced motion', async ({
  browser,
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await preparePage(page);
  const product = products.find((item) => item.slug === 'gable');
  if (!product) throw new Error('Missing representative gable product');
  await page.goto(product.route);

  const gallery = page.locator('main[data-product-detail]:visible')
    .last()
    .locator('[data-product-gallery="primary"] [data-responsive-gallery]');
  const viewport = gallery.locator(':scope > div').first();
  await gallery.scrollIntoViewIfNeeded();
  const dispatchPointer = async (
    type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
    clientX: number,
    clientY = 200,
  ) => viewport.dispatchEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX,
    clientY,
    isPrimary: true,
    pointerId: 51,
    pointerType: 'touch',
  });

  await dispatchPointer('pointerdown', 200);
  await dispatchPointer('pointermove', 150, 202);
  await expect.poll(() => viewport.evaluate((element) => (
    Number.parseFloat(element.style.getPropertyValue('--gallery-drag-x'))
  ))).toBeLessThan(0);
  await dispatchPointer('pointermove', 250, 202);
  await expect.poll(() => viewport.evaluate((element) => (
    Number.parseFloat(element.style.getPropertyValue('--gallery-drag-x'))
  ))).toBeGreaterThan(0);
  await dispatchPointer('pointerup', 270, 202);
  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `${(product.builtGallery ?? product.gallery).length}/${(product.builtGallery ?? product.gallery).length}`,
  );

  await dispatchPointer('pointerdown', 200);
  await dispatchPointer('pointermove', 140, 202);
  await dispatchPointer('pointercancel', 140, 202);
  await expect(viewport).toHaveAttribute('data-gallery-gesture', 'idle');
  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `${(product.builtGallery ?? product.gallery).length}/${(product.builtGallery ?? product.gallery).length}`,
  );

  await dispatchPointer('pointerdown', 200);
  await dispatchPointer('pointermove', 140, 202);
  await page.setViewportSize({ width: 360, height: 800 });
  await expect(viewport).toHaveAttribute('data-gallery-gesture', 'idle');
  await expect.poll(() => viewport.evaluate((element) => (
    element.style.getPropertyValue('--gallery-drag-x')
  ))).toBe('0px');

  const next = gallery.getByRole('button', { name: `Next image in ${product.name} project gallery` });
  await next.focus();
  await next.click();
  await expect(next).toBeFocused();
  await expect(gallery).toHaveAttribute('data-gallery-position', `1/${(product.builtGallery ?? product.gallery).length}`);
  await gallery.focus();
  await page.keyboard.press('End');
  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `${(product.builtGallery ?? product.gallery).length}/${(product.builtGallery ?? product.gallery).length}`,
  );

  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement)
    .getPropertyValue('--motion-duration-short').trim())).toMatch(/^0(?:ms|s)$/);
  await dispatchPointer('pointerdown', 200);
  await dispatchPointer('pointermove', 280, 202);
  await dispatchPointer('pointerup', 290, 202);
  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `${(product.builtGallery ?? product.gallery).length - 1}/${(product.builtGallery ?? product.gallery).length}`,
  );
  await expect(viewport).toHaveAttribute('data-gallery-gesture', 'idle');

  await context.close();
});

test('unpublished heater evidence is labelled rather than inferred from context imagery', async ({ page }) => {
  await preparePage(page);
  await page.goto('/products/lighting-heating/patio-heaters');

  const main = page.locator('main[data-product-detail]:visible').last();
  await expect(main).not.toContainText('—');
  await expect(page.getByRole('heading', {
    name: 'No named heater installation is published.',
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

test.describe('product first-read refinement', () => {
  test.beforeEach(async ({ page }) => {
    await preparePage(page);
    await page.route(/google-analytics|googletagmanager|facebook\.com/, route => route.abort());
    await page.route(/\/api\/(enquiry|contact)(?:\?|$)/, route => route.abort());
  });
  for (const width of [320, 390, 820, 1100, 1440]) test(`installed price and controls fit at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/products/pergolas/box-perimeter');
    await expect(page.getByRole('textbox', { name: 'Width in metres' })).toHaveValue('6.0');
    await expect(page.getByRole('group', { name: 'Model view' })).toBeVisible();
    await expect(page.getByText('Including installation', { exact: true }).filter({ visible: true }).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width > 760) {
      const action = await page.getByRole('link', { name: 'Enquire about this design' }).boundingBox();
      const size = await page.getByRole('textbox', { name: 'Projection in metres' }).boundingBox();
      expect(action!.y + action!.height).toBeLessThan(1000);
      expect(size!.y + size!.height).toBeLessThan(1000);
    }
  });
  for (const type of ['pitched', 'gable', 'box-perimeter']) test(`${type} edited selection carries through enquiry and designer and Back`, async ({ page }) => {
    await page.goto(`/products/pergolas/${type}`);
    const width = page.getByRole('textbox', { name: 'Width in metres' });
    await width.fill('7.4'); await width.press('Enter');
    await expect(width).toHaveValue('7.4');
    await expect(page.getByRole('button', {name:'Design',exact:true})).toHaveAttribute('aria-pressed','true');
    const enquiry = page.getByRole('link', { name: 'Enquire about this design' });
    const href = await enquiry.getAttribute('href');
    expect(href).toContain('#design=');
    const expectedDraft = parsePreviewDesign(href!.split('#design=')[1].split('&estimate=')[0]);
    await enquiry.click(); await expect(page).toHaveURL(/design-enquiry/);
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? 'null'))).toEqual(expectedDraft);
    await page.locator('summary').filter({hasText:'View design details'}).click();
    await expect(page.locator('main')).toContainText('7.4');
    await page.goBack(); await expect(width).toHaveValue('7.4');
    await page.getByRole('link', { name: 'Customise further' }).click();
    await expect(page).toHaveURL(/configurator-preview/);
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('sanctuary.configurator-preview.v1') ?? 'null'))).toEqual(expectedDraft);
    await page.goBack(); await expect(width).toHaveValue('7.4');
    await page.reload(); await expect(width).toHaveValue('7.4');
    await expect(page.getByRole('button', {name:'Photos',exact:true})).toHaveAttribute('aria-pressed','true');
  });
  test('mobile modes retain selection across resize and fullscreen returns focus', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/products/pergolas/gable');
    const modes = page.getByRole('group', { name: 'Model view' });
    await modes.getByRole('button', { name: 'Photos' }).click();
    await expect(page.getByText(/Built references, not your selected design or estimate./)).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(modes.getByRole('button', { name: 'Photos' })).toHaveAttribute('aria-pressed', 'true');
    await modes.getByRole('button', { name: 'Plan', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(modes.getByRole('button', { name: 'Plan', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Open fullscreen 3D' })).toHaveCount(0);
    await modes.getByRole('button', { name: 'Design' }).click();
    const opener = page.getByRole('button', { name: 'Open fullscreen 3D' });
    await opener.click(); await expect(page.getByRole('dialog', { name: 'Explore your pergola' })).toBeVisible();
    await expect(page.getByLabel('Your design enquiry')).toBeHidden();
    await page.getByRole('button', { name: 'Close fullscreen 3D' }).click();
    await expect(opener).toBeFocused(); await expect(page.getByLabel('Your design enquiry')).toBeVisible();
    await page.locator('summary').filter({hasText:'Compare acrylic, solid and mixed roofing'}).click();
    await expect(page.getByRole('radio', { name: '01 Acrylic: Daylight through the roof' })).toBeVisible();
  });
});

test.describe('product estimate recovery', () => {
  for (const width of [320, 390, 1440]) test(`price failure recovers without moving choices at ${width}`, async ({ page }) => {
    await preparePage(page); await page.setViewportSize({width,height:1000});
    let recovered = false;
    await page.route('**/api/configurator-price', route => route.fulfill({status:200,json:recovered ? {status:'priced',amountIncGst:14560,versionNumber:15} : {status:'unavailable'}}));
    await page.goto('/products/pergolas/box-perimeter');
    const retry = page.getByRole('button', { name:'Retry estimate' }).filter({visible:true});
    await expect(retry).toBeVisible();
    const choices = page.getByRole('tab', {name:/Size/});
    const before = await choices.boundingBox();
    recovered = true; await retry.click();
    await expect(retry).toBeHidden();
    await expect(page.getByText('$14,560',{exact:true}).filter({visible:true}).first()).toBeVisible();
    const after = await choices.boundingBox();
    expect(Math.abs(after!.y-before!.y)).toBeLessThanOrEqual(2);
  });
});


test.describe('product range gallery', () => {
  for (const type of ['pitched', 'gable', 'box-perimeter']) for (const width of [320, 390, 1440]) test(`${type} shows distinct built references and stable navigation at ${width}`, async ({page}) => {
    await preparePage(page); await page.setViewportSize({width,height:1000});
    const product = products.find(item => item.slug === type)!;
    await page.goto(product.route);
    await page.locator('#product-built').scrollIntoViewIfNeeded();
    const gallery = page.locator('[data-product-gallery="primary"] [data-responsive-gallery]');
    await expect(gallery).toBeVisible();
    await expect(page.getByText('Built examples, not your selected design or estimate.')).toBeVisible();
    const thumbs = gallery.getByRole('group', {name: `${product.name} project gallery thumbnails`}).getByRole('button');
    await expect(thumbs).toHaveCount(8);
    for (const thumb of await thumbs.all()) {
      const box = await thumb.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const first = await gallery.boundingBox();
    for(let index=0;index<(product.builtGallery ?? product.gallery).length;index++) {
      await thumbs.nth(index).click();
      await expect(thumbs.nth(index)).toHaveAttribute('aria-pressed', 'true');
      await expect(gallery).toHaveAttribute('data-gallery-position', `${index+1}/${(product.builtGallery ?? product.gallery).length}`);
      const image = gallery.locator('[data-gallery-frame-active] img');
      await expect(image).toHaveAttribute('alt', (product.builtGallery ?? product.gallery)[index].alt);
      await image.evaluate((element:HTMLImageElement)=>element.decode());
      expect(Math.abs((await gallery.boundingBox())!.height-first!.height)).toBeLessThanOrEqual(2);

    }
    await thumbs.last().focus();
    const pageY = await page.evaluate(() => scrollY);
    await page.keyboard.press('Home');
    await expect(thumbs.first()).toBeFocused();
    await expect(gallery).toHaveAttribute('data-gallery-position', '1/8');
    await page.keyboard.press('ArrowRight');
    await expect(thumbs.nth(1)).toBeFocused();
    await expect(gallery).toHaveAttribute('data-gallery-position', '2/8');
    await page.keyboard.press('End');
    await expect(thumbs.last()).toBeFocused();
    await expect(gallery).toHaveAttribute('data-gallery-position', '8/8');
    expect(Math.abs(await page.evaluate(() => scrollY) - pageY)).toBeLessThanOrEqual(2);
    const lastBox = await thumbs.last().boundingBox();
    expect(lastBox!.x).toBeGreaterThanOrEqual(0);
    expect(lastBox!.x + lastBox!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const opening = page.getByRole('region', {name:'Built pergola photos', exact:true});
    await expect(opening).toHaveAttribute('data-gallery-position', '1/3');
    await expect(opening.locator('[data-gallery-frame-active] img')).toHaveAttribute('alt', product.gallery[0].alt);
    await expect(opening.getByRole('group', {name:/thumbnails/})).toHaveCount(0);
    await page.locator('summary').filter({hasText:'Explore a project in detail'}).click();
    if(product.evidence.status==='governed') await expect(page.locator(`[href="/projects/${product.evidence.projectSlug}"]`)).toBeVisible();
    await page.getByRole('group', {name:'Model view'}).getByRole('button',{name:'Photos'}).click();
    await expect(page.getByText(/Built references, not your selected design or estimate./)).toBeVisible();
  });
});


test.describe('photo-led product opening', () => {
  test('saved choices stay intact in Photos and explicit keyboard or roof edits reveal Design', async ({page}) => {
    await preparePage(page); await page.setViewportSize({width:390,height:1000});
    await page.addInitScript(() => sessionStorage.setItem('sanctuary:pitched-product:v1', JSON.stringify({widthMm:7400,projectionMm:3000,material:'acrylic',sides:'open',orientation:'parallel'})));
    await page.goto('/products/pergolas/pitched');
    const photos=page.getByRole('button',{name:'Photos',exact:true});
    const design=page.getByRole('button',{name:'Design',exact:true});
    await expect(photos).toHaveAttribute('aria-pressed','true');
    await expect(page.getByRole('textbox',{name:'Width in metres'})).toHaveValue('7.4');
    const price=page.locator('[class*="purchase"] [class*="price"]').first();
    expect((await price.boundingBox())!.y).toBeLessThan(350);
    const width=page.getByRole('slider',{name:'Width'}); await width.focus();
    const y=await page.evaluate(()=>scrollY); await width.press('ArrowRight');
    await expect(design).toHaveAttribute('aria-pressed','true');
    expect(Math.abs(await page.evaluate(()=>scrollY)-y)).toBeLessThanOrEqual(2);
    await page.getByRole('button',{name:'Plan',exact:true}).click();
    await page.getByRole('tab',{name:/Roof/}).click();
    await expect(page.getByRole('button',{name:'Plan',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('radio',{name:'Solid + timber',exact:true}).check();
    await expect(design).toHaveAttribute('aria-pressed','true');
    await photos.click();
    await page.getByRole('tab',{name:/Sides/}).click();
    const options=page.locator('input[name="product-sides"]'); await options.nth(1).check();
    await expect(design).toHaveAttribute('aria-pressed','true');
  });
  test('opening photos preserve reference details and stable stage through navigation', async ({page})=>{
    await preparePage(page);await page.setViewportSize({width:390,height:1000});
    await page.goto('/products/pergolas/box-perimeter');
    const gallery=page.getByRole('region',{name:'Built pergola photos',exact:true});
    await expect(gallery).toBeVisible();const before=await gallery.boundingBox();
    await expect(gallery.locator('[data-gallery-frame-active] img')).not.toHaveAttribute('loading', 'lazy');
    await expect(page.locator('[data-product-gallery="primary"] [data-gallery-frame-active] img')).toHaveAttribute('loading', 'lazy');
    await gallery.focus();await page.keyboard.press('End');
    await expect(gallery).toContainText('Steel carport with an internal gable');
    expect(Math.abs((await gallery.boundingBox())!.height-before!.height)).toBeLessThanOrEqual(2);
    await expect(page.getByText('Built references, not your selected design or estimate.',{exact:true})).toBeVisible();
  });
});


for (const width of [320,390]) test(`photo and design modes keep controls stable at ${width}`, async ({page})=>{
  await preparePage(page); await page.setViewportSize({width,height:1000});
  await page.goto('/products/pergolas/pitched');
  const size=page.getByRole('tab',{name:/Size/});
  const position=()=>size.evaluate(e=>e.getBoundingClientRect().top+scrollY);
  const initial=await position();
  for(const mode of ['Design','Plan','Photos']) {
    await page.getByRole('button',{name:mode,exact:true}).click();
    expect(Math.abs(await position()-initial)).toBeLessThanOrEqual(2);
  }
});


test('product GPU fallback keeps selected mode truthful and Design remains recoverable', async ({page})=>{
  await preparePage(page); await page.goto('/products/pergolas/pitched');
  await page.getByRole('button',{name:'Design',exact:true}).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-studio-state','settled');
  await page.locator('canvas').dispatchEvent('webglcontextlost');
  await expect(page.getByRole('button',{name:'Plan',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByRole('img',{name:/Pergola footprint:/})).toBeVisible();
  await page.getByRole('button',{name:'Design',exact:true}).click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.getByRole('button',{name:'Design',exact:true})).toHaveAttribute('aria-pressed','true');
});


for(const width of [390,1100,1440,1920]) test(`stacked dimension controls and notices fit at ${width}`,async({page})=>{
  await preparePage(page);await page.setViewportSize({width,height:1000});
  await page.goto('/products/pergolas/pitched');
  const w=page.getByRole('textbox',{name:'Width in metres'}),p=page.getByRole('textbox',{name:'Projection in metres'});
  await expect(w).toHaveValue('6.0');
  const a=await w.boundingBox(),b=await p.boundingBox();
  expect(b!.y).toBeGreaterThan(a!.y+a!.height);
  expect(Math.abs(a!.x-b!.x)).toBeLessThanOrEqual(2);
  const slider=page.getByRole('slider',{name:'Width',exact:true});
  await slider.focus();await slider.press('ArrowRight');await expect(w).toHaveValue('6.1');
  for(const slider of await page.getByRole('slider').all()) expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  const before=await p.boundingBox();await w.fill('not a size');await w.press('Enter');
  await expect(page.getByText('Enter a size in metres.',{exact:true})).toBeVisible();
  expect(Math.abs((await p.boundingBox())!.y-before!.y)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
