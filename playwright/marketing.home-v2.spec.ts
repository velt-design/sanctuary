import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const route = '/home-v2';
const canonicalUrl = 'https://www.sanctuarypergolas.co.nz';
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-home-v2');
const capture = process.env.MARKETING_HOME_V2_CAPTURE?.trim();

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

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

async function waitForImage(image: Locator, label: string) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(
    () => image.evaluate((element) => {
      const candidate = element as HTMLImageElement;
      return candidate.complete ? candidate.naturalWidth : 0;
    }),
    { message: `${label} should load` },
  ).toBeGreaterThan(0);
}

async function waitForAllImages(main: Locator) {
  const images = main.locator('img');
  const count = await images.count();
  expect(count, 'homepage V2 should render project and material photography').toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    await waitForImage(images.nth(index), `homepage V2 image ${index + 1}`);
  }
}

for (const viewport of viewports) {
  test(`homepage V2 is responsive and complete at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);

    const response = await page.goto(route);
    expect(response?.ok(), `${route} should resolve`).toBe(true);

    const main = page.locator('main[data-homepage-variant="v2"]');
    const hero = main.locator('section[aria-labelledby="home-v2-heading"]');
    const header = page.locator('header.site');
    const brand = header.locator('.site-brand');

    await expect(main).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.getByRole('heading', {
      level: 1,
      name: 'Architectural pergolas tailored to Kiwi homes.',
    })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /nofollow/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonicalUrl);

    const liveRating = main.locator('[data-live-rating]');
    await expect(liveRating).toBeVisible();
    await expect(liveRating).toHaveAttribute(
      'aria-label',
      /^Rated \d+(?:\.\d)? out of 5 from \d+ Google reviews$/,
    );
    await expect(liveRating).toHaveAttribute('href', /search\.google\.com\/local\/reviews/);

    const heroActions = main.getByLabel('Homepage V2 actions');
    await expect(heroActions.getByRole('link', { name: 'Start your project', exact: true }))
      .toHaveAttribute('href', '/contact');
    await expect(heroActions.locator('a[href="/projects"]')).toHaveText('View projects');
    await expect(main.getByRole('link', { name: 'Start your project', exact: true })).toHaveCount(2);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(hero).toBeVisible();
    await expect(header).toBeVisible();

    const topState = await page.evaluate(() => {
      const headerElement = document.querySelector<HTMLElement>('header.site');
      const brandElement = headerElement?.querySelector<HTMLElement>('.site-brand');
      const heroElement = document.querySelector<HTMLElement>('main[data-homepage-variant="v2"] section[aria-labelledby="home-v2-heading"]');
      const imageElement = heroElement?.querySelector<HTMLElement>('img');
      if (!headerElement || !brandElement || !heroElement || !imageElement) return null;

      return {
        header: headerElement.getBoundingClientRect().toJSON(),
        hero: heroElement.getBoundingClientRect().toJSON(),
        image: imageElement.getBoundingClientRect().toJSON(),
        backgroundColor: getComputedStyle(headerElement).backgroundColor,
        brandColor: getComputedStyle(brandElement).color,
        backdropFilter: getComputedStyle(headerElement).backdropFilter,
      };
    });

    expect(topState, 'homepage V2 should expose measurable hero and header geometry').not.toBeNull();

    if (viewport.width > 900) {
      await expect(header).toHaveAttribute('data-hero-navigation', 'overlay');
      expect(topState!.hero.top).toBeLessThanOrEqual(1);
      expect(topState!.hero.bottom).toBeGreaterThanOrEqual(viewport.height - 1);
      expect(topState!.image.top).toBeLessThanOrEqual(1);
      expect(topState!.header.bottom).toBeGreaterThan(topState!.hero.top);
      expect(topState!.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(topState!.brandColor).toBe('rgb(255, 255, 255)');
      expect(topState!.backdropFilter).toBe('none');

      await page.evaluate(() => window.scrollTo(0, 140));
      await expect(header).toHaveAttribute('data-hero-navigation', 'solid');
      await expect.poll(() => header.evaluate((element) => getComputedStyle(element).backgroundColor))
        .not.toBe('rgba(0, 0, 0, 0)');
      await expect.poll(() => brand.evaluate((element) => getComputedStyle(element).color))
        .toBe('rgb(15, 15, 16)');
    } else {
      expect(topState!.hero.top).toBeGreaterThanOrEqual(64);
      expect(topState!.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(topState!.brandColor).toBe('rgb(15, 15, 16)');
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      await expect(header.locator('.desktop-nav')).toBeHidden();
    }

    await waitForAllImages(main);
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
  });
}

test('homepage V2 stays noindex and unlisted while the current homepage remains established', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto(route);

  const v2RatingLabel = await page.locator('[data-live-rating]').getAttribute('aria-label');
  expect(v2RatingLabel).toBeTruthy();
  await expect(page.locator('header.site a[href="/home-v2"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/home-v2"]')).toHaveCount(0);

  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('/home-v2');

  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/homepage/);
  await expect(page.locator('main[data-homepage-variant="v2"]')).toHaveCount(0);
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Architectural pergolas tailored to Kiwi homes.',
  })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The Sanctuary Process' })).toBeAttached();
  await expect(page.getByRole('link', { name: 'Quick Estimate' }).first()).toHaveAttribute('href', '/contact');
  await expect(page.locator('a[href="/home-v2"]')).toHaveCount(0);
  await expect(page.locator('.home-hero a[aria-label^="Rated"]')).toHaveAttribute('aria-label', v2RatingLabel!);
});

test('homepage V2 preserves the shared mobile menu scroll lock and focus return', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);
  await expect(page.locator('main[data-homepage-variant="v2"]')).toBeVisible();
  await page.waitForTimeout(100);
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
  const initialScrollY = 500;

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  const menuButtonBox = await menuButton.boundingBox();
  expect(menuButtonBox).not.toBeNull();
  await page.mouse.click(
    menuButtonBox!.x + menuButtonBox!.width / 2,
    menuButtonBox!.y + menuButtonBox!.height / 2,
  );
  await expect(page.locator('body')).toHaveClass(/no-scroll/);
  await expect(page.locator('body')).toHaveCSS('overflow-y', 'hidden');
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(page.locator('body')).toHaveCSS('top', `-${initialScrollY}px`);
  const mobileNavigation = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(mobileNavigation).toBeVisible();
  await expect(mobileNavigation.getByRole('link').first()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(initialScrollY);
  await expect(menuButton).toBeFocused();
});

test('capture current and V2 homepage comparison evidence', async ({ page }) => {
  test.skip(!capture, 'Set MARKETING_HOME_V2_CAPTURE=1 to refresh homepage comparison evidence.');
  await preparePage(page);
  await mkdir(evidenceDirectory, { recursive: true });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto('/');
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Architectural pergolas tailored to Kiwi homes.',
    })).toBeVisible();
    await waitForImage(page.locator('.home-hero img'), `current homepage ${viewport.name} hero`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(evidenceDirectory, `current-${viewport.name}-top-${viewport.width}x${viewport.height}.png`),
    });

    await page.goto(route);
    const main = page.locator('main[data-homepage-variant="v2"]');
    await expect(main).toBeVisible();
    await waitForImage(
      main.locator('section[aria-labelledby="home-v2-heading"] img'),
      `homepage V2 ${viewport.name} hero`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(evidenceDirectory, `home-v2-${viewport.name}-top-${viewport.width}x${viewport.height}.png`),
    });

    await waitForAllImages(main);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(evidenceDirectory, `home-v2-${viewport.name}-full-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  }
});
