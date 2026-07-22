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
