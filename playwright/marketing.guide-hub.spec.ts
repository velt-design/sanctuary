import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const route = '/pergola-guides';
const title = 'Pergola Design Guides | Sanctuary Pergolas';
const description = 'Explore Sanctuary Pergolas guides to planning, forms, materials, cost, blinds, outdoor rooms and commercial pergola projects in Auckland.';
const expectedGuides = [
  { number: '01', href: '/pergolas-auckland', title: 'Pergolas Auckland', label: 'Service guide' },
  { number: '02', href: '/custom-pergolas-auckland', title: 'Custom Pergolas Auckland', label: 'Service guide' },
  { number: '03', href: '/outdoor-rooms-auckland', title: 'Outdoor Rooms Auckland', label: 'Planning guide' },
  { number: '04', href: '/commercial-pergolas-auckland', title: 'Commercial Pergolas Auckland', label: 'Service guide' },
  { number: '05', href: '/aluminium-pergolas-auckland', title: 'Aluminium Pergolas Auckland', label: 'Material guide' },
  { number: '06', href: '/gable-pergolas-auckland', title: 'Gable Pergolas Auckland', label: 'Roof-form guide' },
  { number: '07', href: '/pitched-pergolas-auckland', title: 'Pitched Pergolas Auckland', label: 'Roof-form guide' },
  { number: '08', href: '/pergola-cost-auckland', title: 'Pergola Cost Auckland', label: 'Cost guide' },
  { number: '09', href: '/pergolas-with-blinds', title: 'Pergolas With Blinds', label: 'Integration guide' },
  { number: '10', href: '/acrylic-pergolas-vs-louvre-roofs', title: 'Acrylic Pergolas vs Louvre Roofs', label: 'Comparison guide' },
] as const;
const expectedChapterNumbers = [
  { id: 'plan-the-project', numbers: ['01', '02', '03', '04'] },
  { id: 'choose-form-and-structure', numbers: ['05', '06', '07'] },
  { id: 'compare-scope-and-components', numbers: ['08', '09', '10'] },
] as const;
const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;
const capture = process.env.MARKETING_GUIDE_HUB_CAPTURE?.trim();
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-seo-landing', 'pergola-guides');

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

for (const viewport of viewports) {
  test(`guide library follows the marketing foundation at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);

    const main = page.locator('main[data-pergola-guide-hub]');
    await expect(page).toHaveTitle(title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.sanctuarypergolas.co.nz${route}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index, follow/);
    await expect(page.getByRole('heading', { level: 1, name: 'Find the guide for the decision in front of you' })).toBeVisible();
    await expect(page.getByText('Editorial review: Sanctuary Pergolas')).toBeVisible();
    await expect(page.locator('time[datetime="2026-07-22"]')).toHaveText('22 July 2026');
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.locator('[data-guide-link]')).toHaveCount(expectedGuides.length);
    await expect(main.getByRole('navigation', { name: 'Guide chapters' }).locator('a')).toHaveCount(3);

    for (const guide of expectedGuides) {
      const link = main.locator(`[data-guide-link][href="${guide.href}"]`);
      await expect(link, `${guide.title} should be linked once`).toHaveCount(1);
      await expect(link).toContainText(guide.number);
      await expect(link).toContainText(guide.title);
      await expect(link).toContainText(guide.label);
    }

    const renderedGuides = await main.locator('[data-guide-link]').evaluateAll((links) => links.map((link) => ({
      number: link.querySelector('.guide-hub-card__number')?.textContent?.trim(),
      href: link.getAttribute('href'),
      title: link.querySelector('.guide-hub-card__heading strong')?.textContent?.trim(),
      label: link.querySelector('.guide-hub-card__heading small')?.textContent?.trim(),
    })));
    expect(renderedGuides).toEqual(expectedGuides.map((guide) => ({ ...guide })));

    for (const chapter of expectedChapterNumbers) {
      const numbers = await main.locator(`#${chapter.id} .guide-hub-card__number`).allTextContents();
      expect(numbers).toEqual([...chapter.numbers]);
    }

    await expect.poll(() => main.locator('img').evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await main.evaluate((element) => getComputedStyle(element).getPropertyValue('--color-accent-olive').trim())).toBe('#4f5748');

    if (viewport.width <= 900) {
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(page.locator('header.site .desktop-nav')).toBeHidden();
    } else {
      await expect(page.getByRole('link', { name: 'Quick Estimate' })).toBeVisible();
    }

    if (capture) {
      await mkdir(evidenceDirectory, { recursive: true });
      await page.screenshot({ path: path.join(evidenceDirectory, `${viewport.name}-top.png`) });
      await page.locator('#plan-the-project').scrollIntoViewIfNeeded();
      if (viewport.width > 900) {
        await expect(page.locator('header.site')).toHaveAttribute('data-hero-navigation', 'solid');
      }
      await page.waitForTimeout(650);
      await page.screenshot({ path: path.join(evidenceDirectory, `${viewport.name}-library.png`) });
    }
  });
}

test('all ten guide destinations, sitemap entry, footer discovery and ordered schema are sound', async ({ page, request }) => {
  await preparePage(page);
  for (const guide of expectedGuides) {
    expect((await request.get(guide.href)).status(), `${guide.href} should resolve`).toBeLessThan(400);
  }

  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).toContainText(route);

  await page.goto(route);
  await expect(page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Pergola Guides' })).toHaveAttribute('href', route);

  const jsonLd = (await page.locator('script[type="application/ld+json"]').allTextContents())
    .flatMap((script) => {
      const parsed = JSON.parse(script) as unknown;
      return Array.isArray(parsed) ? parsed : [parsed];
    }) as Array<{
      '@type'?: string;
      dateModified?: string;
      reviewedBy?: { name?: string };
      numberOfItems?: number;
      itemListElement?: Array<{ position: number; name: string; url: string }>;
    }>;
  const itemList = jsonLd.find((node) => node['@type'] === 'ItemList');
  expect(jsonLd.find((node) => node['@type'] === 'CollectionPage')).toMatchObject({ dateModified: '2026-07-22', reviewedBy: { name: 'Sanctuary Pergolas' } });
  expect(itemList?.numberOfItems).toBe(expectedGuides.length);
  expect(itemList?.itemListElement).toEqual(expectedGuides.map((guide, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: guide.title,
    url: `https://www.sanctuarypergolas.co.nz${guide.href}`,
  })));

  const historicBrochure = await request.get('/downloads/Sanctuary-Pergolas-Brochure.pdf', { maxRedirects: 0 });
  expect(historicBrochure.status()).toBe(308);
  expect(historicBrochure.headers()['x-robots-tag']).toContain('noindex');
  await page.goto('/products/pergolas/gable');
  await expect(page.locator('a[href="/downloads/Sanctuary-Pergolas-Brochure.pdf"]')).toHaveCount(0);
  const currentGuideLinks = page.locator('a[href="/pergola-guides"]', { hasText: 'Pergola Design Guides' });
  expect(await currentGuideLinks.count()).toBeGreaterThan(0);
  await expect(currentGuideLinks.first()).toContainText('Pergola Design Guides');
});
