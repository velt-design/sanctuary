import { expect, test, type Page } from '@playwright/test';
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

function projectGalleryItemCount(project: Project) { return project.gallery.length; }

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
  await expect(page.locator('h1:visible')).toHaveText('Built projects around NZ');
  await expect(page.locator('[data-project-case-study]')).toHaveCount(0);
  await expect(visibleProjectCards(page)).toHaveCount(projects.length);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicOrigin}/projects`,
  );
  await expect(page.locator('[data-project-collection-cta]')).toBeVisible();

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
    await expect(main.locator('h1:visible')).toHaveText('Built projects around NZ');
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
    const collectionCta = main.locator('[data-project-collection-cta]');
    await expect(collectionCta).toBeVisible();
    await expect(collectionCta.getByRole('heading', { level: 2 }))
      .toHaveText('Have a project in mind?');
    await expect(collectionCta.getByRole('link', { name: 'Start your project' }))
      .toHaveAttribute('href', buildEnquiryHref({
        sourcePath: '/projects',
        sourceComponent: 'final_cta',
      }));
    await expect(main.locator('.project-navigator__result-count'))
      .toHaveCSS('color', 'rgb(95, 99, 92)');

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
    const lastCard = await cards.last().boundingBox();
    const collectionCtaBox = await collectionCta.boundingBox();
    expect(lastCard).not.toBeNull();
    expect(collectionCtaBox).not.toBeNull();
    expect(collectionCtaBox!.y).toBeGreaterThan(lastCard!.y + lastCard!.height);

    const firstMedia = main.locator(
      '[data-project-card] [data-responsive-media] > div',
    ).first();
    const mediaBox = await firstMedia.boundingBox();
    expect(mediaBox?.height ?? 0).toBeCloseTo((mediaBox?.width ?? 0) * 1.25, 0);
    if (width >= 1200) expect(mediaBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(430);
    const firstImage = firstMedia.locator('img');
    await expect(firstImage).not.toHaveAttribute('loading', 'lazy');
    await expect(cards.nth(1).locator('img')).toHaveAttribute('loading', 'lazy');
    await expect(firstImage).toHaveAttribute(
      'sizes',
      '(max-width: 899px) calc(100vw - 2.5rem), (max-width: 1199px) calc((100vw - 6rem) / 2), min(30vw, 32rem)',
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
    .toHaveText('4 of 14 projects');

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
    .toHaveText('0 of 14 projects');
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

test('Atelier Shu retains its governed front-on canopy case-study image', async ({ page }) => {
  const imagePath = 'project-atelier-shu-02.jpg';

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/projects/atelier-shu-cafe');
  const hero = visibleProjectsMain(page).locator('.project-case-study__hero');
  expect((await hero.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(600);
  await expect(hero.locator('img')).toHaveAttribute('src', new RegExp(imagePath));
  await expect(hero.locator('img')).toHaveAttribute(
    'alt',
    'Front-on view of the dark-tint acrylic gable canopy over outdoor seating at Atelier Shu Cafe in Newmarket',
  );
  await expect(hero.locator('img')).toHaveCSS('object-position', '50% 18%');
  const gallery = visibleProjectsMain(page).locator('#project-gallery [data-responsive-gallery]');
  const source = projects.find(item=>item.slug==='atelier-shu-cafe')!;
  const seen:string[]=[];
  for(let i=0;i<source.gallery.length;i++){
    seen.push(await gallery.locator('[data-gallery-frame-active] img').getAttribute('src') ?? '');
    await gallery.getByRole('button',{name:/Next image/}).click();
  }
  expect(seen.some(src=>src.includes('project-atelier-shu-05.jpg'))).toBe(true);
  expect(seen.some(src=>src.includes('project-atelier-shu-04.jpg'))).toBe(true);

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
  const gallery=main.locator('#project-gallery [data-responsive-gallery]');
  const source=projects.find(item=>item.slug==='tindalls-bay-pavilion')!;
  for(let i=0;i<source.gallery.length;i++){
   await expect(gallery.locator('[data-gallery-frame-active] img')).toHaveAttribute('alt',source.gallery[i].alt);
   await gallery.getByRole('button',{name:/Next image/}).click();
  }

});

test('Atelier imagery stays selective and claim-aligned across guide surfaces', async ({ page }) => {
  await page.goto('/projects/atelier-shu-cafe');
  await expect(visibleMain(page).locator(
    'img[src*="project-atelier-shu-02.jpg"]',
  )).toHaveCount(1);

  for (const route of [
    '/commercial-pergolas-auckland',
    '/acrylic-roof-pergolas-auckland',
    '/acrylic-pergolas-vs-louvre-roofs',
    '/',
    '/gable-pergolas-auckland',
  ]) {
    await page.goto(route);
    await expect(visibleMain(page).locator(
      'img[src*="project-atelier-shu-02.jpg"]',
    )).toHaveCount(0);
  }

  await page.goto('/acrylic-roof-pergolas-auckland');
  const main = visibleMain(page);
  await expect(main.locator('a[href="/projects/atelier-shu-cafe"] img')).toHaveAttribute(
    'src',
    /project-atelier-shu-05\.jpg/,
  );
  await expect(main.locator('img[src*="project-atelier-shu-05.jpg"]')).toHaveCount(1);

  await page.goto('/acrylic-pergolas-vs-louvre-roofs');
  await expect(
    visibleMain(page).locator('img[src*="project-atelier-shu-05.jpg"]'),
  ).toHaveCount(0);
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
    await expect(caseStudy.locator('.project-case-study__intro')).toContainText(project.blurb);
    await expect(caseStudy.locator('#project-story')).toContainText(project.constraint);
    await expect(caseStudy).toContainText(project.roofApproach);
    await expect(caseStudy.locator('.project-case-study__fact-list dt')).not.toHaveCount(0);
    expect(
      await caseStudy.locator('.project-case-study__fact-list dd').evaluateAll(
        (elements) => elements.every((element) => Boolean(element.textContent?.trim())),
      ),
    ).toBe(true);
    await expect(caseStudy.getByRole('heading', { name: 'How it comes together.' })).toBeVisible();
    await expect(caseStudy.getByRole('link', { name: /Send project brief/ })).toHaveAttribute('href', buildEnquiryHref({
      enquiryType: project.type === 'Commercial' ? 'commercial' : 'residential',
      sourcePath: '/projects/'+project.slug, sourceComponent: 'project_cta', sourceProject: project.slug,
    }));

    const hero = caseStudy.locator('.project-case-study__hero img');
    await expect(hero).toBeVisible();
    await expect.poll(
      () => hero.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
    const caseStudyHeroImage = project.slug === 'warkworth-outdoor-room' ? project.gallery[0] : project.caseStudyHeroImage ?? project.heroImage;
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
  await expect(main.locator('[data-all-projects]')).toBeVisible();
  await expect(main.locator('.project-case-study__fact-list')).toContainText('Covered area');
  await expect(main.locator('.project-case-study__fact-list')).not.toContainText('Dimensions');
  await expectNoPageOverflow(page);
});

test('the editorial project journey retains visible facts and touch-safe actions', async ({ page }) => {
  test.slow(); await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320,390,430]) {
    await page.setViewportSize({width,height:844});
    for (const item of mobileRefinementRoutes) {
      await page.goto(item.route); await dismissConsent(page);
      const main = visibleProjectsMain(page);
      await expect(main.locator('h1:visible')).toHaveCount(1);
      await expect(main.locator('.project-case-study__hero img')).toBeVisible();
      await expect(main.locator('.project-case-study__fact-list')).toBeVisible();
      await expect(main.getByRole('link',{name:/Send project brief/})).toHaveAttribute('href',buildEnquiryHref({enquiryType:item.project!.type === 'Commercial'?'commercial':'residential',sourcePath:item.route,sourceComponent:'project_cta',sourceProject:item.project!.slug}));
      await expectNoPageOverflow(page); await expectNoNestedVerticalScroll(page); await expectMinimumTouchTargets(page); await expectLogicalVisibleHeadingOrder(page);
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

    const gallery=main.locator('#project-gallery [data-responsive-gallery]');
    await expect(gallery).toHaveAttribute('data-gallery-position','1/'+projectGalleryItemCount(representativeProject));
    await expect(gallery.locator('[data-gallery-frame-active] img')).toHaveAttribute('alt',representativeProject.gallery[0].alt);
    await expect(gallery.getByRole('button')).toHaveCount(2);
    for (const control of await gallery.getByRole('button').all()) expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await expect(main.locator('[data-project-next]')).toBeVisible();
  });
}

test('project gallery supports keyboard, pointer and every governed image',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(representativeRoute);await dismissConsent(page);
 const gallery=visibleProjectsMain(page).locator('#project-gallery [data-responsive-gallery]');
 await gallery.focus();await page.keyboard.press('End');await expect(gallery).toHaveAttribute('data-gallery-position',projectGalleryItemCount(representativeProject)+'/'+projectGalleryItemCount(representativeProject));
 await page.keyboard.press('Home');await expect(gallery).toHaveAttribute('data-gallery-position','1/'+projectGalleryItemCount(representativeProject));
 for(let index=0;index<representativeProject.gallery.length;index++){
  await expect(gallery.locator('[data-gallery-frame-active] img')).toHaveAttribute('alt',representativeProject.gallery[index].alt);
  await gallery.getByRole('button',{name:/Next image/}).click();
 }
 await expect(gallery).toHaveAttribute('data-gallery-position','1/'+projectGalleryItemCount(representativeProject));
 await expectNoPageOverflow(page);
});

test('collection filters and supports list keyboard navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/projects');
  await dismissConsent(page);
  const main = visibleProjectsMain(page);



  const activeProject = main.locator('[data-project-card]').first();
  await activeProject.focus();
  await page.keyboard.press('ArrowDown');
  await expect(main.locator('.project-navigator__list a').nth(1)).toBeFocused();

  await main.locator('.project-navigator__filters select').first().selectOption('commercial');
  await expect(main.locator('[data-project-card]')).toHaveCount(projects.filter(project => project.type === 'Commercial').length);
  const visibleLabels = main.locator('[data-project-card]');
  expect(await visibleLabels.count()).toBeGreaterThan(0);
  for (const label of await visibleLabels.allTextContents()) {
    expect(label.toLowerCase()).toContain('commercial');
  }
});

test('project index becomes a capped responsive editorial grid with substantial imagery', async ({
  page,
}) => {
  test.slow();

  for (const { width, columns } of [
    { width: 768, columns: 1 },
    { width: 900, columns: 2 },
    { width: 1024, columns: 2 },
    { width: 1199, columns: 2 },
    { width: 1200, columns: 3 },
    { width: 1440, columns: 3 },
    { width: 1920, columns: 3 },
  ]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/projects', { waitUntil: 'domcontentloaded' });
    await dismissConsent(page);
    const main = visibleProjectsMain(page);
    const navigator = main.locator('.project-navigator--collection');
    const cards = visibleProjectCards(page);
    const collectionCta = main.locator('[data-project-collection-cta]');

    await expect(navigator).toBeVisible();
    await expect(navigator).toHaveCSS('position', 'static');
    const collectionTitle = main.locator('h1:visible');
    await expect(collectionTitle).toHaveText('Built projects around NZ');
    await expect(collectionTitle.locator('[data-projects-title-muted]')).toHaveCount(2);
    await expect(collectionTitle.locator('.projects-experience__collection-title-emphasis'))
      .toHaveText('projects');
    await expect(collectionTitle.locator('[data-projects-title-muted]').first())
      .toHaveCSS('color', 'rgb(151, 154, 148)');
    await expect(collectionTitle.locator('.projects-experience__collection-title-emphasis'))
      .toHaveCSS('color', 'rgb(17, 18, 16)');
    await expect(main.locator('.project-case-study')).toHaveCount(0);
    await expect(main.locator('.project-navigator__trigger')).toHaveCount(0);
    await expect(cards).toHaveCount(projects.length);
    await expect(collectionCta).toBeVisible();

    const geometry = await cards.evaluateAll((elements) => elements
      .slice(0, 4)
      .map((element) => {
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, width: bounds.width };
      }));
    expect(geometry).toHaveLength(4);
    const sameRow = (left: number, right: number) => Math.abs(left - right) <= 2;
    if (columns === 1) {
      expect(sameRow(geometry[0]!.y, geometry[1]!.y)).toBe(false);
    } else if (columns === 2) {
      expect(sameRow(geometry[0]!.y, geometry[1]!.y)).toBe(true);
      expect(sameRow(geometry[0]!.y, geometry[2]!.y)).toBe(false);
    } else {
      expect(sameRow(geometry[0]!.y, geometry[1]!.y)).toBe(true);
      expect(sameRow(geometry[0]!.y, geometry[2]!.y)).toBe(true);
      expect(sameRow(geometry[0]!.y, geometry[3]!.y)).toBe(false);
    }
    if (width >= 900) expect(geometry[0]!.width).toBeGreaterThan(320);

    const firstMedia = cards.first().locator('[data-responsive-media] > div');
    const mediaBox = await firstMedia.boundingBox();
    expect(mediaBox?.height ?? 0).toBeCloseTo((mediaBox?.width ?? 0) * 1.25, 0);
    const firstImage = firstMedia.locator('img');
    await expect(firstImage).not.toHaveAttribute('loading', 'lazy');
    if (width >= 900) {
      await expect(cards.nth(1).locator('img')).not.toHaveAttribute('loading', 'lazy');
      await expect(cards.nth(2).locator('img')).toHaveAttribute('loading', 'lazy');
    } else {
      await expect(cards.nth(1).locator('img')).toHaveAttribute('loading', 'lazy');
    }
    await expect(firstImage).toHaveAttribute(
      'sizes',
      '(max-width: 899px) calc(100vw - 2.5rem), (max-width: 1199px) calc((100vw - 6rem) / 2), min(30vw, 32rem)',
    );

    if (width >= 900) {
      await expect(main.locator('[data-project-filter-disclosure] summary')).toBeHidden();
      await expect(main.getByLabel('Filter by audience')).toBeVisible();
      await expect(main.getByLabel('Filter by roof form')).toBeVisible();
    }

    const lastCard = await cards.last().boundingBox();
    const collectionCtaBox = await collectionCta.boundingBox();
    expect(lastCard).not.toBeNull();
    expect(collectionCtaBox).not.toBeNull();
    expect(collectionCtaBox!.y).toBeGreaterThan(lastCard!.y + lastCard!.height);

    await cards.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(cards.nth(1)).toBeFocused();
    await expectNoPageOverflow(page);
    await expectNoNestedVerticalScroll(page);
  }
});

test('project collection remains complete and useful without JavaScript', async ({
  browser,
}, testInfo) => {
  const baseURL = String(testInfo.project.use.baseURL);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(`${baseURL}/projects?audience=residential&form=gable`, {
    waitUntil: 'domcontentloaded',
  });
  const main = visibleProjectsMain(page);
  const residentialGables = projects.filter((project) => (
    project.type === 'Residential' && project.roof === 'Gable'
  ));

  await expect(main.locator('h1')).toHaveText('Built projects around NZ');
  await expect(visibleProjectCards(page)).toHaveCount(residentialGables.length);
  await expect(main.locator('[data-project-case-study]')).toHaveCount(0);
  await expect(main.getByLabel('Filter by audience')).toHaveValue('residential');
  await expect(main.getByLabel('Filter by roof form')).toHaveValue('gable');
  await expect(visibleProjectCards(page).first()).toHaveAttribute(
    'href',
    `/projects/${residentialGables[0]!.slug}`,
  );
  await expect(visibleProjectCards(page).first().locator('img')).toBeVisible();
  await expect(main.locator('[data-project-collection-cta]')).toBeVisible();
  await expect(main.locator('[data-project-card-size-control]')).toHaveCount(0);

  const noScriptCards = await visibleProjectCards(page).evaluateAll((elements) => elements
    .slice(0, 4)
    .map((element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y };
    }));
  expect(noScriptCards[0]!.y).toBeCloseTo(noScriptCards[1]!.y, 0);
  expect(noScriptCards[0]!.y).toBeCloseTo(noScriptCards[2]!.y, 0);
  expect(noScriptCards[0]!.y).not.toBeCloseTo(noScriptCards[3]!.y, 0);
  await context.close();
});

test('desktop view scale snaps, caps density, and restores local preference', async ({
  page,
}) => {
  test.slow();

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await dismissConsent(page);
  const main = visibleProjectsMain(page);
  const slider = main.getByLabel('View scale');
  const cards = visibleProjectCards(page);
  const firstCard = cards.first();
  const firstTitle = firstCard.locator('[data-editorial-card-title]');
  const firstEyebrow = firstCard.locator('[data-editorial-card-eyebrow]');
  const firstCopy = firstCard.locator('[data-editorial-card-copy]');
  const firstCondensedMeta = firstCard.locator('[data-editorial-card-condensed-meta]');
  const firstAction = firstCard.locator('[data-editorial-card-action]');

  await expect(slider).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(slider).toBeVisible();
  await expect(slider).toHaveValue('1');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Editorial, 3 columns');
  await expect(main.locator('[data-project-index-bar]')).toBeVisible();
  await expect(main.locator('.project-navigator__result-count')).toHaveText('14 projects');
  await expect(main.locator('.project-card-size__heading output')).toHaveText('Editorial / 03');
  await expect(main.locator('.project-card-size__stop')).toHaveText(['02', '03', '04', '05']);
  expect((await main.locator('.project-card-size__control').boundingBox())?.height ?? 0)
    .toBeGreaterThanOrEqual(44);
  await expect(firstCard).toHaveAccessibleName(
    `${projects[0].title}. ${projects[0].location}. ${projects[0].type}. Gable. View project`,
  );
  await expect(firstEyebrow).toBeVisible();
  await expect(firstCopy).toBeVisible();
  await expect(firstCondensedMeta).toBeHidden();
  await expect(firstAction).toContainText('View project');

  const expectColumns = async (columns: number) => {
    const geometry = await cards.evaluateAll((elements, columnCount) => elements
      .slice(0, columnCount + 1)
      .map((element) => element.getBoundingClientRect().y), columns);
    geometry.slice(1, columns).forEach((y) => {
      expect(y).toBeCloseTo(geometry[0]!, 0);
    });
    expect(geometry[columns]).not.toBeCloseTo(geometry[0]!, 0);
  };

  await slider.focus();
  await expect(slider).toBeFocused();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('3');
  await page.keyboard.press('Home');
  await expect(slider).toHaveValue('0');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Showcase, 2 columns');
  await expect(main.locator('.project-card-size__heading output')).toHaveText('Showcase / 02');
  await expectColumns(2);
  await expect(firstEyebrow).toBeVisible();
  await expect(firstCopy).toBeVisible();
  await expect(firstCondensedMeta).toBeHidden();
  await expect(firstAction).toContainText('View project');

  await slider.fill('2');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Compact, up to 4 columns');
  await expect(main.locator('.project-card-size__heading output')).toHaveText('Compact / 04');
  await expectColumns(4);
  await expect(firstEyebrow).toBeHidden();
  await expect(firstCopy).toBeHidden();
  await expect(firstCondensedMeta).toBeVisible();
  await expect(firstCondensedMeta).toHaveText(
    `${projects[0].region} · ${projects[0].type} · Gable`,
  );
  await expect(firstCondensedMeta).toHaveCSS('white-space', 'nowrap');
  await expect(firstTitle).toHaveCSS('-webkit-line-clamp', '2');
  await expect(firstAction).toHaveCSS('font-size', '0px');

  await slider.fill('3');
  await expect(slider).toHaveAttribute('aria-valuetext', 'Overview, up to 5 columns');
  await expect(main.locator('.project-card-size__heading output')).toHaveText('Overview / 05');
  await expectColumns(4);
  await expect(firstTitle).toBeVisible();
  await expect(firstTitle).toHaveCSS('-webkit-line-clamp', '2');
  await expect(firstEyebrow).toBeHidden();
  await expect(firstCopy).toBeHidden();
  await expect(firstCondensedMeta).toBeHidden();
  await expect(firstAction).toHaveCSS('font-size', '0px');
  await expect(firstTitle).toHaveCSS('font-size', '17.2px');
  await expect(firstCard.locator('[data-editorial-card-content]')).toHaveCSS('height', '64px');
  const overviewArrowStyle = await firstAction.evaluate((element) => {
    const style = window.getComputedStyle(element, '::after');
    return { fontSize: style.fontSize, transform: style.transform };
  });
  expect(overviewArrowStyle.fontSize).toBe('12px');
  expect(overviewArrowStyle.transform).not.toBe('none');
  const overviewContentHeights = await cards.locator('[data-editorial-card-content]')
    .evaluateAll((elements) => elements.slice(0, 5).map((element) => (
      element.getBoundingClientRect().height
    )));
  expect(Math.max(...overviewContentHeights) - Math.min(...overviewContentHeights))
    .toBeLessThanOrEqual(1);
  await expect(cards.first().locator('img')).toHaveAttribute(
    'sizes',
    '(max-width: 899px) calc(100vw - 2.5rem), (max-width: 1199px) calc((100vw - 6rem) / 2), (max-width: 1359px) min(30vw, 32rem), (max-width: 1599px) min(23vw, 24rem), min(18vw, 19rem)',
  );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(main.getByLabel('View scale')).toHaveValue('3');
  await expectColumns(4);

  await page.setViewportSize({ width: 1600, height: 900 });
  await expectColumns(5);
  await expectNoPageOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(main.getByLabel('View scale')).toBeHidden();
  await expectColumns(1);
  await expect(firstEyebrow).toBeVisible();
  await expect(firstCopy).toBeVisible();
  await expect(firstCondensedMeta).toBeHidden();
  await expect(firstAction).not.toHaveCSS('font-size', '0px');
});

test('mobile details use visible native navigation without a modal or scroll lock',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(representativeRoute);await dismissConsent(page);
 await expect(page.locator('[data-all-projects]')).toBeVisible();await expect(page.locator('[data-project-next]')).toBeVisible();
 await expect(page.locator('[role="dialog"]')).toHaveCount(0);await expect(page.locator('body')).not.toHaveClass(/projects-navigator-open/);
 await page.locator('[data-all-projects]').press('Enter');await expect(page).toHaveURL(/\/projects$/);
});

test('technical detail and one related-project path remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);
  const main = visibleProjectsMain(page);

  const technical = main.locator('#project-details details').first();
  await expect(technical).not.toHaveAttribute('open', '');
  await technical.locator('summary').click();
  await expect(technical).toHaveAttribute('open', '');
  await expect(technical.locator('p').first()).toBeVisible();

  await expect(main.locator('[data-related-projects] a')).not.toHaveCount(0);
  await expect(main.locator('.project-case-study__pagination')).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Send project brief/ })).toBeVisible();

  const relatedProject = main.locator('[data-related-projects] a').first();
  const relatedProjectHref = await relatedProject.getAttribute('href');
  await relatedProject.click();
  await expect(page).toHaveURL(new RegExp(`${relatedProjectHref}$`));
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${representativeRoute}$`));

  const gallery = main.locator('#project-gallery [data-responsive-gallery]');
  await gallery.getByRole('button',{name:/Next image/}).click();
  await expect(gallery).toHaveAttribute('data-gallery-position','2/'+projectGalleryItemCount(representativeProject));
  await expect(main.getByRole('link', { name: /Send project brief/ })).toHaveAttribute('href', buildEnquiryHref({
    enquiryType: representativeProject.type === 'Commercial'
      ? 'commercial'
      : 'residential',
    sourcePath: representativeRoute,
    sourceComponent: 'project_cta',
    sourceProject: representativeProject.slug,
  }));

  await page.getByRole('button', { name: 'Open menu', exact: true }).click();
  await page.locator('#mobile-menu').getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(visibleProjectCards(page)).toHaveCount(projects.length);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`${representativeRoute}$`));
  await expect(visibleProjectsMain(page).locator(
    '#project-gallery [data-responsive-gallery]',
  )).toBeVisible();

  await page.reload();
  const refreshedGallery = visibleProjectsMain(page).locator(
    '#project-gallery [data-responsive-gallery]',
  );
  await expect(refreshedGallery).toBeVisible();
  await expect(refreshedGallery).toHaveAttribute('data-gallery-position','1/'+projectGalleryItemCount(representativeProject));
});

test('project technical disclosures are keyboard operable and preserve state',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(representativeRoute);await dismissConsent(page);
 const detail=visibleProjectsMain(page).locator('#project-details details').first();
 await detail.locator('summary').focus();await page.keyboard.press('Enter');await expect(detail).toHaveAttribute('open','');
 await expect(detail.locator('p').first()).toBeVisible();
 await page.setViewportSize({width:1440,height:1000});await expect(detail).toHaveAttribute('open','');await expect(detail.locator('summary')).toBeVisible();
});
test('project facts and technical content remain server rendered',async({request})=>{
 const response=await request.get(representativeRoute);expect(response.ok()).toBe(true);const html=await response.text();
 expect(html).toContain('Structure &amp; finish');expect(html).toContain('Outdoor room details');expect(html).toContain('The brief');
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

  const gallery = visibleProjectsMain(page).locator(
    '#project-gallery [data-responsive-gallery]',
  );
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveAttribute('data-gallery-position','1/'+projectGalleryItemCount(representativeProject));
  const viewport=gallery.locator(':scope > div').first();
  await expect(viewport).toHaveAttribute('data-gallery-adjacent-ready','true');
  const drag=async(type:string,x:number,y:number)=>viewport.dispatchEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,isPrimary:true,pointerId:41,pointerType:'touch'});
  await drag('pointerdown',340,200);await drag('pointermove',310,202);await expect(viewport).toHaveAttribute('data-gallery-gesture','dragging-horizontal');await drag('pointerup',160,205);
  await expect(gallery).toHaveAttribute('data-gallery-position','2/'+projectGalleryItemCount(representativeProject));
  await expectNoPageOverflow(page);
  await context.close();
});

test('reduced-motion preference removes material project transitions', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(representativeRoute);
  await dismissConsent(page);

  const shell = visibleProjectsMain(page).locator('#project-gallery');
  const gallery = shell.locator('[data-responsive-gallery]');
  expect(await gallery.locator('[data-gallery-frame-active]').evaluate(el=>Math.max(...getComputedStyle(el).transitionDuration.split(',').map(Number.parseFloat)))).toBeLessThanOrEqual(.001);
  const next = shell.getByRole('button', {
    name: `Next image in ${representativeProject.title} project gallery`,
  });
  await next.focus();
  await page.keyboard.press('Enter');
  await expect(shell.locator('[aria-live="polite"]')).toContainText('Image 2 of');
});
