import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  beginPortalJourney,
  elapsedJourneyMs,
  finishPortalJourney,
  installPortalPerformanceProbe,
  portalPerformanceBuildId,
  type PortalPerformanceJourney,
  type PortalPerformanceRun,
} from './support/portalPerformance';

const FIXTURE_PATH = '/qa/projects-index-mutation-fixture';
const DETAILS_API_PATTERN = '**/api/projects/fixture-project/details';
const journeys: PortalPerformanceJourney[] = [];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.beforeEach(async ({ page }) => {
  await installPortalPerformanceProbe(page);
});

test('records immediate project feedback separately from deliberately slow persistence', async ({ page }) => {
  await page.route(DETAILS_API_PATTERN, async (route) => {
    await delay(750);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto(FIXTURE_PATH);
  await expect(page.locator('[data-project-mutation-fixture="ready"]')).toBeVisible();

  await page.getByRole('button', { name: /Fixture Project/ }).click();
  await page.getByLabel('Project name').fill('Instant Fixture Project');

  const response = page.waitForResponse(
    (candidate) => candidate.url().includes('/api/projects/fixture-project/details') && candidate.status() === 200,
  );
  const probe = await beginPortalJourney(page);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('[data-fixture-project-name="true"]')).toHaveText('Instant Fixture Project');
  await expect(page.locator('[data-fixture-project-saving="true"]')).toBeVisible();
  const feedbackMs = elapsedJourneyMs(probe);
  const usefulContentMs = feedbackMs;

  await response;
  await expect(page.locator('[data-fixture-project-saving="true"]')).toBeHidden();
  const backgroundSettledMs = elapsedJourneyMs(probe);
  const journey = await finishPortalJourney(page, probe, {
    name: 'project-index-inline-edit',
    kind: 'interaction',
    feedbackMs,
    usefulContentMs,
    backgroundSettledMs,
    productTargetMet: feedbackMs <= 100 && usefulContentMs <= 100,
    regressionBudgetMet: feedbackMs <= 150 && usefulContentMs <= 250,
  });
  journey.productTargetMet =
    journey.productTargetMet && journey.longestTaskMs <= 50 && !journey.blockingOverlaySeen;
  journey.regressionBudgetMet =
    journey.regressionBudgetMet && journey.longestTaskMs <= 50 && !journey.blockingOverlaySeen;
  journeys.push(journey);

  expect(journey.feedbackMs).toBeLessThanOrEqual(100);
  expect(journey.backgroundSettledMs).toBeGreaterThan(600);
  expect(journey.backgroundSettledMs).toBeGreaterThan(journey.usefulContentMs);
  expect(journey.longestTaskMs).toBeLessThanOrEqual(50);
  expect(journey.blockingOverlaySeen).toBe(false);
});

test('rolls the visible name back when background persistence rejects the change', async ({ page }) => {
  await page.route(DETAILS_API_PATTERN, async (route) => {
    await delay(300);
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Fixture persistence failed.' }),
    });
  });

  await page.goto(FIXTURE_PATH);
  await page.getByRole('button', { name: /Fixture Project/ }).click();
  await page.getByLabel('Project name').fill('Temporary Fixture Name');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.locator('[data-fixture-project-name="true"]')).toHaveText('Temporary Fixture Name');
  await expect(page.locator('[data-fixture-project-saving="true"]')).toBeVisible();
  await expect(page.locator('[data-fixture-project-name="true"]')).toHaveText('Fixture Project');
  await expect(page.getByRole('status')).toContainText('Fixture persistence failed.');
  await expect(page.locator('[data-fixture-project-saving="true"]')).toBeHidden();
});

test.afterAll(async () => {
  const artifactPath =
    process.env.PORTAL_MUTATION_PERF_ARTIFACT?.trim() ||
    'artifacts/portal-project-mutation-performance.json';
  const payload: PortalPerformanceRun = {
    schemaVersion: 2,
    capturedAt: new Date().toISOString(),
    buildId: portalPerformanceBuildId(),
    journeys,
  };
  await fs.mkdir(path.dirname(artifactPath), { recursive: true });
  await fs.writeFile(artifactPath, JSON.stringify(payload, null, 2), 'utf8');
});
