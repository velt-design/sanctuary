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
        || entry.event.startsWith('project_reference_')
        || entry.event.startsWith('brief_')
      )
    ))
  ));
}

async function selectDirection(page: Page, direction: string) {
  await page.locator(`[data-project-direction="${direction}"]`).click();
  await expect(page.locator('[data-project-finder-result]'))
    .toHaveAttribute('data-project-finder-result', direction);
}

test('project finder route is protected, noindex and separate from the live homepage', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  const response = await page.goto('/home-project-finder');

  expect(response?.status()).toBe(200);
  expect(response?.headers()['x-robots-tag']).toMatch(/noindex.*nofollow/i);
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
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeVisible();
  await expect(page.getByText('Fixed-roof pergola design and build in Auckland'))
    .toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Why Sanctuary' })
    .getByRole('link', { name: /61 Google reviews/ })).toBeVisible();
  await expect(page.locator('header.site')).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await expect(page.locator('[data-project-direction]')).toHaveCount(3);
  await expect(page.locator('h1')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);

  await page.goto('/sitemap.xml');
  await expect(page.locator('body')).not.toContainText(
    `${publicOrigin}/home-project-finder`,
  );

  await page.goto('/');
  await expect(page.locator('meta[name="robots"]')).not.toHaveAttribute(
    'content',
    /noindex/i,
  );
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Custom pergolas for Auckland homes and sites.',
  })).toBeVisible();
});

test('each project direction gives one useful pathway and two governed references', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  const paths = [
    ['cover', 'Residential pergola planning', '/pergolas-auckland', ['Dairy Flat Estate', 'St Heliers Townhouse']],
    ['outdoor-room', 'A complete outdoor room', '/outdoor-rooms-auckland', ['Warkworth Outdoor Room', 'Riverhead Gable Pavilion']],
    ['bespoke', 'Bespoke pergola design', '/custom-pergolas-auckland', ['Tindalls Bay - Patio & Carport', 'Ardmore Box Carport']],
  ] as const;

  for (const [direction, heading, pathway, projectNames] of paths) {
    await page.goto('/home-project-finder');
    await selectDirection(page, direction);
    await expect(page.getByRole('heading', { level: 2, name: heading, exact: true }))
      .toBeVisible();
    await expect(page.locator('[data-project-finder-result] a').first())
      .toHaveAttribute('href', pathway);
    for (const projectName of projectNames) {
      await expect(page.getByRole('heading', { level: 3, name: projectName }))
        .toBeVisible();
    }
    await expect(page.locator('[data-selected-project]')).toHaveCount(4);
    await expectNoHorizontalOverflow(page);
  }
});

test('brief builder enforces three priorities and carries the controlled brief into contact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/home-project-finder');
  await selectDirection(page, 'outdoor-room');
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
    /project=outdoor-room&priorities=daylight%2Ceveryday-use%2Centertaining$/,
  );
  await expect(page.getByRole('heading', {
    level: 3,
    name: /A complete outdoor room for regular use, cooking and entertaining, and natural light\./,
  })).toBeVisible();

  await page.getByRole('link', { name: 'Send this brief to Sanctuary' }).click();
  await expect(page).toHaveURL(/\/contact\?.*project_direction=outdoor-room/);
  await expect(page.locator('.contact-form__context')).toContainText(
    'Starting brief: A complete outdoor room',
  );
  await expect(page.locator('.contact-form__context')).toContainText(
    'Use the space more often',
  );
  const context = JSON.parse(await page.locator(
    '#contact-form input[name="enquiryContext"]',
  ).inputValue());
  expect(context).toMatchObject({
    enquiry_type: 'residential',
    source_path: '/home-project-finder',
    source_component: 'brief_summary',
    source_experience: 'project-finder-home-v1',
    project_direction: 'outdoor-room',
    project_priorities: ['daylight', 'everyday-use', 'entertaining'],
  });
});

test('URL state is canonical, refreshable and restored by browser history', async ({
  page,
}) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/home-project-finder?project=invalid&priorities=daylight&free_text=secret');
  await expect(page).toHaveURL(/\/home-project-finder$/);
  await expect(page.getByText('secret')).toHaveCount(0);

  await page.goto('/home-project-finder?project=cover&project=bespoke');
  await expect(page).toHaveURL(/\/home-project-finder$/);

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
});

test('keyboard selection uses roving radio behavior and predictable focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setAnalyticsConsent(page, false);
  await page.goto('/home-project-finder');
  const cover = page.locator('[data-project-direction="cover"]');
  await cover.focus();
  await cover.press('ArrowDown');
  await expect(page).toHaveURL(/project=outdoor-room$/);
  await expect(page.locator('button[data-project-direction="outdoor-room"]'))
    .toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'A complete outdoor room',
    exact: true,
  }).first()).toBeFocused();

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
  await page.goto('/home-project-finder?project=cover');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('#mobile-menu')).toHaveAttribute(
    'data-mobile-menu-state',
    'open',
  );
  await page.getByRole('button', { name: 'Close menu' }).click();
  await expect(page).toHaveURL(/home-project-finder\?project=cover$/);
  await expect(page.locator('#mobile-menu')).toHaveAttribute(
    'data-mobile-menu-state',
    'closed',
  );
});

test('analytics use consent-aware closed project finder values', async ({ page }) => {
  await setAnalyticsConsent(page, false);
  await page.goto('/home-project-finder');
  await selectDirection(page, 'cover');
  await page.getByRole('button', { name: 'Refine what matters' }).click();
  await page.locator('[data-project-priority]').first().check();
  expect(await projectFinderEvents(page)).toEqual([]);

  const consented = await page.context().browser()?.newPage();
  if (!consented) throw new Error('Browser page unavailable');
  await setAnalyticsConsent(consented, true);
  await consented.goto('/home-project-finder');
  await selectDirection(consented, 'bespoke');
  await consented.getByRole('button', { name: 'Refine what matters' }).click();
  await consented.locator('[data-project-priority]').first().check();
  const events = await projectFinderEvents(consented);
  expect(events.map((event) => event.event)).toEqual(expect.arrayContaining([
    'project_finder_home_view',
    'project_direction_select',
    'project_result_view',
    'brief_builder_open',
    'brief_priority_select',
    'brief_summary_view',
  ]));
  for (const event of events) {
    expect(JSON.stringify(event)).not.toMatch(/@|email|phone|free_text|address/i);
    expect(event).toMatchObject({
      homepage_variant: 'project_finder_home_v1',
      source_path: '/home-project-finder',
    });
  }
  await consented.close();
});

test('no-JavaScript visitors receive direct project and enquiry pathways', async ({
  browser,
}: {
  browser: Browser;
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/home-project-finder');
  await expect(page.getByRole('heading', {
    level: 1,
    name: 'Outdoor spaces designed around the way you live.',
  })).toBeVisible();
  await expect(page.getByRole('heading', {
    level: 2,
    name: 'Three direct project pathways.',
  })).toBeVisible();
  await expect(page.locator('[data-project-finder-interactive]')).toBeHidden();
  await expect(page.getByRole('link', { name: 'A refined deck cover' }))
    .toHaveAttribute('href', '/pergolas-auckland');
  await expect(page.getByRole('link', { name: 'A complete outdoor room' }))
    .toHaveAttribute('href', '/outdoor-rooms-auckland');
  await expect(page.getByRole('link', { name: 'A bespoke or difficult-site solution' }))
    .toHaveAttribute('href', '/custom-pergolas-auckland');
  await context.close();
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
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/home-project-finder');
    await expectNoHorizontalOverflow(page);
    await selectDirection(page, 'outdoor-room');
    await page.getByRole('button', { name: 'Refine what matters' }).click();
    const priorities = page.locator('[data-project-priority]');
    await priorities.nth(0).check();
    await priorities.nth(1).check();
    await priorities.nth(2).check();
    await expect(page.getByRole('heading', { level: 3, name: /A complete outdoor room/ }))
      .toBeVisible();
    await expect(page.locator('[data-project-evidence]')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Send your brief' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }
});
