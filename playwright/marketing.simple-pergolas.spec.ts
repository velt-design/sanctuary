import { expect, test, type Browser, type Page } from '@playwright/test';

const route = '/simple-pergolas-auckland';
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
  { name: '320x720', width: 320, height: 720 },
] as const;
const desktopHeroViewports = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
  { name: '1536x864', width: 1536, height: 864 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;
const responsiveBoundaryViewports = [
  { name: '1440x500', width: 1440, height: 500 },
  { name: '1121x600', width: 1121, height: 600 },
  { name: '1120x600', width: 1120, height: 600 },
  { name: '901x500', width: 901, height: 500 },
  { name: '900x500', width: 900, height: 500 },
  { name: '768x500', width: 768, height: 500 },
  { name: '761x500', width: 761, height: 500 },
  { name: '760x500', width: 760, height: 500 },
  { name: '721x600', width: 721, height: 600 },
  { name: '720x600', width: 720, height: 600 },
  { name: '381x600', width: 381, height: 600 },
  { name: '380x600', width: 380, height: 600 },
  { name: '320x500', width: 320, height: 500 },
] as const;
const routeStates = [
  { name: 'plain', href: route, hasSavedBrief: false },
  {
    name: 'homepage-attributed',
    href: `${route}?project=cover&priorities=daylight%2Ceveryday-use`,
    hasSavedBrief: true,
  },
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

async function readResponsiveLayout(page: Page) {
  return page.evaluate(() => {
    const toBox = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      const htmlElement = element as HTMLElement;
      return {
        top: rect.top + window.scrollY,
        right: rect.right,
        bottom: rect.bottom + window.scrollY,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        clientHeight: htmlElement.clientHeight,
        scrollHeight: htmlElement.scrollHeight,
      };
    };
    const hero = document.querySelector('main > section');
    const heroCopy = hero?.querySelector(':scope > div') ?? null;
    const heroMedia = hero?.querySelector(':scope > figure') ?? null;
    const savedBrief = document.querySelector('[data-project-finder-journey-context]');
    const fit = document.querySelector('[data-simple-price-integration="fit-section"]');
    const fitMediaFigures = Array.from(fit?.querySelectorAll('figure') ?? []);
    const clippedText = Array.from(document.querySelectorAll<HTMLElement>(
      'main :is(h1, h2, h3, p, dt, dd, li)',
    ))
      .filter((element) => (
        element.getClientRects().length > 0
        && element.scrollWidth > element.clientWidth + 1
      ))
      .slice(0, 5)
      .map((element) => element.textContent?.trim().slice(0, 80) ?? element.tagName);

    return {
      documentOverflow: document.documentElement.scrollWidth
        - document.documentElement.clientWidth,
      sections: Array.from(document.querySelectorAll('main > section')).map(toBox),
      hero: toBox(hero),
      heroCopy: toBox(heroCopy),
      heroMedia: toBox(heroMedia),
      heroImage: toBox(heroMedia?.querySelector('img') ?? null),
      heroFacts: toBox(hero?.querySelector('dl[aria-label="Simple cover highlights"]') ?? null),
      savedBrief: toBox(savedBrief),
      savedBriefLayout: toBox(savedBrief?.querySelector(':scope > div') ?? null),
      fit: toBox(fit),
      fitMediaFigures: fitMediaFigures.map(toBox),
      clippedText,
    };
  });
}

function expectAligned(actual: number, expected: number, tolerance = 1.5) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

for (const viewport of viewports) {
  test(`simple cover sales page is production-ready at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);

    await expect(page).toHaveTitle('Simple Pitched Acrylic Pergolas | Sanctuary Pergolas');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /follow/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${publicOrigin}${route}`);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', {
      level: 1,
      name: 'Cover the space without losing light.',
    })).toBeVisible();
    await expect(page.getByText('A straightforward pitched acrylic pergola, finished to the Sanctuary standard.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get an initial estimate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Simple form. Sanctuary finish.' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Up to 6 m', exact: true })).toHaveCount(2);
    await expect(page.getByText('Optional blinds', { exact: true })).toBeAttached();
    await expect(page.getByText('Rob Ebert', { exact: true })).toBeAttached();
    await expect(page.getByText('Pierre and Tracy', { exact: true })).toBeAttached();
    await expect(page.getByRole('link', { name: 'Explore Custom design' })).toHaveAttribute(
      'href',
      '/custom-pergolas-auckland',
    );
    await expect(page.locator('#acrylic-enquiry-type')).toHaveValue('residential');
    await expect(page.getByRole('button', { name: 'Request my initial estimate' })).toBeAttached();
    await expect(page.locator('[data-simple-price-integration="fit-section"]')).toBeAttached();
    await expect(page.locator('input[type="range"]')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText('—');
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth <= document.documentElement.clientWidth
    ))).toBe(true);

    const longestCriteriaHeading = page.getByRole('heading', {
      name: 'Straightforward',
      exact: true,
    });
    expect(await longestCriteriaHeading.evaluate((heading) => (
      heading.scrollWidth <= heading.clientWidth
    ))).toBe(true);

    const headerBox = await page.locator('header.site').boundingBox();
    const heroEyebrowBox = await page.getByText(
      'Pitched acrylic cover \u00b7 Auckland',
      { exact: true },
    ).boundingBox();
    expect(headerBox).not.toBeNull();
    expect(heroEyebrowBox).not.toBeNull();
    expect(heroEyebrowBox!.y).toBeGreaterThanOrEqual(
      headerBox!.y + headerBox!.height + 8,
    );

    if (viewport.width === 1024) {
      const factsBox = await page.locator(
        'dl[aria-label="Simple cover highlights"]',
      ).boundingBox();
      expect(factsBox).not.toBeNull();
      expect(factsBox!.height).toBeLessThan(100);
    }

    const priorityImage = page.locator('main section').first().locator('picture img');
    await expect.poll(() => priorityImage.evaluate((image) => (
      (image as HTMLImageElement).naturalWidth
    ))).toBeGreaterThan(0);
    await expect.poll(() => priorityImage.evaluate((image) => (
      (image as HTMLImageElement).currentSrc
    ))).toContain(viewport.width <= 760 ? 'pitched-11' : 'pitched-03');
  });
}

for (const routeState of routeStates) {
  for (const viewport of responsiveBoundaryViewports) {
    test(`${routeState.name} layout stays contained at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await preparePage(page);
      await page.goto(routeState.href);

      const layout = await readResponsiveLayout(page);
      expect(layout.documentOverflow).toBeLessThanOrEqual(0);
      expect(layout.clippedText).toEqual([]);
      expect(layout.hero).not.toBeNull();
      expect(layout.heroCopy).not.toBeNull();
      expect(layout.heroMedia).not.toBeNull();
      expect(layout.heroImage).not.toBeNull();
      expect(layout.heroFacts).not.toBeNull();
      expect(layout.fit).not.toBeNull();
      expect(layout.savedBrief === null).toBe(!routeState.hasSavedBrief);

      for (let index = 1; index < layout.sections.length; index += 1) {
        const previous = layout.sections[index - 1];
        const current = layout.sections[index];
        expect(previous).not.toBeNull();
        expect(current).not.toBeNull();
        expect(current!.top).toBeGreaterThanOrEqual(previous!.bottom - 1.5);
      }

      expect(layout.hero!.scrollHeight).toBeLessThanOrEqual(
        layout.hero!.clientHeight + 1,
      );
      expect(layout.heroCopy!.bottom).toBeLessThanOrEqual(layout.hero!.bottom + 1);
      expect(layout.heroMedia!.bottom).toBeLessThanOrEqual(layout.hero!.bottom + 1);
      expect(layout.heroFacts!.bottom).toBeLessThanOrEqual(layout.heroCopy!.bottom + 1);
      expect(layout.heroFacts!.left).toBeGreaterThanOrEqual(layout.heroCopy!.left - 1);
      expect(layout.heroFacts!.right).toBeLessThanOrEqual(layout.heroCopy!.right + 1);

      if (routeState.hasSavedBrief) {
        expect(layout.savedBriefLayout).not.toBeNull();
        expect(layout.savedBrief!.scrollHeight).toBeLessThanOrEqual(
          layout.savedBrief!.clientHeight + 1,
        );
        expect(layout.savedBrief!.top).toBeGreaterThanOrEqual(layout.hero!.bottom - 1.5);
        expect(layout.savedBriefLayout!.top).toBeGreaterThanOrEqual(
          layout.savedBrief!.top - 1,
        );
        expect(layout.savedBriefLayout!.bottom).toBeLessThanOrEqual(
          layout.savedBrief!.bottom + 1,
        );
        expect(layout.fit!.top).toBeGreaterThanOrEqual(layout.savedBrief!.bottom - 1.5);
      } else {
        expect(layout.fit!.top).toBeGreaterThanOrEqual(layout.hero!.bottom - 1.5);
      }

      if (viewport.width > 900) {
        expectAligned(layout.heroCopy!.top, layout.hero!.top);
        expectAligned(layout.heroMedia!.top, layout.hero!.top);
        expectAligned(layout.heroCopy!.bottom, layout.heroMedia!.bottom);
        expectAligned(layout.heroImage!.bottom, layout.heroMedia!.bottom);
        expectAligned(layout.heroCopy!.left, layout.hero!.left);
        expectAligned(layout.heroMedia!.right, layout.hero!.right);
      } else {
        expectAligned(layout.heroMedia!.top, layout.hero!.top);
        expectAligned(layout.heroMedia!.left, layout.hero!.left);
        expectAligned(layout.heroMedia!.right, layout.hero!.right);
        expectAligned(layout.heroImage!.bottom, layout.heroMedia!.bottom);
        expect(layout.heroCopy!.top).toBeGreaterThanOrEqual(layout.heroMedia!.bottom - 1);
        expectAligned(layout.heroCopy!.left, layout.hero!.left);
        expectAligned(layout.heroCopy!.right, layout.hero!.right);
      }

      expect(layout.fitMediaFigures).toHaveLength(2);
      const [firstFitMedia, secondFitMedia] = layout.fitMediaFigures;
      expect(firstFitMedia).not.toBeNull();
      expect(secondFitMedia).not.toBeNull();
      if (viewport.width > 720) {
        expectAligned(firstFitMedia!.top, secondFitMedia!.top);
        expectAligned(firstFitMedia!.bottom, secondFitMedia!.bottom);
      } else {
        expectAligned(firstFitMedia!.left, secondFitMedia!.left);
        expectAligned(firstFitMedia!.right, secondFitMedia!.right);
        expect(secondFitMedia!.top).toBeGreaterThanOrEqual(firstFitMedia!.bottom - 1);
      }

      const headerBox = await page.locator('header.site').boundingBox();
      const eyebrowBox = await page.getByText(
        'Pitched acrylic cover \u00b7 Auckland',
        { exact: true },
      ).boundingBox();
      const titleBox = await page.getByRole('heading', {
        level: 1,
        name: 'Cover the space without losing light.',
      }).boundingBox();
      const introBox = await page.getByText(
        'A straightforward pitched acrylic pergola, finished to the Sanctuary standard.',
        { exact: true },
      ).boundingBox();
      expect(headerBox).not.toBeNull();
      expect(eyebrowBox).not.toBeNull();
      expect(titleBox).not.toBeNull();
      expect(introBox).not.toBeNull();
      expect(eyebrowBox!.y).toBeGreaterThanOrEqual(
        headerBox!.y + headerBox!.height + 8,
      );
      const titleToIntroGap = introBox!.y - (titleBox!.y + titleBox!.height);
      expect(titleToIntroGap).toBeGreaterThanOrEqual(24);
      expect(titleToIntroGap).toBeLessThanOrEqual(56);

      await page.getByRole('link', { name: 'Check if your deck fits' }).click();
      const anchoredHeaderBox = await page.locator('header.site').boundingBox();
      const anchoredFitBox = await page.locator('#right-fit').boundingBox();
      expect(anchoredHeaderBox).not.toBeNull();
      expect(anchoredFitBox).not.toBeNull();
      expect(anchoredFitBox!.y).toBeGreaterThanOrEqual(
        anchoredHeaderBox!.y + anchoredHeaderBox!.height + 8,
      );
      expect(await page.evaluate(() => (
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      ))).toBeLessThanOrEqual(0);
    });
  }
}

for (const viewport of desktopHeroViewports) {
  test(`desktop hero owns the initial viewport at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await preparePage(page);
    await page.goto(route);

    const hero = page.locator('main > section').first();
    const nextSection = page.locator('main > section').nth(1);
    const heroCopy = hero.locator('h1').locator('..');
    const heroMedia = hero.locator('figure');
    const heroImage = heroMedia.locator('img');
    const title = hero.locator('h1');
    const intro = hero.getByText(
      'A straightforward pitched acrylic pergola, finished to the Sanctuary standard.',
      { exact: true },
    );

    await expect(heroImage).toBeVisible();

    const [
      heroBox,
      nextSectionBox,
      copyBox,
      mediaBox,
      imageBox,
      titleBox,
      introBox,
    ] = await Promise.all([
      hero.boundingBox(),
      nextSection.boundingBox(),
      heroCopy.boundingBox(),
      heroMedia.boundingBox(),
      heroImage.boundingBox(),
      title.boundingBox(),
      intro.boundingBox(),
    ]);

    expect(heroBox).not.toBeNull();
    expect(nextSectionBox).not.toBeNull();
    expect(copyBox).not.toBeNull();
    expect(mediaBox).not.toBeNull();
    expect(imageBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(introBox).not.toBeNull();

    expect(Math.abs(heroBox!.y + heroBox!.height - viewport.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(nextSectionBox!.y - viewport.height)).toBeLessThanOrEqual(2);
    expect(Math.abs(copyBox!.y + copyBox!.height - (mediaBox!.y + mediaBox!.height))).toBeLessThanOrEqual(1);
    expect(Math.abs(imageBox!.y + imageBox!.height - (mediaBox!.y + mediaBox!.height))).toBeLessThanOrEqual(1);
    expect(introBox!.y - (titleBox!.y + titleBox!.height)).toBeGreaterThanOrEqual(24);
  });
}

test('homepage priorities continue into the page and embedded enquiry without project detours', async ({ page }) => {
  await preparePage(page);
  await page.goto(`${route}?project=cover&priorities=daylight%2Ceveryday-use`);

  const context = page.locator('[data-project-finder-journey-context]');
  await expect(context).toHaveAttribute('data-project-direction', 'cover');
  await expect(context).toHaveAttribute('data-project-priorities', 'daylight,everyday-use');
  await expect(context.getByText('A simple cover designed to preserve natural light and make the space work every day.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Refine your brief' })).toHaveAttribute(
    'href',
    '/?project=cover&priorities=daylight%2Ceveryday-use',
  );
  await expect(page.getByRole('link', { name: 'View project' })).toHaveCount(0);

  const formContext = page.locator('input[name="enquiryContext"]');
  await expect(formContext).toHaveValue(/"source_experience":"project-finder-home-v1"/);
  await expect(formContext).toHaveValue(/"project_direction":"cover"/);
  await expect(formContext).toHaveValue(/"project_priorities":\["daylight","everyday-use"\]/);
  await expect(page.locator('input[name="page"]')).toHaveValue(route);
});

test('simple cover enquiry keeps deck level, side protection and accessible validation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);

  await page.locator('#initial-estimate').scrollIntoViewIfNeeded();
  await page.getByText('Add optional project details').click();
  await expect(page.getByLabel('Deck level')).toContainText('Elevated or first-floor deck');
  await expect(page.getByLabel('Side protection')).toContainText('Roof with one side blind');
  await expect(page.getByText('Outdoor blinds', { exact: true })).toBeVisible();

  await page.locator('#acrylic-enquiry-message').fill('Cover the deck and plan a blind for the western side.');
  await page.getByRole('button', { name: 'Request my initial estimate' }).click();
  const errorSummary = page.locator('#acrylic-enquiry-error-summary');
  await expect(errorSummary).toBeFocused();
  await expect(errorSummary).toContainText('Enter your name.');
  await expect(page.locator('#acrylic-enquiry-message')).toHaveValue(
    'Cover the deck and plan a blind for the western side.',
  );
});

test('the simple cover sales page remains accessible without JavaScript', async ({ browser }: { browser: Browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(route);

  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Cover the space without losing light.',
  })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Simple form. Sanctuary finish.' })).toBeVisible();
  await expect(page.getByText('Optional blinds', { exact: true })).toBeVisible();
  const form = page.locator('form[action="/api/enquiry/fallback"]');
  await expect(form).toBeVisible();
  await expect(form.locator('input[name="page"]')).toHaveValue(route);
  await expect(page.getByText('File upload needs JavaScript.')).toBeVisible();
  await context.close();
});

test('the noindex sales page is excluded from the sitemap while the acrylic SEO guide remains listed', async ({ page }) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('/simple-pergolas-auckland');
  await expect(page.locator('body')).toContainText('/acrylic-roof-pergolas-auckland');

  await page.goto('/acrylic-roof-pergolas-auckland?project=cover&priorities=daylight%2Ceveryday-use');
  const legacyHeaderCta = page.locator('header.site').getByRole('link', {
    name: 'Start your project',
  });
  await expect(legacyHeaderCta).toHaveAttribute('href', /project_direction=cover/);
  await expect(legacyHeaderCta).toHaveAttribute(
    'href',
    /project_priorities=daylight%2Ceveryday-use/,
  );
});
