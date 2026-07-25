import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import {
  buildEnquiryHref,
  getEnquiryRouteContext,
} from '../apps/marketing/lib/enquiryContext';

const establishedHeaderRoutes = [
  '/',
  '/projects',
  '/projects/warkworth-outdoor-room',
  '/projects/goodhome-commercial-terrace',
  '/products',
  '/products/pergolas/pitched',
  '/gallery',
  '/contact',
  '/privacy',
  '/acrylic-roof-pergolas-auckland-v2',
  '/commercial-pergolas-auckland',
] as const;

const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'mobile-ux-phase-3-pr-8');
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
      ...getEnquiryRouteContext(resolvedPath),
      sourcePath: resolvedPath,
      sourceComponent: 'header',
    }));
    await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#mobile-menu')).toHaveAttribute('inert', '');
    await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toHaveCount(0);

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
  await page.goto('/contact');
  await expect(page.locator('[data-contact-page]:visible').last()).toBeVisible();
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 320));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);

  const header = page.locator('header.site');
  const menuButton = page.locator('button[aria-controls="mobile-menu"]');
  await expect(menuButton).toHaveAttribute('aria-label', 'Open menu');
  await expect(header).toHaveAttribute('data-header-ui', 'architectural-editorial');
  await expect(header).toHaveCSS('height', '65px');
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveCSS('border-radius', '0px');
  await expect(menuButton).toHaveCSS('height', '44px');
  expect(await menuButton.evaluate((element) => getComputedStyle(element, '::before').content)).toBe('"Menu"');

  await menuButton.evaluate((element) => element.focus({ preventScroll: true }));
  await page.keyboard.press('Enter');
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(page.locator('body')).toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).toHaveClass(/no-scroll/);
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(page.locator('body')).toHaveCSS('top', '-320px');
  await expect(mobileNavigation).toBeVisible();
  await expect(page.locator('header.site .desktop-nav')).toBeHidden();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#mobile-menu')).not.toHaveAttribute('inert', '');
  await expect(mobileNavigation.getByRole('link').first()).toBeFocused();
  const focusedLinkStyle = await mobileNavigation.getByRole('link').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      focusVisible: element.matches(':focus-visible'),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focusedLinkStyle.focusVisible).toBe(true);
  expect(focusedLinkStyle.outlineStyle).not.toBe('none');
  expect(focusedLinkStyle.outlineWidth).toBeGreaterThanOrEqual(2);
  await expect(mobileNavigation.getByRole('link')).toHaveText([
    'Home',
    'Projects',
    'Pergola options',
    'Commercial',
    'Architects, designers & builders',
    'Contact',
    'Get an estimate',
  ]);
  await expect(mobileNavigation.getByRole('link', { name: 'Contact' }))
    .toHaveAttribute('aria-current', 'page');
  await expect(mobileNavigation.getByRole('link', { name: 'Architects, designers & builders' }))
    .toHaveAttribute('href', '/architects-designers-builders');
  await expect(mobileNavigation.getByRole('link', { name: 'Get an estimate' }))
    .toHaveAttribute('href', buildEnquiryHref({
      sourcePath: '/contact',
      sourceComponent: 'header',
    }));

  for (const target of [menuButton, ...await mobileNavigation.getByRole('link').all()]) {
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }

  await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(64, 0);

  await page.keyboard.press('Shift+Tab');
  await expect(menuButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(mobileNavigation.getByRole('link', { name: 'Get an estimate' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menuButton).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(mobileNavigation.getByRole('link').first()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
  await expect(menuButton).toBeFocused();
  await expect(page.locator('#mobile-menu')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#mobile-menu')).toHaveAttribute('inert', '');
});

test('shared header destinations remain functional', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto('/');
  await page.locator('header.site').getByRole('link', { name: 'Products' }).click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Cover the deck. Keep the light.' })).toBeVisible();
});

for (const viewport of [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test(`mobile destinations, focus and targets remain stable at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await preparePage(page);
    await page.goto('/products/pergolas/pitched');

    const menuButton = page.locator('button[aria-controls="mobile-menu"]');
    await menuButton.click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
    await expect(mobileNavigation).toBeVisible();
    await expect(mobileNavigation.getByRole('link', { name: 'Pergola options' }))
      .toHaveAttribute('aria-current', 'page');
    await expect.poll(() => page.locator('#mobile-menu').evaluate(
      (element) => element.getBoundingClientRect().top,
    )).toBeCloseTo(64, 0);

    const menuGeometry = await page.locator('#mobile-menu').evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        viewportWidth: window.innerWidth,
        documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(menuGeometry.left).toBeGreaterThanOrEqual(0);
    expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth);
    expect(menuGeometry.top).toBeCloseTo(64, 0);
    expect(menuGeometry.documentOverflow).toBeLessThanOrEqual(0);

    for (const target of [menuButton, ...await mobileNavigation.getByRole('link').all()]) {
      const bounds = await target.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeGreaterThanOrEqual(44);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }

    await page.keyboard.press('Escape');
    await expect(menuButton).toBeFocused();
  });
}

test('the mobile menu remains operable at tablet width and short viewport heights', async ({ page }) => {
  await preparePage(page);

  await page.setViewportSize({ width: 768, height: 700 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Open menu' }).click();
  const menu = page.locator('#mobile-menu');
  const mobileNavigation = page.getByRole('navigation', {
    name: 'Mobile primary',
  });
  await expect(
    mobileNavigation.getByRole('link', { name: 'Home' }),
  ).toBeFocused();
  const estimate = mobileNavigation.getByRole('link', {
    name: 'Get an estimate',
  });
  const shortViewportState = await menu.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      bottom: bounds.bottom,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      scrollHeight: element.scrollHeight,
      viewportHeight: window.innerHeight,
    };
  });
  expect(shortViewportState.bottom).toBeLessThanOrEqual(shortViewportState.viewportHeight);
  expect(shortViewportState.clientHeight).toBeLessThanOrEqual(416);
  expect(shortViewportState.scrollHeight).toBeGreaterThan(shortViewportState.clientHeight);
  expect(shortViewportState.overflowY).toBe('auto');
  await estimate.focus();
  await expect(estimate).toBeFocused();
  await expect(estimate).toBeInViewport();
  await page.keyboard.press('Escape');
});

test('the mobile menu removes directly relevant motion when reduced motion is requested', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparePage(page);
  await page.goto('/projects');

  const menuButton = page.locator('button[aria-controls="mobile-menu"]');
  const menu = page.locator('#mobile-menu');
  const header = page.locator('header.site');
  const menuButtonBox = await menuButton.boundingBox();
  expect(menuButtonBox).not.toBeNull();
  await page.mouse.click(
    menuButtonBox!.x + menuButtonBox!.width / 2,
    menuButtonBox!.y + menuButtonBox!.height / 2,
  );

  await expect(menu).toHaveCSS('transition-duration', '0s');
  await expect(menuButton).toHaveCSS('transition-duration', '0s');
  await expect(header).toHaveCSS('transition-duration', '0s');
  await page.keyboard.press('Escape');
});

test('audience-aware destinations and browser Back keep route and scroll context', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);

  for (const route of [
    '/commercial-pergolas-auckland',
    '/projects/goodhome-commercial-terrace',
    '/products/pergolas/gable',
    '/contact',
  ] as const) {
    await page.goto(route);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
    await expect(mobileNavigation.getByRole('link', { name: 'Architects, designers & builders' }))
      .toHaveAttribute('href', '/architects-designers-builders');
    await expect(mobileNavigation.getByRole('link', { name: 'Get an estimate' }))
      .toHaveAttribute('href', buildEnquiryHref({
        ...getEnquiryRouteContext(route),
        sourcePath: route,
        sourceComponent: 'header',
      }));
    await page.keyboard.press('Escape');
  }

  await page.goto('/contact');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile primary' })
    .getByRole('link', { name: 'Pergola options' })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);

  await page.goBack();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.locator('body')).not.toHaveClass(/mobile-menu-open/);
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
});

test('capture representative shared-header states', async ({ page }) => {
  test.skip(!capture, 'Set MARKETING_SHARED_HEADER_CAPTURE=1 to refresh visual evidence.');
  await preparePage(page);
  await mkdir(evidenceDirectory, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('header.site')).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(evidenceDirectory, 'homepage-header-desktop-1440x1000.png') });

  for (const viewport of [
    { width: 430, height: 932 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
    { width: 360, height: 480 },
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile primary' })).toBeVisible();
    await expect.poll(() => page.locator('#mobile-menu').evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(64, 0);
    await page.screenshot({
      path: path.join(
        evidenceDirectory,
        `projects-mobile-menu-${viewport.width}x${viewport.height}.png`,
      ),
    });
  }
});
