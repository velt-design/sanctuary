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

async function openDashboard(page: Page) {
  await page.goto('about:blank');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 60_000 });
  const root = page.locator('[data-ui-foundation-consumer="dashboard"]:visible');
  await expect(root).toBeVisible({ timeout: 60_000 });
  await expect(root).toHaveAttribute('data-dashboard-state', /fresh|refresh-failed/, { timeout: 60_000 });
  const exceptions = root.locator('[data-dashboard-project-exceptions="true"]');
  await expect(exceptions).toBeVisible({ timeout: 60_000 });
  await expect(exceptions).not.toContainText('Loading project exceptions', { timeout: 60_000 });
  return root;
}

test('Dashboard is responsive, hard-edge, and keeps read-only workflow links intact', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (route) => route.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const root = await openDashboard(page);
    await expect(root.getByRole('region', { name: 'Pipeline counts' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'Recent Activity' })).toBeVisible();
    await expect(root.getByRole('region', { name: 'Tasks' })).toBeVisible();
    await expect(root.getByText('Actions due', { exact: true })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(root);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `dashboard-${viewport.name}.png`),
      fullPage: viewport.width >= 768,
    });
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
  const tasks = reducedMotionRoot.getByRole('region', { name: 'Tasks' });
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
