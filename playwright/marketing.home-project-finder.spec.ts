import { expect, test, type Browser, type Page } from '@playwright/test';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';

async function setAnalyticsConsent(page: Page, analytics: boolean) {
  await page.addInitScript((analyticsConsent) => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: analyticsConsent,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
    window.dataLayer = [];
  }, analytics);
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function waitForCinematicWelcome(page: Page) {
  await expect(page.locator('[data-homepage-welcome]')).toBeHidden({
    timeout: 3_000,
  });
}

async function projectFinderOpeningGeometry(page: Page) {
  return page.locator('[data-project-finder-opening]').evaluate((opening) => {
    const openingRect = opening.getBoundingClientRect();
    const viewportTop = window.visualViewport?.offsetTop ?? 0;
    const viewportBottom = viewportTop
      + (window.visualViewport?.height ?? window.innerHeight);
    const headerBottom = Math.max(
      viewportTop,
      document.querySelector<HTMLElement>('header.site')
        ?.getBoundingClientRect().bottom ?? viewportTop,
    );
    const availableTop = headerBottom + 8;
    const availableBottom = viewportBottom - 8;
    const availableHeight = Math.max(0, availableBottom - availableTop);
    return {
      availableBottom,
      availableHeight,
      availableTop,
      bottom: openingRect.bottom,
      fits: openingRect.height <= availableHeight + 1,
      top: openingRect.top,
    };
  });
}

async function expectProjectFinderOpeningAligned(page: Page) {
  await expect.poll(async () => {
    const geometry = await projectFinderOpeningGeometry(page);
    if (geometry.fits) {
      return geometry.top >= geometry.availableTop - 2
        && geometry.bottom <= geometry.availableBottom + 2;
    }
    return Math.abs(geometry.top - geometry.availableTop) <= 2;
  }).toBe(true);
}

async function projectFinderEvents(page: Page) {
  return page.evaluate(() => (
    (window.dataLayer ?? []).filter((entry): entry is Record<string, unknown> => (
      typeof entry === 'object'
      && entry !== null
      && !Array.isArray(entry)
      && typeof entry.event === 'string'
      && (
        entry.event.startsWith('project_finder_')
        || entry.event.startsWith('project_direction_')
        || entry.event.startsWith('project_result_')
        || entry.event.startsWith('project_pathway_')
        || entry.event.startsWith('project_view_')
        || entry.event.startsWith('professional_path_')
        || entry.event.startsWith('brief_')
      )
    ))
  ));
}

async function selectDirection(page: Page, direction: string) {
  await page.locator(`[data-project-direction="${direction}"]`).click();
  if (direction === 'commercial-professional') {
    await expect(page.locator('[data-professional-path-chooser]')).toBeVisible();
    return;
  }
  await expect(page.locator('[data-project-finder-result]'))
    .toHaveAttribute('data-project-finder-result', direction);
}

async function selectProfessionalPath(page: Page, path: string) {
  await page.locator(`[data-professional-path="${path}"]`).click();
  await expect(page.locator('[data-project-finder-result]'))
    .toHaveAttribute(
      'data-project-finder-result',
      `commercial-professional:${path}`,
    );
}

test('project finder is the indexable live homepage and the prototype URL redirects', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  const response = await page.goto('/');

  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag'] ?? '').not.toMatch(/noindex/i);
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    'content',
    /noindex/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    publicOrigin,
  );
  await waitForCinematicWelcome(page);
  const heroJourney = page.locator('[data-homepage-hero-journey]');
  const header = page.locator('header.site');
  await expect(heroJourney).toHaveAttribute('data-hero-stage', 'image');
  await expect(header).toHaveAttribute('data-hero-navigation', 'overlay');
  await expect(header.locator('.nav-cta')).toHaveCount(0);
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeHidden();
  await expect(page.getByText('Fixed-roof pergola design and build in Auckland'))
    .toBeHidden();
  const revealArrow = page.getByRole('button', {
    name: 'Reveal the Sanctuary introduction',
  });
  await expect(page.locator('[data-homepage-hero-symbol="chevron"]'))
    .toHaveCount(2);
  await expect(revealArrow).toBeVisible();
  const chevronGeometry = await revealArrow.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const styles = getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      borderStyle: styles.borderStyle,
      height: rect.height,
      width: rect.width,
    };
  });
  expect(chevronGeometry.width).toBeGreaterThanOrEqual(56);
  expect(chevronGeometry.height).toBeGreaterThanOrEqual(64);
  expect(chevronGeometry.borderStyle).toBe('none');
  expect(chevronGeometry.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  await revealArrow.click();
  await expect(heroJourney).toHaveAttribute('data-hero-stage', 'story');
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeVisible();
  await expect(page.getByText('Fixed-roof pergola design and build in Auckland'))
    .toBeVisible();
  await expect(page.getByRole('link', {
    name: 'Warkworth Outdoor Room, Warkworth',
  })).toBeVisible();
  const continueArrow = page.getByRole('button', {
    name: 'Continue to choose your project starting point',
  });
  await expect(continueArrow).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Why Sanctuary' })
    .getByRole('link', { name: /61 Google reviews/ })).toBeVisible();
  await expect(header).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('footer').getByRole('link', {
    name: 'Start your project',
  })).toHaveAttribute(
    'href',
    '/contact?enquiry_type=residential&source_path=%2F&source_component=footer&source_experience=project-finder-home-v1#contact-form',
  );
  await expect(page.locator('[data-project-direction]')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: /Simple cover/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Custom design/ })).toBeVisible();
  await expect(page.getByRole('radio', { name: /Commercial \/ Professional/ }))
    .toBeVisible();
  await expect(page.locator('[data-professional-path-chooser]')).toHaveCount(0);
  await expect(page.locator('[data-project-direction] img')).toHaveCount(3);
  await expect(page.locator('[data-project-direction] img').first())
    .toHaveAttribute('loading', 'lazy');
  await expect(page.getByRole('img', {
    name: 'Interior outdoor room with cedar ceiling, pendant lighting and lounge seating',
  }).first()).toHaveAttribute('fetchpriority', 'high');
  await expect(page.locator('[data-homepage-hero] img'))
    .toHaveAttribute('loading', 'eager');
  await expect(page.locator('main img[loading="eager"]')).toHaveCount(1);
  await expect(page.locator('main').getByRole('link', { name: 'Start your project' }))
    .toBeHidden();
  await expect(page.locator('h1')).toHaveCount(1);
  const openingGeometry = await page.evaluate(() => {
    const hero = document.querySelector<HTMLElement>('main section');
    const proof = document.querySelector<HTMLElement>('[aria-label="Why Sanctuary"]');
    return {
      heroHeight: hero?.getBoundingClientRect().height ?? 0,
      proofTop: proof?.getBoundingClientRect().top ?? 0,
      viewportHeight: window.innerHeight,
    };
  });
  expect(openingGeometry.proofTop).toBeGreaterThanOrEqual(
    openingGeometry.viewportHeight - 1,
  );
  expect(openingGeometry.heroHeight).toBeGreaterThan(700);
  await expectNoHorizontalOverflow(page);

  await page.evaluate(() => window.scrollTo(0, 240));
  await expect(header).toHaveAttribute(
    'data-hero-navigation',
    'overlay',
  );
  await continueArrow.click();
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'Which starting point best describes your project?',
  })).toBeInViewport();
  await expect(header).toHaveAttribute('data-hero-navigation', 'solid');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await expect(header).toHaveAttribute('data-hero-navigation', 'overlay');

  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText(
    `${publicOrigin}/home-project-finder`,
  );

  const redirect = await page.request.get('/home-project-finder', {
    maxRedirects: 0,
  });
  expect(redirect.status()).toBe(308);
  expect(new URL(redirect.headers()['location']).pathname).toBe('/');
  expect(redirect.headers()['x-robots-tag']).toMatch(/noindex.*nofollow/i);

  await page.goto('/home-project-finder?project=cover');
  await expect(page).toHaveURL(/\/\?project=cover$/);
  await expect(page.locator('[data-project-finder-result="cover"]')).toBeVisible();
});

test('the welcome screen is immediate, bounded and reduced-motion safe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setAnalyticsConsent(page, false);
  await page.route('**/_next/image?*', async (route) => route.abort());
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const welcome = page.locator('[data-homepage-welcome]');
  await expect(welcome).toBeVisible();
  await expect(welcome.locator('span')).toHaveText('Welcome to');
  await expect(welcome.locator('strong')).toHaveText('Sanctuary Pergolas');
  await expect(welcome.locator('a, button, header, nav')).toHaveCount(0);
  await expect(welcome).toHaveCSS('background-color', 'rgb(23, 24, 23)');
  await expect(welcome).toHaveCSS('transition-duration', '0s');
  await expect(page.locator('header.site')).toBeHidden();
  await expect(welcome).toBeHidden({ timeout: 2_500 });
  await expect(page.locator('header.site')).toBeVisible();
  await expect(page.locator('[data-homepage-hero]')).toBeInViewport();
});

test('mobile art direction and two deliberate scroll gestures lead into text-only choices', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setAnalyticsConsent(page, false);
  await page.goto('/');
  await waitForCinematicWelcome(page);

  const heroJourney = page.locator('[data-homepage-hero-journey]');
  const heroImage = page.locator('[data-homepage-hero] img');
  await expect.poll(() => heroImage.evaluate((image) => (
    (image as HTMLImageElement).currentSrc
  ))).toContain('warkworth-gable-02.jpg');
  await expect.poll(() => heroImage.evaluate((image) => (
    (image as HTMLImageElement).naturalWidth
  ))).toBeGreaterThan(0);
  await expect(heroJourney).toHaveAttribute('data-hero-stage', 'image');

  await page.mouse.wheel(0, 600);
  await expect(heroJourney).toHaveAttribute('data-hero-stage', 'story');
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeVisible();

  await page.waitForTimeout(220);
  await page.mouse.wheel(0, 600);
  const finderHeading = page.getByRole('heading', {
    level: 2,
    name: 'Which starting point best describes your project?',
  });
  await expect(finderHeading).toBeInViewport();
  await expectProjectFinderOpeningAligned(page);

  const primaryDirections = page.locator('[data-project-direction]');
  await expect(primaryDirections).toHaveCount(3);
  await expect(primaryDirections.locator('img')).toHaveCount(3);
  expect(await primaryDirections.locator('img').evaluateAll((images) => (
    images.every((image) => image.getClientRects().length === 0)
  ))).toBe(true);
  const simpleCoverTitle = page.getByRole('radio', { name: /Simple cover/ })
    .locator('strong');
  const optionTitleSize = await simpleCoverTitle.evaluate((element) => (
    Number.parseFloat(getComputedStyle(element).fontSize)
  ));
  expect(optionTitleSize).toBeGreaterThanOrEqual(36);

  await page.getByRole('radio', { name: /Commercial \/ Professional/ }).click();
  await expect(page.locator('[data-professional-path]').first().locator('img'))
    .toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('the finder landing contains the complete opening whenever the viewport can hold it', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setAnalyticsConsent(page, false);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await waitForCinematicWelcome(page);
    await page.getByRole('button', {
      name: 'Reveal the Sanctuary introduction',
    }).click();
    await page.getByRole('button', {
      name: 'Continue to choose your project starting point',
    }).click();
    await expectProjectFinderOpeningAligned(page);
    expect((await projectFinderOpeningGeometry(page)).fits).toBe(true);
    await expectNoHorizontalOverflow(page);
  }
});

test('the production finder stays within its repeatable interaction and layout budget', async ({
  page,
}) => {
  const enforceProductionLcp = (
    process.env.MARKETING_HOMEPAGE_PRODUCTION_PERF === '1'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const metrics = {
      cls: 0,
      lcp: 0,
      firstResultResponseMs: null as number | null,
    };
    (window as typeof window & {
      __projectFinderPerformance?: typeof metrics;
    }).__projectFinderPerformance = metrics;

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput) metrics.cls += shift.value ?? 0;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const latest = list.getEntries().at(-1);
        if (latest) metrics.lcp = latest.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // The assertions below expose a browser without the required observers.
    }
  });
  await setAnalyticsConsent(page, false);
  await page.goto('/');
  const main = page.locator(
    'main[data-project-finder-home-variant="project_finder_home_v2"]',
  );
  const heroImage = main.locator('[data-homepage-hero] img');
  await expect(heroImage).toHaveJSProperty('complete', true);
  await expect(heroImage).toHaveAttribute('fetchpriority', 'high');
  await page.waitForTimeout(500);

  const firstDirection = main.locator('[data-project-direction="cover"]');
  await firstDirection.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const metrics = (
      window as typeof window & {
        __projectFinderPerformance?: {
          cls: number;
          lcp: number;
          firstResultResponseMs: number | null;
        };
      }
    ).__projectFinderPerformance;
    const control = document.querySelector<HTMLButtonElement>(
      '[role="radio"][data-project-direction="cover"]',
    );
    const finder = document.querySelector(
      '[data-project-finder-interactive]',
    );
    if (!metrics || !control || !finder) return;

    const observer = new MutationObserver(() => {
      if (!finder.querySelector('[data-project-finder-result="cover"]')) return;
      metrics.firstResultResponseMs = performance.now() - startedAt;
      observer.disconnect();
    });
    let startedAt = 0;
    observer.observe(finder, { childList: true, subtree: true });
    control.addEventListener('click', () => {
      startedAt = performance.now();
    }, { capture: true, once: true });
  });
  await firstDirection.click();
  await expect(main.locator('[data-project-finder-result="cover"]')).toBeVisible();

  const metrics = await page.evaluate(() => (
    (window as typeof window & {
      __projectFinderPerformance?: {
        cls: number;
        lcp: number;
        firstResultResponseMs: number | null;
      };
    }).__projectFinderPerformance
  ));
  expect(metrics?.lcp ?? 0).toBeGreaterThan(0);
  if (enforceProductionLcp) {
    expect(metrics?.lcp ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2_500);
  }
  expect(metrics?.cls ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(0.1);
  expect(
    metrics?.firstResultResponseMs ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(500);
});

test('the two residential directions give one useful pathway and two governed references', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  const paths = [
    ['cover', 'Acrylic roof pergolas', '/acrylic-roof-pergolas-auckland', ['Dairy Flat Estate', 'St Heliers Townhouse']],
    ['bespoke', 'Custom pergola design', '/custom-pergolas-auckland', ['Tindalls Bay - Patio & Carport', 'Warkworth Outdoor Room']],
  ] as const;

  for (const [direction, heading, pathway, projectNames] of paths) {
    await page.goto('/');
    await selectDirection(page, direction);
    await expect(page.getByRole('heading', { level: 2, name: heading, exact: true }))
      .toBeVisible();
    await expect(page.locator('[data-project-finder-result] a').first())
      .toHaveAttribute('href', `${pathway}?project=${direction}`);
    for (const projectName of projectNames) {
      await expect(page.getByRole('heading', { level: 3, name: projectName }))
        .toBeVisible();
    }
    await expect(page.locator('[data-selected-project]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'View all projects' }))
      .toHaveAttribute('href', '/projects');
    await expect(page.getByRole('link', { name: 'Use as a reference' }))
      .toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Start your project now' }))
      .toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  }
});

test('commercial and professional choices reveal tailored results and evidence', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  const paths = [
    ['venue', 'Extend your venue with confidence', '/commercial-pergolas-auckland', ['The Good Home Takanini', 'Lilliput Mini Golf']],
    ['builder-contractor', 'A defined pergola package for your build', '/architects-designers-builders', ['Lilliput Mini Golf', 'KiwiRail Head Office']],
    ['architects-designers', 'Pergola collaboration for architects and designers', '/architects-designers-builders', ['KiwiRail Head Office', 'The Good Home Takanini']],
  ] as const;

  for (const [path, heading, destination, projectNames] of paths) {
    await page.goto('/');
    await selectDirection(page, 'commercial-professional');
    await expect(page.locator('[data-professional-path]')).toHaveCount(3);
    await selectProfessionalPath(page, path);
    await expect(page.getByRole('heading', { level: 2, name: heading, exact: true }))
      .toBeVisible();
    await expect(page.locator('[data-project-finder-result] a').first())
      .toHaveAttribute(
        'href',
        `${destination}?project=commercial-professional&professional_path=${path}`,
      );
    for (const projectName of projectNames) {
      await expect(page.getByRole('heading', { level: 3, name: projectName }))
        .toBeVisible();
    }
    await expect(page.locator('[data-selected-project]')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Refine what matters' }))
      .toHaveCount(0);
    await expect(page.locator('footer').getByRole('link', {
      name: 'Start your project',
    })).toHaveAttribute(
      'href',
      new RegExp(
        `enquiry_type=${path === 'venue' ? 'commercial' : 'professional'}`
        + '.*project_direction=commercial-professional'
        + `.*project_professional_path=${path}`,
      ),
    );
    await expectNoHorizontalOverflow(page);
  }
});

test('brief builder enforces three priorities and defers the controlled brief enquiry until after proof', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/');
  await selectDirection(page, 'bespoke');
  await page.getByRole('button', { name: 'Refine what matters' }).click();

  const priorities = page.locator('[data-project-priority]');
  await expect(priorities).toHaveCount(6);
  await priorities.nth(0).check();
  await priorities.nth(1).check();
  await priorities.nth(2).check();
  await expect(page.getByText('3 of 3 selected')).toBeVisible();
  await priorities.nth(3).click();
  await expect(page.getByText(
    'Choose up to three priorities. Remove one before adding another.',
  )).toBeVisible();
  await expect(priorities.nth(3)).not.toBeChecked();
  await expect(page).toHaveURL(
    /project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination$/,
  );
  await expect(page.getByRole('heading', {
    level: 3,
    name: /A custom pergola design developed to keep the structure visually open, coordinate cleanly with the wider project, and preserve natural light\./,
  })).toBeVisible();

  await expect(page.getByRole('link', { name: 'Send this brief to Sanctuary' }))
    .toHaveCount(0);
  await page.getByRole('link', { name: 'Send your brief' }).click();
  await expect(page).toHaveURL(/\/contact\?.*project_direction=bespoke/);
  await expect(page.locator('.contact-form__context')).toContainText(
    'Starting brief: Custom design',
  );
  await expect(page.locator('.contact-form__context')).toContainText(
    'Keep the structure open',
  );
  const context = JSON.parse(await page.locator(
    '#contact-form input[name="enquiryContext"]',
  ).inputValue());
  expect(context).toMatchObject({
    enquiry_type: 'residential',
    source_path: '/',
    source_component: 'project_finder',
    source_experience: 'project-finder-home-v1',
    project_direction: 'bespoke',
    project_priorities: ['daylight', 'open-structure', 'coordination'],
  });
});

test('the recommended service page retains the selected brief through enquiry', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination');
  await page.getByRole('link', { name: 'Explore custom pergolas' }).click();

  await expect(page).toHaveURL(
    /\/custom-pergolas-auckland\?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination$/,
  );
  const journeyContext = page.locator('[data-project-finder-journey-context]');
  await expect(journeyContext).toBeVisible();
  await expect(journeyContext.getByRole('heading', { level: 2 })).toHaveText(
    'A custom pergola design developed to keep the structure visually open, coordinate cleanly with the wider project, and preserve natural light.',
  );
  await expect(journeyContext.getByRole('link', { name: 'Refine your brief' }))
    .toHaveAttribute(
      'href',
      '/?project=bespoke&priorities=daylight%2Copen-structure%2Ccoordination',
    );
  await expect(journeyContext.getByRole('link', { name: 'Continue to enquiry' }))
    .toHaveCount(0);

  const formContext = JSON.parse(await page.locator(
    '#project-details input[name="enquiryContext"]',
  ).inputValue());
  expect(formContext).toMatchObject({
    enquiry_type: 'residential',
    source_path: '/custom-pergolas-auckland',
    source_component: 'embedded_form',
    source_experience: 'project-finder-home-v1',
    project_direction: 'bespoke',
    project_priorities: ['daylight', 'open-structure', 'coordination'],
  });
  await expect(page.locator('header.site .nav-cta')).toHaveAttribute(
    'href',
    /project_direction=bespoke.*project_priorities=daylight%2Copen-structure%2Ccoordination/,
  );
});

test('viewing a project keeps the finder brief and viewed project through a later enquiry', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto(
    '/?project=bespoke&priorities=daylight%2Ccoordination',
  );

  const projectCard = page.locator(
    '[data-project-evidence="warkworth-outdoor-room"]',
  );
  const viewProject = projectCard.getByRole('link', { name: 'View project' });
  await expect(viewProject).toHaveAttribute(
    'href',
    '/projects/warkworth-outdoor-room?project=bespoke&priorities=daylight%2Ccoordination&reference=warkworth-outdoor-room',
  );
  await viewProject.click();

  await expect(page).toHaveURL(
    /\/projects\/warkworth-outdoor-room\?project=bespoke&priorities=daylight%2Ccoordination&reference=warkworth-outdoor-room$/,
  );
  await expect(page.locator('.project-case-study__intro-actions')).toHaveCount(0);
  const finalEnquiry = page.locator('.project-case-study__final-cta')
    .getByRole('link', { name: 'Send project brief' });
  await expect(finalEnquiry).toHaveAttribute(
    'href',
    /source_project=warkworth-outdoor-room.*source_experience=project-finder-home-v1.*project_direction=bespoke.*project_priorities=daylight%2Ccoordination/,
  );
  await expect(page.locator('header.site .nav-cta')).toHaveAttribute(
    'href',
    /source_project=warkworth-outdoor-room.*source_experience=project-finder-home-v1.*project_direction=bespoke.*project_priorities=daylight%2Ccoordination/,
  );
  const relatedProject = page.locator('.project-case-study__related-list a');
  const relatedCount = await relatedProject.count();
  expect(relatedCount).toBeGreaterThan(0);
  await expect(relatedProject.first()).toHaveAttribute(
    'href',
    /\?project=bespoke&priorities=daylight%2Ccoordination&reference=/,
  );

  await finalEnquiry.click();
  const context = JSON.parse(await page.locator(
    '#contact-form input[name="enquiryContext"]',
  ).inputValue());
  expect(context).toMatchObject({
    source_project: 'warkworth-outdoor-room',
    source_experience: 'project-finder-home-v1',
    project_direction: 'bespoke',
    project_priorities: ['daylight', 'coordination'],
  });
});

test('URL state is canonical, refreshable and restored by browser history', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/?project=invalid&priorities=daylight&free_text=secret');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('secret')).toHaveCount(0);

  await page.goto('/?project=cover&project=bespoke');
  await expect(page).toHaveURL(/\/$/);

  await selectDirection(page, 'cover');
  await selectDirection(page, 'bespoke');
  await expect(page).toHaveURL(/project=bespoke$/);
  await page.goBack();
  await expect(page).toHaveURL(/project=cover$/);
  await expect(page.locator('button[data-project-direction="cover"]'))
    .toHaveAttribute('aria-checked', 'true');
  await page.goForward();
  await expect(page.locator('button[data-project-direction="bespoke"]'))
    .toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.locator('[data-project-finder-result="bespoke"]')).toBeVisible();

  await selectDirection(page, 'commercial-professional');
  await selectProfessionalPath(page, 'venue');
  await expect(page).toHaveURL(
    /project=commercial-professional&professional_path=venue$/,
  );
  await page.goBack();
  await expect(page.locator('[data-professional-path-chooser]')).toBeVisible();
  await expect(page.locator('[data-project-finder-result]')).toHaveCount(0);
  await page.goForward();
  await expect(page.locator('button[data-professional-path="venue"]'))
    .toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.locator(
    '[data-project-finder-result="commercial-professional:venue"]',
  )).toBeVisible();

  await page.goto(
    '/?project=commercial-professional&professional_path=invalid&priorities=daylight',
  );
  await expect(page).toHaveURL(/\?project=commercial-professional$/);
  await expect(page.locator('[data-professional-path-chooser]')).toBeVisible();
});

test('keyboard selection uses roving radio behavior and predictable focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/');
  const cover = page.locator('[data-project-direction="cover"]');
  await cover.focus();
  await cover.press('ArrowDown');
  await expect(page).toHaveURL(/project=bespoke$/);
  await expect(page.locator('button[data-project-direction="bespoke"]'))
    .toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'Custom pergola design',
    exact: true,
  }).first()).toBeFocused();

  const bespoke = page.locator('button[data-project-direction="bespoke"]');
  await bespoke.focus();
  await bespoke.press('ArrowDown');
  await expect(page).toHaveURL(/project=commercial-professional$/);
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'Which pathway fits best?',
    exact: true,
  })).toBeFocused();
  const venue = page.locator('button[data-professional-path="venue"]');
  await venue.focus();
  await venue.press('ArrowDown');
  await expect(page).toHaveURL(
    /project=commercial-professional&professional_path=builder-contractor$/,
  );
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'A defined pergola package for your build',
    exact: true,
  })).toBeFocused();

  const ids = await page.locator('[id]').evaluateAll((elements) => (
    elements.map((element) => element.id)
  ));
  expect(new Set(ids).size).toBe(ids.length);

  const targets = await page.locator(
    '[data-project-finder-interactive] a, [data-project-finder-interactive] button, [data-project-finder-interactive] input',
  ).evaluateAll((elements) => elements
    .filter((element) => {
      const style = window.getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, height: rect.height, tag: element.tagName };
    }));
  for (const target of targets.filter(({ tag }) => tag !== 'INPUT')) {
    expect(target.height).toBeGreaterThanOrEqual(43.5);
  }
});

test('mobile menu remains operable without losing finder URL state', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/?project=cover');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-menu')).toHaveAttribute(
    'data-mobile-menu-state',
    'open',
  );
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page).toHaveURL(/\?project=cover$/);
  await expect(page.locator('#mobile-menu')).toHaveAttribute(
    'data-mobile-menu-state',
    'closed',
  );
});

test('analytics use consent-aware closed project finder values', async ({ page }) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/');
  await selectDirection(page, 'cover');
  await page.getByRole('button', { name: 'Refine what matters' }).click();
  await page.locator('[data-project-priority]').first().check();
  expect(await projectFinderEvents(page)).toEqual([]);

  const consented = await page.context().browser()?.newPage();
  if (!consented) throw new Error('Browser page unavailable');
  await setAnalyticsConsent(consented, true);
  await consented.goto('/');
  await selectDirection(consented, 'bespoke');
  await consented.getByRole('button', { name: 'Refine what matters' }).click();
  await consented.locator('[data-project-priority]').first().check();
  await expect.poll(async () => (
    await projectFinderEvents(consented)
  ).filter((event) => event.event === 'project_result_view').length).toBe(1);

  await consented.evaluate(() => {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element
        ? event.target.closest(
            '[data-project-finder-event], [data-homepage-event]',
          )
        : null;
      if (target) event.preventDefault();
    }, true);
  });
  const firstProject = consented.locator('[data-project-evidence]').first();
  await firstProject.getByRole('link', { name: 'View project' }).click();
  await selectDirection(consented, 'commercial-professional');
  await selectProfessionalPath(consented, 'venue');
  await consented.getByRole('link', { name: 'Explore commercial pergolas' }).click();
  await consented.locator('header.site .nav-cta').click();
  const events = await projectFinderEvents(consented);
  expect(events.map((event) => event.event)).toEqual(expect.arrayContaining([
    'project_finder_home_view',
    'project_direction_select',
    'project_result_view',
    'brief_builder_open',
    'brief_priority_select',
    'brief_summary_view',
    'project_view_click',
    'professional_path_select',
    'project_pathway_click',
    'project_finder_direct_enquiry_click',
  ]));
  expect(events.filter((event) => event.event === 'project_result_view')).toHaveLength(2);
  for (const event of events) {
    expect(JSON.stringify(event)).not.toMatch(/@|email|phone|free_text|address/i);
    expect(event).toMatchObject({
      homepage_variant: 'project_finder_home_v2',
      source_path: '/',
    });
  }
  expect(events.find((event) => (
    event.event === 'project_finder_direct_enquiry_click'
    && event.source_component === 'header'
  ))).toMatchObject({
    enquiry_type: 'commercial',
    source_path: '/',
    project_direction: 'commercial-professional',
    professional_path: 'venue',
  });
  await consented.close();
});

test('no-JavaScript visitors receive direct project and enquiry pathways', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeVisible();
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'Choose the path that best fits your project.',
  })).toBeVisible();
  await expect(page.locator('header.site')).toBeVisible();
  await expect(page.locator('[data-project-finder-interactive]')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Simple cover' }))
    .toHaveAttribute('href', '/acrylic-roof-pergolas-auckland');
  await expect(page.getByRole('link', { name: 'Custom design' }))
    .toHaveAttribute('href', '/custom-pergolas-auckland');
  await expect(page.getByRole('link', { name: 'Extending a Venue' }))
    .toHaveAttribute('href', '/commercial-pergolas-auckland');
  await expect(page.getByRole('link', { name: 'Builder or Contractor' }))
    .toHaveAttribute('href', '/architects-designers-builders');
  await expect(page.getByRole('link', { name: 'Architects and Designers' }))
    .toHaveAttribute('href', '/architects-designers-builders');
  await context.close();
});

test('direction cards stay compact on mobile and avoid narrow tablet columns', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');

  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 900 });
    const cards = await page.locator('[data-project-direction]').evaluateAll((elements) => (
      elements.map((element) => {
        const card = element.getBoundingClientRect();
        const image = element.querySelector('img')?.getBoundingClientRect();
        return { cardHeight: card.height, imageWidth: image?.width ?? 0 };
      })
    ));
    for (const card of cards) {
      expect(card.cardHeight).toBeLessThan(230);
      expect(card.imageWidth).toBeLessThanOrEqual(116);
    }
    if (width === 320) {
      const proofTop = await page.locator('[aria-label="Why Sanctuary"]')
        .evaluate((element) => element.getBoundingClientRect().top);
      expect(proofTop).toBeGreaterThanOrEqual(899);
    }
    await expectNoHorizontalOverflow(page);
  }

  for (const width of [768, 900]) {
    await page.setViewportSize({ width, height: 1024 });
    const cards = await page.locator('[data-project-direction]').evaluateAll((elements) => (
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    ));
    for (const card of cards) {
      expect(card.width).toBeGreaterThan(width * .75);
      expect(card.height).toBeLessThan(320);
    }
    await expectNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await selectDirection(page, 'commercial-professional');
  const professionalCards = await page.locator('[data-professional-path]')
    .evaluateAll((elements) => elements.map((element) => {
      const card = element.getBoundingClientRect();
      const image = element.querySelector('img')?.getBoundingClientRect();
      return { cardHeight: card.height, imageWidth: image?.width ?? 0 };
    }));
  expect(professionalCards).toHaveLength(3);
  for (const card of professionalCards) {
    expect(card.cardHeight).toBeLessThan(230);
    expect(card.imageWidth).toBeLessThanOrEqual(116);
  }
  await expectNoHorizontalOverflow(page);
});

test('the full selected journey stays usable and overflow-free across the QA matrix', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await setAnalyticsConsent(page, false);
  const viewports = [
    { width: 320, height: 568 },
    { width: 320, height: 700 },
    { width: 360, height: 400 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 414, height: 896 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 900, height: 1180 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];
  await page.setViewportSize(viewports[0]);
  await page.goto('/');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expectNoHorizontalOverflow(page);
    await selectDirection(page, 'bespoke');
    await page.getByRole('button', { name: 'Refine what matters' }).click();
    const priorities = page.locator('[data-project-priority]');
    await priorities.nth(0).check();
    await priorities.nth(1).check();
    await priorities.nth(2).check();
    await expect(page.getByRole('heading', { level: 3, name: /A custom pergola design/ }))
      .toBeVisible();
    await expect(page.locator('[data-project-evidence]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Send your brief' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(page).toHaveURL(/\/$/);

    await selectDirection(page, 'commercial-professional');
    await selectProfessionalPath(page, 'architects-designers');
    await expect(page.getByRole('heading', {
      level: 2,
      name: 'Pergola collaboration for architects and designers',
      exact: true,
    })).toBeVisible();
    await expect(page.locator('[data-project-evidence]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Send your brief' }))
      .toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Start again' }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});
