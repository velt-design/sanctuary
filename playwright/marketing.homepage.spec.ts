import { expect, test, type Locator, type Page } from '@playwright/test';
import { buildEnquiryHref } from '../apps/marketing/lib/enquiryContext';

const route = '/';
const viewports = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '414x896', width: 414, height: 896 },
  { name: '430x932', width: 430, height: 932 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

const intentScenarios = [
  {
    name: /Cover a deck/,
    value: 'home-cover',
    projects: ['Dairy Flat Estate', 'Mt Maunganui Box'],
  },
  {
    name: /Create an outdoor room/,
    value: 'outdoor-room',
    projects: ['Warkworth Outdoor Room', 'Riverhead Gable Pavilion'],
  },
  {
    name: /Commercial or professional project/,
    value: 'commercial-professional',
    projects: ['The Good Home Takanini', 'KiwiRail Head Office'],
  },
] as const;

async function preparePage(page: Page, analytics = false) {
  await page.addInitScript((analyticsConsent) => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify({
      analytics: analyticsConsent,
      marketing: false,
      updatedAt: new Date().toISOString(),
      version: 1,
    }));
    (window as typeof window & { dataLayer?: unknown[] }).dataLayer = [];
  }, analytics);
}

async function getHomepageMain(page: Page) {
  const main = page.locator(
    'main[data-homepage-variant="design_conversation_home_v3"]:visible',
  );
  await expect(main).toHaveCount(1);
  return main;
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectImageLoaded(image: Locator) {
  await expect.poll(() => image.evaluate((element) => {
    const candidate = element as HTMLImageElement;
    return candidate.complete ? candidate.naturalWidth : 0;
  })).toBeGreaterThan(0);
}

async function getDesignEvents(page: Page) {
  return page.evaluate(() => (
    (window as typeof window & {
      dataLayer?: Array<Record<string, unknown> | unknown[]>;
    }).dataLayer
      ?.filter((event): event is Record<string, unknown> => (
        !Array.isArray(event)
        && typeof event.event === 'string'
        && event.event.startsWith('design_conversation_')
      )) ?? []
  ));
}

for (const [index, viewport] of viewports.entries()) {
  test(`first design conversation is responsive at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await preparePage(page);

    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);

    const main = await getHomepageMain(page);
    const scenario = intentScenarios[index % intentScenarios.length]!;

    await expect(main.locator('h1')).toHaveCount(1);
    await expect(main.getByRole('heading', {
      level: 1,
      name: 'Custom pergolas for Auckland homes and sites.',
    })).toBeVisible();
    await expect(main.getByText('Warkworth Outdoor Room', { exact: true }))
      .toBeVisible();
    await expect(main.locator('[data-homepage-hero] img')).toHaveCount(1);
    await expectImageLoaded(main.locator('[data-homepage-hero] img'));
    await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
      'content',
      /noindex/i,
    );

    const radios = main.getByRole('radio');
    await expect(radios).toHaveCount(3);
    if (viewport.width <= 430) {
      await main.getByRole('link', {
        name: 'Find a relevant project',
      }).click();
      await expect(radios.first()).toBeInViewport({ ratio: 0.8 });
    }
    const selectedRadio = main.getByRole('radio', { name: scenario.name });
    await selectedRadio.click();
    await expect(selectedRadio).toHaveAttribute('aria-checked', 'true');

    const projectResponse = main.locator(
      `[data-intent-response="${scenario.value}"]`,
    );
    await expect(projectResponse).toBeVisible();
    await expect(projectResponse.locator('article')).toHaveCount(2);
    for (const projectTitle of scenario.projects) {
      await expect(projectResponse.getByRole('heading', {
        level: 3,
        name: projectTitle,
      })).toBeVisible();
      await expect(projectResponse.getByRole('link', {
        name: `View ${projectTitle} project`,
      })).toBeVisible();
      await expect(projectResponse.getByRole('link', {
        name: `Use ${projectTitle} as an enquiry reference`,
      })).toBeVisible();
    }

    const controls = main.locator(
      'button:visible, a[data-design-conversation-event]:visible',
    );
    const controlCount = await controls.count();
    for (let controlIndex = 0; controlIndex < controlCount; controlIndex += 1) {
      const box = await controls.nth(controlIndex).boundingBox();
      expect(
        box && Math.round(box.height) >= 44 && Math.round(box.width) >= 44,
        `control ${controlIndex + 1} should expose a 44 by 44px touch target`,
      ).toBeTruthy();
    }

    await expectNoHorizontalOverflow(page);
  });
}

test('keyboard radio behavior changes the project response without moving focus away', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, true);
  await page.goto(route);
  const main = await getHomepageMain(page);
  const radios = main.getByRole('radio');

  await radios.first().focus();
  await expect(radios.first()).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(radios.nth(1)).toBeFocused();
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator('[data-intent-response="outdoor-room"]'))
    .toBeVisible();
  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_intent_select'
    )).length
  )).toBe(1);

  await page.keyboard.press('End');
  await expect(radios.nth(2)).toBeFocused();
  await expect(radios.nth(2)).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator(
    '[data-intent-response="commercial-professional"]',
  )).toBeVisible();
  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_intent_select'
    )).length
  )).toBe(2);
  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_match_view'
    )).length
  )).toBe(2);

  await main.getByRole('button', {
    name: 'Change',
    exact: true,
  }).click();
  await expect(radios.first()).toBeFocused();
  await expect(main.locator('[data-intent-response]')).toHaveCount(0);
});

test('the journey remains operable in the 360x400 CSS viewport produced by 200 percent zoom', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 400 });
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  const start = main.getByRole('link', { name: 'Find a relevant project' });
  await start.scrollIntoViewIfNeeded();
  await start.click();
  const firstIntent = main.getByRole('radio', {
    name: /Cover a deck/,
  });
  await expect(firstIntent).toBeInViewport({ ratio: 0.8 });
  await firstIntent.click();

  await expect(main.locator('[data-intent-response="home-cover"]'))
    .toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('the selected completed project arrives at contact as validated enquiry context', async ({
  page,
}) => {
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  await main.getByRole('radio', {
    name: /Create an outdoor room/,
  }).click();
  const warkworthCard = main.locator('article').filter({
    hasText: 'Warkworth Outdoor Room',
  });
  const referenceHref = buildEnquiryHref({
    enquiryType: 'residential',
    sourcePath: route,
    sourceComponent: 'project_cta',
    sourceProject: 'warkworth-outdoor-room',
  });
  const reference = warkworthCard.getByRole('link', {
    name: 'Use Warkworth Outdoor Room as an enquiry reference',
  });

  await expect(reference).toHaveAttribute('href', referenceHref);
  await reference.click();
  await expect(page).toHaveURL(new RegExp(
    referenceHref.replace(/[?]/g, '\\?'),
  ));
  await expect(page.getByLabel('Enquiry context')).toContainText(
    'Project: Warkworth Outdoor Room',
  );
  await expect(page.getByRole('radio', {
    name: 'Residential',
    exact: false,
  })).toBeChecked();
});

test('consented analytics records the bounded interaction once without personal data', async ({
  page,
}) => {
  await preparePage(page, true);
  await page.goto(route);
  const main = await getHomepageMain(page);

  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_view'
    )).length
  )).toBe(1);

  await main.getByRole('radio', {
    name: /Cover a deck/,
  }).click();
  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_intent_select'
    )).length
  )).toBe(1);
  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_match_view'
    )).length
  )).toBe(1);

  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      if (
        event.target instanceof Element
        && event.target.closest(
          '[data-design-conversation-event="design_conversation_reference_select"]',
        )
      ) {
        event.preventDefault();
      }
    }, true);
  });
  await main.getByRole('link', {
    name: 'Use Dairy Flat Estate as an enquiry reference',
  }).first().click();

  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_reference_select'
    )).length
  )).toBe(1);

  const events = await getDesignEvents(page);
  expect(events.find((event) => (
    event.event === 'design_conversation_intent_select'
  ))).toMatchObject({
    homepage_variant: 'design_conversation_home_v3',
    viewport_category: 'desktop',
    source_path: route,
    project_intent: 'home-cover',
    matched_projects: ['dairy-flat-estate', 'mt-maunganui-box'],
    step_number: 1,
  });

  const serializedEvents = JSON.stringify(events);
  for (const personalProperty of [
    'email',
    'phone',
    'name',
    'message',
    'dimensions',
  ]) {
    expect(serializedEvents).not.toContain(`"${personalProperty}"`);
  }
});

test('denied analytics consent records no design-conversation events', async ({
  page,
}) => {
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);
  await main.getByRole('radio', {
    name: /Cover a deck/,
  }).click();

  const eventCount = await page.evaluate(() => (
    (window as typeof window & {
      dataLayer?: Array<Record<string, unknown> | unknown[]>;
    }).dataLayer
      ?.filter((event) => (
        !Array.isArray(event)
        && typeof event.event === 'string'
        && event.event.startsWith('design_conversation_')
      )).length ?? 0
  ));
  expect(eventCount).toBe(0);
});

test('selected options and inverse actions keep visible hover and focus contrast', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  const selectedIntent = main.getByRole('radio', {
    name: 'Cover a deck',
    exact: true,
  });
  await selectedIntent.click();
  await selectedIntent.hover();
  await expect(selectedIntent).toHaveCSS('background-color', 'rgb(79, 87, 72)');
  await expect(selectedIntent).toHaveCSS('color', 'rgb(244, 244, 240)');
  await selectedIntent.focus();
  await expect(selectedIntent).toHaveCSS('outline-color', 'rgb(244, 244, 240)');

  const heroAction = main.getByRole('link', {
    name: 'Find a relevant project',
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await heroAction.focus();
  await expect(heroAction).toHaveCSS('outline-color', 'rgb(244, 244, 240)');

  const headerAction = page.locator('header.site .nav-cta');
  await headerAction.focus();
  await expect(headerAction).toHaveCSS('outline-color', 'rgb(255, 255, 255)');

  const closingAction = main.locator(
    '[data-design-conversation-event="design_conversation_general_enquiry_click"]',
  ).last();
  await closingAction.scrollIntoViewIfNeeded();
  await closingAction.focus();
  await expect(closingAction).toHaveCSS(
    'outline-color',
    'rgb(17, 18, 16)',
  );
});

test('the tracked header enquiry retains the homepage residential audience', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparePage(page, true);
  await page.goto(route);
  await getHomepageMain(page);
  await page.evaluate(() => {
    document.addEventListener('click', (event) => {
      if (
        event.target instanceof Element
        && event.target.closest('[data-homepage-event="header_estimate_click"]')
      ) {
        event.preventDefault();
      }
    }, true);
  });

  await page.locator('header.site .nav-cta').click();
  await expect.poll(async () => (
    (await getDesignEvents(page)).filter((event) => (
      event.event === 'design_conversation_general_enquiry_click'
      && event.enquiry_type === 'residential'
    )).length
  )).toBe(1);
});

test('hydration and every first-answer transition remain free of browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  for (const scenario of intentScenarios) {
    await main.getByRole('radio', { name: scenario.name }).click();
    await expect(main.locator(`[data-intent-response="${scenario.value}"]`))
      .toBeVisible();
  }

  expect(errors).toEqual([]);
});

test('reduced motion removes the project-response transition', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  await main.getByRole('radio', {
    name: /Create an outdoor room/,
  }).click();
  const motion = await main.locator('[data-intent-response]').evaluate(
    (response) => ({
      animationName: getComputedStyle(response).animationName,
      transitionDuration: getComputedStyle(response).transitionDuration,
    }),
  );
  expect(motion).toEqual({
    animationName: 'none',
    transitionDuration: '0s',
  });
});

test('the bounded homepage stays within its repeatable performance budget', async ({
  page,
}) => {
  const enforceProductionLcp = (
    process.env.MARKETING_HOMEPAGE_PRODUCTION_PERF === '1'
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const metrics = { cls: 0, lcp: 0, firstAnswerResponseMs: null as number | null };
    (window as typeof window & {
      __homepagePerformance?: typeof metrics;
    }).__homepagePerformance = metrics;

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
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);
  const heroImage = main.locator('[data-homepage-hero] img');
  await expectImageLoaded(heroImage);
  await expect(heroImage).toHaveAttribute('fetchpriority', 'high');
  await page.waitForTimeout(500);

  const firstAnswer = main.getByRole('radio', {
    name: 'Cover a deck',
    exact: true,
  });
  await firstAnswer.scrollIntoViewIfNeeded();
  await expect(firstAnswer).toBeVisible();
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  await page.evaluate(() => {
    const metrics = (
      window as typeof window & {
        __homepagePerformance?: {
          cls: number;
          lcp: number;
          firstAnswerResponseMs: number | null;
        };
      }
    ).__homepagePerformance;
    const control = document.querySelector<HTMLButtonElement>(
      '[role="radio"][data-project-intent="home-cover"]',
    );
    const conversation = document.querySelector(
      '[data-design-conversation-interactive]',
    );
    if (!metrics || !control || !conversation) return;

    const observer = new MutationObserver(() => {
      if (!conversation.querySelector('[data-intent-response="home-cover"]')) {
        return;
      }
      metrics.firstAnswerResponseMs = performance.now() - startedAt;
      observer.disconnect();
    });
    let startedAt = 0;
    observer.observe(conversation, { childList: true, subtree: true });
    control.addEventListener('click', () => {
      startedAt = performance.now();
    }, { capture: true, once: true });
  });
  await firstAnswer.click();
  await expect(main.locator('[data-intent-response="home-cover"]'))
    .toBeVisible();
  const metrics = await page.evaluate(() => (
    (window as typeof window & {
      __homepagePerformance?: {
        cls: number;
        lcp: number;
        firstAnswerResponseMs: number | null;
      };
    }).__homepagePerformance
  ));

  expect(metrics?.lcp ?? 0).toBeGreaterThan(0);
  if (enforceProductionLcp) {
    expect(metrics?.lcp ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(2_500);
  }
  expect(metrics?.cls ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(0.1);
  expect(
    metrics?.firstAnswerResponseMs ?? Number.POSITIVE_INFINITY,
  ).toBeLessThanOrEqual(500);
});

test('the conversation remains usable when session storage is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const storage = window.sessionStorage;
    const storageKey = 'sanctuary:homepage-design-conversation:intent';
    const unavailable = () => {
      throw new DOMException('Storage unavailable', 'SecurityError');
    };
    Object.defineProperties(storage, {
      getItem: {
        configurable: true,
        value: (key: string) => (
          key === storageKey
            ? unavailable()
            : Storage.prototype.getItem.call(storage, key)
        ),
      },
      setItem: {
        configurable: true,
        value: (key: string, value: string) => (
          key === storageKey
            ? unavailable()
            : Storage.prototype.setItem.call(storage, key, value)
        ),
      },
      removeItem: {
        configurable: true,
        value: (key: string) => (
          key === storageKey
            ? unavailable()
            : Storage.prototype.removeItem.call(storage, key)
        ),
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route);
  const main = await getHomepageMain(page);

  await main.getByRole('radio', {
    name: /Commercial or professional project/,
  }).click();
  await expect(main.locator(
    '[data-intent-response="commercial-professional"]',
  )).toBeVisible();
  await expect(main.getByText('KiwiRail Head Office', { exact: true }))
    .toBeVisible();
});

test('a cached return restores the validated first answer without hiding other choices', async ({
  page,
}) => {
  await preparePage(page);
  await page.goto(route);
  let main = await getHomepageMain(page);

  await main.getByRole('radio', {
    name: /Cover a deck/,
  }).click();
  await expect(main.locator('[data-intent-response="home-cover"]'))
    .toBeVisible();

  await page.reload();
  main = await getHomepageMain(page);
  await expect(main.getByRole('radio', {
    name: /Cover a deck/,
  })).toHaveAttribute('aria-checked', 'true');
  await expect(main.locator('[data-intent-response="home-cover"]'))
    .toBeVisible();
  await expect(main.getByRole('radio')).toHaveCount(3);
});

test('project text and enquiry actions remain useful when a response image fails', async ({
  page,
}) => {
  await page.route('**/*project-dairy-flat-01.jpg*', async (request) => {
    await request.abort();
  });
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  await main.getByRole('radio', {
    name: /Cover a deck/,
  }).click();
  const dairyFlatCard = main.locator('article').filter({
    hasText: 'Dairy Flat Estate',
  });
  await expect(dairyFlatCard).toBeVisible();
  await expect(dairyFlatCard).toContainText(
    'An acrylic gable follows the roofline',
  );
  await expect(dairyFlatCard.getByRole('link', {
    name: 'Use Dairy Flat Estate as an enquiry reference',
  })).toBeVisible();
});

test('the production homepage is canonical, indexable and carries its crawlable responsibilities', async ({
  page,
}) => {
  await preparePage(page);
  const response = await page.goto(route);
  expect(response?.ok()).toBe(true);
  const homepage = await getHomepageMain(page);

  await expect(homepage.getByRole('heading', {
    level: 1,
    name: 'Custom pergolas for Auckland homes and sites.',
  })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    'content',
    /noindex/i,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://www.sanctuarypergolas.co.nz',
  );
  await expect(page).toHaveTitle(
    'Architectural Pergola Design & Build | Sanctuary Pergolas',
  );
  await expect(homepage.getByRole('heading', {
    level: 2,
    name: 'Choose a project path.',
  })).toBeVisible();
  await expect(homepage.getByRole('heading', {
    level: 2,
    name: 'From brief to installation.',
  })).toBeVisible();
  await expect(homepage.getByRole('link', {
    name: 'Explore home pergolas',
  })).toHaveAttribute('href', '/pergolas-auckland');
  await expect(homepage.getByRole('link', {
    name: 'Explore commercial work',
  })).toHaveAttribute('href', '/commercial-pergolas-auckland#project-details');
  await expect(homepage.getByRole('link', {
    name: 'Explore collaboration',
  })).toHaveAttribute('href', '/architects-designers-builders');

  const schemaTypes = await page.locator(
    'script[type="application/ld+json"]',
  ).evaluateAll((scripts) => scripts.flatMap((script) => {
    const value = JSON.parse(script.textContent ?? '{}') as
      | Record<string, unknown>
      | Array<Record<string, unknown>>;
    const items = Array.isArray(value) ? value : [value];
    return items.map((item) => item['@type']);
  }));
  expect(schemaTypes).toEqual(expect.arrayContaining([
    'Organization',
    'LocalBusiness',
    'WebSite',
    'WebPage',
  ]));
  await expect(homepage.getByRole('radio')).toHaveCount(3);
  await expect(homepage.getByText('What matters most for the space?'))
    .toHaveCount(0);
  await expect(homepage.getByText('What information do you already have?'))
    .toHaveCount(0);
});

test('retired homepage comparison routes permanently redirect to the canonical root', async ({
  request,
}) => {
  for (const retiredRoute of ['/home-experimental', '/home-v2']) {
    const response = await request.get(retiredRoute, { maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers().location).toBe('/');
  }
});

test('the homepage keeps one coherent landmark and screen-reader question structure', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);
  const main = await getHomepageMain(page);

  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('radiogroup', {
    name: 'What are you trying to create?',
  })).toHaveCount(1);
  await expect(main.getByRole('radio', {
    name: 'Cover a deck',
    exact: true,
  })).toHaveCount(1);
  await expect(main.getByRole('status')).toHaveAttribute('aria-live', 'polite');

  const structure = await main.evaluate((element) => {
    const levels = [...element.querySelectorAll('h1, h2, h3, h4, h5, h6')]
      .map((heading) => Number(heading.tagName.slice(1)));
    return {
      levels,
      imagesMissingAlt: [...element.querySelectorAll('img')]
        .filter((image) => !image.hasAttribute('alt')).length,
    };
  });
  expect(structure.imagesMissingAlt).toBe(0);
  for (let index = 1; index < structure.levels.length; index += 1) {
    expect(
      structure.levels[index]! - structure.levels[index - 1]!,
      'heading levels should not skip forward',
    ).toBeLessThanOrEqual(1);
  }
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every first-question pathway, built examples, proof and direct enquiry', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(route);
    expect(response?.ok()).toBe(true);

    const main = await getHomepageMain(page);
    await expect(main.locator('[data-design-conversation-interactive]'))
      .toBeHidden();
    await expect(main.getByRole('heading', {
      level: 1,
      name: 'Custom pergolas for Auckland homes and sites.',
    })).toBeVisible();

    await expect(main.getByRole('heading', {
      level: 2,
      name: 'What are you trying to create?',
    })).toBeVisible();
    const fallback = main.locator('noscript');
    for (const scenario of intentScenarios) {
      await expect(fallback.getByRole('heading', {
        level: 3,
        name: scenario.name,
      })).toBeVisible();
      for (const project of scenario.projects) {
        await expect(fallback.getByText(project, { exact: true })).toBeVisible();
      }
    }
    for (const scenario of intentScenarios) {
      for (const project of scenario.projects) {
        await expect(fallback.getByRole('link', {
          name: `Use ${project} as an enquiry reference`,
        })).toBeVisible();
      }
    }
    await expect(main.getByLabel('Sanctuary project proof')).toBeVisible();
    await expect(main.getByRole('heading', {
      level: 2,
      name: 'Choose a project path.',
    })).toBeVisible();
    await expect(main.getByRole('heading', {
      level: 2,
      name: 'From brief to installation.',
    })).toBeVisible();
    await expect(main.getByRole('link', {
      name: 'Continue without a project reference',
    }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test('the production homepage preserves the shared mobile-menu scroll lock and focus return', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto(route);
  await getHomepageMain(page);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 500));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);

  const menuButton = page.getByRole('button', { name: 'Open menu' });
  await menuButton.click();
  await expect(page.locator('body')).toHaveClass(/no-scroll/);
  await expect(page.locator('body')).toHaveCSS('position', 'fixed');
  await expect(page.locator('body')).toHaveCSS('top', '-500px');
  const navigation = page.getByRole('navigation', { name: 'Mobile primary' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link').first()).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/no-scroll/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
  await expect(menuButton).toBeFocused();
});
