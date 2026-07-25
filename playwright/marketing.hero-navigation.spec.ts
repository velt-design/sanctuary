import { mkdir } from 'node:fs/promises';
import path from 'node:path';
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

const viewports = [
  { name: '1920x1000', width: 1920, height: 1000 },
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-hero-navigation');
const capture = process.env.MARKETING_HERO_NAV_CAPTURE?.trim();

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
  test(`all programme heroes use the correct navigation state at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);

    for (const route of routes) {
      await page.goto(route);
      const header = page.locator('header.site');
      const brand = header.locator('.site-brand');
      const hero = page.locator(route === '/pergola-guides' ? '.guide-hub-hero' : '.acrylic-hero').last();
      const heroImage = page.locator(route === '/pergola-guides' ? '.guide-hub-hero__figure' : '.acrylic-hero__image').last();

      await expect(header).toBeVisible();
      await expect(hero).toBeVisible();
      await expect(heroImage).toBeVisible();
      await expect(header).toHaveAttribute('data-hero-navigation', 'overlay');

      const topState = await page.evaluate(() => {
        const headerElement = document.querySelector<HTMLElement>('header.site');
        const brandElement = headerElement?.querySelector<HTMLElement>('.site-brand');
        const guideRoute = window.location.pathname === '/pergola-guides';
        const heroElements = document.querySelectorAll<HTMLElement>(guideRoute ? '.guide-hub-hero' : '.acrylic-hero');
        const imageElements = document.querySelectorAll<HTMLElement>(guideRoute ? '.guide-hub-hero__figure' : '.acrylic-hero__image');
        const heroElement = heroElements.item(heroElements.length - 1);
        const imageElement = imageElements.item(imageElements.length - 1);
        const projectsLink = headerElement?.querySelector<HTMLElement>('a[href="/projects"]');
        const productsLink = headerElement?.querySelector<HTMLElement>('a[href="/products"]');
        if (!headerElement || !brandElement || !heroElement || !imageElement || !projectsLink || !productsLink) return null;
        const headerStyles = getComputedStyle(headerElement);
        const projectsRect = projectsLink.getBoundingClientRect();
        const productsRect = productsLink.getBoundingClientRect();
        return {
          header: headerElement.getBoundingClientRect().toJSON(),
          hero: heroElement.getBoundingClientRect().toJSON(),
          image: imageElement.getBoundingClientRect().toJSON(),
          navGapMidpoint: (projectsRect.right + productsRect.left) / 2,
          viewportCenter: window.innerWidth / 2,
          backgroundColor: headerStyles.backgroundColor,
          brandColor: getComputedStyle(brandElement).color,
          backdropFilter: headerStyles.backdropFilter,
        };
      });
      expect(topState, `${route} should expose measurable header and hero geometry`).not.toBeNull();

      if (viewport.width > 900) {
        expect(topState!.hero.top, `${route} hero should begin at the viewport top`).toBeLessThanOrEqual(1);
        expect(topState!.hero.bottom, `${route} hero should cover the viewport with no canvas gap at the fold`).toBeGreaterThanOrEqual(viewport.height - 1);
        expect(topState!.image.top, `${route} image should extend beneath the navigation`).toBeLessThanOrEqual(1);
        expect(topState!.header.bottom, `${route} header should overlap its hero`).toBeGreaterThan(topState!.hero.top);
        expect(Math.abs(topState!.navGapMidpoint - topState!.viewportCenter), `${route} Projects/Products gap should be centred`).toBeLessThanOrEqual(1);
        if (route === '/pergola-guides') {
          expect(Math.abs(topState!.image.left - topState!.viewportCenter), 'guide hero split should share the navigation centreline').toBeLessThanOrEqual(1);
        }
        expect(topState!.backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(topState!.brandColor).toBe('rgb(255, 255, 255)');
        expect(topState!.backdropFilter).toBe('none');

        await page.evaluate(() => window.scrollTo(0, 140));
        await expect(header).toHaveAttribute('data-hero-navigation', 'solid');
        await expect.poll(() => header.evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
        await expect.poll(() => brand.evaluate((element) => getComputedStyle(element).color)).toBe('rgb(15, 15, 16)');
      } else {
        expect(topState!.hero.top, `${route} mobile hero should remain below the collapsed header`).toBeGreaterThanOrEqual(63);
        expect(topState!.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(topState!.brandColor).toBe('rgb(15, 15, 16)');
        await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
        await expect(page.locator('header.site .desktop-nav')).toBeHidden();
      }

      if (capture && (route === '/outdoor-rooms-auckland' || route === '/pergola-guides')) {
        await mkdir(evidenceDirectory, { recursive: true });
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(header).toHaveAttribute('data-hero-navigation', 'overlay');
        await page.waitForTimeout(650);
        const name = route.slice(1);
        await page.screenshot({ path: path.join(evidenceDirectory, `${name}-${viewport.name}-top.png`) });
        if (viewport.width > 900) {
          await page.evaluate(() => window.scrollTo(0, 140));
          await expect(header).toHaveAttribute('data-hero-navigation', 'solid');
          await page.waitForTimeout(650);
          await page.screenshot({ path: path.join(evidenceDirectory, `${name}-${viewport.name}-scrolled.png`) });
        }
      }
    }
  });
}

test('mobile menu interaction remains intact on a programme page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/outdoor-rooms-auckland');
  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/mobile-menu-open/);
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
  await expect(page.locator('header.site')).toHaveCSS('background-color', 'rgb(233, 234, 230)');
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
});
