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

async function preparePage(page: Page, analytics = false) {
  await page.addInitScript((analyticsConsent) => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: analyticsConsent,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
  }, analytics);
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

async function expectWarkworthGableFraming(main: Locator) {
  const images = main.locator('img[src*="project-warkworth-outdoor-room-01"]');
  expect(await images.count(), 'homepage V2 should render the Warkworth exterior in its featured-project placement').toBe(1);

  const framing = await images.evaluateAll((elements) => elements.map((element) => {
    const image = element as HTMLImageElement;
    const bounds = image.getBoundingClientRect();
    const scale = Math.max(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const renderedHeight = image.naturalHeight * scale;
    const verticalOverflow = Math.max(0, renderedHeight - bounds.height);
    const position = Number.parseFloat(getComputedStyle(image).objectPosition.split(' ')[1]) / 100;
    const pergolaApexY = image.naturalHeight * (430 / 2048) * scale - verticalOverflow * position;

    return {
      objectPosition: getComputedStyle(image).objectPosition,
      pergolaApexY,
      frameHeight: bounds.height,
    };
  }));

  for (const image of framing) {
    expect(image.objectPosition).toBe('50% 18%');
    expect(image.pergolaApexY, 'the pergola apex should retain visible sky above it').toBeGreaterThanOrEqual(20);
    expect(image.pergolaApexY, 'the pergola apex should remain inside the crop').toBeLessThan(image.frameHeight);
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
      name: 'Bespoke pergolas, built around the architecture.',
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
    await expect(heroActions.getByRole('link', { name: 'Get an initial project estimate', exact: true }))
      .toHaveAttribute('href', '/contact');
    await expect(heroActions.locator('a[href="/projects"]')).toHaveText('View completed projects');

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
    await expectWarkworthGableFraming(main);
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);
  });
}

test('homepage V2 stays noindex and unlisted while the current homepage remains established', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  const stagingResponse = await page.goto(route);

  const v2RatingLabel = await page.locator('[data-live-rating]').getAttribute('aria-label');
  expect(v2RatingLabel).toBeTruthy();
  expect(stagingResponse?.headers()['x-robots-tag']).toBe('noindex, nofollow');
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

test('homepage V2 exposes the approved pathways, evidence and production-ready SEO identity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto(route);

  const main = page.locator('main[data-homepage-variant="v2"]');
  await expect(page).toHaveTitle('Architectural Pergola Design & Build | Sanctuary Pergolas');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Sanctuary designs, builds and installs bespoke fixed-roof architectural pergolas in Auckland for residential and selected commercial projects.',
  );

  await expect(main).toContainText('Sanctuary designs, builds and installs bespoke fixed-roof pergolas in Auckland');
  await expect(main).toContainText('home or commercial site');
  await expect(main).not.toContainText('4 roof forms');
  await expect(main).not.toContainText('10 design guides');
  await expect(main).not.toContainText('3 planning chapters');
  await expect(main).not.toContainText('1 connected brief');

  await expect(main.getByRole('heading', { level: 2, name: 'Warkworth Outdoor Room' })).toBeVisible();
  await expect(main).toContainText('5.0 m × 6.0 m');
  await expect(main).toContainText('Freestanding gable');
  await expect(main).toContainText('Sanctuary response');

  const expectedPathways = [
    ['/pergolas-auckland', 'Plan an Auckland pergola'],
    ['/custom-pergolas-auckland', 'Explore custom pergola design'],
    ['/commercial-pergolas-auckland', 'Discuss a commercial project'],
    ['/contact#contact-form', 'Send plans or a project brief'],
  ] as const;
  for (const [href, name] of expectedPathways) {
    await expect(main.getByRole('link', { name })).toHaveAttribute('href', href);
  }

  for (const form of ['Pitched', 'Gable', 'Hip', 'Box perimeter']) {
    await expect(main.getByRole('heading', { level: 3, name: form })).toBeVisible();
  }
  for (const roof of ['Acrylic roofing', 'Solid roofing', 'Combination roofing']) {
    await expect(main.getByRole('heading', { level: 3, name: roof })).toBeVisible();
  }
  for (const option of ['Blinds and screens', 'Integrated lighting', 'Heating']) {
    await expect(main.getByRole('heading', { level: 3, name: option })).toBeVisible();
  }

  const process = main.locator('section[aria-labelledby="design-build-process"]');
  await expect(process.locator('ol > li')).toHaveCount(5);
  await expect(main.locator('[data-home-review]')).toHaveCount(3);
  await expect(main.getByRole('link', { name: 'Explore the pergola guides' })).toHaveAttribute('href', '/pergola-guides');
  await expect(main.getByRole('link', { name: 'Send your project details' })).toHaveAttribute('href', '/contact');

  const schemaTypes = await page.locator('script[type="application/ld+json"]').evaluateAll((nodes) => (
    nodes.flatMap((node) => {
      const parsed = JSON.parse(node.textContent || 'null');
      const values = Array.isArray(parsed) ? parsed : [parsed];
      return values.map((value) => value?.['@type']).filter(Boolean);
    })
  ));
  expect(schemaTypes).toContain('Organization');
  expect(schemaTypes).toContain('LocalBusiness');
  expect(schemaTypes).toContain('WebSite');
  expect(schemaTypes).toContain('WebPage');
  expect(schemaTypes).not.toContain('AggregateRating');
  expect(schemaTypes).not.toContain('Review');

  const visibleCopy = await main.innerText();
  for (const unsupportedClaim of ['10-year warranty', 'weatherproof', 'year-round protection', '1 to 5 day', '2 to 10 day', '8 to 12 week']) {
    expect(visibleCopy.toLowerCase()).not.toContain(unsupportedClaim);
  }
  expect(visibleCopy).not.toContain('—');
});

test('homepage V2 records consented CTA events without customer data', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page, true);
  await page.goto(route);
  await page.evaluate(() => {
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
  });

  await page.locator('[data-homepage-event="hero_projects_click"]').click();
  await page.waitForURL('**/projects');
  const trackedEvent = await page.evaluate(() => (
    (window as typeof window & { dataLayer?: Array<Record<string, unknown> | unknown[]> }).dataLayer
      ?.find((entry) => !Array.isArray(entry) && entry.event === 'hero_projects_click')
  ));

  expect(trackedEvent).toEqual({
    event: 'hero_projects_click',
    homepage_variant: 'v2',
    destination: '/projects',
  });
});

test('homepage V2 internal destinations resolve without redirect errors', async ({ page }) => {
  await preparePage(page);
  await page.goto(route);

  const hrefs = await page.locator('main[data-homepage-variant="v2"] a[href^="/"]').evaluateAll((links) => (
    Array.from(new Set(links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href))))
  ));
  expect(hrefs.length).toBeGreaterThan(20);

  for (const href of hrefs) {
    const response = await page.request.get(href.split('#')[0]);
    expect(response.status(), `${href} should resolve without an error`).toBeLessThan(400);
  }
});

test('Warkworth exterior focal framing propagates across public placements', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);

  for (const { destination, galleryAdvances = 0 } of [
    { destination: '/' },
    { destination: '/home-v2' },
    { destination: '/projects' },
    { destination: '/projects/warkworth-outdoor-room', galleryAdvances: 4 },
    { destination: '/pergola-guides' },
    { destination: '/pergolas-auckland' },
    { destination: '/acrylic-roof-pergolas-auckland' },
    { destination: '/acrylic-roof-pergolas-auckland-v2' },
  ]) {
    const response = await page.goto(destination);
    expect(response?.ok(), `${destination} should resolve`).toBe(true);
    for (let index = 0; index < galleryAdvances; index += 1) {
      const nextImage = page.getByRole('button', { name: 'Next image' });
      expect(await nextImage.count(), `${destination} should expose one project gallery control`).toBe(1);
      await nextImage.click();
    }
    const images = page.locator('img[src*="project-warkworth-outdoor-room-01"]');
    const imageCount = await images.count();
    expect(imageCount, `${destination} should render the Warkworth exterior`).toBeGreaterThan(0);
    await images.evaluateAll((elements) => elements.find((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0;
    })?.scrollIntoView({ block: 'center' }));
    await expect.poll(
      () => images.evaluateAll((elements) => elements.some((element) => {
        const image = element as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      })),
      { message: `${destination} should load at least one Warkworth exterior placement` },
    ).toBe(true);
    const positions = await images.evaluateAll((elements) => (
      elements.map((element) => getComputedStyle(element).objectPosition)
    ));
    expect(positions, `${destination} should preserve the shared upper focal position`)
      .toEqual(positions.map(() => '50% 18%'));
  }
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
    { name: 'tablet', width: 768, height: 1024 },
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
    await expectWarkworthGableFraming(main);
    const featuredProject = main.locator('section[aria-labelledby="featured-warkworth-project"]');
    await featuredProject.scrollIntoViewIfNeeded();
    await featuredProject.screenshot({
      path: path.join(evidenceDirectory, `home-v2-warkworth-${viewport.name}-${viewport.width}x${viewport.height}.png`),
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(evidenceDirectory, `home-v2-${viewport.name}-full-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    });
  }
});
