import { expect, test, type Page } from '@playwright/test';

async function checkArrowRendering(page: Page) {
  const report = await page.evaluate(() => {
    const arrow = /[\u2190-\u21ff\u27f0-\u27ff\u2900-\u297f\u2b00-\u2b11\u2b45-\u2b4c\u2794-\u27bf\u{1f500}-\u{1f503}\u{1f519}-\u{1f51d}\u{1f800}-\u{1f8ff}]/u;
    const glyphs: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement?.closest('script,style') && arrow.test(node.textContent ?? '')) glyphs.push(node.textContent!.trim());
    }
    const pseudoGlyphs: string[] = [];
    for (const element of document.querySelectorAll('main *,header *,footer *')) for (const pseudo of ['::before', '::after']) {
      const content = getComputedStyle(element, pseudo).content;
      if (arrow.test(content)) pseudoGlyphs.push(`${element.tagName}${pseudo}: ${content}`);
    }
    const invalidIcons = [...document.querySelectorAll<SVGElement>('[data-arrow-icon]')].filter(icon => {
      const bounds = icon.getBoundingClientRect();
      return icon.getAttribute('aria-hidden') !== 'true' || icon.getAttribute('focusable') !== 'false'
        || icon.querySelector('text') !== null || (bounds.width > 0 && (bounds.width > 96 || bounds.height > 96));
    }).map(icon => icon.outerHTML);
    return { glyphs, pseudoGlyphs, invalidIcons };
  });
  expect(report).toEqual({ glyphs: [], pseudoGlyphs: [], invalidIcons: [] });
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.origin !== new URL(baseURL!).origin || url.pathname.startsWith('/api/enquiry')) return route.abort();
    if (!['GET', 'HEAD'].includes(request.method()) && !['/api/configurator-price', '/api/landing-price-table', '/api/pergola-selection'].includes(url.pathname)) return route.abort();
    return route.continue();
  });
  await page.route('**/api/tracking-region', route => route.fulfill({ json: { policy: 'consent_required' } }));
  await page.addInitScript(() => localStorage.setItem('sp_consent_v1', JSON.stringify({ analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 1 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('all sitemap pages and retained public journeys render arrows without font glyphs', async ({ page, request }) => {
  test.setTimeout(240_000);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const routes = [...new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]).pathname))];
  routes.push('/ads/outdoor-living', '/ads/acrylic-pergolas', '/ads/facebook/outdoor-living', '/ads/facebook/acrylic-pergolas', '/auckland-outdoor-living', '/home-journey', '/home-guided', '/design-enquiry', '/configurator-preview', '/arrow-audit-missing-page');
  for (const route of routes) {
    await test.step(route, async () => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(route === '/arrow-audit-missing-page' ? 404 : 200);
      await expect(page.locator('main').first()).toBeVisible();
      await checkArrowRendering(page);
    });
  }
});

for (const width of [320, 390, 1440, 2560]) test(`pergola and comparison arrows keep their size, labels and actions at ${width}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: width < 800 ? 844 : 1100 });
  await page.goto('/products');
  if (width <= 760) {
    const rooflines = page.getByRole('navigation', { name: 'Explore the three rooflines' });
    const gable = rooflines.getByRole('link', { name: 'Gable', exact: true });
    await expect(gable.locator('svg[data-arrow-icon=down-right]')).toBeVisible();
    await expect(gable).toHaveAttribute('href', '#compare-gable');
    await gable.focus(); await gable.press('Enter');
    await expect(page.locator('#compare-gable')).toBeInViewport();
  }
  const exploreGable = page.getByRole('link', { name: 'Explore Gable', exact: true });
  await expect(exploreGable.locator('svg[data-arrow-icon=up-right]')).toBeVisible();
  await expect(exploreGable).toHaveAttribute('href', '/products/pergolas/gable');
  await checkArrowRendering(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`products-${width}.png`) });
  await page.goto('/pergolas-auckland');
  const enquiry = page.getByRole('link', { name: 'Talk about your project', exact: true }).first();
  await expect(enquiry.locator('svg[data-arrow-icon=up-right]')).toHaveCount(1);
  if (width > 800) {
    const down = page.getByRole('link', { name: 'Explore your pergola below' });
    await expect(down.locator('svg[data-arrow-icon=down]')).toBeVisible();
    await down.focus(); await down.press('Enter'); await expect(page.locator('#explore-options')).toBeInViewport();
  }
  await checkArrowRendering(page);
  await page.screenshot({ path: info.outputPath(`pergolas-${width}.png`) });
  await page.goto('/acrylic-pergolas-vs-louvre-roofs');
  const fixedRoof = page.getByRole('region', { name: 'An acrylic alternative.', exact: true });
  const action = fixedRoof.getByRole('link', { name: 'Discuss a fixed-roof pergola', exact: true });
  await expect(action.locator('svg')).toBeVisible();
  await expect(fixedRoof).toContainText('We do not supply louvre roofs.');
  await page.screenshot({ path: info.outputPath(`acrylic-alternative-${width}.png`) });
  await action.focus(); await action.press('Enter');
  await expect(page.locator('#estimate-form-title')).toBeInViewport();
  await checkArrowRendering(page);
});

test('gallery arrow controls retain accessible names, keyboard focus and image navigation', async ({ page }) => {
  await page.goto('/projects/dairy-flat-estate');
  const gallery = page.locator('[data-responsive-gallery]').first();
  const next = gallery.getByRole('button', { name: /^Next image in/ });
  const previous = gallery.getByRole('button', { name: /^Previous image in/ });
  await expect(gallery.getByRole('status')).toHaveText(/Image 1 of/);
  await next.focus(); await next.press('Enter');
  await expect(gallery.getByRole('status')).toHaveText(/Image 2 of/);
  await expect(next).toBeFocused();
  await previous.focus(); await previous.press('Space');
  await expect(gallery.getByRole('status')).toHaveText(/Image 1 of/);
  await expect(previous).toBeFocused();
  await checkArrowRendering(page);
});

test('Personalise return arrow preserves the chosen roof and remains keyboard operable', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/configurator-preview?open=1');
  await page.getByRole('button', { name: 'Personalise your pergola', exact: true }).click();
  await page.getByRole('button', { name: /^Roof & ceiling/ }).click();
  const solid = page.getByRole('radio', { name: /^Solid \+ timber ceiling/ });
  await solid.check();
  const back = page.getByLabel('Your pergola choices').getByRole('button', { name: 'Back to Personalise', exact: true });
  await expect(back.locator('svg[data-arrow-icon=left]')).toBeVisible();
  await back.focus(); await back.press('Enter');
  const roof = page.getByRole('button', { name: /^Roof & ceiling/ });
  await expect(roof).toContainText('Solid roof + timber ceiling');
  await roof.focus(); await roof.press('Enter');
  await expect(solid).toBeChecked();
  await checkArrowRendering(page);
});
