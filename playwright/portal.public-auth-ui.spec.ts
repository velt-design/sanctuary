import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';

const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-public-auth');
fs.mkdirSync(evidenceDir, { recursive: true });

const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: 'serial' });

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (!evidence) return;
  await attachPortalBrowserEvidence(testInfo, page, evidence, {
    routeId: 'public-auth-foundation-ui',
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

function expectCleanBrowserEvidence(evidence: PortalBrowserEvidence) {
  const actionableConsoleMessages = evidence.consoleMessages.filter(
    (message) => !(message.type === 'warning' && message.text.includes('was preloaded using link preload but not used')),
  );
  expect(actionableConsoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
}

test('public staff auth and access states use the responsive Foundation surface', async ({ page }) => {
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  for (const viewport of [
    { name: '1440x1000', width: 1440, height: 1000 },
    { name: '390x844', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');
    const login = page.locator('[data-ui-foundation-consumer="public-auth"]');
    await expect(login.getByRole('heading', { name: 'Staff Login' })).toBeVisible();
    await expect(login.getByLabel('Email')).toBeVisible();
    await expect(login.getByLabel('Password')).toBeVisible();
    await expect(login.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(login);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `login-${viewport.name}.png`),
      fullPage: true,
    });

    await page.goto('/access-status?state=lookup-failed&callbackUrl=%2Fdashboard');
    const access = page.locator('[data-ui-foundation-consumer="public-auth"]');
    await expect(access.getByRole('heading', { name: 'Access check unavailable' })).toBeVisible();
    await expect(access.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(access.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(access);
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `access-status-${viewport.name}.png`),
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 720, height: 500 });
  await page.goto('/login');
  const zoomRoot = page.locator('[data-ui-foundation-consumer="public-auth"]');
  await expect(zoomRoot).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, {
    path: path.join(evidenceDir, 'login-720x500-zoom-200.png'),
    fullPage: true,
  });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  const animationDurations = await zoomRoot.locator('*:visible').evaluateAll((elements) =>
    elements.flatMap((element) => getComputedStyle(element).animationDuration.split(',')),
  );
  expect(animationDurations.every((value) => value.trim() === '0s')).toBe(true);

  await page.goto('/staff/login?callbackUrl=%2Fstaff%2Fprojects');
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fstaff%2Fprojects$/);
  expectCleanBrowserEvidence(evidence);
});
