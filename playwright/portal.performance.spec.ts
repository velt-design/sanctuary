import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

type RouteBudget = {
  route: string;
  shellVisibleMsMax: number;
  contentVisibleMsMax: number;
};

type InteractionBudget = {
  route: string;
  interactionLabel: string;
  interactionMsMax: number;
};

type RouteTiming = {
  route: string;
  shellVisibleMs: number;
  contentVisibleMs: number;
  finalUrl: string;
  shellVisibleMsMax?: number;
  contentVisibleMsMax?: number;
  interactionLabel?: string;
  interactionMs?: number;
  interactionMsMax?: number;
  withinBudget: boolean;
};

type PerfBudgets = {
  routes: RouteBudget[];
  interactions: InteractionBudget[];
};

const timings: RouteTiming[] = [];
const budgetPath = path.resolve(process.cwd(), 'playwright/portal.performance.budgets.json');
const budgets = JSON.parse(await fs.readFile(budgetPath, 'utf8')) as PerfBudgets;

function getRouteBudget(route: string): RouteBudget {
  const found = budgets.routes.find((entry) => entry.route === route);
  if (!found) throw new Error(`Missing route perf budget for ${route}`);
  return found;
}

function getInteractionBudget(route: string, interactionLabel: string): InteractionBudget {
  const found = budgets.interactions.find((entry) => entry.route === route && entry.interactionLabel === interactionLabel);
  if (!found) throw new Error(`Missing interaction perf budget for ${route} (${interactionLabel})`);
  return found;
}

async function measureRoute(page: Page, route: string, ready: () => Promise<Locator>) {
  const budget = getRouteBudget(route);
  const startedAt = Date.now();

  await page.goto(route);
  await expect(page.locator('[data-portal-sidebar-rail="true"]')).toBeVisible({ timeout: 60_000 });
  const shellVisibleMs = Date.now() - startedAt;

  const target = await ready();
  await expect(target).toBeVisible({ timeout: 60_000 });
  const contentVisibleMs = Date.now() - startedAt;

  timings.push({
    route,
    shellVisibleMs,
    contentVisibleMs,
    finalUrl: page.url(),
    shellVisibleMsMax: budget.shellVisibleMsMax,
    contentVisibleMsMax: budget.contentVisibleMsMax,
    withinBudget: shellVisibleMs <= budget.shellVisibleMsMax && contentVisibleMs <= budget.contentVisibleMsMax,
  });

  expect(shellVisibleMs, `${route} shell visible ${shellVisibleMs}ms exceeded budget ${budget.shellVisibleMsMax}ms`).toBeLessThanOrEqual(
    budget.shellVisibleMsMax,
  );
  expect(
    contentVisibleMs,
    `${route} content visible ${contentVisibleMs}ms exceeded budget ${budget.contentVisibleMsMax}ms`,
  ).toBeLessThanOrEqual(budget.contentVisibleMsMax);
}

async function measureScheduleBoardInteraction(page: Page) {
  const budget = getInteractionBudget('/staff/schedule', 'unscheduled-panel-toggle');
  const toggle = page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ });
  await expect(toggle).toBeVisible({ timeout: 60_000 });

  const initialExpanded = await toggle.getAttribute('aria-expanded');
  const startedAt = Date.now();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', initialExpanded === 'true' ? 'false' : 'true');
  const interactionMs = Date.now() - startedAt;

  timings.push({
    route: '/staff/schedule',
    shellVisibleMs: 0,
    contentVisibleMs: 0,
    finalUrl: page.url(),
    shellVisibleMsMax: 0,
    contentVisibleMsMax: 0,
    interactionLabel: 'unscheduled-panel-toggle',
    interactionMs,
    interactionMsMax: budget.interactionMsMax,
    withinBudget: interactionMs <= budget.interactionMsMax,
  });

  expect(
    interactionMs,
    `/staff/schedule ${budget.interactionLabel} ${interactionMs}ms exceeded budget ${budget.interactionMsMax}ms`,
  ).toBeLessThanOrEqual(budget.interactionMsMax);
}

test.describe.configure({ mode: 'serial' });

test('captures portal route timing metrics', async ({ page }) => {
  await measureRoute(page, '/dashboard', async () => page.getByRole('heading', { name: 'Dashboard' }));
  await measureRoute(page, '/staff/projects', async () => page.getByRole('heading', { name: 'Projects' }));
  await measureRoute(page, '/staff/contacts', async () => page.getByRole('heading', { name: 'Contacts' }));
  await measureRoute(page, '/staff/schedule', async () => page.getByRole('heading', { name: 'Schedule' }));
  await measureScheduleBoardInteraction(page);
});

test.afterAll(async () => {
  const artifactPath = process.env.PORTAL_PERF_ARTIFACT?.trim() || 'artifacts/portal-route-timings.json';

  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(
    artifactPath,
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        budgets,
        routes: timings,
      },
      null,
      2,
    ),
    'utf8',
  );
});
