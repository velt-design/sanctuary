import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

const route = '/';
const canonicalUrl = 'https://www.sanctuarypergolas.co.nz';
const evidenceDirectory = path.join(process.cwd(), 'artifacts', 'marketing-home-v2');
const capture = process.env.MARKETING_HOME_V2_CAPTURE?.trim();
const responsiveCaptureLabel = process.env.MARKETING_HOME_V2_CAPTURE_LABEL?.trim();

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '430x932', width: 430, height: 932 },
  { name: '390x844', width: 390, height: 844 },
  { name: '360x800', width: 360, height: 800 },
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
  const source = await image.getAttribute('src');
  await expect.poll(
    () => image.evaluate((element) => {
      const candidate = element as HTMLImageElement;
      return candidate.complete ? candidate.naturalWidth : 0;
    }),
    { message: `${label} should load (${source ?? 'missing src'})` },
  ).toBeGreaterThan(0);
}

async function waitForAllImages(main: Locator) {
  const images = main.locator('img');
  const count = await images.count();
  expect(count, 'homepage V2 should render project and material photography').toBeGreaterThan(0);

  for (let index = 0; index < count; index += 1) {
    if (await images.nth(index).isVisible()) {
      await waitForImage(images.nth(index), `homepage V2 image ${index + 1}`);
    }
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
    const hero = main.locator('section[aria-labelledby="homepage-heading"]');
    const header = page.locator('header.site');
    const brand = header.locator('.site-brand');

    await expect(main).toBeVisible();
    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.getByRole('heading', {
      level: 1,
      name: 'Bespoke pergolas, built around the architecture.',
    })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /follow/i);
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute('content', /noindex/i);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonicalUrl);

    const visitorPathways = main.locator('section[aria-labelledby="project-pathways"]');
    await expect(visitorPathways).toBeVisible();

    if (viewport.width > 640) {
      const desktopDisclosures = main.locator('details[data-mobile-disclosure]');
      await expect(desktopDisclosures).toHaveCount(7);
      await expect.poll(() => desktopDisclosures.evaluateAll((items) => items.every((item) => item.hasAttribute('open'))))
        .toBe(true);
      await expect(desktopDisclosures.locator('summary').first()).toBeHidden();
      await expect(main.locator('figure').filter({ hasText: 'Tindalls Bay / Patio and carport' })).toBeHidden();
      await expect(main.locator('section[aria-labelledby="mobile-selected-projects"]')).toBeHidden();
      await expect(main.locator('section[aria-labelledby="selected-projects"]')).toBeVisible();
    } else {
      await expect(main.locator('section[aria-labelledby="mobile-selected-projects"]')).toBeVisible();
      await expect(main.locator('section[aria-labelledby="selected-projects"]')).toBeHidden();
    }

    const liveRating = main.locator('[data-live-rating]');
    await expect(liveRating).toBeVisible();
    await expect(liveRating).toHaveAttribute(
      'aria-label',
      /^Rated \d+(?:\.\d)? out of 5 from \d+ Google reviews$/,
    );
    await expect(liveRating).toHaveAttribute('href', /search\.google\.com\/local\/reviews/);

    const proofItems = main.locator('[data-proof-item]');
    await expect(proofItems).toHaveCount(4);
    await expect(proofItems.nth(1)).toContainText('Auckland based');
    await expect(proofItems.nth(1)).toContainText('Local design and installation');
    await expect(proofItems.nth(2)).toContainText('Design & Build');
    await expect(proofItems.nth(2)).toContainText('One team from concept to completion');
    await expect(proofItems.nth(3)).toContainText('Fixed-roof specialists');
    await expect(proofItems.nth(3)).toContainText('Residential and selected commercial projects');

    const proofGeometry = await proofItems.evaluateAll((items) => items.map((item) => {
      const primary = item.querySelector<HTMLElement>('[data-proof-primary]');
      const supporting = item.querySelector<HTMLElement>('[data-proof-supporting]');
      const bounds = item.getBoundingClientRect();
      const supportingBounds = supporting?.getBoundingClientRect();
      const range = document.createRange();
      if (primary) range.selectNodeContents(primary);
      const primaryLineTops = primary
        ? [...range.getClientRects()].filter((line) => line.width > 0).map((line) => Math.round(line.top))
        : [];
      return {
        top: bounds.top,
        height: bounds.height,
        supportingTop: supportingBounds?.top ?? 0,
        primaryLines: new Set(primaryLineTops).size,
      };
    }));
    for (const item of proofGeometry) {
      expect(item.primaryLines, 'proof statements should wrap to no more than two controlled lines').toBeLessThanOrEqual(2.1);
    }
    const proofRowTops = [...new Set(proofGeometry.map((item) => Math.round(item.top)))];
    for (const rowTop of proofRowTops) {
      const row = proofGeometry.filter((item) => Math.round(item.top) === rowTop);
      expect(new Set(row.map((item) => Math.round(item.height))).size).toBe(1);
      expect(Math.max(...row.map((item) => item.supportingTop)) - Math.min(...row.map((item) => item.supportingTop)))
        .toBeLessThanOrEqual(1);
    }

    const heroActions = main.getByLabel('Homepage actions');
    await expect(heroActions.getByRole('link', { name: 'Get an initial project estimate', exact: true }))
      .toHaveAttribute('href', '/contact?enquiry=residential#contact-form');
    await expect(heroActions.locator('a[href="/projects"]')).toHaveText('View completed projects');

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(hero).toBeVisible();
    await expect(header).toBeVisible();

    const topState = await page.evaluate(() => {
      const headerElement = document.querySelector<HTMLElement>('header.site');
      const brandElement = headerElement?.querySelector<HTMLElement>('.site-brand');
      const heroElement = document.querySelector<HTMLElement>('main[data-homepage-variant="v2"] section[aria-labelledby="homepage-heading"]');
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

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const) {
  test(`mobile homepage treatment is concise and progressive at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await preparePage(page);
    await page.goto(route);

    const main = page.locator('main[data-homepage-variant="v2"]');
    const disclosures = main.locator('details[data-mobile-disclosure]');
    await expect(disclosures).toHaveCount(7);
    await expect.poll(() => disclosures.evaluateAll((items) => items.every((item) => !item.hasAttribute('open'))))
      .toBe(true);

    const summaries = disclosures.locator('summary');
    await expect(summaries).toHaveCount(7);
    for (let index = 0; index < await summaries.count(); index += 1) {
      await expect(summaries.nth(index)).toBeVisible();
      const bounds = await summaries.nth(index).boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }

    const collapsedState = await main.evaluate((element) => {
      const wordCount = (value: string) => value.trim().match(/\S+/g)?.length ?? 0;
      const blocks = [...element.querySelectorAll<HTMLElement>(':scope > section, :scope > aside, :scope > figure')]
        .filter((block) => {
          const bounds = block.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        });
      let currentTextOnlyRun = 0;
      let longestTextOnlyRun = 0;

      for (const block of blocks) {
        const hasImage = [...block.querySelectorAll('img')].some((image) => {
          const bounds = image.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        });
        const isTextHeavy = wordCount(block.innerText) > 50;
        currentTextOnlyRun = isTextHeavy && !hasImage ? currentTextOnlyRun + 1 : 0;
        longestTextOnlyRun = Math.max(longestTextOnlyRun, currentTextOnlyRun);
      }

      return {
        visibleWords: wordCount(element.innerText),
        longestTextOnlyRun,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });

    expect(collapsedState.overflow).toBeLessThanOrEqual(0);
    expect(collapsedState.longestTextOnlyRun).toBeLessThanOrEqual(2);

    const headingLineCounts = await main.locator('h1, h2').evaluateAll((headings) => headings.map((heading) => {
      const range = document.createRange();
      range.selectNodeContents(heading);
      return new Set([...range.getClientRects()].filter((line) => line.width > 0).map((line) => Math.round(line.top))).size;
    }));
    expect(Math.max(...headingLineCounts), 'mobile page-level headings should avoid awkward long wraps')
      .toBeLessThanOrEqual(4);

    const roofApproachCards = main.locator('[data-homepage-event="roof_approach_click"]').locator('..');
    const cardHeights = await roofApproachCards.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
    expect(Math.max(...cardHeights), 'priority mobile cards should remain compact').toBeLessThanOrEqual(300);

    const visitorPathways = main.locator('section[aria-labelledby="project-pathways"]');
    const otherProjectTypes = visitorPathways.locator('details[data-mobile-disclosure]');
    await expect(visitorPathways.locator('a[href="/pergolas-auckland"]')).toBeVisible();
    await expect(visitorPathways.locator('a[href="/custom-pergolas-auckland"]')).toBeVisible();
    await expect(visitorPathways.locator('a[href^="/commercial-pergolas-auckland"]')).toBeHidden();
    await expect(otherProjectTypes.locator('summary')).toHaveText('Other project types');

    const selectedPreview = main.locator('section[aria-labelledby="mobile-selected-projects"]');
    await expect(selectedPreview).toBeVisible();
    await expect(selectedPreview.locator('article')).toHaveCount(2);
    const previewImages = selectedPreview.locator('img');
    await expect(previewImages).toHaveCount(2);
    for (let index = 0; index < await previewImages.count(); index += 1) {
      await waitForImage(previewImages.nth(index), `early selected project ${index + 1}`);
    }

    const mobileSectionOrder = await main.evaluate((element) => {
      const pathways = element.querySelector('section[aria-labelledby="project-pathways"]');
      const projects = element.querySelector('section[aria-labelledby="mobile-selected-projects"]');
      const approach = element.querySelector('section[aria-labelledby="sanctuary-design-approach"]');
      if (!pathways || !projects || !approach) return null;
      return [pathways, projects, approach].map((section) => section.getBoundingClientRect().top);
    });
    expect(mobileSectionOrder).not.toBeNull();
    expect(mobileSectionOrder![0]).toBeLessThan(mobileSectionOrder![1]);
    expect(mobileSectionOrder![1]).toBeLessThan(mobileSectionOrder![2]);

    const formImages = main.locator('section[aria-labelledby="pergola-forms"] article img');
    await expect(formImages).toHaveCount(4);
    const approachImages = main.locator('section[aria-labelledby="roof-and-material-approaches"] article img');
    await expect(approachImages).toHaveCount(3);

    const mobileReviews = main.getByRole('region', { name: 'Client reviews' });
    await expect(mobileReviews.locator('figure:visible')).toHaveCount(1);
    await expect(mobileReviews.getByRole('button', { name: 'Previous review' })).toBeVisible();
    await expect(mobileReviews.getByRole('button', { name: 'Next review' })).toBeVisible();

    const process = main.locator('section[aria-labelledby="design-build-process"]');
    await expect(process.locator('details')).toHaveCount(5);
    const processSummaries = process.locator('details > summary');
    for (let index = 0; index < await processSummaries.count(); index += 1) {
      const bounds = await processSummaries.nth(index).boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }

    const guideGateway = main.getByRole('navigation', { name: 'Featured pergola guides' });
    await expect(guideGateway.getByRole('link')).toHaveCount(3);

    const proofRows = await main.locator('[data-proof-item]').evaluateAll((items) => (
      new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size
    ));
    expect(proofRows).toBe(2);

    for (let index = 0; index < await summaries.count(); index += 1) {
      await summaries.nth(index).click();
      await expect(disclosures.nth(index)).toHaveAttribute('open', '');
    }

    await main.locator('details').evaluateAll((items) => {
      items.forEach((item) => {
        item.open = true;
      });
    });

    const expandedWords = await main.evaluate((element) => (
      element.innerText.trim().match(/\S+/g)?.length ?? 0
    ));
    expect(
      collapsedState.visibleWords / expandedWords,
      'the default mobile view should expose about 30% less copy while retaining expandable content',
    ).toBeLessThanOrEqual(.72);
    expect(collapsedState.visibleWords / expandedWords).toBeGreaterThan(.62);
  });
}

test('approved homepage is indexable at root and the staging route permanently redirects', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  const stagingResponse = await page.request.get('/home-v2', { maxRedirects: 0 });
  expect(stagingResponse.status()).toBe(308);
  expect(stagingResponse.headers().location).toBe('/');

  await page.goto(route);
  await expect(page.locator('main[data-homepage-variant="v2"]')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /index/i);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonicalUrl);
  await expect(page.locator('header.site a[href="/home-v2"]')).toHaveCount(0);
  await expect(page.locator('footer a[href="/home-v2"]')).toHaveCount(0);

  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText('/home-v2');
  await expect(page.locator('body')).toContainText(`${canonicalUrl}/`);
});

test('homepage V2 exposes the approved pathways, evidence and production-ready SEO identity', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto(route);

  const main = page.locator('main[data-homepage-variant="v2"]');
  await expect(page).toHaveTitle('Architectural Pergola Design & Build | Sanctuary Pergolas');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    'Sanctuary designs, builds and installs bespoke fixed-roof architectural pergolas for Auckland homes and selected commercial projects.',
  );

  await expect(main).toContainText('Sanctuary designs, builds and installs bespoke fixed-roof pergolas for Auckland homes and selected commercial projects');
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
    ['/commercial-pergolas-auckland#project-details', 'Discuss a commercial project'],
    ['/contact?enquiry=professional#contact-form', 'Send plans or a project brief'],
  ] as const;
  const pathwaySection = main.locator('section[aria-labelledby="project-pathways"]');
  for (const [href, name] of expectedPathways) {
    await expect(pathwaySection.getByRole('link', { name })).toHaveAttribute('href', href);
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
  await expect(process.locator('ol:visible > li')).toHaveCount(5);
  await expect(main.locator('[data-home-review]')).toHaveCount(3);
  await expect(main.getByRole('link', { name: 'Explore custom design capability' }))
    .toHaveAttribute('href', '/custom-pergolas-auckland');
  await expect(main.getByRole('link', { name: 'Compare pergola forms' }))
    .toHaveAttribute('href', '/products');
  await expect(main.getByRole('link', { name: 'Compare roof approaches' }))
    .toHaveAttribute('href', '/pergolas-auckland#roofing-options');
  await expect(main.getByRole('link', { name: 'Explore all pergola guides' })).toHaveAttribute('href', '/pergola-guides');
  await expect(main.getByRole('navigation', { name: 'Featured pergola guides' }).getByRole('link')).toHaveCount(3);
  await expect(main.getByRole('link', { name: 'Send your project details' }))
    .toHaveAttribute('href', '/contact?enquiry=residential#contact-form');
  await expect(main).toContainText('Before site work begins, Sanctuary records the agreed design');
  await expect(main).toContainText('Documented scope, approval and scheduling');
  await expect(main).not.toContainText('Three concise Google reviews');
  await expect(main).not.toContainText('complete technical manual');
  await expect(main).not.toContainText('Standalone');
  await expect(page.getByRole('link', { name: 'Get an estimate', exact: true }))
    .toHaveAttribute('href', '/contact?enquiry=residential#contact-form');

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
    viewport_category: 'desktop',
    destination: '/projects',
  });
});

test('mobile homepage records disclosure and review interactions with device context', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, true);
  await page.goto(route);
  await page.evaluate(() => {
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
  });

  const pathways = page.locator('section[aria-labelledby="project-pathways"]');
  await pathways.locator('summary').click();
  await page.getByRole('button', { name: 'Next review' }).click();

  const trackedEvents = await page.evaluate(() => (
    (window as typeof window & { dataLayer?: Array<Record<string, unknown> | unknown[]> }).dataLayer
      ?.filter((entry): entry is Record<string, unknown> => !Array.isArray(entry))
      .filter((entry) => ['project_types_expand', 'review_next_click'].includes(String(entry.event)))
  ));

  expect(trackedEvents).toEqual([
    {
      event: 'project_types_expand',
      homepage_variant: 'v2',
      viewport_category: 'mobile',
    },
    {
      event: 'review_next_click',
      homepage_variant: 'v2',
      viewport_category: 'mobile',
    },
  ]);

  await page.getByRole('button', { name: 'Open menu' }).click();
  const mobileEstimate = page.getByRole('navigation', { name: 'Mobile primary' })
    .getByRole('link', { name: 'Get an estimate', exact: true });
  await expect(mobileEstimate).toBeVisible();
  await expect(mobileEstimate).toHaveAttribute('href', '/contact?enquiry=residential#contact-form');
  await expect(mobileEstimate).toHaveAttribute('data-homepage-event', 'header_estimate_click');
});

test('homepage enquiry links open the promised contact pathway', async ({ page }) => {
  await preparePage(page);

  for (const [destination, enquiryOption] of [
    ['/contact?enquiry=residential#contact-form', 'Residential'],
    ['/contact?enquiry=professional#contact-form', 'Architect, designer or builder'],
  ] as const) {
    await page.goto(destination);
    await expect(page).toHaveURL(new RegExp(`${destination.replace(/[?]/g, '\\?')}$`));
    await expect(page.getByRole('radio', { name: enquiryOption, exact: false }))
      .toBeChecked();
    await expect(page.locator('#contact-form').last()).toBeVisible();
  }
});

test('homepage comparison and commercial links land at the promised sections', async ({ page }) => {
  await preparePage(page);

  for (const [destination, target] of [
    ['/products', '[data-products-index]'],
    ['/pergolas-auckland#roofing-options', '#roofing-options'],
    ['/commercial-pergolas-auckland#project-details', '#project-details'],
    ['/contact#contact-form', '#contact-form'],
  ] as const) {
    await page.goto(destination);
    await expect(page.locator(target).last()).toBeAttached();
    await expect(page).toHaveURL(new RegExp(`${destination.replace(/[?]/g, '\\?')}$`));
  }
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

test('homepage keeps a coherent keyboard and document structure', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);

  const structure = await page.locator('main[data-homepage-variant="v2"]').evaluate((main) => {
    const headingLevels = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .map((heading) => Number(heading.tagName.slice(1)));
    const images = [...main.querySelectorAll('img')];
    return {
      headingLevels,
      h1Count: headingLevels.filter((level) => level === 1).length,
      imagesMissingAlt: images.filter((image) => !image.hasAttribute('alt')).length,
      imageCount: images.length,
    };
  });
  expect(structure.h1Count).toBe(1);
  expect(structure.imagesMissingAlt).toBe(0);
  expect(structure.imageCount).toBeGreaterThan(0);
  for (let index = 1; index < structure.headingLevels.length; index += 1) {
    expect(
      structure.headingLevels[index] - structure.headingLevels[index - 1],
      'heading levels should not skip forward',
    ).toBeLessThanOrEqual(1);
  }

  await page.keyboard.press('Tab');
  const focusedElement = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active) return null;
    const style = getComputedStyle(active);
    return {
      tagName: active.tagName,
      name: active.getAttribute('aria-label') || active.textContent?.trim(),
      hasVisibleFocus:
        (style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0)
        || style.boxShadow !== 'none',
    };
  });
  expect(focusedElement?.tagName).toBe('A');
  expect(focusedElement?.name).toContain('Sanctuary Pergolas');
  expect(focusedElement?.hasVisibleFocus).toBe(true);

  const mobileMenuButton = page.getByRole('button', { name: 'Open menu' });
  const heroEstimate = page.getByRole('link', { name: 'Get an initial project estimate', exact: true });
  for (const target of [mobileMenuButton, heroEstimate]) {
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(44);
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
  }
});

test('Warkworth exterior focal framing propagates across public placements', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);

  for (const destination of [
    '/',
    '/projects',
    '/projects/warkworth-outdoor-room',
    '/pergola-guides',
    '/pergolas-auckland',
    '/acrylic-roof-pergolas-auckland',
    '/acrylic-roof-pergolas-auckland-v2',
  ]) {
    const response = await page.goto(destination);
    expect(response?.ok(), `${destination} should resolve`).toBe(true);
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

test('capture approved homepage evidence', async ({ page }) => {
  test.skip(!capture, 'Set MARKETING_HOME_V2_CAPTURE=1 to refresh homepage evidence.');
  await preparePage(page);
  await mkdir(evidenceDirectory, { recursive: true });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto(route);
    const main = page.locator('main[data-homepage-variant="v2"]');
    await expect(main).toBeVisible();
    await waitForImage(
      main.locator('section[aria-labelledby="homepage-heading"] img'),
      `homepage ${viewport.name} hero`,
    );
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(evidenceDirectory, `homepage-${viewport.name}-top-${viewport.width}x${viewport.height}.png`),
    });

    const proofRail = main.locator('aside[aria-label="Sanctuary project evidence"]');
    await proofRail.scrollIntoViewIfNeeded();
    await proofRail.screenshot({
      path: path.join(evidenceDirectory, `homepage-proof-${viewport.name}-${viewport.width}x${viewport.height}.png`),
    });
  }
});

test('capture responsive homepage redesign evidence', async ({ page }) => {
  test.skip(
    !responsiveCaptureLabel,
    'Set MARKETING_HOME_V2_CAPTURE_LABEL=before or after to capture responsive redesign evidence.',
  );
  await preparePage(page);

  const responsiveEvidenceDirectory = path.join(
    process.cwd(),
    'artifacts',
    'homepage-mobile-redesign',
    responsiveCaptureLabel!,
  );
  await mkdir(responsiveEvidenceDirectory, { recursive: true });

  for (const viewport of [
    { name: 'mobile-360x800', width: 360, height: 800 },
    { name: 'mobile-390x844', width: 390, height: 844 },
    { name: 'mobile-430x932', width: 430, height: 932 },
    { name: 'tablet-768x1024', width: 768, height: 1024 },
    { name: 'tablet-820x1180', width: 820, height: 1180 },
    { name: 'tablet-1024x1366', width: 1024, height: 1366 },
    { name: 'desktop-1280x800', width: 1280, height: 800 },
    { name: 'desktop-1440x900', width: 1440, height: 900 },
  ] as const) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(route);

    const main = page.locator('main[data-homepage-variant="v2"]');
    await expect(main).toBeVisible();
    await waitForAllImages(main);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(
        responsiveEvidenceDirectory,
        `homepage-${responsiveCaptureLabel}-${viewport.name}.png`,
      ),
      fullPage: true,
    });
  }
});
