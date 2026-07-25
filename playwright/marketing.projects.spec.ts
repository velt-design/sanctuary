import { expect, test, type Page } from '@playwright/test';
import { ROOF_MATERIAL_MEDIA } from '../apps/marketing/app/start/startFlowMedia';
import { projects, type Project } from '../apps/marketing/data/projects';
import { buildEnquiryHref } from '../apps/marketing/lib/enquiryContext';

const representativeProject = projects[0];
const representativeRoute = `/projects/${representativeProject.slug}`;
const publicOrigin = 'https://www.sanctuarypergolas.co.nz';
const mobileRefinementRoutes = [
  {
    name: 'residential outdoor room',
    route: '/projects/warkworth-outdoor-room',
    maximumHeightAt390: 4_250,
    project: projects.find((project) => project.slug === 'warkworth-outdoor-room'),
  },
  {
    name: 'compact residential project',
    route: '/projects/st-heliers-townhouse',
    maximumHeightAt390: 3_508,
    project: projects.find((project) => project.slug === 'st-heliers-townhouse'),
  },
  {
    name: 'commercial project',
    route: '/projects/lilliput-mini-golf',
    maximumHeightAt390: 4_060,
    project: projects.find((project) => project.slug === 'lilliput-mini-golf'),
  },
  {
    name: 'incomplete technical record',
    route: '/projects/velskov-forest',
    maximumHeightAt390: 4_074,
    project: projects.find((project) => project.slug === 'velskov-forest'),
  },
] as const;

async function dismissConsent(page: Page) {
  const essentialOnly = page.getByRole('button', { name: 'Essential only' });
  if (await essentialOnly.count() && await essentialOnly.isVisible()) {
    await essentialOnly.click();
  }
}

function visibleMain(page: Page) {
  return page.locator('main:visible').last();
}

function visibleProjectsMain(page: Page) {
  return page.locator('main[data-projects-experience]:visible').last();
}

function projectGalleryItemCount(project: Project) {
  const heroImage = project.caseStudyHeroImage ?? project.heroImage;
  return new Set([
    heroImage.src,
    ...project.gallery.map((image) => image.src),
  ]).size - 1;
}

async function expectNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(dimensions.documentScrollWidth).toBeLessThanOrEqual(dimensions.documentClientWidth);
  expect(dimensions.bodyScrollWidth).toBeLessThanOrEqual(dimensions.bodyClientWidth);
}

async function expectNoNestedVerticalScroll(page: Page) {
  const nestedScrollers = await visibleProjectsMain(page).locator('*').evaluateAll((elements) => elements
    .filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      const style = getComputedStyle(element);
      return ['auto', 'scroll'].includes(style.overflowY)
        && element.scrollHeight > element.clientHeight + 1;
    })
    .map((element) => ({
      className: String(element.className),
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    })));

  expect(nestedScrollers).toEqual([]);
}

async function expectMinimumTouchTargets(page: Page) {
  const undersized = await visibleProjectsMain(page)
    .locator('a:visible, button:visible, select:visible, summary:visible')
    .evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        height: Math.round(rect.height),
        label:
          element.getAttribute('aria-label')
          ?? element.textContent?.trim().replace(/\s+/g, ' ').slice(0, 60)
          ?? element.tagName,
        width: Math.round(rect.width),
      };
    }).filter(({ height, width }) => height < 44 || width < 44));

  expect(undersized).toEqual([]);
}

async function expectLogicalVisibleHeadingOrder(page: Page) {
  const levels = await visibleProjectsMain(page)
    .locator('h1:visible, h2:visible, h3:visible').evaluateAll((headings) =>
    headings.map((heading) => Number(heading.tagName.slice(1))));

  expect(levels[0]).toBe(1);
  for (let index = 1; index < levels.length; index += 1) {
    expect(
      levels[index] - levels[index - 1],
      `visible heading order should not skip from H${levels[index - 1]} to H${levels[index]}`,
    ).toBeLessThanOrEqual(1);
  }
}

async function expectNoProjectEmDashes(page: Page) {
  const main = visibleProjectsMain(page);
  await expect(main).not.toContainText('—');
  const decorativeEmDashes = await main.locator('*').evaluateAll((elements) =>
    elements.reduce((count, element) => {
      const before = getComputedStyle(element, '::before').content;
      const after = getComputedStyle(element, '::after').content;
      return count + Number(before.includes('—')) + Number(after.includes('—'));
    }, 0));
  expect(decorativeEmDashes).toBe(0);
}

function visibleProjectCards(page: Page) {
  return visibleProjectsMain(page).locator('[data-project-card]:visible');
}

test('projects index preserves a canonical collection route and legacy query selection', async ({ page }) => {
  await page.goto(`/projects?slug=${projects[3].slug}`);

  await expect(page.locator('h1:visible')).toHaveCount(1);
  await expect(page.locator('h1:visible')).toHaveText('Pergola projects and case studies');
  await expect(page.locator('[data-project-case-study]:visible')).toHaveAttribute(
    'data-project-case-study',
    projects[3].slug,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicOrigin}/projects`,
  );

  const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
  const parsedSchemas = schemas.flatMap((schema) => {
    const parsed = JSON.parse(schema);
    return Array.isArray(parsed) ? parsed : [parsed];
  });
  expect(parsedSchemas.some((schema) => schema['@type'] === 'CollectionPage')).toBe(true);
  expect(parsedSchemas.some((schema) => schema['@type'] === 'ItemList')).toBe(true);
});

test('mobile project index is one image-led semantic card sequence at every target width', async ({
  page,
}) => {
  test.slow();

  for (const width of [430, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await dismissConsent(page);

    const main = visibleProjectsMain(page);
    const cards = visibleProjectCards(page);
    await expect(main.locator('h1:visible')).toHaveText('Pergola projects and case studies');
    await expect(main.locator('.project-case-study')).toHaveCount(0);
    await expect(main.locator('[data-project-case-study]')).toHaveCount(0);
    await expect(main.locator('.project-case-study__gallery')).toHaveCount(0);
    await expect(main.locator('.project-navigator__trigger')).toHaveCount(0);
    await expect(main.locator('.project-navigator__list')).toHaveCount(1);
    await expect(main.getByRole('navigation', { name: 'Project case studies' }))
      .toContainText(projects[0].title);
    await expect(main.locator('.project-navigator__result-count'))
      .toHaveAttribute('aria-live', 'polite');
    await expect(cards).toHaveCount(projects.length);
    await expect(cards.first().locator('h2')).toHaveText(projects[0].title);
    await expect(cards.first()).toHaveAttribute(
      'href',
      `/projects/${projects[0].slug}`,
    );
    await expect(cards.first()).toContainText(projects[0].title);
    await expect(cards.first()).toContainText(projects[0].location);
    await expect(cards.first()).toContainText(
      `${projects[0].type} / ${projects[0].roof}`,
    );
    await expect(cards.first()).not.toContainText(projects[0].blurb);
    await expect(cards.first()).not.toContainText(projects[0].year);

    const [firstCard, secondCard] = await cards.evaluateAll((elements) =>
      elements.slice(0, 2).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          height: rect.height,
          width: rect.width,
          y: rect.y,
        };
      }));
    expect(firstCard?.width ?? 0).toBeGreaterThanOrEqual(width - 42);
    expect(secondCard?.y ?? 0).toBeGreaterThan(
      (firstCard?.y ?? 0) + (firstCard?.height ?? 0),
    );

    const firstMedia = main.locator(
      '[data-project-card] [data-responsive-media] > div',
    ).first();
    const mediaBox = await firstMedia.boundingBox();
    expect(mediaBox?.height ?? 0).toBeCloseTo((mediaBox?.width ?? 0) * 1.25, 0);
    const firstImage = firstMedia.locator('img');
    await expect(firstImage).toHaveAttribute('loading', 'lazy');
    await expect(firstImage).toHaveAttribute(
      'sizes',
      '(max-width: 899px) calc(100vw - 2.5rem), 1px',
    );
    await expect(firstImage).toHaveCSS(
      'object-position',
      projects[0].heroImage.objectPosition ?? '50% 50%',
    );
    await expect.poll(
      () => firstImage.evaluate((image: HTMLImageElement) => (
        image.complete && image.naturalWidth > 0
      )),
    ).toBe(true);

    const filterDisclosure = main.locator('[data-project-filter-disclosure]');
    const filterSummary = filterDisclosure.locator('summary');
    await expect(filterSummary).toBeVisible();
    expect((await filterSummary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expect(filterDisclosure).not.toHaveAttribute('open', '');
    await filterSummary.focus();
    await page.keyboard.press('Tab');
    await expect(cards.first()).toBeFocused();
    expect(await cards.first().evaluate((element) => (
      getComputedStyle(element).outlineStyle
    ))).not.toBe('none');

    await expectNoPageOverflow(page);
    await expectNoNestedVerticalScroll(page);
    await expectMinimumTouchTargets(page);
    await expectLogicalVisibleHeadingOrder(page);
  }
});

test('mobile collection omits hidden project detail markup, payload and media requests', async ({
  browser,
}, testInfo) => {
  test.slow();
  const baseURL = String(testInfo.project.use.baseURL);
  const selectedProject = projects.find((project) => project.slug === 'velskov-forest');
  expect(selectedProject).toBeTruthy();

  for (const width of [430, 390, 360]) {
    const context = await browser.newContext({
      baseURL,
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const projectMediaRequests: string[] = [];
    page.on('request', (request) => {
      if (
        ['image', 'media'].includes(request.resourceType())
        || request.url().includes('youtube')
      ) {
        projectMediaRequests.push(request.url());
      }
    });

    const response = await page.goto(
      `/projects?slug=${selectedProject!.slug}&audience=residential`,
      { waitUntil: 'networkidle' },
    );
    expect(response?.ok()).toBe(true);
    const html = await response!.text();
    const main = visibleProjectsMain(page);

    await expect(main.locator('[data-project-case-study]')).toHaveCount(0);
    await expect(main.locator('.project-case-study__gallery')).toHaveCount(0);
    await expect(main.locator('.project-case-study iframe')).toHaveCount(0);
    await expect(visibleProjectCards(page)).toHaveCount(
      projects.filter((project) => project.type === 'Residential').length,
    );
    expect(html).not.toContain('data-project-case-study');
    expect(html).not.toContain(selectedProject!.constraint);
    expect(html).not.toContain('/images/project-velskov-02.jpg');
    expect(html).not.toContain('/images/project-velskov-03.jpg');
    expect(Buffer.byteLength(html)).toBeLessThan(150_000);
    expect(
      projectMediaRequests.filter((url) => url.includes('project-velskov')),
    ).toEqual([]);
    expect(
      projectMediaRequests.filter((url) => url.includes('youtube')),
    ).toEqual([]);

    await context.close();
  }
});

test('project filters persist through refresh, filter history, project Back, and reset', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  await dismissConsent(page);

  const main = visibleProjectsMain(page);
  const disclosure = main.locator('[data-project-filter-disclosure]');
  const summary = disclosure.locator('summary');
  // Server HTML keeps responsive detail open for no-JavaScript access. Wait
  // for the mobile enhancement to close it before asserting its JS behavior.
  await expect(disclosure).not.toHaveAttribute('open', '');
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(disclosure).toHaveAttribute('open', '');

  await main.getByLabel('Filter by audience').selectOption('residential');
  await page.waitForURL(/audience=residential/);
  await expect(visibleProjectCards(page)).toHaveCount(9);

  await main.getByLabel('Filter by roof form').selectOption('gable');
  await page.waitForURL(/audience=residential&form=gable/);
  await expect(visibleProjectCards(page)).toHaveCount(4);
  await expect(main.locator('.project-navigator__result-count'))
    .toHaveText('Showing 4 of 14 projects');

  await page.reload();
  await expect(main.getByLabel('Filter by audience')).toHaveValue('residential');
  await expect(main.getByLabel('Filter by roof form')).toHaveValue('gable');
  await expect(visibleProjectCards(page)).toHaveCount(4);

  await page.goBack();
  await expect(main.getByLabel('Filter by audience')).toHaveValue('residential');
  await expect(main.getByLabel('Filter by roof form')).toHaveValue('all');
  await expect(visibleProjectCards(page)).toHaveCount(9);
  await page.goForward();
  await expect(visibleProjectCards(page)).toHaveCount(4);

  const filteredUrl = page.url();
  const firstDestination = await visibleProjectCards(page).first().getAttribute('href');
  await visibleProjectCards(page).first().click();
  await expect(page).toHaveURL(firstDestination ?? '');
  await page.goBack();
  await expect(page).toHaveURL(filteredUrl);
  await expect(visibleProjectCards(page)).toHaveCount(4);

  await main.locator('[data-project-filter-disclosure] summary').click();
  await main.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(visibleProjectCards(page)).toHaveCount(projects.length);
  await page.goBack();
  await expect(visibleProjectCards(page)).toHaveCount(4);
});

test('empty project filters keep a clear all-project recovery', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/projects?audience=commercial&form=box-perimeter');
  await dismissConsent(page);

  const main = visibleProjectsMain(page);
  await expect(visibleProjectCards(page)).toHaveCount(0);
  await expect(main.locator('.project-navigator__result-count'))
    .toHaveText('Showing 0 of 14 projects');
  await expect(main.locator('.project-navigator__empty'))
    .toContainText('No projects match both filters.');
  const viewAll = main.getByRole('button', { name: 'View all projects' });
  expect((await viewAll.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await viewAll.click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(visibleProjectCards(page)).toHaveCount(projects.length);
  await expectNoPageOverflow(page);
});

test('every canonical project remains discoverable in the public sitemap', async ({ page }) => {
  await page.goto('/sitemap.xml');
  const sitemap = page.locator('body');

  for (const project of projects) {
    await expect(sitemap).toContainText(`${publicOrigin}/projects/${project.slug}`);
  }
});

test('Atelier Shu uses the front-on canopy image on its case study and commercial guide proof', async ({ page }) => {
  const imagePath = 'project-atelier-shu-02.jpg';

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/atelier-shu-cafe');
  const hero = visibleProjectsMain(page).locator('.project-case-study__hero');
  expect((await hero.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(780);
  await expect(hero.locator('img')).toHaveAttribute('src', new RegExp(imagePath));
  await expect(hero.locator('img')).toHaveAttribute(
    'alt',
    'Front-on view of the dark-tint acrylic gable canopy over outdoor seating at Atelier Shu Cafe in Newmarket',
  );
  await expect(hero.locator('img')).toHaveCSS('object-position', '50% 18%');
  await expect(visibleProjectsMain(page).locator(
    '.project-case-study__gallery img[src*="project-atelier-shu-03.jpg"]',
  )).toHaveCount(1);

  await page.goto('/commercial-pergolas-auckland');
  const atelierCard = visibleMain(page).locator('a[href="/projects/atelier-shu-cafe"]');
  await expect(atelierCard.locator('img')).toHaveAttribute('src', new RegExp(imagePath));
  await expect(atelierCard.locator('img')).toHaveAttribute(
    'alt',
    'Front-on view of the dark-tint acrylic gable canopy over outdoor seating at Atelier Shu Cafe in Newmarket',
  );

  await page.goto('/sitemap-images.xml');
  await expect(page.locator('body')).toContainText(`${publicOrigin}/images/${imagePath}`);
});

test('Tindalls Bay leads with the full exterior and retains both supporting views', async ({ page }) => {
  await page.goto('/projects/tindalls-bay-pavilion');
  const main = visibleProjectsMain(page);

  await expect(main.locator('.project-case-study__hero img')).toHaveAttribute(
    'src',
    /project-tindalls-bay-02\.jpg/,
  );
  await expect(main.locator('.project-case-study__gallery img')).toHaveCount(2);
  await expect(main.locator('.project-case-study__gallery img').nth(0)).toHaveAttribute(
    'src',
    /project-tindalls-bay\.jpg/,
  );
  await expect(main.locator('.project-case-study__gallery img').nth(1)).toHaveAttribute(
    'src',
    /project-tindalls-bay-03\.jpg/,
  );
});

test('Atelier imagery stays selective and claim-aligned across guide surfaces', async ({ page }) => {
  for (const route of ['/projects/atelier-shu-cafe', '/commercial-pergolas-auckland']) {
    await page.goto(route);
    await expect(visibleMain(page).locator(
      'img[src*="project-atelier-shu-02.jpg"]',
    )).toHaveCount(1);
  }

  for (const route of [
    '/acrylic-roof-pergolas-auckland',
    '/acrylic-roof-pergolas-auckland-v2',
    '/acrylic-pergolas-vs-louvre-roofs',
    '/start',
    '/',
    '/gable-pergolas-auckland',
  ]) {
    await page.goto(route);
    await expect(visibleMain(page).locator(
      'img[src*="project-atelier-shu-02.jpg"]',
    )).toHaveCount(0);
  }

  await page.goto('/acrylic-roof-pergolas-auckland');
  let main = visibleMain(page);
  await expect(main.locator('.acrylic-editorial-media img')).toHaveAttribute(
    'src',
    /project-dairy-flat-02\.jpg/,
  );
  await expect(main.locator('a[href="/projects/atelier-shu-cafe"] img')).toHaveAttribute(
    'src',
    /project-atelier-shu-03\.jpg/,
  );

  await page.goto('/start');
  main = visibleMain(page);
  await expect(main.locator('img[src*="project-atelier-shu-03.jpg"]')).toHaveAttribute(
    'alt',
    'Atelier Shu Cafe gable canopy integrated with the existing Newmarket frontage.',
  );
  await expect(main.locator('img[src*="project-atelier-shu-01.jpg"]')).toHaveCount(0);
  expect(ROOF_MATERIAL_MEDIA.combination).toEqual({
    src: '/images/materials-combination.jpg',
    alt: 'Combination roof concept with timber-lined and acrylic roof zones.',
  });

  for (const route of [
    '/acrylic-roof-pergolas-auckland',
    '/acrylic-roof-pergolas-auckland-v2',
    '/acrylic-pergolas-vs-louvre-roofs',
    '/start',
  ]) {
    await page.goto(route);
    await expect(visibleMain(page).locator(
      'img[src*="project-atelier-shu-03.jpg"]',
    )).toHaveCount(1);
  }
});

test('every canonical project route has complete case-study structure, metadata, and a loaded hero', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });

  for (const project of projects) {
    await page.goto(`/projects/${project.slug}`, { waitUntil: 'domcontentloaded' });
    await dismissConsent(page);

    const main = visibleProjectsMain(page);
    const caseStudy = main.locator('[data-project-case-study]');
    await expect(caseStudy).toHaveAttribute(
      'data-project-case-study',
      project.slug,
    );
    await expect(main.locator('h1:visible')).toHaveCount(1);
    await expect(main.locator('h1:visible')).toHaveText(project.title);
    await expect(page).toHaveTitle(new RegExp(project.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}/projects/${project.slug}`,
    );
    await expect(caseStudy.locator('.project-case-study__intro-copy')).toContainText(project.blurb);
    await expect(caseStudy.locator('.project-case-study__story')).toContainText(project.constraint);
    await expect(caseStudy).toContainText(project.roofApproach);
    await expect(caseStudy.locator('.project-case-study__fact-list dt')).not.toHaveCount(0);
    expect(
      await caseStudy.locator('.project-case-study__fact-list dd').evaluateAll(
        (elements) => elements.every((element) => Boolean(element.textContent?.trim())),
      ),
    ).toBe(true);
    await expect(caseStudy.locator(
      'details[data-project-mobile-disclosure="facts"]',
    )).not.toHaveAttribute('open', '');
    await expect(caseStudy.locator(
      'details[data-project-mobile-disclosure="brief"]',
    )).not.toHaveAttribute('open', '');
    await expect(caseStudy.locator('.project-case-study__breadcrumbs a'))
      .toHaveAttribute('href', '/projects');
    await expect(caseStudy.locator(
      '.project-case-study__intro-actions .project-action--primary',
    )).toHaveAttribute('href', buildEnquiryHref({
      enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential',
      sourcePath: `/projects/${project.slug}`,
      sourceComponent: 'project_cta',
      sourceProject: project.slug,
    }));
    await expect(caseStudy.locator(
      '.project-case-study__final-cta .project-action--primary',
    )).toHaveAttribute('href', buildEnquiryHref({
      enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential',
      sourcePath: `/projects/${project.slug}`,
      sourceComponent: 'project_cta',
      sourceProject: project.slug,
    }));

    const hero = caseStudy.locator('.project-case-study__hero img');
    await expect(hero).toBeVisible();
    await expect.poll(
      () => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
    const caseStudyHeroImage = project.caseStudyHeroImage ?? project.heroImage;
    await expect(hero).toHaveAttribute('src', new RegExp(
      caseStudyHeroImage.src.split('/').at(-1)?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') ?? '',
    ));
    await expect(hero).toHaveCSS(
      'object-position',
      !caseStudyHeroImage.objectPosition || caseStudyHeroImage.objectPosition === 'center'
        ? '50% 50%'
        : caseStudyHeroImage.objectPosition,
    );

    const schemaTypes = (
      await page.locator('script[type="application/ld+json"]').allTextContents()
    ).flatMap((schema) => {
      const parsed = JSON.parse(schema);
      return (Array.isArray(parsed) ? parsed : [parsed]).map((node) => node['@type']);
    });
    expect(schemaTypes).toEqual(expect.arrayContaining(['WebPage', 'BreadcrumbList']));
    await expectNoPageOverflow(page);
    await expectNoNestedVerticalScroll(page);
    await expectLogicalVisibleHeadingOrder(page);
    await expectNoProjectEmDashes(page);
  }

  expect(pageErrors).toEqual([]);
});

test('known data gaps are omitted instead of becoming invented or empty facts', async ({ page }) => {
  await page.goto('/projects/velskov-forest');
  let facts = visibleProjectsMain(page).locator('.project-case-study__fact-list');
  await expect(facts).not.toContainText('Completed');
  await expect(facts).not.toContainText('Structure finish');
  await expect(facts).not.toContainText('Configuration');

  await page.goto('/projects/tindalls-bay-pavilion');
  facts = visibleProjectsMain(page).locator('.project-case-study__fact-list');
  await expect(facts).toContainText('Covered area');
  await expect(facts).not.toContainText('Footprint');

  await page.goto('/projects/warkworth-outdoor-room');
  facts = visibleProjectsMain(page).locator('.project-case-study__fact-list');
  await expect(facts).toContainText('Freestanding');
});

test('long project labels and partial dimensions remain readable at the minimum width', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/projects/tindalls-bay-pavilion');
  await dismissConsent(page);
  const main = visibleProjectsMain(page);

  await expect(main.locator('h1')).toHaveText('Tindalls Bay - Patio & Carport');
  await expect(main.locator('.project-navigator__trigger-title')).toHaveText(
    'Tindalls Bay - Patio & Carport',
  );
  await expect(main.locator('.project-case-study__fact-list')).toContainText('Covered area');
  await expect(main.locator('.project-case-study__fact-list')).not.toContainText('Dimensions');
  await expectNoPageOverflow(page);
});

test('the refined project journey is shorter, persuasive, and touch safe at target widths', async ({
  page,
}) => {
  test.slow();
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });

    for (const routeCase of mobileRefinementRoutes) {
      expect(routeCase.project, `${routeCase.name} should have a governed project record`)
        .toBeDefined();
      await page.goto(routeCase.route, { waitUntil: 'domcontentloaded' });
      await dismissConsent(page);

      const main = visibleProjectsMain(page);
      const caseStudy = main.locator('.project-case-study');
      const disclosures = caseStudy.locator('details[data-project-mobile-disclosure]');
      const expectedEnquiryHref = buildEnquiryHref({
        enquiryType: routeCase.project!.type === 'Commercial'
          ? 'commercial'
          : 'residential',
        sourcePath: routeCase.route,
        sourceComponent: 'project_cta',
        sourceProject: routeCase.project!.slug,
      });
      await expect(main.locator('h1:visible')).toHaveCount(1);
      await expect(main.locator('.project-case-study__hero img')).toBeVisible();
      await expect(main.locator('.project-case-study__intro-actions .project-action--primary'))
        .toHaveAttribute('href', expectedEnquiryHref);
      await expect(main.locator('.project-case-study__final-cta .project-action--primary'))
        .toHaveAttribute('href', expectedEnquiryHref);

      const firstCta = await main.locator(
        '.project-case-study__intro-actions .project-action--primary',
      ).boundingBox();
      expect(firstCta?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(844);

      const heroHeight = (await main.locator(
        '.project-case-study__hero-media',
      ).boundingBox())?.height ?? 0;
      expect(heroHeight).toBeGreaterThanOrEqual(width * 0.7);
      expect(heroHeight).toBeLessThanOrEqual(width * 0.8);
      if (routeCase.route === '/projects') {
        await expect(main.locator('.project-case-study__breadcrumbs')).toHaveCount(0);
      } else {
        await expect(main.locator('.project-case-study__breadcrumbs a'))
          .toHaveAttribute('href', '/projects');
      }

      for (const disclosure of await disclosures.all()) {
        await expect(disclosure).not.toHaveAttribute('open', '');
        expect((await disclosure.locator('summary').boundingBox())?.height ?? 0)
          .toBeGreaterThanOrEqual(44);
      }

      if (width === 390) {
        expect((await main.boundingBox())?.height ?? Number.POSITIVE_INFINITY)
          .toBeLessThanOrEqual(routeCase.maximumHeightAt390);
      }

      await expectNoPageOverflow(page);
      await expectNoNestedVerticalScroll(page);
      await expectMinimumTouchTargets(page);
      await expectLogicalVisibleHeadingOrder(page);
      await expectNoProjectEmDashes(page);
    }
  }
});

for (const viewport of [
  { name: 'wide desktop', width: 1440, height: 1000 },
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'compact desktop', width: 1024, height: 768 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 430, height: 932 },
  { name: 'small mobile', width: 390, height: 844 },
  { name: 'minimum mobile', width: 360, height: 800 },
]) {
  test(`project composition has no page overflow at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(representativeRoute);
    await dismissConsent(page);
    const main = visibleProjectsMain(page);
    await expect(main.locator('.project-case-study')).toBeVisible();
    await expectNoPageOverflow(page);

    if (viewport.width >= 900) {
      await expect(main.locator('[data-project-gallery-layout="desktop"]')).toBeVisible();
      await expect(main.locator('[data-responsive-gallery]')).toBeHidden();
      await expect(main.locator('.project-navigator__panel')).toBeVisible();
      await expect(main.locator('.project-navigator__trigger')).toBeHidden();
      await expect(main.locator(
        'details[data-project-mobile-disclosure="facts"]',
      )).toHaveAttribute('open', '');
      await expect(main.locator('.project-case-study__fact-list')).toBeVisible();
      await expect(main.locator(
        'details[data-project-mobile-disclosure="brief"] summary',
      )).toBeHidden();
    } else {
      const gallery = main.locator('[data-responsive-gallery]');
      const expectedPosition = `1/${projectGalleryItemCount(representativeProject)}`;
      await expect(main.locator('[data-project-gallery-layout="desktop"]')).toBeHidden();
      await expect(gallery).toBeVisible();
      await expect(gallery).toHaveAttribute('data-gallery-position', expectedPosition);
      await expect(gallery).toHaveAttribute('data-gallery-swipe', 'true');
      await expect(gallery.locator('img')).toHaveCount(1);
      await expect(gallery.getByRole('status')).toHaveText(
        `Image ${expectedPosition.replace('/', ' of ')}`,
      );

      for (const control of await gallery.getByRole('button').all()) {
        const box = await control.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
      }

      const next = gallery.getByRole('button', { name: /Next image/ });
      await next.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(next).toBeFocused();
      const focusState = await next.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          outlineStyle: style.outlineStyle,
          outlineWidth: Number.parseFloat(style.outlineWidth),
        };
      });
      expect(focusState.outlineStyle).not.toBe('none');
      expect(focusState.outlineWidth).toBeGreaterThanOrEqual(2);
      await next.click();
      await expect(gallery).toHaveAttribute(
        'data-gallery-position',
        `2/${projectGalleryItemCount(representativeProject)}`,
      );
      await expect(next).toBeFocused();
      await gallery.focus();
      await page.keyboard.press('Home');
      await expect(gallery).toHaveAttribute('data-gallery-position', expectedPosition);
      await expect(main.locator('.project-navigator__trigger')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
  });
}

test('desktop navigator filters projects, remains sticky, and supports list keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(representativeRoute);
  await dismissConsent(page);
  const main = visibleProjectsMain(page);

  const navigatorPanel = main.locator('.project-navigator__panel');
  const initialTop = (await navigatorPanel.boundingBox())?.y ?? 0;
  await page.evaluate(() => document.body.scrollTo(0, 700));
  await expect.poll(async () => (await navigatorPanel.boundingBox())?.y ?? -1).toBeGreaterThan(80);
  // Allow the one-pixel font/layout settlement observed between first paint
  // and the sticky measurement; meaningful downward drift still fails.
  expect((await navigatorPanel.boundingBox())?.y ?? 0).toBeLessThanOrEqual(initialTop + 2);

  const activeProject = main.locator('.project-navigator__list a[aria-current="page"]');
  await activeProject.focus();
  await page.keyboard.press('ArrowDown');
  await expect(main.locator('.project-navigator__list a').nth(1)).toBeFocused();

  await main.locator('.project-navigator__filters select').first().selectOption('commercial');
  const visibleLabels = main.locator('.project-navigator__list small');
  expect(await visibleLabels.count()).toBeGreaterThan(0);
  for (const label of await visibleLabels.allTextContents()) {
    expect(label).toContain('Commercial');
  }
});

test('desktop index retains the case-study rail without eagerly loading mobile card media', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects', { waitUntil: 'networkidle' });
  await dismissConsent(page);
  const main = visibleProjectsMain(page);
  const navigator = main.locator('.project-navigator--collection');
  const cards = main.locator('[data-project-card]');

  await expect(navigator).toBeVisible();
  await expect(navigator).toHaveCSS('position', 'sticky');
  await expect(main.locator('.project-case-study')).toBeVisible();
  await expect(main.locator('.project-navigator__trigger')).toHaveCount(0);
  await expect(main.locator('[data-project-filter-disclosure] summary')).toBeHidden();
  await expect(main.getByLabel('Filter by audience')).toBeVisible();
  await expect(cards).toHaveCount(projects.length);
  expect((await cards.first().boundingBox())?.height ?? 0).toBeLessThanOrEqual(90);

  const cardImages = cards.locator('img');
  await expect(cardImages).toHaveCount(projects.length);
  expect(await cardImages.evaluateAll((images) => images.every((image) => {
    const cardImage = image as HTMLImageElement;
    return cardImage.loading === 'lazy'
      && cardImage.sizes === '(max-width: 899px) calc(100vw - 2.5rem), 1px'
      && cardImage.naturalWidth <= 1;
  }))).toBe(true);

  await cards.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(cards.nth(1)).toBeFocused();
  await expectNoPageOverflow(page);
});

test('mobile navigator is a focus-managed modal sheet with reversible scroll lock', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);
  // The server-rendered navigator is available before its modal enhancement.
  // Wait for the responsive role before exercising scroll-lock behavior.
  await expect(page.locator('#project-navigator-panel[role="dialog"]')).toHaveCount(1);
  await page.evaluate(() => document.body.scrollTo(0, 360));
  const readingPosition = await page.evaluate(() => document.body.scrollTop);
  const main = visibleProjectsMain(page);

  const trigger = main.locator('.project-navigator__trigger');
  await trigger.click();
  const dialog = page.getByRole('dialog').last();

  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.project-navigator__close')).toBeFocused();
  await expect(page.locator('html')).toHaveClass(/projects-navigator-open/);
  await expect(page.locator('body')).toHaveClass(/projects-navigator-open/);
  await expect.poll(async () => (await dialog.boundingBox())?.y ?? 900).toBeLessThan(200);
  const undersizedControls = await dialog.locator(
    'a:visible, button:visible, select:visible',
  ).evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return {
      height: Math.round(rect.height),
      label: element.getAttribute('aria-label') ?? element.textContent?.trim(),
      width: Math.round(rect.width),
    };
  }).filter(({ height, width }) => height < 44 || width < 44));
  expect(undersizedControls).toEqual([]);

  await page.keyboard.press('Shift+Tab');
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');

  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('html')).not.toHaveClass(/projects-navigator-open/);
  await expect(page.locator('body')).not.toHaveClass(/projects-navigator-open/);
  expect(await page.evaluate(() => document.body.scrollTop)).toBe(readingPosition);
});

test('technical detail, contextual links, related work, and circular project navigation remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);
  const main = visibleProjectsMain(page);

  const technical = main.locator(
    '.project-case-study__technical details[data-project-mobile-disclosure="technical"]',
  );
  await expect(technical).not.toHaveAttribute('open', '');
  await technical.locator('summary').click();
  await expect(technical).toHaveAttribute('open', '');
  await expect(technical.locator('.project-case-study__technical-grid')).toBeVisible();

  await expect(main.locator('.project-case-study__related-list a')).not.toHaveCount(0);
  await expect(main.locator('.project-case-study__pagination a')).toHaveCount(2);
  await expect(main.locator('.project-case-study__intro-actions a')).not.toHaveCount(0);

  const relatedProject = main.locator('.project-case-study__related-list a').first();
  const relatedProjectHref = await relatedProject.getAttribute('href');
  await relatedProject.click();
  await expect(page).toHaveURL(new RegExp(`${relatedProjectHref}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${representativeRoute}$`));

  const previousProject = main.locator('.project-case-study__pagination a[rel="prev"]');
  const previousProjectHref = await previousProject.getAttribute('href');
  await previousProject.click();
  await expect(page).toHaveURL(new RegExp(`${previousProjectHref}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${representativeRoute}$`));

  const gallery = main.locator('[data-responsive-gallery]');
  await gallery.getByRole('button', { name: /Next image/ }).click();
  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `2/${projectGalleryItemCount(representativeProject)}`,
  );
  await expect(main.locator(
    '.project-case-study__intro-actions .project-action--primary',
  )).toHaveAttribute('href', buildEnquiryHref({
    enquiryType: representativeProject.type === 'Commercial'
      ? 'commercial'
      : 'residential',
    sourcePath: representativeRoute,
    sourceComponent: 'project_cta',
    sourceProject: representativeProject.slug,
  }));

  const nextProject = main.locator('.project-case-study__pagination a[rel="next"]');
  const nextProjectHref = await nextProject.getAttribute('href');
  await nextProject.click();
  await expect(page).toHaveURL(new RegExp(`${nextProjectHref}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${representativeRoute}$`));
  await expect(visibleProjectsMain(page).locator('[data-responsive-gallery]')).toBeVisible();

  await main.locator('.project-case-study__breadcrumbs a').click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(visibleProjectCards(page)).toHaveCount(projects.length);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${representativeRoute}$`));
  await expect(visibleProjectsMain(page).locator('[data-responsive-gallery]')).toBeVisible();

  await page.reload();
  await expect(visibleProjectsMain(page).locator('[data-responsive-gallery]')).toHaveAttribute(
    'data-gallery-position',
    `1/${projectGalleryItemCount(representativeProject)}`,
  );
});

test('project disclosures are native, keyboard operable, and expanded on desktop', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const main = visibleProjectsMain(page);
  const facts = main.locator('details[data-project-mobile-disclosure="facts"]');
  const factsSummary = facts.locator('summary');
  await expect(facts).not.toHaveAttribute('open', '');
  await factsSummary.focus();
  await expect(factsSummary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(facts).toHaveAttribute('open', '');
  await expect(facts.getByText('Structure & finish', { exact: true })).toBeVisible();

  const brief = main.locator('details[data-project-mobile-disclosure="brief"]');
  await brief.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(brief).toHaveAttribute('open', '');
  await expect(brief.getByText('The brief', { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const disclosure of await main.locator(
    'details[data-project-mobile-disclosure]',
  ).all()) {
    await expect(disclosure).toHaveAttribute('open', '');
  }
  await expect(factsSummary).toBeHidden();
  await expect(main.getByText('Outdoor room details', { exact: true })).toBeVisible();
});

test('collapsed project content remains present and expanded in server HTML', async ({ request }) => {
  const response = await request.get(representativeRoute);
  expect(response.ok()).toBe(true);
  const html = await response.text();

  expect(html).toMatch(
    /<details[^>]*data-project-mobile-disclosure="facts"[^>]*open=""/,
  );
  expect(html).toMatch(
    /<details[^>]*data-project-mobile-disclosure="brief"[^>]*open=""/,
  );
  expect(html).toMatch(
    /<details[^>]*data-project-mobile-disclosure="technical"[^>]*open=""/,
  );
  expect(html).toContain('Structure &amp; finish');
  expect(html).toContain('The brief');
  expect(html).toContain('Outdoor room details');
});

test('mobile gallery responds to a touch drag without moving the page sideways', async ({ browser }, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const gallery = visibleProjectsMain(page).locator('[data-responsive-gallery]');
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `1/${projectGalleryItemCount(representativeProject)}`,
  );
  const box = await gallery.boundingBox();
  expect(box).not.toBeNull();

  const startX = (box?.x ?? 0) + Math.min((box?.width ?? 390) - 24, 340);
  const endX = startX - 220;
  const y = Math.max(150, Math.min(780, (box?.y ?? 150) + 240));
  const session = await context.newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: endX, y }],
  });
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });

  await expect(gallery).toHaveAttribute(
    'data-gallery-position',
    `2/${projectGalleryItemCount(representativeProject)}`,
  );
  await expectNoPageOverflow(page);
  await context.close();
});

test('reduced-motion preference removes material project transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  await visibleProjectsMain(page).locator('.project-navigator__trigger').click();
  const duration = await page.getByRole('dialog').last().evaluate(
    (element) => getComputedStyle(element).transitionDuration,
  );
  const seconds = duration
    .split(',')
    .map((value) => value.trim())
    .map((value) => value.endsWith('ms')
      ? Number.parseFloat(value) / 1000
      : Number.parseFloat(value));
  expect(Math.max(...seconds)).toBeLessThanOrEqual(0.001);
});
