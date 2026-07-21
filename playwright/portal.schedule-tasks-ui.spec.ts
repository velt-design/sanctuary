import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-schedule-tasks');
fs.mkdirSync(evidenceDir, { recursive: true });
const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();
test.describe.configure({ mode: 'serial' });

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (evidence) {
    await attachPortalBrowserEvidence(testInfo, page, evidence, {
      routeId: 'schedule-tasks-foundation-ui',
      label: testInfo.title,
    });
  }
});

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

async function expectNoLegacyRoundedSurfaces(root: Locator) {
  const offenders = await root.locator('*:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const radius = Number.parseFloat(style.borderRadius);
    const rect = element.getBoundingClientRect();
    const isSmallCircle = Math.abs(rect.width - rect.height) < 1 && rect.width <= 24;
    if (!Number.isFinite(radius) || radius <= 4 || isSmallCircle || element.tagName.toLowerCase() === 'svg') return [];
    return [{ tag: element.tagName, className: element.className, radius: style.borderRadius }];
  }).slice(0, 20));
  expect(offenders).toEqual([]);
}

async function openSchedule(page: Page, view: 'board' | 'gantt' | 'site-visits' = 'board') {
  await page.goto('about:blank');
  await page.goto(`/staff/schedule${view === 'board' ? '' : `?view=${view}`}`);
  await expect(page.getByRole('heading', { name: 'Schedule', exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-ui-foundation-consumer="schedule"]:visible')).toHaveCount(1, { timeout: 60_000 });
  if (view === 'board') {
    await expect(page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ })).toBeVisible({ timeout: 60_000 });
  } else if (view === 'gantt') {
    await expect(page.locator('[aria-label="Gantt timeline"]')).toBeVisible({ timeout: 60_000 });
  } else {
    await expect(page.getByRole('region', { name: 'Site visits calendar' })).toBeVisible({ timeout: 60_000 });
  }
}

test('Schedule foundation presentation is responsive and non-mutating', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openSchedule(page);
    await expect(page.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Collapse unscheduled panel|Expand unscheduled panel/ })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="schedule"]:visible'));
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `schedule-board-${viewport.name}.png`),
      fullPage: viewport.width < 1120,
    });
  }

  const jobActions = page.getByRole('button', { name: 'Job actions', exact: true }).first();
  await jobActions.click();
  const firstJobAction = page.getByRole('menuitem').first();
  await firstJobAction.click();
  const actionDialog = page.getByRole('dialog').last();
  await expect(actionDialog).toBeVisible();
  await expect(actionDialog).toHaveAttribute('data-modal-panel', 'true');
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(actionDialog);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-action-dialog-390x844.png'),
  });
  await page.keyboard.press('Escape');
  await expect(actionDialog).toHaveCount(0);
  await expect(jobActions).toBeFocused();

  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSchedule(page, 'gantt');
  await expect(page.getByRole('button', { name: 'Gantt', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[aria-label="Gantt timeline"]')).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="schedule"]:visible'));
  await capturePortalEvidenceScreenshot(page, { path: path.join(evidenceDir, 'schedule-gantt-1440x1000.png') });

  for (const viewport of [viewports[0], viewports[4]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await openSchedule(page, 'site-visits');
    await expect(page.getByRole('button', { name: 'Site visits', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('region', { name: 'Site visits calendar' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="schedule"]:visible'));
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `schedule-site-visits-${viewport.name}.png`),
      fullPage: viewport.width < 1120,
    });
  }

  const slot = page.locator('main[aria-label="Site visits week calendar"] button[aria-label$="09:00"]').first();
  await slot.click();
  const slotDialog = page.getByRole('dialog', { name: 'Select site visit' });
  await expect(slotDialog).toBeVisible();
  await slotDialog.getByRole('button', { name: 'Create site visit (no project)' }).click();
  const siteVisitDialog = page.getByRole('dialog', { name: 'New site visit' });
  await expect(siteVisitDialog).toBeVisible();
  await expect(siteVisitDialog.getByText('Visit / Project', { exact: true })).toBeVisible();
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(siteVisitDialog);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-site-visit-create-390x844.png'),
  });
  await siteVisitDialog.getByRole('button', { name: 'Discard' }).click();
  await expect(siteVisitDialog).toHaveCount(0);

  await page.setViewportSize({ width: 720, height: 500 });
  await openSchedule(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'schedule-board-720x500-zoom-200.png'),
    fullPage: true,
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  await openSchedule(page);
  const headerTargets = await page.locator('header button:visible, [data-ui-foundation-consumer="schedule"] > div:first-of-type button:visible').evaluateAll((elements) =>
    elements.map((element) => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height })),
  );
  expect(headerTargets.filter((target) => target.label && target.height < 43)).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.locator('[data-ui-foundation-consumer="schedule"]').evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(motion.split(',').every((duration) => duration.trim() === '0s')).toBe(true);

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('Project tasks use canonical local-first feedback without changing task state', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  await page.goto('/staff/projects');
  const projects = page.getByRole('region', { name: 'Projects list' });
  await expect(projects).toBeVisible({ timeout: 60_000 });
  await expect(projects.getByRole('status')).toHaveCount(0, { timeout: 60_000 });
  const firstProjectHref = await projects.getByRole('link', { name: 'Open' }).first().getAttribute('href');
  expect(firstProjectHref, 'The authenticated browser account needs at least one active project.').toBeTruthy();

  for (const viewport of [viewports[0], viewports[4]]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(firstProjectHref as string);
    const tasks = page.locator('[data-ui-foundation-consumer="project-tasks"]:visible');
    await expect(tasks).toBeVisible({ timeout: 60_000 });
    await expect(tasks).toHaveAttribute('data-ui-foundation-consumer', 'project-tasks');
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(tasks);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `project-tasks-${viewport.name}.png`),
      fullPage: true,
    });
  }

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
