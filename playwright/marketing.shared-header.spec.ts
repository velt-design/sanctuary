import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  buildEnquiryHref,
  inferEnquiryAudience,
} from '../apps/marketing/lib/enquiryContext';

const establishedHeaderRoutes = [
  '/',
  '/projects',
  '/projects/warkworth-outdoor-room',
  '/products',
  '/products/pergolas/pitched',
  '/gallery',
  '/contact',
  '/privacy',
  '/acrylic-roof-pergolas-auckland-v2',
  '/commercial-pergolas-auckland',
] as const;

const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-shared-header');
const capture = process.env.MARKETING_SHARED_HEADER_CAPTURE?.trim();

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

test('the architectural editorial header is shared by established public routes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);

  for (const route of establishedHeaderRoutes) {
    await page.goto(route);
    const resolvedPath = new URL(page.url()).pathname;
    const header = page.locator('header.site');
    const cta = header.getByRole('link', { name: 'Get an estimate' });
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute('data-header-ui', 'architectural-editorial');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveCSS('border-radius', '0px');
    await expect(cta).toHaveCSS('background-color', 'rgb(79, 87, 72)');
    await expect(cta).toHaveAttribute('href', buildEnquiryHref({
      enquiryType: inferEnquiryAudience(resolvedPath),
      sourcePath: resolvedPath,
      sourceComponent: 'header',
    }));

    const geometry = await header.evaluate((element) => {
      const brand = element.querySelector<HTMLElement>('.site-brand');
      const projects = element.querySelector<HTMLElement>('a[href="/projects"]');
      const products = element.querySelector<HTMLElement>('a[href="/products"]');
      if (!brand || !projects || !products) return null;
      const projectsRect = projects.getBoundingClientRect();
      const productsRect = products.getBoundingClientRect();
      return {
        headerHeight: element.getBoundingClientRect().height,
        headerBackground: getComputedStyle(element).backgroundColor,
        heroNavigation: element.dataset.heroNavigation ?? null,
        headerFont: getComputedStyle(element).fontFamily,
        brandFont: getComputedStyle(brand).fontFamily,
        navGapMidpoint: (projectsRect.right + productsRect.left) / 2,
        viewportCenter: window.innerWidth / 2,
      };
    });

    expect(geometry, `${route} should expose shared header geometry`).not.toBeNull();
    expect(geometry!.headerHeight).toBeCloseTo(83, 0);
    if (geometry!.heroNavigation === 'overlay') {
      expect(geometry!.headerBackground).toBe('rgba(0, 0, 0, 0)');
    } else {
      expect(geometry!.headerBackground).not.toBe('rgba(0, 0, 0, 0)');
    }
    expect(geometry!.headerFont).toContain('Inter Variable');
    expect(geometry!.brandFont).toContain('Instrument Sans Variable');
    expect(Math.abs(geometry!.navGapMidpoint - geometry!.viewportCenter)).toBeLessThanOrEqual(1);
  }
});

test('the shared mobile header uses the compact square menu and restores keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/projects');

  const header = page.locator('header.site');
  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await expect(header).toHaveAttribute('data-header-ui', 'architectural-editorial');
  await expect(header).toHaveCSS('height', '65px');
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveCSS('border-radius', '0px');
  await expect(menuButton).toHaveCSS('height', '44px');
  expect(await menuButton.evaluate((element) => getComputedStyle(element, '::before').content)).toBe('"Menu"');

  await menuButton.click();
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(page.locator('body')).toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).toHaveClass(/no-scroll/);
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole('link').first()).toBeFocused();
  await expect(mobileNavigation.getByRole('link')).toHaveText([
    'Home',
    'Projects',
    'Products',
    'Contact',
    'Get an estimate',
  ]);

  await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(64, 0);

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
  await expect(menuButton).toBeFocused();
});

test('shared header destinations remain functional', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto('/');
  await page.locator('header.site').getByRole('link', { name: 'Products' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cover the deck. Keep the light.' })).toBeVisible();
});

test('capture representative shared-header states', async ({ page }) => {
  test.skip(!capture, 'Set MARKETING_SHARED_HEADER_CAPTURE=1 to refresh visual evidence.');
  await preparePage(page);
  await mkdir(evidenceDirectory, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of ['/', '/products', '/contact'] as const) {
    await page.goto(route);
    await expect(page.locator('header.site')).toBeVisible();
    await page.waitForTimeout(300);
    const name = route === '/' ? 'homepage' : route.slice(1);
    await page.screenshot({ path: path.join(evidenceDirectory, `${name}-1440x1000.png`) });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
  await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(64, 0);
  await page.screenshot({ path: path.join(evidenceDirectory, 'projects-mobile-menu-390x844.png') });

  await page.goto('/contact');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
  await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(64, 0);
  await page.screenshot({ path: path.join(evidenceDirectory, 'contact-mobile-menu-390x844.png') });
});
