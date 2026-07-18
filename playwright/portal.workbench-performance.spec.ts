import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
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
import { openWorkbenchFixture, selectRailObject, switchWorkbenchMode } from './support/workbenchFixture';

const FIXTURE = 'multi-house-u-two-pergola';
const journeys: PortalPerformanceJourney[] = [];

async function measureWorkbenchInteraction(
  page: Page,
  name: string,
  action: () => Promise<unknown>,
  feedbackReady: () => Promise<unknown>,
  usefulReady: () => Promise<unknown>,
) {
  const probe = await beginPortalJourney(page);
  await action();
  await feedbackReady();
  const feedbackMs = elapsedJourneyMs(probe);
  await usefulReady();
  const usefulContentMs = elapsedJourneyMs(probe);
  const backgroundSettledMs = await waitForBackgroundSettled(page, probe);
  const journey = await finishPortalJourney(page, probe, {
    name,
    kind: 'interaction',
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet: feedbackMs <= 100 && usefulContentMs <= 500,
    regressionBudgetMet: true,
  });
  journey.productTargetMet =
    journey.productTargetMet && journey.longestTaskMs <= 50 && !journey.blockingOverlaySeen;
  journeys.push(journey);
}

async function waitForTwoAnimationFrames(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

test.beforeEach(async ({ page }) => {
  await installPortalPerformanceProbe(page);
});

test('captures workbench selection and view-switch feedback without authenticated project data', async ({ page }) => {
  await openWorkbenchFixture(page, FIXTURE);
  await switchWorkbenchMode(page, 'Plan Editor');
  await expect(page.locator('[data-plan-viewport="true"]')).toBeVisible({ timeout: 60_000 });
  await selectRailObject(page, 'pergolas', 'pergola-1');

  await measureWorkbenchInteraction(
    page,
    'workbench-object-selection',
    () => page.locator('[data-workbench-object-button="pergolas:pergola-2"]').click(),
    () => expect(page.locator('[data-active-workbench-object="pergolas:pergola-2"]')).toBeVisible(),
    async () => {
      await waitForTwoAnimationFrames(page);
      await expect(page.locator('[data-plan-viewport="true"]')).toBeVisible();
    },
  );

  const reviewTab = page.getByRole('tab', { name: '3D Review' }).first();
  await measureWorkbenchInteraction(
    page,
    'workbench-plan-to-3d',
    () => reviewTab.click(),
    () => expect(reviewTab).toHaveAttribute('aria-selected', 'true'),
    () => expect(page.locator('[data-testid="geometry-3d-viewport-diagnostics"]').first()).toHaveAttribute('data-finite-bounds', 'true'),
  );
});

test.afterAll(async () => {
  const artifactPath =
    process.env.PORTAL_WORKBENCH_PERF_ARTIFACT?.trim() ||
    'artifacts/portal-workbench-performance.json';
  const payload: PortalPerformanceRun = {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    buildId: portalPerformanceBuildId(),
    journeys,
  };
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(payload, null, 2), 'utf8');
});
