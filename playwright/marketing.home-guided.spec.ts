import { expect, test, type Page } from '@playwright/test';

const publicOrigin = 'https://www.sanctuarypergolas.co.nz';

async function allowAnalytics(page: Page) {
  await setAnalyticsConsent(page, true);
}

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

async function choose(page: Page, answer: string) {
  await page.locator(`[data-guided-answer="${answer}"]`).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function guidedEvents(page: Page) {
  return page.evaluate(() => (
    (window.dataLayer ?? []).filter((entry): entry is Record<string, unknown> => (
      typeof entry === 'object'
      && entry !== null
      && !Array.isArray(entry)
      && typeof entry.event === 'string'
      && entry.event.startsWith('guided_home_')
    ))
  ));
}

const destinationContinuations = [
  {
    route: '/pergolas-auckland?focus=shade',
    canonical: '/pergolas-auckland',
    resultId: 'residential-cover',
    focusId: 'shade',
    heading: 'Add shelter and useful shade.',
    returnHref: '/home-guided?audience=home&goal=straightforward-cover&focus=shade',
    firstProject: 'St Heliers Townhouse',
    enquiryType: 'residential',
  },
  {
    route: '/outdoor-rooms-auckland?use=poolside',
    canonical: '/outdoor-rooms-auckland',
    resultId: 'outdoor-room',
    focusId: 'poolside',
    heading: 'Connect shelter with the poolside setting.',
    returnHref: '/home-guided?audience=home&goal=outdoor-room&use=poolside',
    firstProject: 'Riverhead Gable Pavilion',
    enquiryType: 'residential',
  },
  {
    route: '/custom-pergolas-auckland?constraint=structure',
    canonical: '/custom-pergolas-auckland',
    resultId: 'bespoke',
    focusId: 'structure',
    heading: 'Let structure follow the difficult condition.',
    returnHref: '/home-guided?audience=home&goal=difficult-site&constraint=structure',
    firstProject: 'Ardmore Box Carport',
    enquiryType: 'residential',
  },
  {
    route: '/commercial-pergolas-auckland?sector=workplace&role=collaborate',
    canonical: '/commercial-pergolas-auckland',
    resultId: 'commercial',
    focusId: 'collaborate',
    heading: 'A defined role within the project team.',
    returnHref: '/home-guided?audience=business&sector=workplace&role=collaborate',
    firstProject: 'KiwiRail Head Office',
    enquiryType: 'commercial',
  },
  {
    route: '/architects-designers-builders?stage=delivery&need=delivery-coordination',
    canonical: '/architects-designers-builders',
    resultId: 'professional',
    focusId: 'delivery-coordination',
    heading: 'Coordinate the package through delivery.',
    returnHref: '/home-guided?audience=professional&stage=delivery&need=delivery-coordination',
    firstProject: 'Lilliput Mini Golf',
    enquiryType: 'professional',
  },
] as const;

test('guided homepage baseline is protected and retains the shared marketing shell', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await allowAnalytics(page);
  const response = await page.goto('/home-guided');

  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex.*nofollow/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    publicOrigin,
  );
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'What are you planning?',
  })).toBeVisible();
  await expect(page.locator('header.site')).toBeVisible();
  await expect(page.locator('header.site .nav-cta')).toHaveCount(0);
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('#guided-question-audience')).toBeVisible();
  await expect(page.locator('[data-guided-question="audience"]'))
    .toBeVisible();
  await expect(page.locator('[data-homepage-variant]')).toHaveCount(0);

  const guidedViews = await page.evaluate(() => (
    (window.dataLayer ?? []).filter((entry) => (
      typeof entry === 'object'
      && entry !== null
      && 'event' in entry
      && entry.event === 'design_conversation_view'
    )).length
  ));
  expect(guidedViews).toBe(0);
});

test('guided homepage stays out of the sitemap and the live homepage remains canonical', async ({
  page,
}) => {
  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText(
    `${publicOrigin}/home-guided`,
  );

  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    'content',
    /noindex/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    publicOrigin,
  );
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeVisible();
});

test('every homeowner branch reaches the specified result and destination', async ({
  page,
}) => {
  const paths = [
    ['straightforward-cover', 'daylight', 'residential-cover', '/pergolas-auckland?focus=daylight'],
    ['straightforward-cover', 'shade', 'residential-cover', '/pergolas-auckland?focus=shade'],
    ['straightforward-cover', 'balanced', 'residential-cover', '/pergolas-auckland?focus=balanced'],
    ['outdoor-room', 'everyday', 'outdoor-room', '/outdoor-rooms-auckland?use=everyday'],
    ['outdoor-room', 'entertaining', 'outdoor-room', '/outdoor-rooms-auckland?use=entertaining'],
    ['outdoor-room', 'poolside', 'outdoor-room', '/outdoor-rooms-auckland?use=poolside'],
    ['difficult-site', 'connection', 'bespoke', '/custom-pergolas-auckland?constraint=connection'],
    ['difficult-site', 'structure', 'bespoke', '/custom-pergolas-auckland?constraint=structure'],
    ['difficult-site', 'coordination', 'bespoke', '/custom-pergolas-auckland?constraint=coordination'],
  ] as const;

  await setAnalyticsConsent(page, false);
  for (const [goal, finalAnswer, resultId, destination] of paths) {
    await page.goto('/home-guided');
    await choose(page, 'home');
    await choose(page, goal);
    await choose(page, finalAnswer);
    await expect(page.locator(`[data-guided-result="${resultId}"]`))
      .toBeVisible();
    await expect(page.locator(`[data-guided-result="${resultId}"] a`))
      .toHaveAttribute('href', destination);
  }
});

test('every commercial sector and delivery role reaches the commercial result', async ({
  page,
}) => {
  const sectors = ['hospitality', 'workplace', 'recreation'] as const;
  const roles = ['lead', 'collaborate', 'feasibility'] as const;
  await setAnalyticsConsent(page, false);

  for (const sector of sectors) {
    for (const role of roles) {
      await page.goto('/home-guided');
      await choose(page, 'business');
      await choose(page, sector);
      await choose(page, role);
      const result = page.locator('[data-guided-result="commercial"]');
      await expect(result).toBeVisible();
      await expect(result.locator('a')).toHaveAttribute(
        'href',
        `/commercial-pergolas-auckland?sector=${sector}&role=${role}`,
      );
    }
  }
});

test('every professional stage and need reaches professional collaboration', async ({
  page,
}) => {
  const stages = ['concept', 'developed', 'delivery'] as const;
  const needs = ['design-input', 'scope', 'delivery-coordination'] as const;
  await setAnalyticsConsent(page, false);

  for (const stage of stages) {
    for (const need of needs) {
      await page.goto('/home-guided');
      await choose(page, 'professional');
      await choose(page, stage);
      await choose(page, need);
      const result = page.locator('[data-guided-result="professional"]');
      await expect(result).toBeVisible();
      await expect(result.locator('a')).toHaveAttribute(
        'href',
        `/architects-designers-builders?stage=${stage}&need=${need}`,
      );
    }
  }
});

test('browser Back, Forward and refresh restore validated conversation state', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await choose(page, 'home');
  await choose(page, 'outdoor-room');
  await choose(page, 'entertaining');
  await expect(page.locator('[data-guided-result="outdoor-room"]')).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(
    /home-guided\?audience=home&goal=outdoor-room$/,
  );
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'How do you want to use the space?',
  })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/home-guided\?audience=home$/);
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'What are you trying to create?',
  })).toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(
    /home-guided\?audience=home&goal=outdoor-room$/,
  );
  await choose(page, 'poolside');
  await page.reload();
  await expect(page).toHaveURL(
    /home-guided\?audience=home&goal=outdoor-room&use=poolside$/,
  );
  await expect(page.locator('[data-guided-result="outdoor-room"]')).toBeVisible();
});

test('changing Question 1 clears downstream answers and returns focus safely', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto(
    '/home-guided?audience=business&sector=hospitality&role=lead',
  );
  await expect(page.locator('[data-guided-result="commercial"]')).toBeVisible();

  await page.getByRole('button', {
    name: 'Change answer to question 1: Who are you planning for?',
  }).click();
  await expect(page).toHaveURL(/\/home-guided$/);
  const heading = page.getByRole('heading', {
    level: 1,
    name: 'What are you planning?',
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.locator('[data-guided-result]')).toHaveCount(0);
});

test('invalid and incompatible query values are removed without exposing free text', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto(
    '/home-guided?audience=home&goal=outdoor-room&focus=shade&use=invalid&free_text=secret',
  );
  await expect(page).toHaveURL(
    /home-guided\?audience=home&goal=outdoor-room$/,
  );
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'How do you want to use the space?',
  })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('secret');
});

test('the primary result link reaches the existing dedicated landing route', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await choose(page, 'home');
  await choose(page, 'straightforward-cover');
  await choose(page, 'daylight');
  await page.getByRole('link', { name: 'Explore residential pergolas' }).click();
  await expect(page).toHaveURL(/\/pergolas-auckland\?focus=daylight$/);
  await expect(page.locator('h1')).toHaveCount(1);
});

test('all five destinations continue valid context, evidence order and enquiry attribution', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);

  for (const continuation of destinationContinuations) {
    await page.goto(continuation.route, { waitUntil: 'domcontentloaded' });
    const context = page.locator(
      'section.acrylic-hero + [data-guided-journey-context]',
    );
    await expect(context).toBeVisible();
    await expect(context).toHaveAttribute(
      'data-guided-result',
      continuation.resultId,
    );
    await expect(context).toHaveAttribute(
      'data-guided-focus',
      continuation.focusId,
    );
    await expect(context.getByRole('heading', {
      level: 2,
      name: continuation.heading,
    })).toBeVisible();
    await expect(context.getByRole('link', { name: 'Change answers' }))
      .toHaveAttribute('href', continuation.returnHref);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `${publicOrigin}${continuation.canonical}`,
    );
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.acrylic-project-grid h3').first())
      .toHaveText(continuation.firstProject);
    await expectNoHorizontalOverflow(page);

    const enquiryContext = JSON.parse(await page.locator(
      'input[name="enquiryContext"]',
    ).inputValue()) as Record<string, string>;
    expect(enquiryContext).toMatchObject({
      enquiry_type: continuation.enquiryType,
      source_path: continuation.canonical,
      source_component: 'embedded_form',
      source_experience: 'guided-home-v1',
      source_pathway: continuation.resultId,
      source_focus: continuation.focusId,
    });
  }
});

test('direct and invalid destination visits stay canonical and omit guided context', async ({
  page,
}) => {
  const invalidRoutes = [
    '/pergolas-auckland?focus=person%40example.test',
    '/outdoor-rooms-auckland?use=unknown',
    '/custom-pergolas-auckland?constraint=connection&constraint=structure',
    '/commercial-pergolas-auckland?sector=hospitality',
    '/architects-designers-builders?stage=concept&need=unknown',
  ];

  for (const route of invalidRoutes) {
    await page.goto(route);
    await expect(page.locator('[data-guided-journey-context]')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.locator('.acrylic-project-grid').filter({
      visible: true,
    }).count()).toBeGreaterThan(0);
    await expect(page.locator('body')).not.toContainText('person@example.test');
  }
});

test('destination refresh and Back/Forward preserve the completed guided conversation', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto(
    '/home-guided?audience=business&sector=workplace&role=collaborate',
  );
  await page.getByRole('link', { name: 'Explore commercial projects' }).click();
  await expect(page).toHaveURL(
    /commercial-pergolas-auckland\?sector=workplace&role=collaborate$/,
  );
  await expect(page.locator('[data-guided-journey-context]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-guided-journey-context]')).toBeVisible();

  await page.getByRole('link', { name: 'Change answers' }).click();
  await expect(page).toHaveURL(
    /home-guided\?audience=business&sector=workplace&role=collaborate$/,
  );
  await expect(page.locator('[data-guided-result="commercial"]')).toBeVisible();

  await page.goBack();
  await expect(page.locator('[data-guided-journey-context]')).toBeVisible();
  await page.goForward();
  await expect(page.locator('[data-guided-result="commercial"]')).toBeVisible();
});

test('mobile controls meet target size with no overflow or hidden branch DOM', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await expectNoHorizontalOverflow(page);

  const optionHeights = await page.locator('[data-guided-answer]')
    .evaluateAll((options) => options.map((option) => (
      option.getBoundingClientRect().height
    )));
  expect(optionHeights.every((height) => height >= 44)).toBe(true);
  await expect(page.locator('#design-conversation img')).toHaveCount(0);
  await expect(page.locator('[data-guided-home-hero] img')).toHaveCount(1);
  await expect(page.locator('[data-guided-question]')).toHaveCount(1);
  await expect(page.locator('[data-guided-result]')).toHaveCount(0);
});

test('keyboard radio navigation advances and preserves visible focus', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  const firstOption = page.locator('[data-guided-answer="home"]');
  await firstOption.focus();
  await firstOption.press('End');
  await expect(page).toHaveURL(/home-guided\?audience=professional$/);
  const nextHeading = page.getByRole('heading', {
    level: 2,
    name: 'What stage is the project at?',
  });
  await expect(nextHeading).toBeFocused();
  await expect(page.locator('[role="status"]')).toContainText(
    'Question 2 of 3. What stage is the project at?',
  );
});

test('illustrated questions render only governed media for the active branch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await expect(page.locator('img')).toHaveCount(1);

  await choose(page, 'home');
  await expect(page.locator('[data-guided-question="home-goal"] img'))
    .toHaveCount(3);
  await expect(page.getByAltText('Pergola at a Dairy Flat estate')).toBeVisible();
  await expect(page.getByAltText(
    'Freestanding matte black gable outdoor room beside a Warkworth home',
  )).toBeVisible();
  await expect(page.getByAltText(
    'Tindalls Bay home with connected patio and carport roof structures',
  )).toBeVisible();
  await expect(page.getByAltText('Covered hospitality courtyard with gable pergola'))
    .toHaveCount(0);

  await choose(page, 'difficult-site');
  await expect(page.locator('[data-guided-question="home-site-constraint"] img'))
    .toHaveCount(0);
  await expect(page.locator('img')).toHaveCount(1);
});

test('global mobile navigation remains available without adding a desktop CTA', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' }))
    .toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Mobile primary' })
    .getByRole('link', { name: 'Start your project' }))
    .toBeVisible();
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page.locator('header.site .nav-cta')).toHaveCount(0);
});

test('guided layouts keep one H1, safe touch targets and no overflow across target widths', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  const viewports = [
    { width: 320, height: 700 },
    { width: 360, height: 760 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 760 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];
  await page.setViewportSize(viewports[0]);
  await page.goto('/home-guided?audience=business');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    const targetSizes = await page.locator('[data-guided-answer]')
      .evaluateAll((options) => options.map((option) => {
        const rect = option.getBoundingClientRect();
        return {
          height: rect.height,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      }));
    expect(targetSizes.every(({ height, width }) => height >= 44 && width >= 44))
      .toBe(true);
    expect(targetSizes.every(({ left, right }) => (
      left >= -1 && right <= viewport.width + 1
    ))).toBe(true);
  }
});

test('the guided opening stays within its repeatable performance budget', async ({
  page,
}) => {
  const enforceProductionLcp = (
    process.env.MARKETING_GUIDED_HOME_PRODUCTION_PERF === '1'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.addInitScript(() => {
    const metrics = {
      cls: 0,
      firstAnswerResponseMs: null as number | null,
      lcp: 0,
    };
    (window as typeof window & {
      __guidedHomePerformance?: typeof metrics;
    }).__guidedHomePerformance = metrics;

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
      // Assertions below expose a browser without the required observers.
    }
  });
  await page.goto('/home-guided');
  const heroImage = page.locator('[data-guided-home-hero] img');
  await expect(heroImage).toHaveAttribute('fetchpriority', 'high');
  await expect.poll(() => heroImage.evaluate((image) => (
    (image as HTMLImageElement).complete
      && (image as HTMLImageElement).naturalWidth > 0
  ))).toBe(true);
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const metrics = (
      window as typeof window & {
        __guidedHomePerformance?: {
          cls: number;
          firstAnswerResponseMs: number | null;
          lcp: number;
        };
      }
    ).__guidedHomePerformance;
    const control = document.querySelector<HTMLButtonElement>(
      '[data-guided-answer="home"]',
    );
    const conversation = document.querySelector('[data-guided-home-variant]');
    if (!metrics || !control || !conversation) return;

    let startedAt = 0;
    const observer = new MutationObserver(() => {
      if (!conversation.querySelector('[data-guided-question="home-goal"]')) {
        return;
      }
      metrics.firstAnswerResponseMs = performance.now() - startedAt;
      observer.disconnect();
    });
    observer.observe(conversation, { childList: true, subtree: true });
    control.addEventListener('click', () => {
      startedAt = performance.now();
    }, { capture: true, once: true });
  });
  await choose(page, 'home');
  await expect(page.locator('[data-guided-question="home-goal"]')).toBeVisible();
  const metrics = await page.evaluate(() => (
    (window as typeof window & {
      __guidedHomePerformance?: {
        cls: number;
        firstAnswerResponseMs: number | null;
        lcp: number;
      };
    }).__guidedHomePerformance
  ));

  expect(metrics?.lcp ?? 0).toBeGreaterThan(0);
  if (enforceProductionLcp) {
    expect(metrics?.lcp ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2_500);
  }
  expect(metrics?.cls ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(0.1);
  expect(metrics?.firstAnswerResponseMs ?? Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(500);
});

test('reduced motion removes the guided question entrance movement', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await choose(page, 'professional');
  const motion = await page.locator('[data-guided-question="professional-stage"]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        transform: style.transform,
      };
    });
  expect(motion.animationDuration).toBe('0s');
  expect(motion.transform).toBe('none');
});

test('the concise five-path fallback remains usable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
  });
  const noScriptPage = await context.newPage();
  await noScriptPage.goto('/home-guided');
  const fallback = noScriptPage.locator(
    'section[aria-labelledby="guided-no-script-heading"]',
  );
  await expect(fallback).toBeVisible();
  await expect(fallback.getByRole('link')).toHaveCount(5);
  await expect(noScriptPage.locator('[data-guided-home-variant]')).toBeHidden();
  await context.close();
});

test('guided analytics are consent-aware and contain only closed journey values', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await choose(page, 'home');
  expect(await guidedEvents(page)).toEqual([]);

  await page.close();
});

test('consented analytics record view, question, answer, result and CTA events', async ({
  page,
}) => {
  await allowAnalytics(page);
  await page.goto('/home-guided');
  await choose(page, 'professional');
  await choose(page, 'concept');
  await choose(page, 'design-input');
  await expect.poll(async () => (
    (await guidedEvents(page)).map((event) => event.event)
  )).toContain('guided_home_result_view');

  await page.getByRole('link', {
    name: 'Explore professional collaboration',
  }).evaluate((link) => {
    link.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
  });
  await page.getByRole('link', {
    name: 'Explore professional collaboration',
  }).click();
  const events = await guidedEvents(page);
  expect(events.map((event) => event.event)).toEqual(expect.arrayContaining([
    'guided_home_view',
    'guided_home_question_view',
    'guided_home_answer',
    'guided_home_result_view',
    'guided_home_result_click',
  ]));
  const resultEvent = events.find((event) => (
    event.event === 'guided_home_result_view'
  ));
  expect(resultEvent).toMatchObject({
    audience: 'professional',
    focus_id: 'design-input',
    homepage_variant: 'guided_design_conversation_home_v1',
    result_id: 'professional',
    source_path: '/home-guided',
  });
});

test('the guided DOM has no duplicate IDs or client page errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await setAnalyticsConsent(page, false);
  await page.goto('/home-guided');
  await choose(page, 'business');
  await choose(page, 'workplace');

  const duplicateIds = await page.locator('[id]').evaluateAll((elements) => {
    const counts = new Map<string, number>();
    for (const element of elements) {
      counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([id]) => id);
  });
  expect(duplicateIds).toEqual([]);
  expect(errors).toEqual([]);
});
