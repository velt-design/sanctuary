import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  beginPortalJourney,
  beginPortalVisualFeedback,
  cancelPortalVisualFeedback,
  elapsedJourneyMs,
  finishPortalJourney,
  installPortalPerformanceProbe,
  PORTAL_PROJECT_TAB_USEFUL_CONTENT_SELECTORS,
  portalPerformanceBuildId,
  portalVisualFeedbackMs,
  type PortalPerformanceJourney,
  type PortalPerformanceRun,
} from './support/portalPerformance';

const FIXTURE_PATH = '/qa/projects-index-mutation-fixture';
const DETAILS_API_PATTERN = '**/api/projects/fixture-project/details';
const CONTACT_DETAILS_API_PATTERN = '**/api/contacts/fixture-contact';
const journeys: PortalPerformanceJourney[] = [];

test('visual timing separates tab selection from content and driver delays', async ({ page }) => {
  await page.setContent('<button role="tab" aria-selected="false">Commercial</button><main></main>');
  await page.evaluate(() => document.querySelector('button')!.addEventListener('click', event => (event.currentTarget as HTMLElement).setAttribute('aria-selected', 'true')));
  const action = { selector: '[role="tab"]', text: 'Commercial' };
  await beginPortalVisualFeedback(page, { selector: '[data-ready]', state: 'visible', action });
  await beginPortalVisualFeedback(page, {
    selector: '[role="tab"]', state: 'selected', text: 'Commercial', action,
  }, 'tab-selection');
  await page.waitForTimeout(180);
  await page.getByRole('tab', { name: 'Commercial' }).click();
  const selection = await portalVisualFeedbackMs(page, 5_000, 'tab-selection');
  const driverOffset = await page.evaluate(() => { const probe = window.__portalVisualFeedbackProbes!['tab-selection']; return probe.startedAt! - probe.armedAt; });
  expect(selection).toBeLessThanOrEqual(100);
  expect(driverOffset).toBeGreaterThanOrEqual(180);
  // Deliberately delayed content and driver reads must not extend the captured selection.
  await page.waitForTimeout(200);
  await page.evaluate(() => document.querySelector('main')!.setAttribute('data-ready', 'true'));
  const content = await portalVisualFeedbackMs(page);
  expect(content - selection).toBeGreaterThanOrEqual(150);
  expect(await portalVisualFeedbackMs(page, 5_000, 'tab-selection')).toBe(selection);
  await expect(portalVisualFeedbackMs(page, 50, 'missing')).rejects.toThrow();
});

test('click captures match nested targets, isolate names and retire cancellation, replacement and timeout', async ({ page }) => {
  await page.setContent('<button id="other">Other</button><button id="done"><span>Done</span></button><main></main>');
  await page.evaluate(() => document.querySelector('#done')!.addEventListener('click', event => { if (!(event as MouseEvent).ctrlKey) document.querySelector('main')!.setAttribute('data-ready', 'true'); }));
  const condition = { selector: '[data-ready]', state: 'visible' as const, action: { selector: '#done', text: 'Done' } };
  await beginPortalVisualFeedback(page, condition, 'old');
  await cancelPortalVisualFeedback(page, 'old');
  await expect(portalVisualFeedbackMs(page, 50, 'old')).rejects.toThrow();
  await beginPortalVisualFeedback(page, condition, 'timeout');
  await expect(portalVisualFeedbackMs(page, 50, 'timeout')).rejects.toThrow();
  expect(await page.evaluate(() => window.__portalVisualFeedbackProbes?.timeout)).toBeUndefined();
  await beginPortalVisualFeedback(page, condition, 'replacement');
  const replaced = portalVisualFeedbackMs(page, 5_000, 'replacement').then(() => null, error => error);
  await page.evaluate(() => undefined);
  await beginPortalVisualFeedback(page, condition, 'replacement');
  expect((await replaced as Error).message).toContain('replaced or cancelled');
  expect(await page.evaluate(() => window.__portalVisualFeedbackProbes!.replacement.startedAt)).toBeNull();
  await beginPortalVisualFeedback(page, condition, 'current');
  await page.getByRole('button', { name: 'Other' }).click();
  expect(await page.evaluate(() => window.__portalVisualFeedbackProbes!.current.startedAt)).toBeNull();
  await page.locator('#done span').click({ modifiers: ['Control'] });
  expect(await page.evaluate(() => window.__portalVisualFeedbackProbes!.current.startedAt)).toBeNull();
  await page.locator('#done span').click();
  expect(await portalVisualFeedbackMs(page, 5_000, 'current')).toBeLessThanOrEqual(100);
  expect(await portalVisualFeedbackMs(page, 5_000, 'replacement')).toBeLessThanOrEqual(100);
  expect(await page.evaluate(() => Object.keys(window.__portalVisualFeedbackProbes!).sort())).toEqual(['current', 'replacement']);
  await beginPortalVisualFeedback(page, condition, 'preexisting');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(portalVisualFeedbackMs(page, 50, 'preexisting')).rejects.toThrow('already present');
});

test('anchors before focus blur can finish editing ahead of the button click', async ({ page }) => {
  await page.setContent('<button id="done">Done</button><input aria-label="Draft"/>');
  await page.evaluate(() => {
    const input = document.querySelector('input')!, button = document.querySelector('button')!;
    input.addEventListener('blur', () => { (window as any).blurAt = performance.now(); input.remove(); });
    button.addEventListener('click', () => { (window as any).clickAt = performance.now(); });
    input.focus();
  });
  await beginPortalVisualFeedback(page, { selector: 'input[aria-label="Draft"]', state: 'hidden', action: { selector: '#done', text: 'Done' } });
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect(await portalVisualFeedbackMs(page)).toBeLessThanOrEqual(100);
  const timing = await page.evaluate(() => ({ start: window.__portalVisualFeedbackProbes!.default.startedAt!, end: window.__portalVisualFeedbackProbes!.default.completedAt!, blur: (window as any).blurAt as number, click: (window as any).clickAt as number }));
  expect(timing.start).toBeLessThanOrEqual(timing.blur);
  expect(timing.blur).toBeLessThanOrEqual(timing.end);
  expect(timing.end).toBeLessThanOrEqual(timing.click);
});

test('anchors keyboard activation and programmatic click without accepting unrelated keys', async ({ page }) => {
  for (const activation of ['Enter', 'Space', 'programmatic']) {
    await page.setContent('<button id="done">Done</button><input aria-label="Draft"/>');
    await page.evaluate(() => document.querySelector('button')!.addEventListener('click', () => document.querySelector('input')!.remove()));
    await page.getByRole('button', { name: 'Done' }).focus();
    await beginPortalVisualFeedback(page, { selector: 'input[aria-label="Draft"]', state: 'hidden', action: { selector: '#done', text: 'Done' } });
    await page.keyboard.press('ArrowLeft');
    expect(await page.evaluate(() => window.__portalVisualFeedbackProbes!.default.startedAt)).toBeNull();
    if (activation === 'programmatic') await page.evaluate(() => (document.querySelector('button') as HTMLButtonElement).click());
    else await page.keyboard.press(activation);
    expect(await portalVisualFeedbackMs(page)).toBeLessThanOrEqual(100);
  }
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.beforeEach(async ({ page }) => {
  await installPortalPerformanceProbe(page);
});

test('captures the scoped commercial loading shell before later driver validation', async ({ page }) => {
  await page.setContent(
    '<main aria-label="Browser timing fixture" data-project-tab-body="estimates"></main>',
  );
  await beginPortalVisualFeedback(page, {
    selector: PORTAL_PROJECT_TAB_USEFUL_CONTENT_SELECTORS.estimates,
    state: 'visible',
  });
  const driverStartedAt = Date.now();

  await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const marker = document.createElement('div');
    marker.dataset.projectTabLoading = 'commercial';
    marker.textContent = 'Loading commercial in the background…';
    document.querySelector('[data-project-tab-body="estimates"]')?.appendChild(marker);
  });
  await page.waitForTimeout(700);
  await expect(page.locator(PORTAL_PROJECT_TAB_USEFUL_CONTENT_SELECTORS.estimates)).toBeVisible();

  const usefulContentMs = await portalVisualFeedbackMs(page);
  const driverElapsedMs = Date.now() - driverStartedAt;
  expect(usefulContentMs).toBeGreaterThan(0);
  expect(driverElapsedMs - usefulContentMs).toBeGreaterThan(500);
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
  await expect(page.locator('[data-fixture-project-saving="true"]')).toHaveCount(0);
  await beginPortalVisualFeedback(page, {
    selector: '[data-fixture-project-saving="true"]',
    state: 'visible',
    action: { selector: '[data-project-mutation-fixture="ready"] button', text: 'Save' },
  });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('[data-fixture-project-name="true"]')).toHaveText('Instant Fixture Project');
  await expect(page.locator('[data-fixture-project-saving="true"]')).toBeVisible();
  const feedbackMs = await portalVisualFeedbackMs(page);
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
  await expect(fixture.locator('input#projectName')).toHaveCount(1);
  await beginPortalVisualFeedback(page, {
    selector: '[data-project-details-mutation-fixture="ready"] input#projectName',
    state: 'hidden',
    action: { selector: '[data-project-details-mutation-fixture="ready"] button', text: 'Done' },
  });
  await fixture.getByRole('button', { name: 'Done' }).click();
  await expect(fixture.getByLabel('Project name')).toBeHidden();
  await expect(fixture.locator('input#projectName')).toHaveCount(0);
  await expect(fixture.getByText('Instant Detail Project', { exact: true })).toBeVisible();
  const feedbackMs = await portalVisualFeedbackMs(page);
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
  await expect(fixture.locator('input[aria-label="Contact name"]')).toHaveCount(1);
  await beginPortalVisualFeedback(page, {
    selector: '[data-contact-details-mutation-fixture="ready"] input[aria-label="Contact name"]',
    state: 'hidden',
    action: { selector: '[data-contact-details-mutation-fixture="ready"] button', text: 'Done' },
  });
  await fixture.getByRole('button', { name: 'Done' }).click();
  await expect(fixture.getByLabel('Contact name')).toBeHidden();
  await expect(fixture.locator('input[aria-label="Contact name"]')).toHaveCount(0);
  await expect(fixture.getByRole('heading', { name: 'Instant Fixture Contact' })).toBeVisible();
  const feedbackMs = await portalVisualFeedbackMs(page);
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
  await expect(fixture.getByText('Save needs attention', { exact: true })).toBeVisible();
  await expect(fixture.getByRole('alert')).toContainText('Fixture detail save rejected.');
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
  await expect(fixture.getByRole('status')).toContainText('Save needs attention');
  await fixture.getByRole('button', { name: 'Review changes' }).click();
  await expect(fixture.getByLabel('Contact name')).toHaveValue('Rejected Fixture Contact');
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
