import { expect, test, type Page } from '@playwright/test';

const routes = [
  '/pergolas-auckland',
  '/custom-pergolas-auckland',
  '/aluminium-pergolas-auckland',
  '/pergola-cost-auckland',
  '/gable-pergolas-auckland',
  '/pitched-pergolas-auckland',
  '/outdoor-rooms-auckland',
  '/pergolas-with-blinds',
  '/acrylic-pergolas-vs-louvre-roofs',
  '/commercial-pergolas-auckland',
  '/pergola-guides',
] as const;

const longDashPattern = /[\u2013\u2014]/;
const unapprovedClaimPattern = /\b(?:1\s*[-\u2013\u2014]\s*5 days|2\s*[-\u2013\u2014]\s*5 days|3\s*[-\u2013\u2014]\s*4 days|6\s*[-\u2013\u2014]\s*8 weeks|10[-\s]?year warranty|99% UV|30\s*[-\u2013\u2014]\s*70%)\b/i;
const unapprovedCategoricalClaimPattern = /\b(?:strong rain protection|blocking UV|filtering UV|wind rating to|\d+\s*km\/h gusts|marine-grade|very low maintenance|minimal upkeep|high daylight transmission|high daylight levels|maximises daylight|most shade and acoustic comfort|versatile all-round performance|louvre-like look|louvre aesthetic|heat reduction)\b/i;

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: false,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  });
}

test('new SEO programme routes contain no en or em dashes in copy, metadata or structured data', async ({ page }) => {
  await preparePage(page);

  for (const route of routes) {
    await page.goto(route);

    const copy = await page.locator('main[data-marketing-foundation-page]').innerText();
    const metadata = await page.locator('title, meta[content]').evaluateAll((elements) => elements.map((element) => (
      element.tagName === 'TITLE'
        ? element.textContent ?? ''
        : element.getAttribute('content') ?? ''
    )).join('\n'));
    const structuredData = (await page.locator('script[type="application/ld+json"]').allTextContents()).join('\n');

    expect(copy, `${route} visible copy should not contain a long dash`).not.toMatch(longDashPattern);
    expect(metadata, `${route} metadata should not contain a long dash`).not.toMatch(longDashPattern);
    expect(structuredData, `${route} structured data should not contain a long dash`).not.toMatch(longDashPattern);
  }
});

test('indexable public pages do not repeat known unapproved timing, warranty or product-performance claims', async ({ page, request }) => {
  await preparePage(page);
  const sitemapResponse = await request.get('/sitemap.xml');
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  const publicRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
  expect(publicRoutes.length).toBeGreaterThan(routes.length);

  for (const route of publicRoutes) {
    await page.goto(route);

    const documentText = await page.locator('html').textContent();
    expect(documentText ?? '', `${route} should not expose an unapproved numeric claim`).not.toMatch(unapprovedClaimPattern);
    expect(documentText ?? '', `${route} should not expose a known unapproved categorical claim`).not.toMatch(unapprovedCategoricalClaimPattern);
  }
});

test('the historic brochure endpoint is retired to the governed guide library', async ({ request }) => {
  const response = await request.get('/downloads/Sanctuary-Pergolas-Brochure.pdf', { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers().location).toMatch(/\/pergola-guides$/);
});

test('guide routes resolve directly with global business schema and responsive image hints', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  const imageWarnings: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' && /Image with src|Largest Contentful Paint|sizes prop|quality/.test(message.text())) imageWarnings.push(message.text());
  });

  for (const route of routes) {
    const directResponse = await request.get(route, { maxRedirects: 0 });
    expect(directResponse.status(), `${route} should return directly without a redirect`).toBe(200);

    await page.goto(route);
    const main = page.locator('main[data-marketing-foundation-page]');
    const heroImage = route === '/pergola-guides'
      ? main.locator('.guide-hub-hero__image')
      : main.locator('.acrylic-hero__image');

    await expect(heroImage).toHaveAttribute('loading', 'eager');
    await expect(heroImage).toHaveAttribute('fetchpriority', 'high');
    const imageHints = await main.locator('img').evaluateAll((images) => images.map((image) => ({
      srcset: image.getAttribute('srcset'),
      sizes: image.getAttribute('sizes'),
    })));
    expect(imageHints.length, `${route} should contain editorial imagery`).toBeGreaterThan(0);
    for (const hint of imageHints) {
      expect(hint.srcset, `${route} images should expose a responsive srcset`).toBeTruthy();
      expect(hint.sizes, `${route} images should expose responsive sizing`).toBeTruthy();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${route} should not overflow the mobile viewport`).toBe(true);

    const schemaTypes = (await page.locator('script[type="application/ld+json"]').allTextContents()).flatMap((script) => {
      const value = JSON.parse(script) as Record<string, unknown> | Array<Record<string, unknown>>;
      return (Array.isArray(value) ? value : [value]).map((node) => node['@type']);
    });
    expect(schemaTypes).toContain('Organization');
    expect(schemaTypes).toContain('LocalBusiness');
  }

  expect(imageWarnings, 'guide routes should not emit Next.js image-performance warnings').toEqual([]);
});
