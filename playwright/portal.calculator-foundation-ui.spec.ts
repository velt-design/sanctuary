import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';
import { loadPortalScenarioState } from './support/portalScenarioRegistry';

const scenario = loadPortalScenarioState().scenarios['calculator-multi-module'];
if (!scenario) throw new Error('Calculator browser scenario is not registered.');
const route = `/staff/calculator?projectId=${encodeURIComponent(String(scenario.projectId))}&editEstimateId=${encodeURIComponent(String(scenario.estimateId))}`;
const evidenceDir = path.resolve(process.cwd(), 'artifacts/ui-foundation-calculator');
fs.mkdirSync(evidenceDir, { recursive: true });
const evidenceByPage = new WeakMap<Page, PortalBrowserEvidence>();

const viewports = [
  { name: '1440x1000', width: 1440, height: 1000 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1024x900', width: 1024, height: 900 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
] as const;

test.afterEach(async ({ page }, testInfo) => {
  const evidence = evidenceByPage.get(page);
  if (evidence) await attachPortalBrowserEvidence(testInfo, page, evidence, { routeId: 'calculator-foundation-ui', label: testInfo.title });
});

async function openCalculator(page: Page) {
  await page.goto('about:blank');
  await page.goto(route);
  await expect(page.locator('[data-ui-foundation-consumer="calculator"]:visible')).toHaveCount(1, { timeout: 60_000 });
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
}

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

async function expectNoLegacyRoundedSurfaces(root: Locator) {
  const offenders = await root.locator('*:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const style = getComputedStyle(element);
    const radius = Number.parseFloat(style.borderRadius);
    const rect = element.getBoundingClientRect();
    const isSmallCircle = Math.abs(rect.width - rect.height) < 1 && rect.width <= 24;
    const className = typeof element.className === 'string' ? element.className : '';
    const isSemanticBadge = element.matches('[data-ui-status-badge], [data-ui-geometry-status]')
      || className.includes('modulePlanSource')
      || className.includes('modulePlanConsistency');
    if (!Number.isFinite(radius) || radius <= 4 || isSmallCircle || isSemanticBadge || element.tagName.toLowerCase() === 'svg') return [];
    return [{ tag: element.tagName, className: element.className, radius: style.borderRadius }];
  }).slice(0, 20));
  expect(offenders).toEqual([]);
}

test('Calculator foundation presentation is responsive and non-mutating', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));
  const evidence = installPortalBrowserEvidence(page);
  evidenceByPage.set(page, evidence);

  await page.setViewportSize({ width: viewports[0].width, height: viewports[0].height });
  await openCalculator(page);
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expect(page.locator('[data-calculator-command-bar]')).toBeVisible();
    await expect(page.locator('[aria-label="Pergolas and modules"]:visible, [data-calculator-module-launcher]:visible').first()).toBeVisible();
    await expect(page.getByRole('region', { name: /Pricing preview|Current customer price/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeVisible();
    await expectNoDocumentOverflow(page);
    await expectNoLegacyRoundedSurfaces(page.locator('[data-ui-foundation-consumer="calculator"]:visible'));
    await capturePortalEvidenceScreenshot(page, {
      path: path.join(evidenceDir, `calculator-${viewport.name}.png`),
      fullPage: viewport.width < 1120,
    });
  }

  await page.setViewportSize({ width: 720, height: 500 });
  await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
  await expectNoDocumentOverflow(page);
  await capturePortalEvidenceScreenshot(page, { path: path.join(evidenceDir, 'calculator-720x500-zoom-200.png'), fullPage: true });
  await page.evaluate(() => { document.documentElement.style.zoom = ''; });

  await page.setViewportSize({ width: 390, height: 844 });
  const targets = await page.locator('[data-calculator-command-bar] button:visible').evaluateAll((elements) =>
    elements.map((element) => ({ label: element.textContent?.trim(), height: element.getBoundingClientRect().height })),
  );
  expect(targets.filter((target) => target.label && target.height < 43)).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await page.locator('[data-calculator-command-bar]').evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(motion.split(',').every((duration) => duration.trim() === '0s')).toBe(true);

  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});
