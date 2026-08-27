import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import {
  beginPortalJourney,
  elapsedJourneyMs,
  finishPortalJourney,
  installPortalPerformanceProbe,
  portalPerformanceBuildId,
  waitForBackgroundSettled,
  type PortalPerformanceJourney,
  type PortalPerformanceRun,
} from './support/portalPerformance';

type RouteBudget = {
  name: string;
  route: string;
  shellVisibleMsMax: number;
  contentVisibleMsMax: number;
};

type JourneyBudget = {
  name: string;
  feedbackMsMax: number;
  usefulContentMsMax: number;
  enforced: boolean;
  aggregation?: 'run' | 'p75';
  productFeedbackMsMax?: number;
};

type InteractionBudget = JourneyBudget & {
  route: string;
};

type PerfBudgets = {
  productTargets: {
    feedbackMsMax: number;
    warmTabFeedbackMsMax: number;
    cachedContentMsMax: number;
    longestTaskMsMax: number;
  };
  routes: RouteBudget[];
  warmJourneys: JourneyBudget[];
  interactions: InteractionBudget[];
};

const journeys: PortalPerformanceJourney[] = [];
const budgetPath = path.resolve(process.cwd(), 'playwright/portal.performance.budgets.json');
const budgets = JSON.parse(fs.readFileSync(budgetPath, 'utf8')) as PerfBudgets;

function routeBudget(name: string): RouteBudget {
  const found = budgets.routes.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing cold-route performance budget for ${name}`);
  return found;
}

function warmBudget(name: string): JourneyBudget {
  const found = budgets.warmJourneys.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing warm-navigation performance budget for ${name}`);
  return found;
}

function interactionBudget(name: string): InteractionBudget {
  const found = budgets.interactions.find((entry) => entry.name === name);
  if (!found) throw new Error(`Missing interaction performance budget for ${name}`);
  return found;
}

function recordJourney(journey: PortalPerformanceJourney) {
  journeys.push(journey);
}

function assertRegressionBudget(journey: PortalPerformanceJourney, budget: JourneyBudget) {
  if (!budget.enforced || budget.aggregation === 'p75') return;
  expect(
    journey.feedbackMs,
    `${journey.name} feedback ${journey.feedbackMs}ms exceeded ${budget.feedbackMsMax}ms`,
  ).toBeLessThanOrEqual(budget.feedbackMsMax);
  expect(
    journey.usefulContentMs,
    `${journey.name} useful content ${journey.usefulContentMs}ms exceeded ${budget.usefulContentMsMax}ms`,
  ).toBeLessThanOrEqual(budget.usefulContentMsMax);
}

async function measureColdRoute(page: Page, name: string, ready: () => Locator) {
  const budget = routeBudget(name);
  const probe = await beginPortalJourney(page, { cold: true });

  await page.goto(budget.route);
  await expect(
    page.locator('[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]').first(),
  ).toBeVisible({ timeout: 60_000 });
  const feedbackMs = elapsedJourneyMs(probe);
  await expect(ready()).toBeVisible({ timeout: 60_000 });
  const usefulContentMs = elapsedJourneyMs(probe);
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);

  const regressionBudgetMet = feedbackMs <= budget.shellVisibleMsMax && usefulContentMs <= budget.contentVisibleMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: 'cold-route',
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet: feedbackMs <= budgets.productTargets.feedbackMsMax,
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);

  expect(
    feedbackMs,
    `${budget.route} shell visible ${feedbackMs}ms exceeded ${budget.shellVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.shellVisibleMsMax);
  expect(
    usefulContentMs,
    `${budget.route} content visible ${usefulContentMs}ms exceeded ${budget.contentVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.contentVisibleMsMax);
}

async function discoverFirstProjectDetailRoute(browser: Browser, authenticatedPage: Page): Promise<string> {
  const storageState = await authenticatedPage.context().storageState();
  const discoveryContext = await browser.newContext({ storageState });
  try {
    const discoveryPage = await discoveryContext.newPage();
    await discoveryPage.goto('/staff/projects');
    const openLink = await firstProjectOpenLink(discoveryPage);
    const href = await openLink.getAttribute('href');
    expect(href, 'The authenticated performance account needs an active project for the cold detail journey.').toBeTruthy();
    const segments = new URL(String(href), discoveryPage.url()).pathname.split('/').filter(Boolean);
    const projectId = segments.at(-1);
    expect(projectId, 'The authenticated performance account needs an active project for the cold detail journey.').toBeTruthy();
    return `/staff/projects/${encodeURIComponent(String(projectId))}`;
  } finally {
    await discoveryContext.close();
  }
}

async function discoverGeneratedJobPackProjectRoute(): Promise<string> {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  expect(supabaseUrl, 'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required to discover conditional Job Packs coverage.').toBeTruthy();
  expect(serviceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required to discover conditional Job Packs coverage.').toBeTruthy();

  const endpoint = new URL('/rest/v1/job_pack_generations', String(supabaseUrl));
  endpoint.searchParams.set('select', 'project_id');
  endpoint.searchParams.set('order', 'created_at.desc');
  endpoint.searchParams.set('limit', '1');
  const response = await fetch(endpoint, {
    headers: {
      apikey: String(serviceRoleKey),
      authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  expect(response.ok, `Job Packs performance prerequisite query failed with ${response.status}.`).toBe(true);
  const rows = await response.json() as Array<{ project_id?: unknown }>;
  const projectId = typeof rows[0]?.project_id === 'string' ? rows[0].project_id : '';
  expect(projectId, 'The authenticated performance database needs at least one generated job pack.').toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  return `/staff/projects/proj_${projectId}`;
}

async function measureColdProjectDetail(page: Page, route: string) {
  const budget = routeBudget('project-detail-cold');
  const probe = await beginPortalJourney(page, { cold: true });

  await page.goto(route);
  await expect(
    page.locator('[data-portal-sidebar-rail="true"], [data-portal-sidebar-panel="true"]').first(),
  ).toBeVisible({ timeout: 60_000 });
  const feedbackMs = elapsedJourneyMs(probe);
  await expect(page.locator('[data-project-shell-ready="true"]')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible({ timeout: 60_000 });
  const usefulContentMs = elapsedJourneyMs(probe);
  await expect(page.locator('[data-project-background-ready="true"]')).toBeVisible({ timeout: 60_000 });
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);

  const regressionBudgetMet = feedbackMs <= budget.shellVisibleMsMax && usefulContentMs <= budget.contentVisibleMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name: budget.name,
    kind: 'cold-route',
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet: feedbackMs <= budgets.productTargets.feedbackMsMax,
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);

  expect(feedbackMs, `${budget.route} shell visible ${feedbackMs}ms exceeded ${budget.shellVisibleMsMax}ms`).toBeLessThanOrEqual(
    budget.shellVisibleMsMax,
  );
  expect(
    usefulContentMs,
    `${budget.route} content visible ${usefulContentMs}ms exceeded ${budget.contentVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.contentVisibleMsMax);
}

async function measureWarmJourney(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  feedbackReady: () => Promise<unknown>,
  usefulContentReady: () => Promise<unknown>,
  backgroundReady?: () => Promise<unknown>,
) {
  const budget = warmBudget(name);
  const probe = await beginPortalJourney(page);
  await action();
  await feedbackReady();
  const feedbackMs = elapsedJourneyMs(probe);
  await usefulContentReady();
  const usefulContentMs = elapsedJourneyMs(probe);
  await backgroundReady?.();
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  const regressionBudgetMet =
    feedbackMs <= budget.feedbackMsMax && usefulContentMs <= budget.usefulContentMsMax;
  const productFeedbackMsMax = budget.productFeedbackMsMax ?? budgets.productTargets.feedbackMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: 'warm-navigation',
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet:
      feedbackMs <= productFeedbackMsMax &&
      usefulContentMs <= budgets.productTargets.cachedContentMsMax,
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);
  assertRegressionBudget(journey, budget);
}

async function measureInteraction(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  feedbackReady: () => Promise<unknown>,
  usefulContentReady: () => Promise<unknown> = feedbackReady,
) {
  const budget = interactionBudget(name);
  const probe = await beginPortalJourney(page);
  await action();
  await feedbackReady();
  const feedbackMs = elapsedJourneyMs(probe);
  await usefulContentReady();
  const usefulContentMs = elapsedJourneyMs(probe);
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  const regressionBudgetMet =
    feedbackMs <= budget.feedbackMsMax && usefulContentMs <= budget.usefulContentMsMax;
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: 'interaction',
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet:
      feedbackMs <= (budget.productFeedbackMsMax ?? budgets.productTargets.feedbackMsMax) &&
      journeyContentWithinTarget(name, usefulContentMs),
    regressionBudgetMet,
  });
  journey.productTargetMet =
    journey.productTargetMet &&
    journey.longestTaskMs <= budgets.productTargets.longestTaskMsMax &&
    !journey.blockingOverlaySeen;
  recordJourney(journey);
  assertRegressionBudget(journey, budget);
}

function journeyContentWithinTarget(name: string, usefulContentMs: number): boolean {
  if (name.startsWith('project-tab-')) {
    return usefulContentMs <= budgets.productTargets.cachedContentMsMax;
  }
  return true;
}

async function measureProjectTab(
  page: Page,
  name: string,
  tab: Locator,
  usefulContentReady: () => Promise<unknown>,
) {
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await tab.hover();
  await measureInteraction(
    page,
    name,
    () => tab.click(),
    () => expect(tab).toHaveAttribute('aria-selected', 'true'),
    usefulContentReady,
  );
}

async function firstProjectOpenLink(page: Page): Promise<Locator> {
  const projects = page.getByRole('region', { name: 'Projects list' });
  await expect(projects).toBeVisible({ timeout: 60_000 });
  const openLink = projects.getByRole('link', { name: 'Open' }).first();
  await expect(openLink).toBeVisible({ timeout: 60_000 });
  return openLink;
}

async function prepareDashboardNavigation(page: Page, parent?: 'Projects' | 'Pricebook'): Promise<void> {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
  if (!parent) return;
  const expand = page.getByRole('button', { name: `Expand ${parent}`, exact: true }).first();
  if (await expand.count()) await expand.click();
}

async function measurePortalShellNavigation(
  page: Page,
  input: {
    name: string;
    link: Locator;
    heading: string;
  },
): Promise<void> {
  await expect(input.link).toBeVisible({ timeout: 60_000 });
  await input.link.hover();
  await measureWarmJourney(
    page,
    input.name,
    () => input.link.dispatchEvent('click'),
    () => expect(
      page.locator('[data-portal-route-progress="true"], [data-portal-instant-shell]').first(),
    ).toBeVisible(),
    () => expect(page.getByRole('heading', { name: input.heading, exact: true })).toBeVisible(),
  );
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await installPortalPerformanceProbe(page);
});

test('captures cold portal route metrics', async ({ browser, page }) => {
  const projectRoute = await discoverFirstProjectDetailRoute(browser, page);
  const coldProjectContext = await browser.newContext({ storageState: await page.context().storageState() });
  try {
    const coldProjectPage = await coldProjectContext.newPage();
    await installPortalPerformanceProbe(coldProjectPage);
    await measureColdProjectDetail(coldProjectPage, projectRoute);
  } finally {
    await coldProjectContext.close();
  }

  await measureColdRoute(page, 'dashboard-cold', () =>
    page.getByRole('heading', { name: 'Dashboard', exact: true }),
  );
  await measureColdRoute(page, 'projects-cold', () =>
    page.getByRole('heading', { name: 'Projects', exact: true }),
  );
  await measureColdRoute(page, 'contacts-cold', () =>
    page.getByRole('heading', { name: 'Contacts', exact: true }),
  );
  await measureColdRoute(page, 'schedule-cold', () =>
    page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ }),
  );
});

test('captures warm navigation and project tab metrics', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
  const projectsNavLink = page.getByRole('link', { name: 'Projects', exact: true }).first();
  await projectsNavLink.hover();

  await measureWarmJourney(
    page,
    'dashboard-to-projects',
    () => projectsNavLink.dispatchEvent('click'),
    () => page.waitForURL(/\/staff\/projects(?:\?|$)/),
    async () => {
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Projects list' })).toBeVisible();
      await expect(page.locator('[data-projects-index-state]')).toBeVisible();
    },
    () => expect(page.locator('[data-projects-index-background-ready="true"]')).toBeVisible({ timeout: 60_000 }),
  );

  const firstOpen = await firstProjectOpenLink(page);
  await firstOpen.hover();
  await measureWarmJourney(
    page,
    'projects-to-project',
    () => firstOpen.dispatchEvent('click'),
    () => page.waitForURL(/\/staff\/projects\/[^/?]+(?:\?|$)/),
    async () => {
      await expect(page.locator('[data-project-shell-ready="true"]')).toBeVisible();
      await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible();
    },
    async () => {
      await expect(page.locator('[data-project-background-ready="true"]')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('[data-project-tab-loading]')).toHaveCount(0, { timeout: 60_000 });
      await expect(page.locator('[data-project-tab-awaiting-snapshot]')).toHaveCount(0, { timeout: 60_000 });
    },
  );

  await measureWarmJourney(
    page,
    'project-back-to-projects',
    () => page.goBack(),
    () => page.waitForURL(/\/projects(?:\?|$)/),
    () => expect(page.getByRole('region', { name: 'Projects list' })).toBeVisible(),
  );

  const reopen = await firstProjectOpenLink(page);
  await reopen.hover();
  await reopen.click();
  await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible({ timeout: 60_000 });

  const commercialTab = page.getByRole('tab', { name: 'Commercial', exact: true });
  await measureProjectTab(
    page,
    'project-tab-commercial-estimates',
    commercialTab,
    async () => {
      await expect(page.locator('[data-project-tab-body="estimates"]')).toBeVisible();
      await expect(
        page.locator('[data-estimates-view="list"], [data-project-tab-loading="commercial"]').first(),
      ).toBeVisible();
    },
  );

  const quotesTab = page.getByRole('tab', { name: 'Quotes', exact: true });
  await measureProjectTab(
    page,
    'project-tab-commercial-quotes',
    quotesTab,
    async () => {
      await expect(page.locator('[data-project-tab-body="quotes"]')).toBeVisible();
      await expect(
        page.locator('[data-project-commercial-view="quotes"], [data-project-tab-loading="quotes"]').first(),
      ).toBeVisible();
    },
  );

  const invoicesTab = page.getByRole('tab', { name: 'Invoices', exact: true });
  await measureProjectTab(
    page,
    'project-tab-commercial-invoices',
    invoicesTab,
    async () => {
      await expect(page.locator('[data-project-commercial-view="invoices"]')).toBeVisible();
    },
  );

  const overviewTab = page.getByRole('tab', { name: 'Overview', exact: true });
  await measureProjectTab(
    page,
    'project-tab-overview',
    overviewTab,
    async () => {
      await expect(page.locator('[data-project-tab-body="activity"]')).toBeVisible();
      await expect(page.locator('[data-project-overview="true"]')).toBeVisible();
    },
  );

  let jobPacksTab = page.getByRole('tab', { name: 'Job Packs', exact: true });
  if (await jobPacksTab.count() === 0) {
    await page.goto(await discoverGeneratedJobPackProjectRoute());
    await expect(page.locator('[data-project-shell-ready="true"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('navigation', { name: 'Project sections' })).toBeVisible({ timeout: 60_000 });
    jobPacksTab = page.getByRole('tab', { name: 'Job Packs', exact: true });
  }
  await expect(
    jobPacksTab,
    'The authenticated performance project needs generated job packs so the conditional current tab is measured.',
  ).toBeVisible({ timeout: 60_000 });
  await measureProjectTab(
    page,
    'project-tab-job-packs',
    jobPacksTab,
    async () => {
      await expect(page.locator('[data-project-tab-body="job-packs"]')).toBeVisible();
      await expect(
        page.locator('[data-project-tab-loading="job-packs"], [data-project-tab-body="job-packs"] h3').first(),
      ).toBeVisible();
    },
  );
});

test('captures warm Contacts navigation', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
  const contactsNavLink = page.getByRole('link', { name: 'Contacts', exact: true }).first();
  await contactsNavLink.hover();

  await measureWarmJourney(
    page,
    'dashboard-to-contacts',
    () => contactsNavLink.dispatchEvent('click'),
    () => page.waitForURL(/\/staff\/contacts(?:\?|$)/),
    async () => {
      await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Search contacts' })).toBeVisible();
      await expect(page.getByRole('region', { name: 'Contacts list' })).toBeVisible();
      await expect(page.locator('[data-contacts-index-state]')).toBeVisible();
    },
    () => expect(page.locator('[data-contacts-index-background-ready="true"]')).toBeVisible({ timeout: 60_000 }),
  );
});

test('captures warm navigation to the remaining instant-shell routes', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/staff/projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible({ timeout: 60_000 });
  await measurePortalShellNavigation(page, {
    name: 'projects-to-dashboard',
    link: page.getByRole('link', { name: 'Dashboard', exact: true }).first(),
    heading: 'Dashboard',
  });

  await prepareDashboardNavigation(page);
  await measurePortalShellNavigation(page, {
    name: 'dashboard-to-schedule',
    link: page.getByRole('link', { name: 'Schedule', exact: true }).first(),
    heading: 'Schedule',
  });

  await prepareDashboardNavigation(page, 'Projects');
  await measurePortalShellNavigation(page, {
    name: 'dashboard-to-work-queue',
    link: page.getByRole('link', { name: 'Work Queue', exact: true }).first(),
    heading: 'Work Queue',
  });

  await prepareDashboardNavigation(page, 'Projects');
  await measurePortalShellNavigation(page, {
    name: 'dashboard-to-design-list',
    link: page.getByRole('link', { name: 'Drafting Queue', exact: true }).first(),
    heading: 'Drafting Queue',
  });

  await prepareDashboardNavigation(page, 'Projects');
  await measurePortalShellNavigation(page, {
    name: 'dashboard-to-running-jobs',
    link: page.getByRole('link', { name: 'Running Jobs', exact: true }).first(),
    heading: 'Running Jobs',
  });

});

test('captures schedule and calculator interaction metrics', async ({ page }) => {
  await page.goto('/staff/schedule');
  const toggle = page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ });
  await expect(toggle).toBeVisible({ timeout: 60_000 });
  const initialExpanded = await toggle.getAttribute('aria-expanded');
  await measureInteraction(
    page,
    'schedule-unscheduled-panel-toggle',
    () => toggle.click(),
    () => expect(toggle).toHaveAttribute('aria-expanded', initialExpanded === 'true' ? 'false' : 'true'),
  );

  await page.goto('/staff/calculator');
  await expect(page.getByRole('heading', { name: 'Calculator', exact: true })).toBeVisible({ timeout: 60_000 });
  const roofLength = page.getByLabel('Roof Length (m)', { exact: true }).first();
  await expect(roofLength).toBeVisible({ timeout: 60_000 });
  const original = Number(await roofLength.inputValue()) || 6;
  const next = String(Number((original + 0.01).toFixed(2)));
  await measureInteraction(
    page,
    'calculator-input-current-result',
    () => roofLength.fill(next),
    () => expect(roofLength).toHaveValue(next),
    () => expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 }),
  );
});

test.afterAll(async () => {
  const artifactPath = process.env.PORTAL_PERF_ARTIFACT?.trim() || 'artifacts/portal-route-timings.json';
  const payload: PortalPerformanceRun = {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    buildId: portalPerformanceBuildId(),
    journeys,
  };
  await fs.promises.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.promises.writeFile(artifactPath, JSON.stringify(payload, null, 2), 'utf8');
});
