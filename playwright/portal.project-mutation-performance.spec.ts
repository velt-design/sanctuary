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
const CONTACT_DETAILS_API_PATTERN = '**/api/contacts/fixture-contact';
const PROJECT_TASKS_API_PATTERN = '**/api/projects/fixture-project/tasks';
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

test('records Project Details Done feedback separately from its local-first save', async ({ page }) => {
  await page.route(DETAILS_API_PATTERN, async (route) => {
    await delay(750);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto(FIXTURE_PATH);
  const fixture = page.locator('[data-project-details-mutation-fixture="ready"]');
  await fixture.getByRole('button', { name: 'Edit' }).click();
  await fixture.getByLabel('Project name').fill('Instant Detail Project');

  const response = page.waitForResponse(
    (candidate) => candidate.url().includes('/api/projects/fixture-project/details') && candidate.status() === 200,
  );
  const probe = await beginPortalJourney(page);
  await fixture.getByRole('button', { name: 'Done' }).click();
  await expect(fixture.getByLabel('Project name')).toBeHidden();
  await expect(fixture.getByText('Instant Detail Project', { exact: true })).toBeVisible();
  const feedbackMs = elapsedJourneyMs(probe);
  const usefulContentMs = feedbackMs;

  await response;
  await expect(fixture.getByText('Saved', { exact: true })).toBeVisible();
  const backgroundSettledMs = elapsedJourneyMs(probe);
  const journey = await finishPortalJourney(page, probe, {
    name: 'project-details-done',
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

test('records Contact Details Done feedback separately from its local-first save', async ({ page }) => {
  await page.route(CONTACT_DETAILS_API_PATTERN, async (route) => {
    await delay(750);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contact: {
          id: 'fixture-contact',
          displayName: 'Instant Fixture Contact',
          email: 'fixture@example.invalid',
          phone: '000 000 0000',
          createdAt: '2026-07-01T00:00:00.000Z',
          updatedAt: '2026-07-20T00:00:00.000Z',
        },
      }),
    });
  });

  await page.goto(FIXTURE_PATH);
  const fixture = page.locator('[data-contact-details-mutation-fixture="ready"]');
  await fixture.getByRole('button', { name: 'Edit' }).click();
  await fixture.getByLabel('Contact name').fill('Instant Fixture Contact');

  const response = page.waitForResponse(
    (candidate) => candidate.url().includes('/api/contacts/fixture-contact') && candidate.status() === 200,
  );
  const probe = await beginPortalJourney(page);
  await fixture.getByRole('button', { name: 'Done' }).click();
  await expect(fixture.getByLabel('Contact name')).toBeHidden();
  await expect(fixture.getByRole('heading', { name: 'Instant Fixture Contact' })).toBeVisible();
  const feedbackMs = elapsedJourneyMs(probe);
  const usefulContentMs = feedbackMs;

  await response;
  await expect(fixture.getByText('Saved', { exact: true })).toBeVisible();
  const backgroundSettledMs = elapsedJourneyMs(probe);
  const journey = await finishPortalJourney(page, probe, {
    name: 'contact-details-done',
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

test('records project-task feedback separately from its background save', async ({ page }) => {
  await page.route(PROJECT_TASKS_API_PATTERN, async (route) => {
    await delay(750);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, taskKey: 'order_materials', completed: true }),
    });
  });

  await page.goto(FIXTURE_PATH);
  const fixture = page.locator('[data-project-task-mutation-fixture="ready"]');
  const checkbox = fixture.getByRole('checkbox', { name: 'Order materials' });
  await checkbox.scrollIntoViewIfNeeded();
  const response = page.waitForResponse(
    (candidate) => candidate.url().includes('/api/projects/fixture-project/tasks') && candidate.status() === 200,
  );
  const probe = await beginPortalJourney(page);
  await checkbox.check();
  const feedbackMs = elapsedJourneyMs(probe);
  const usefulContentMs = feedbackMs;
  await expect(checkbox).toBeChecked();
  await expect(checkbox).toBeDisabled();

  await response;
  await expect(checkbox).toBeEnabled();
  await expect(checkbox).toBeChecked();
  const backgroundSettledMs = elapsedJourneyMs(probe);
  const journey = await finishPortalJourney(page, probe, {
    name: 'project-task-toggle',
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

test('keeps a rejected Project Details draft available after terminal rollback', async ({ page }) => {
  await page.route(DETAILS_API_PATTERN, async (route) => {
    await delay(300);
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Fixture detail save rejected.' }),
    });
  });

  await page.goto(FIXTURE_PATH);
  const fixture = page.locator('[data-project-details-mutation-fixture="ready"]');
  await fixture.getByRole('button', { name: 'Edit' }).click();
  await fixture.getByLabel('Project name').fill('Rejected Detail Project');
  await fixture.getByRole('button', { name: 'Done' }).click();

  await expect(fixture.getByText('Rejected Detail Project', { exact: true })).toBeVisible();
  await expect(fixture.getByText('Fixture Detail Project', { exact: true })).toBeVisible();
  await expect(fixture.getByRole('status')).toContainText('Fixture detail save rejected.');
  await fixture.getByRole('button', { name: 'Review changes' }).click();
  await expect(fixture.getByLabel('Project name')).toHaveValue('Rejected Detail Project');
});

test('keeps a rejected Contact Details draft available after terminal rollback', async ({ page }) => {
  await page.route(CONTACT_DETAILS_API_PATTERN, async (route) => {
    await delay(300);
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Fixture contact save rejected.' }),
    });
  });

  await page.goto(FIXTURE_PATH);
  const fixture = page.locator('[data-contact-details-mutation-fixture="ready"]');
  await fixture.getByRole('button', { name: 'Edit' }).click();
  await fixture.getByLabel('Contact name').fill('Rejected Fixture Contact');
  await fixture.getByRole('button', { name: 'Done' }).click();

  await expect(fixture.getByRole('heading', { name: 'Rejected Fixture Contact' })).toBeVisible();
  await expect(fixture.getByRole('heading', { name: 'Fixture Contact' })).toBeVisible();
  await expect(fixture.getByRole('status')).toContainText('Fixture contact save rejected.');
  await fixture.getByRole('button', { name: 'Review changes' }).click();
  await expect(fixture.getByLabel('Contact name')).toHaveValue('Rejected Fixture Contact');
});

test('rolls a rejected project task back and retries only that task', async ({ page }) => {
  let attempt = 0;
  await page.route(PROJECT_TASKS_API_PATTERN, async (route) => {
    attempt += 1;
    await delay(300);
    await route.fulfill({
      status: attempt === 1 ? 503 : 200,
      contentType: 'application/json',
      body: attempt === 1
        ? JSON.stringify({ error: 'Fixture task save rejected.' })
        : JSON.stringify({ ok: true, taskKey: 'order_materials', completed: true }),
    });
  });

  await page.goto(FIXTURE_PATH);
  const fixture = page.locator('[data-project-task-mutation-fixture="ready"]');
  const checkbox = fixture.getByRole('checkbox', { name: 'Order materials' });
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  await expect(checkbox).not.toBeChecked();
  await expect(fixture.getByRole('status')).toContainText('Fixture task save rejected.');

  const success = page.waitForResponse(
    (candidate) => candidate.url().includes('/api/projects/fixture-project/tasks') && candidate.status() === 200,
  );
  await fixture.getByRole('button', { name: 'Retry Order materials' }).click();
  await expect(checkbox).toBeChecked();
  await success;
  await expect(checkbox).toBeEnabled();
  await expect(fixture.getByText('Fixture task save rejected.')).toBeHidden();
  expect(attempt).toBe(2);
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
