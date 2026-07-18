import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
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
  if (!budget.enforced) return;
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

async function measureWarmJourney(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  feedbackReady: () => Promise<unknown>,
  usefulContentReady: () => Promise<unknown>,
) {
  const budget = warmBudget(name);
  const probe = await beginPortalJourney(page);
  await action();
  await feedbackReady();
  const feedbackMs = elapsedJourneyMs(probe);
  await usefulContentReady();
  const usefulContentMs = elapsedJourneyMs(probe);
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
  if (name === 'project-tab-details') {
    return usefulContentMs <= budgets.productTargets.cachedContentMsMax;
  }
  return true;
}

async function firstProjectOpenLink(page: Page): Promise<Locator> {
  const projects = page.getByRole('region', { name: 'Projects list' });
  await expect(projects).toBeVisible({ timeout: 60_000 });
  const openLink = projects.getByRole('link', { name: 'Open' }).first();
  await expect(openLink).toBeVisible({ timeout: 60_000 });
  return openLink;
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await installPortalPerformanceProbe(page);
});

test('captures cold portal route metrics', async ({ page }) => {
  await measureColdRoute(page, 'dashboard-cold', () => page.getByRole('heading', { name: 'Dashboard' }));
  await measureColdRoute(page, 'projects-cold', () =>
    page.getByRole('heading', { name: 'Projects', exact: true }),
  );
  await measureColdRoute(page, 'contacts-cold', () => page.getByRole('heading', { name: 'Contacts' }));
  await measureColdRoute(page, 'schedule-cold', () =>
    page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ }),
  );
});

test('captures warm navigation and project tab metrics', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible({ timeout: 60_000 });

  await measureWarmJourney(
    page,
    'dashboard-to-projects',
    () => page.getByRole('link', { name: 'Projects', exact: true }).first().click(),
    () => page.waitForURL(/\/staff\/projects(?:\?|$)/),
    () => expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible(),
  );

  const firstOpen = await firstProjectOpenLink(page);
  await firstOpen.hover();
  await measureWarmJourney(
    page,
    'projects-to-project',
    () => firstOpen.click(),
    () => page.waitForURL(/\/staff\/projects\/[^/?]+(?:\?|$)/),
    () => expect(page.getByRole('region', { name: 'Project tabs' })).toBeVisible(),
  );

  await measureWarmJourney(
    page,
    'project-back-to-projects',
    () => page.goBack(),
    () => page.waitForURL(/\/staff\/projects(?:\?|$)/),
    () => expect(page.getByRole('region', { name: 'Projects list' })).toBeVisible(),
  );

  const reopen = await firstProjectOpenLink(page);
  await reopen.hover();
  await reopen.click();
  await expect(page.getByRole('region', { name: 'Project tabs' })).toBeVisible({ timeout: 60_000 });

  const detailsTab = page.getByRole('tab', { name: 'Details', exact: true });
  await detailsTab.hover();
  await measureInteraction(
    page,
    'project-tab-details',
    () => detailsTab.click(),
    () => expect(detailsTab).toHaveAttribute('aria-selected', 'true'),
    () => expect(page.locator('[data-project-tab-body="details"]')).toBeVisible(),
  );
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
