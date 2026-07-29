import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  expect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';

const evidenceDirectory = path.join(
  process.cwd(),
  'artifacts',
  'mobile-touch-motion',
  'tm-02',
);
const captureLabel = process.env.MARKETING_TM02_CAPTURE_LABEL?.trim();
const consentChoice = {
  analytics: false,
  marketing: false,
  updatedAt: '2026-07-26T00:00:00.000Z',
  version: 1,
};

type StyleSnapshot = {
  backgroundColor: string;
  borderColor: string;
  opacity: string;
  transform: string;
};

async function preparePage(page: Page, reducedMotion = false) {
  await page.emulateMedia({
    reducedMotion: reducedMotion ? 'reduce' : 'no-preference',
  });
  await page.addInitScript((choice) => {
    window.localStorage.setItem('sp_consent_v1', JSON.stringify(choice));
  }, consentChoice);
}

async function snapshot(locator: Locator): Promise<StyleSnapshot> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      opacity: style.opacity,
      transform: style.transform,
    };
  });
}

async function holdActive(
  page: Page,
  pressTarget: Locator,
  styleTarget: Locator = pressTarget,
) {
  await pressTarget.scrollIntoViewIfNeeded();
  const bounds = await pressTarget.boundingBox();
  expect(bounds).not.toBeNull();
  const before = await snapshot(styleTarget);

  await page.mouse.move(
    bounds!.x + bounds!.width / 2,
    bounds!.y + bounds!.height / 2,
  );
  await page.mouse.down();
  await expect.poll(() => pressTarget.evaluate((element) => element.matches(':active')))
    .toBe(true);
  await page.waitForTimeout(40);
  const pressed = await snapshot(styleTarget);
  await page.mouse.move(0, 0);
  await page.mouse.up();

  return { before, pressed };
}

function expectVisibleFeedback(
  before: StyleSnapshot,
  pressed: StyleSnapshot,
) {
  expect(
    Object.keys(before).some((key) => (
      before[key as keyof StyleSnapshot] !== pressed[key as keyof StyleSnapshot]
    )),
  ).toBe(true);
}

async function expectHeldFeedback(
  page: Page,
  pressTarget: Locator,
  styleTarget: Locator = pressTarget,
) {
  const { before, pressed } = await holdActive(page, pressTarget, styleTarget);
  expectVisibleFeedback(before, pressed);
}

async function forcePseudoState(
  page: Page,
  selectors: string[],
  pseudoClasses: string[],
) {
  const session = await page.context().newCDPSession(page);
  await session.send('DOM.enable');
  await session.send('CSS.enable');
  const { root } = await session.send('DOM.getDocument', { depth: -1 });
  const nodeIds: number[] = [];

  for (const selector of selectors) {
    const { nodeId } = await session.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector,
    });
    expect(nodeId, `expected ${selector} to resolve for evidence capture`).not.toBe(0);
    nodeIds.push(nodeId);
    await session.send('CSS.forcePseudoState', {
      nodeId,
      forcedPseudoClasses: pseudoClasses,
    });
  }

  return async () => {
    for (const nodeId of nodeIds) {
      await session.send('CSS.forcePseudoState', {
        nodeId,
        forcedPseudoClasses: [],
      });
    }
    await session.detach();
  };
}

for (const viewport of [
  { width: 430, height: 932 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
] as const) {
  test(`shared menu has held-down feedback and governed panel timing at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await preparePage(page);
    await page.goto('/contact');

    const trigger = page.getByRole('button', { name: 'Open menu' });
    await expectHeldFeedback(page, trigger);

    const menu = page.locator('#mobile-menu');
    await expect(menu).toHaveCSS('transition-duration', /^0\.15s(?:, 0\.15s)?$/);
    await trigger.click();
    await expect(menu).toHaveCSS('transition-duration', /^0\.22s(?:, 0\.22s)?$/);

    const currentLink = page
      .getByRole('navigation', { name: 'Mobile primary' })
      .getByRole('link', { name: 'Start your project' });
    const currentPress = await holdActive(page, currentLink);
    expect(currentPress.pressed.backgroundColor)
      .not.toBe(currentPress.before.backgroundColor);
    expect(currentPress.pressed.opacity).toBe('1');

    await page.keyboard.press('Escape');
    await expect(menu).toHaveCSS('transition-duration', /^0\.15s(?:, 0\.15s)?$/);
  });
}

test('homepage and footer adapters provide active feedback while selected state remains stronger', async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await preparePage(page, true);
  await page.goto('/');

  const firstIntent = page.getByRole('radio').first();
  const unselectedPress = await holdActive(page, firstIntent);
  expect(Number(unselectedPress.pressed.opacity)).toBeLessThan(1);

  await firstIntent.click();
  await expect(firstIntent).toHaveAttribute('aria-checked', 'true');
  const selectedPress = await holdActive(page, firstIntent);
  expect(selectedPress.pressed.opacity).toBe('1');

  const projectCard = page.locator('[data-intent-response] article').first();
  const projectLink = projectCard.locator(
    'a[data-design-conversation-event="design_conversation_project_open"]',
  );
  await expectHeldFeedback(page, projectLink, projectCard);

  const audienceCard = page.locator('article').filter({
    has: page.getByRole('link', { name: /homeowner|commercial|architect/i }),
  }).first();
  const audienceLink = audienceCard.getByRole('link');
  await expectHeldFeedback(page, audienceLink, audienceCard);

  const footerReview = page.getByRole('link', { name: /Google reviews/ }).last();
  const footerPress = await holdActive(page, footerReview);
  expect(Number(footerPress.pressed.opacity)).toBeLessThan(1);
});

test('project cards, sheet controls and native gallery controls retain their stronger states', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, true);
  await page.goto('/projects');

  const projectCard = page.locator('[data-project-card]:not(.is-active)').first();
  const cardPress = await holdActive(page, projectCard);
  expect(Number(cardPress.pressed.opacity)).toBeLessThan(1);

  const filterSummary = page.locator('[data-project-filter-disclosure] summary');
  await expectHeldFeedback(page, filterSummary);

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/projects/warkworth-outdoor-room');
  const trigger = page.locator('.project-navigator__trigger');
  await expectHeldFeedback(page, trigger);
  await trigger.click();

  const panel = page.locator('#project-navigator-panel');
  await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(panel).toHaveCSS('transition-duration', /^0\.22s(?:, 0\.22s)?$/);
  const close = panel.getByRole('button', { name: 'Close project navigator' });
  await expectHeldFeedback(page, close);
  await close.click();
  await expect(panel).toHaveCSS('transition-duration', /^0\.15s(?:, 0\.15s)?$/);

  const shell = page.locator('[data-project-gallery-shell]');
  const previous = shell.getByRole('button', { name: /Previous image/ });
  const next = shell.getByRole('button', { name: /Next image/ });
  const position = shell.locator('[aria-live="polite"]');
  await expect(position).toHaveText(/Image 1 of \d+/);
  await expect(previous).toHaveAttribute('aria-disabled', 'true');

  const disabledPress = await holdActive(page, previous);
  expect(disabledPress.pressed).toEqual(disabledPress.before);

  const enabledPress = await holdActive(page, next);
  expect(enabledPress.pressed.transform).not.toBe('none');
  await next.click();
  await expect(position).toHaveText(/Image 2 of \d+/);
});

test('product and route disclosure adapters provide active feedback without changing native disclosure ownership', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await preparePage(page, true);

  await page.goto('/products');
  const productCard = page.locator('a[aria-label^="Explore "]').first();
  const productPress = await holdActive(page, productCard);
  expect(Number(productPress.pressed.opacity)).toBeLessThan(1);

  await page.goto('/products/pergolas/pitched');
  const productDisclosure = page.locator(
    'details[data-product-mobile-disclosure]',
  ).first();
  await expect(productDisclosure).toHaveAttribute('data-disclosure-state', 'mobile');
  await expectHeldFeedback(page, productDisclosure.locator('summary'));

  await page.goto('/pergolas-auckland');
  const residentialDisclosure = page.locator(
    'details[data-mobile-content-disclosure] summary',
  ).first();
  await expectHeldFeedback(page, residentialDisclosure);

  await page.goto('/commercial-pergolas-auckland');
  const seoDisclosure = page.locator(
    'details[data-seo-landing-disclosure] summary',
  ).first();
  await expectHeldFeedback(page, seoDisclosure);
});

test('contact choices, file controls and sending controls preserve state precedence', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, true);
  let finishSubmission: (() => void) | undefined;
  const submissionGate = new Promise<void>((resolve) => {
    finishSubmission = resolve;
  });
  await page.route('**/api/enquiry', async (route) => {
    await submissionGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto('/contact?enquiry_type=residential');

  const selectedRadio = page.getByRole('radio', {
    name: 'Residential',
    exact: false,
  });
  const selectedLabel = selectedRadio.locator('..');
  const selectedPress = await holdActive(page, selectedLabel);
  expect(selectedPress.pressed.opacity).toBe('1');
  await page.getByText('Add optional project details', { exact: true }).click();

  const unselectedLabel = page.getByRole('radio', {
    name: 'Commercial',
    exact: false,
  }).locator('..');
  const unselectedPress = await holdActive(page, unselectedLabel);
  expect(Number(unselectedPress.pressed.opacity)).toBeLessThan(1);

  const lighting = page.getByRole('checkbox', { name: 'Lighting' });
  const lightingLabel = lighting.locator('..');
  const uncheckedPress = await holdActive(page, lightingLabel);
  expect(Number(uncheckedPress.pressed.opacity)).toBeLessThan(1);
  await lighting.check();
  const checkedPress = await holdActive(page, lightingLabel);
  expect(checkedPress.pressed.opacity).toBe('1');

  const fileInput = page.getByLabel('Photos, plans or sketches Optional');
  const fileInputBounds = await fileInput.boundingBox();
  expect(fileInputBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  await fileInput.setInputFiles({
    name: 'tm-02-plan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-tm-02'),
  });
  const remove = page.getByRole('button', { name: 'Remove tm-02-plan.pdf' });
  const removeBounds = await remove.boundingBox();
  expect(removeBounds?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(removeBounds?.width ?? 0).toBeGreaterThanOrEqual(44);
  await expectHeldFeedback(page, remove);
  await remove.click();
  await expect(remove).toHaveCount(0);

  await page.getByLabel('Name Required').fill('TM 02 Test');
  await page.getByLabel('Phone Required').fill('021 000 0000');
  const submit = page.locator('.contact-form__submit button');
  await submit.click();
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveText('Sending brief');
  await expect(submit).toHaveCSS('opacity', '0.64');
  await expect(submit).toHaveCSS('transform', 'none');
  finishSubmission?.();
  await expect(page.getByRole('status')).toContainText('Project brief sent');
  await expect(submit).toBeDisabled();
});

test('reduced motion resolves governed transitions while active surfaces remain visible', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page, true);
  await page.goto('/products');

  const productCard = page.locator('a[aria-label^="Explore "]').first();
  await expect(productCard).toHaveCSS('transition-duration', /^0s(?:, 0s)*$/);
  const press = await holdActive(page, productCard);
  expect(press.pressed.opacity).toBe('0.86');

  await page.goto('/contact');
  const contactAction = page.getByRole('link', {
    name: 'Send a project brief',
  });
  await expect(contactAction).toHaveCSS('transition-duration', /^0s(?:, 0s)*$/);

  const footerReview = page.getByRole('link', { name: /Google reviews/ }).last();
  await footerReview.scrollIntoViewIfNeeded();
  await expect(footerReview).toHaveCSS('transition-duration', /^0s(?:, 0s)*$/);
});

test('desktop hover and focus-visible feedback remains intact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await preparePage(page);
  await page.goto('/products');
  expect(await page.evaluate(() => (
    matchMedia('(hover: hover) and (pointer: fine)').matches
  ))).toBe(true);

  const productCard = page.locator('a[aria-label^="Explore "]').first();
  const productImage = productCard.locator('img');
  const imageBefore = await productImage.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await productCard.hover();
  await expect.poll(() => productImage.evaluate(
    (element) => getComputedStyle(element).transform,
  )).not.toBe(imageBefore);

  await productCard.focus();
  expect(await productCard.evaluate((element) => element.matches(':focus-visible')))
    .toBe(true);
  await expect(productCard).not.toHaveCSS('outline-style', 'none');
});

test('route progress never appears before its existing 150 ms delay', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparePage(page);
  await page.goto('/');
  await page.evaluate(() => {
    const progress = document.querySelector('.route-progress');
    if (!progress) throw new Error('Missing route progress element');
    let startedAt = performance.now();
    const timings: number[] = [];
    document.addEventListener('click', () => {
      startedAt = performance.now();
    }, { capture: true, once: true });
    new MutationObserver(() => {
      if (progress.classList.contains('route-progress--loading')) {
        timings.push(performance.now() - startedAt);
      }
    }).observe(progress, { attributeFilter: ['class'], attributes: true });
    (window as typeof window & { __tm02ProgressTimings?: number[] })
      .__tm02ProgressTimings = timings;
  });

  await page.getByRole('link', { name: 'Compare pergola options' })
    .click();
  await expect(page).toHaveURL(/\/products$/);
  await page.waitForTimeout(220);
  const timings = await page.evaluate(() => (
    (window as typeof window & { __tm02ProgressTimings?: number[] })
      .__tm02ProgressTimings ?? []
  ));
  expect(timings.every((timing) => timing >= 140)).toBe(true);
});

test('capture TM-02 paired pressed-state evidence', async ({ page }) => {
  test.skip(
    captureLabel !== 'before' && captureLabel !== 'after',
    'Set MARKETING_TM02_CAPTURE_LABEL=before or after to capture paired evidence.',
  );
  await mkdir(evidenceDirectory, { recursive: true });
  await preparePage(page);

  await page.setViewportSize({ width: 360, height: 480 });
  await page.goto('/contact');
  await page.getByRole('button', { name: 'Open menu' }).click();
  let clear = await forcePseudoState(
    page,
    ['#mobile-menu .mobile-menu__link[aria-current="page"]'],
    ['active'],
  );
  await page.waitForTimeout(180);
  await page.locator('#mobile-menu').screenshot({
    path: path.join(
      evidenceDirectory,
      `${captureLabel}-mobile-menu-active-360x480.png`,
    ),
  });
  await clear();

  await page.setViewportSize({ width: 430, height: 932 });
  await page.goto('/');
  clear = await forcePseudoState(
    page,
    ['[data-design-conversation-interactive] [role="radio"]:first-child'],
    ['active'],
  );
  await page.waitForTimeout(180);
  await page.locator('[data-design-conversation-interactive] [role="radiogroup"]')
    .screenshot({
      path: path.join(
        evidenceDirectory,
        `${captureLabel}-homepage-intent-active-430x932.png`,
      ),
    });
  await clear();

  const footerReview = page.getByRole('link', { name: /Google reviews/ }).last();
  await footerReview.scrollIntoViewIfNeeded();
  clear = await forcePseudoState(
    page,
    ['footer a[href*="search.google.com/local/reviews"]'],
    ['active'],
  );
  await page.waitForTimeout(180);
  await footerReview.screenshot({
    path: path.join(
      evidenceDirectory,
      `${captureLabel}-footer-review-active-430x932.png`,
    ),
  });
  await clear();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/warkworth-outdoor-room');
  await page.locator('.project-navigator__trigger').click();
  clear = await forcePseudoState(
    page,
    ['#project-navigator-panel .project-navigator__close'],
    ['active'],
  );
  await page.waitForTimeout(220);
  await page.locator('#project-navigator-panel').screenshot({
    path: path.join(
      evidenceDirectory,
      `${captureLabel}-project-sheet-active-390x844.png`,
    ),
  });
  await clear();

  await page.goto('/products');
  clear = await forcePseudoState(
    page,
    ['a[aria-label^="Explore "]'],
    ['active'],
  );
  await page.waitForTimeout(180);
  await page.locator('a[aria-label^="Explore "]').first().screenshot({
    path: path.join(
      evidenceDirectory,
      `${captureLabel}-product-card-active-390x844.png`,
    ),
  });
  await clear();

  await page.goto('/contact?enquiry_type=residential');
  await page.getByLabel('Photos, plans or sketches Optional').setInputFiles({
    name: 'tm-02-plan.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-tm-02'),
  });
  clear = await forcePseudoState(
    page,
    [
      '.contact-form__type-options > label:nth-child(2)',
      '.contact-form__files button',
    ],
    ['active'],
  );
  await page.waitForTimeout(180);
  await page.locator('.contact-form__type-options').screenshot({
    path: path.join(
      evidenceDirectory,
      `${captureLabel}-contact-choice-active-390x844.png`,
    ),
  });
  await page.locator('.contact-form__files').screenshot({
    path: path.join(
      evidenceDirectory,
      `${captureLabel}-contact-file-remove-active-390x844.png`,
    ),
  });
  await clear();
});

test('capture TM-02 paired production performance evidence', async ({
  browser,
}) => {
  test.skip(
    captureLabel !== 'before' && captureLabel !== 'after',
    'Set MARKETING_TM02_CAPTURE_LABEL=before or after to capture paired evidence.',
  );
  await mkdir(evidenceDirectory, { recursive: true });
  const runs = [];

  for (let run = 1; run <= 3; run += 1) {
    const context = await browser.newContext({
      reducedMotion: 'no-preference',
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript((choice) => {
      window.localStorage.setItem('sp_consent_v1', JSON.stringify(choice));
      const evidence = {
        cls: 0,
        longTasks: [] as number[],
      };
      (window as typeof window & {
        __tm02Performance?: typeof evidence;
      }).__tm02Performance = evidence;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            hadRecentInput?: boolean;
            value?: number;
          };
          if (!shift.hadRecentInput) evidence.cls += shift.value ?? 0;
        }
      }).observe({ buffered: true, type: 'layout-shift' });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          evidence.longTasks.push(entry.duration);
        }
      }).observe({ buffered: true, type: 'longtask' });
    }, consentChoice);
    const page = await context.newPage();
    const failedResponses: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failedResponses.push(response.url());
    });
    const response = await page.goto('/', { waitUntil: 'networkidle' });
    expect(response?.ok()).toBe(true);
    await page.waitForTimeout(500);

    const measurement = await page.evaluate(() => {
      const evidence = (window as typeof window & {
        __tm02Performance?: {
          cls: number;
          longTasks: number[];
        };
      }).__tm02Performance;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const scripts = resources.filter((entry) => entry.initiatorType === 'script');
      const images = resources.filter((entry) => entry.initiatorType === 'img');
      const styles = resources.filter((entry) => entry.initiatorType === 'link');
      const totalTransferSize = (entries: PerformanceResourceTiming[]) => (
        entries.reduce((total, entry) => total + entry.transferSize, 0)
      );
      return {
        cls: evidence?.cls ?? 0,
        domNodes: document.querySelectorAll('*').length,
        firstContentfulPaint: performance
          .getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        imageRequestCount: images.length,
        imageTransferBytes: totalTransferSize(images),
        longTaskCount: evidence?.longTasks.length ?? 0,
        longTaskMaxDuration: Math.max(0, ...(evidence?.longTasks ?? [])),
        resourceRequestCount: resources.length,
        scriptRequestCount: scripts.length,
        scriptTransferBytes: totalTransferSize(scripts),
        stylesheetRequestCount: styles.length,
        stylesheetTransferBytes: totalTransferSize(styles),
      };
    });
    runs.push({
      run,
      failedResponses,
      ...measurement,
    });
    await context.close();
  }

  await writeFile(
    path.join(evidenceDirectory, `${captureLabel}-performance.json`),
    `${JSON.stringify({
      browser: 'Playwright Chromium',
      capturedAt: new Date().toISOString(),
      reducedMotion: 'no-preference',
      route: '/',
      runs,
      source: captureLabel,
      viewport: { width: 390, height: 844 },
    }, null, 2)}\n`,
    'utf8',
  );
});
