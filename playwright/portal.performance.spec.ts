import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';

type RouteTiming = {
  route: string;
  shellVisibleMs: number;
  contentVisibleMs: number;
  finalUrl: string;
  interactionLabel?: string;
  interactionMs?: number;
};

const timings: RouteTiming[] = [];

async function measureRoute(page: Page, route: string, ready: () => Promise<Locator>) {
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
  });
}

async function measureScheduleBoardInteraction(page: Page) {
  const toggle = page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ });
  await expect(toggle).toBeVisible({ timeout: 60_000 });

  const initialExpanded = await toggle.getAttribute('aria-expanded');
  const startedAt = Date.now();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', initialExpanded === 'true' ? 'false' : 'true');

  timings.push({
    route: '/staff/schedule',
    shellVisibleMs: 0,
    contentVisibleMs: 0,
    finalUrl: page.url(),
    interactionLabel: 'unscheduled-panel-toggle',
    interactionMs: Date.now() - startedAt,
  });
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
        routes: timings,
      },
      null,
      2,
    ),
    'utf8',
  );
});
