import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-dashboard');
fs.mkdirSync(evidenceDir, { recursive: true });

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();
const viewports = [
  { name: '1920x940', width: 1920, height: 940 },
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'dashboard-foundation-ui',
    label: testInfo.title,
  });
});

async function expectNoDocumentOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
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

async function expectRefinedOperationalHierarchy(page: Page, root: Locator, verifyDesktopChrome: boolean) {
  const pipelineHeader = root.getByRole('region', { name: 'Pipeline counts' }).locator(':scope > div').first();
  const queueHeader = root.getByRole('region', { name: 'Work Queue' }).locator(':scope > div').first();
  const tasksHeader = root.getByRole('region', { name: 'My Tasks' }).locator(':scope > div').first();
  const quickAction = root.getByRole('region', { name: 'Quick actions' }).getByRole('link').first();

  await expect(pipelineHeader).toHaveCSS('background-color', 'rgb(11, 11, 10)');
  await expect(pipelineHeader.getByRole('heading', { name: 'Pipeline' })).toHaveCSS('color', 'rgb(248, 244, 236)');
  await expect(queueHeader).toHaveCSS('background-color', 'rgb(235, 226, 215)');
  await expect(queueHeader).toHaveCSS('border-bottom-color', 'rgb(201, 194, 183)');
  await expect(queueHeader).toHaveCSS('border-bottom-width', '1px');
  await expect(queueHeader.getByRole('heading', { name: 'Work Queue' })).toHaveCSS('color', 'rgb(17, 17, 15)');
  await expect(tasksHeader).toHaveCSS('background-color', 'rgb(11, 11, 10)');
  await expect(tasksHeader.getByRole('heading', { name: 'My Tasks' })).toHaveCSS('color', 'rgb(248, 244, 236)');
  await expect(quickAction).toHaveCSS('background-color', 'rgb(11, 11, 10)');

  const pipelineEdges = await root.getByRole('region', { name: 'Pipeline counts' }).getByRole('link').evaluateAll((links) =>
    links.map((link) => getComputedStyle(link).borderBottomColor),
  );
  expect(pipelineEdges.every((colour) => colour === 'rgba(0, 0, 0, 0)')).toBe(true);

  if (verifyDesktopChrome) {
    await expect(page.locator('[data-portal-sidebar-panel="true"] > div').first()).toHaveCSS('background-color', 'rgb(11, 11, 10)');
  }
}

async function expectOperationalInteractionFeedback(root: Locator) {
  const firstPipelineStage = root.getByRole('region', { name: 'Pipeline counts' }).getByRole('link').first();
  await expect(firstPipelineStage).toHaveAttribute('href', '/staff/projects?status=new');
  await firstPipelineStage.hover();
  await expect(firstPipelineStage).toHaveCSS('border-bottom-color', 'rgb(240, 90, 0)');

  await expect(
    root.getByRole('region', { name: 'Work Queue' }).getByRole('link', { name: 'Open queue' }),
  ).toHaveAttribute('href', '/staff/projects/work-queue');
}

async function expectSingleScreenDesktopLayout(page: Page, root: Locator) {
  const [estimatesBox, queueBox, activityBox, tasksBox] = await Promise.all([
    root.getByRole('region', { name: 'Recent Estimates' }).boundingBox(),
    root.getByRole('region', { name: 'Work Queue' }).boundingBox(),
    root.getByRole('region', { name: 'Recent Activity' }).boundingBox(),
    root.getByRole('region', { name: 'My Tasks' }).boundingBox(),
  ]);

  expect(estimatesBox).not.toBeNull();
  expect(queueBox).not.toBeNull();
  expect(activityBox).not.toBeNull();
  expect(tasksBox).not.toBeNull();
  if (!estimatesBox || !queueBox || !activityBox || !tasksBox) return;

  expect(Math.abs(queueBox.y - activityBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(queueBox.y - tasksBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(queueBox.width - estimatesBox.width)).toBeLessThanOrEqual(1);
  expect(queueBox.y + queueBox.height).toBeLessThanOrEqual(estimatesBox.y + 1);
  expect(queueBox.x + queueBox.width).toBeLessThanOrEqual(activityBox.x + 1);
  expect(activityBox.x + activityBox.width).toBeLessThanOrEqual(tasksBox.x + 1);
  expect(Math.abs(estimatesBox.y + estimatesBox.height - (activityBox.y + activityBox.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(activityBox.y + activityBox.height - (tasksBox.y + tasksBox.height))).toBeLessThanOrEqual(1);

  const dimensions = await page.evaluate(() => ({
    viewportHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
  }));
  const workspaceBottom = Math.max(
    queueBox.y + queueBox.height,
    activityBox.y + activityBox.height,
    tasksBox.y + tasksBox.height,
  );
  expect(workspaceBottom).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
  expect(dimensions.documentHeight).toBeLessThanOrEqual(dimensions.viewportHeight + 1);
}

async function openDashboard(page: Page) {
  await page.goto('about:blank');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
  const root = page.locator('[data-ui-foundation-consumer="dashboard"]:visible');
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(root).toHaveAttribute('data-dashboard-state', /fresh|refresh-failed/, { timeout: 60_000 });
  await expect(root.getByRole('region', { name: 'Work Queue' })).toBeVisible({ timeout: 60_000 });
  return root;
}

test('Dashboard concept refinement is responsive and keeps operational links intact', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const root = await openDashboard(page);
    await expect(root.getByRole('region', { name: 'Pipeline counts' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'New Leads' })).toHaveCount(0);
    await expect(root.getByRole('region', { name: 'Recent Estimates' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'Work Queue' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'Recent Activity' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'My Tasks' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'Quick actions' })).toBeVisible();
    await expect(root.getByText('Project Exceptions', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Installs this week', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Upcoming Installs', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Quotes to send', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Project actions overdue', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Project actions due today', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Attention Today', { exact: true })).toHaveCount(0);
    await expect(root.getByText('Commercial Attention', { exact: true })).toHaveCount(0);
    await expect(root.getByRole('region', { name: 'Pipeline counts' }).getByRole('link')).toHaveCount(9);
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(root);
    await expectRefinedOperationalHierarchy(page, root, viewport.width >= 1280);
    if (viewport.width >= 1280) await expectSingleScreenDesktopLayout(page, root);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `dashboard-${viewport.name}.png`),
      fullPage: viewport.width >= 768,
    });
    if (viewport.name === '1920x940') await expectOperationalInteractionFeedback(root);
  }

  await page.setViewportSize({ width: 720, height: 500 });
  const zoomRoot = await openDashboard(page);
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await expectNoLegacyRoundedSurfaces(zoomRoot);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'dashboard-720x500-zoom-200.png'),
    fullPage: true,
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  const reducedMotionRoot = await openDashboard(page);
  const recentActivity = reducedMotionRoot.getByRole('region', { name: 'Recent Activity' });
  await recentActivity.scrollIntoViewIfNeeded();
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'dashboard-390x844-activity.png'),
    fullPage: false,
  });
  const tasks = reducedMotionRoot.getByRole('region', { name: 'My Tasks' });
  await tasks.scrollIntoViewIfNeeded();
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'dashboard-390x844-tasks.png'),
    fullPage: false,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const transitions = await reducedMotionRoot.locator('a:visible, button:visible').evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).transitionDuration),
  );
  expect(transitions.flatMap((value) => value.split(',')).every((value) => value.trim() === '0s')).toBe(true);

  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
