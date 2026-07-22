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
const layoutReviewDir = path.resolve(process.cwd(), 'artifacts/calculator-layout-review');
fs.mkdirSync(layoutReviewDir, { recursive: true });
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

async function expectConfigurationSelectColumns(
  page: Page,
  expectedColumns: number,
  sectionId = 'connections-site',
) {
  const section = page.locator(`[data-calculator-configuration-section="${sectionId}"]`);
  const grid = section.locator('[data-calculator-field-grid]');
  await expect(grid).toBeVisible();

  const layout = await grid.evaluate((element) => ({
    columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
    selects: Array.from(element.querySelectorAll<HTMLSelectElement>('select')).map((select) => {
      const control = select.getBoundingClientRect();
      const slot = select.closest<HTMLElement>('[data-calculator-field]')?.getBoundingClientRect();
      return {
        left: Math.round(control.left),
        insideSlot: Boolean(slot && control.left >= slot.left - 1 && control.right <= slot.right + 1),
        hasLabel: Boolean(select.labels?.length || select.getAttribute('aria-label')),
      };
    }),
  }));

  expect(layout.columns).toBe(expectedColumns);
  expect(layout.selects.length).toBeGreaterThanOrEqual(expectedColumns);
  expect(layout.selects.every((select) => select.insideSlot && select.hasLabel)).toBe(true);
  const distinctControlColumns = layout.selects.reduce<number[]>((columns, select) => {
    if (!columns.some((left) => Math.abs(left - select.left) <= 4)) columns.push(select.left);
    return columns;
  }, []);
  expect(distinctControlColumns).toHaveLength(expectedColumns);
}

async function expectSpecialistSectionFullWidth(page: Page, sectionId: string) {
  const section = page.locator(`[data-calculator-configuration-section="${sectionId}"]`);
  const field = section.locator(':scope [data-calculator-field]');
  await expect(section).toBeVisible();
  await expect(field).toHaveAttribute('data-field-layout', 'full');
  const dimensions = await section.locator('[data-calculator-field-grid]').evaluate((grid) => {
    const fieldSlot = grid.querySelector<HTMLElement>('[data-calculator-field]');
    if (!fieldSlot) return null;
    const gridBox = grid.getBoundingClientRect();
    const fieldBox = fieldSlot.getBoundingClientRect();
    return {
      leftDelta: Math.abs(fieldBox.left - gridBox.left),
      rightDelta: Math.abs(fieldBox.right - gridBox.right),
      horizontalOverflow: fieldSlot.scrollWidth - fieldSlot.clientWidth,
    };
  });
  expect(dimensions).not.toBeNull();
  expect(dimensions?.leftDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  expect(dimensions?.rightDelta ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
  expect(dimensions?.horizontalOverflow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
}

async function expectConfigurationWorkspaceContained(page: Page) {
  const workspace = page.locator('[data-calculator-configuration-workspace]');
  const main = page.locator('[data-calculator-configuration-main]');
  await expect(workspace).toBeVisible();
  await expect(main).toBeVisible();
  const layout = await workspace.evaluate((element) => {
    const workspaceBox = element.getBoundingClientRect();
    const mainElement = element.querySelector<HTMLElement>('[data-calculator-configuration-main]');
    const mainBox = mainElement?.getBoundingClientRect();
    const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;
    const fieldIssues = Array.from(
      element.querySelectorAll<HTMLElement>('[data-calculator-configuration-section] [data-calculator-field]'),
    ).flatMap((field) => {
      const fieldBox = field.getBoundingClientRect();
      const gridBox = field.parentElement?.getBoundingClientRect();
      if (!gridBox) return ['missing-grid'];
      return fieldBox.left < gridBox.left - 1 || fieldBox.right > gridBox.right + 1
        ? [field.getAttribute('data-calculator-field') ?? 'unknown-field']
        : [];
    });
    return {
      columns,
      mainInsideWorkspace: Boolean(
        mainBox
        && mainBox.left >= workspaceBox.left - 1
        && mainBox.right <= workspaceBox.right + 1
      ),
      mainUsesSecondColumn: columns !== 2 || Boolean(mainBox && mainBox.left > workspaceBox.left + 200),
      fieldIssues,
    };
  });
  expect(layout.mainInsideWorkspace).toBe(true);
  expect(layout.mainUsesSecondColumn).toBe(true);
  expect(layout.fieldIssues).toEqual([]);
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

test('Calculator configuration keeps dropdowns in the intended responsive columns', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openCalculator(page);

  for (const viewport of [
    { width: 1600, height: 1000, columns: 3 },
    { width: 1440, height: 1000, columns: 2 },
    { width: 1366, height: 900, columns: 2 },
    { width: 1280, height: 800, columns: 3 },
    { width: 1024, height: 900, columns: 3 },
    { width: 768, height: 1024, columns: 2 },
    { width: 390, height: 844, columns: 1 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await expectConfigurationSelectColumns(page, viewport.columns);
    await expectSpecialistSectionFullWidth(page, 'blinds');
    await expectSpecialistSectionFullWidth(page, 'infills');
    await expectConfigurationWorkspaceContained(page);
    await expectNoDocumentOverflow(page);
    if (viewport.width === 1440) {
      await page.screenshot({
        path: path.join(layoutReviewDir, 'after-desktop-1440x1000.png'),
        fullPage: false,
      });
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Advanced', exact: true }).click();
  await expectSpecialistSectionFullWidth(page, 'flashings');
  await expectConfigurationSelectColumns(page, 2, 'overrides');
  await expectConfigurationSelectColumns(page, 2, 'house-footprint');
  await expectConfigurationWorkspaceContained(page);
  await expectNoDocumentOverflow(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await expectConfigurationSelectColumns(page, 1, 'overrides');
  await expectConfigurationSelectColumns(page, 1, 'house-footprint');
  await expectSpecialistSectionFullWidth(page, 'flashings');
  await expectConfigurationWorkspaceContained(page);
  await expectNoDocumentOverflow(page);

  await page.getByRole('button', { name: 'Basic', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expectConfigurationSelectColumns(page, 1);
  await page.screenshot({
    path: path.join(layoutReviewDir, 'after-mobile-390x844.png'),
    fullPage: false,
  });
});
