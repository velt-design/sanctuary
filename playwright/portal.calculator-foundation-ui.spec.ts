import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  attachPortalBrowserEvidence,
  capturePortalEvidenceScreenshot,
  installPortalBrowserEvidence,
  type PortalBrowserEvidence,
} from './support/portalBrowserEvidence';
import { computedContrastRatio } from './support/computedContrast';
import { loadPortalScenarioState } from './support/portalScenarioRegistry';

const scenarioState = loadPortalScenarioState();
const scenario = scenarioState.scenarios['calculator-multi-module'];
const simpleScenario = scenarioState.scenarios['project-with-estimate'];
if (!scenario || !simpleScenario) throw new Error('Calculator browser scenarios are not registered.');

function calculatorRouteFor(record: { projectId?: string; estimateId?: string }): string {
  if (!record.projectId || !record.estimateId) {
    throw new Error('Calculator browser scenario is missing its project or estimate id.');
  }
  return `/staff/calculator?projectId=${encodeURIComponent(record.projectId)}&editEstimateId=${encodeURIComponent(record.estimateId)}`;
}

const route = calculatorRouteFor(scenario);
const registeredContainmentScenarios = [
  { name: 'simple', route: calculatorRouteFor(simpleScenario) },
  { name: 'complex', route },
] as const;
const projectCalculatorRoute = `/staff/projects/${encodeURIComponent(String(scenario.projectId))}?tab=estimates&estimateId=${encodeURIComponent(String(scenario.estimateId))}`;
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

async function openCalculator(page: Page, calculatorRoute = route) {
  await page.goto('about:blank');
  await page.goto(calculatorRoute);
  await expect(page.locator('[data-ui-foundation-consumer="calculator"]:visible')).toHaveCount(1, { timeout: 60_000 });
  await expect(
    page.getByText('Live', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 60_000 });
}

async function expectNoDocumentOverflow(page: Page) {
  const width = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}

async function expectOneRoundedCustomerSummary(page: Page) {
  const visibleSummaries = page.locator('[data-rounded-customer-summary]:visible');
  await expect(visibleSummaries).toHaveCount(1);
  const stackedActionsVisible = await page
    .locator('[data-calculator-stacked-result-actions]')
    .isVisible();
  await expect(visibleSummaries).toHaveAttribute(
    'data-pricing-summary-variant',
    stackedActionsVisible ? 'compact' : 'inspector',
  );
  await expect(visibleSummaries).toContainText('Customer price (rounded, inc GST)');
  await expect(visibleSummaries).toContainText('Customer price (rounded, ex GST)');
  await expect(visibleSummaries.locator('strong')).toHaveText(/^\$\d{1,3}(?:,\d{3})*$/);
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
  const workspace = page.locator('[data-calculator-configuration-workspace]:visible');
  const main = workspace.locator('[data-calculator-configuration-main]');
  await expect(workspace).toBeVisible();
  await expect(main).toBeVisible();
  const layout = await workspace.evaluate((element) => {
    const workspaceBox = element.getBoundingClientRect();
    const mainElement = element.querySelector<HTMLElement>('[data-calculator-configuration-main]');
    const mainBox = mainElement?.getBoundingClientRect();
    const columns = getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length;
    const leftColumn = element.parentElement;
    const containers = [
      { name: 'left-column', element: leftColumn },
      { name: 'workspace', element },
      { name: 'configuration-main', element: mainElement },
    ].flatMap(({ name, element: container }) =>
      container
        ? [
            {
              name,
              clientWidth: container.clientWidth,
              scrollWidth: container.scrollWidth,
            },
          ]
        : [],
    );
    const clippingAncestors: Array<{ name: string; element: HTMLElement }> = [];
    if (mainElement) {
      let ancestor: HTMLElement | null = mainElement.parentElement;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
          clippingAncestors.push({
            name: typeof ancestor.className === 'string' && ancestor.className ? ancestor.className : ancestor.tagName.toLowerCase(),
            element: ancestor,
          });
        }
        ancestor = ancestor.parentElement;
      }
    }
    const candidateSelector = ['input', 'select', 'button', 'label', '[data-calculator-field]'].join(',');
    const containmentIssues = mainElement
      ? Array.from(mainElement.querySelectorAll<HTMLElement>(candidateSelector)).flatMap((candidate) => {
          const style = getComputedStyle(candidate);
          const candidateBox = candidate.getBoundingClientRect();
          if (style.display === 'none' || style.visibility === 'hidden' || candidateBox.width <= 0 || candidateBox.height <= 0) {
            return [];
          }
          const boundaries = [{ name: 'configuration-main', element: mainElement }, ...clippingAncestors];
          return boundaries.flatMap(({ name, element: boundary }) => {
            const boundaryBox = boundary.getBoundingClientRect();
            if (candidateBox.left >= boundaryBox.left - 1 && candidateBox.right <= boundaryBox.right + 1) {
              return [];
            }
            return [
              {
                candidate: candidate.getAttribute('aria-label') ?? candidate.getAttribute('data-calculator-field') ?? candidate.textContent?.trim().slice(0, 40) ?? candidate.tagName.toLowerCase(),
                boundary: name,
                candidateLeft: Math.round(candidateBox.left),
                candidateRight: Math.round(candidateBox.right),
                boundaryLeft: Math.round(boundaryBox.left),
                boundaryRight: Math.round(boundaryBox.right),
              },
            ];
          });
        })
      : [{ candidate: 'configuration-main', boundary: 'missing' }];
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
      containers,
      containmentIssues,
      fieldIssues,
    };
  });
  expect(layout.mainInsideWorkspace).toBe(true);
  expect(layout.mainUsesSecondColumn).toBe(true);
  expect(layout.containers.every((container) => container.scrollWidth <= container.clientWidth + 1)).toBe(true);
  expect(layout.containmentIssues).toEqual([]);
  expect(layout.fieldIssues).toEqual([]);
}

async function expectConfigurationControlsReachable(page: Page) {
  const controls = page.locator(
    '[data-calculator-workspace]:visible [data-calculator-configuration-main] :is(input, select, button):visible',
  );
  const count = await controls.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (await control.isDisabled()) {
      await expect(control).toBeDisabled();
      continue;
    }
    await control.focus();
    await expect(control).toBeFocused();
    await control.click({ trial: true });
  }
}

type StickySaveGeometry = {
  scrollOwner: 'document' | 'local';
  scrollAmount: number;
  saveTop: number;
  saveBottom: number;
  chromeBottom: number;
};

async function resetCalculatorScroll(page: Page, workspace: Locator) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  });
  await workspace.evaluate((element) => {
    element.scrollTop = 0;
    element.querySelectorAll<HTMLElement>('*').forEach((descendant) => {
      if (descendant.scrollTop) descendant.scrollTop = 0;
    });
  });
}

async function waitForTwoAnimationFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function expectStickySaveUnobscuredAfterDeepScroll(page: Page, workspace: Locator): Promise<StickySaveGeometry> {
  await resetCalculatorScroll(page, workspace);
  const scroll = await workspace.evaluate((workspaceElement) => {
    const target = workspaceElement.querySelector<HTMLElement>('[data-calculator-configuration-main]');
    if (!target) throw new Error('Calculator configuration main is unavailable.');

    let ancestor: HTMLElement | null = target.parentElement;
    while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
      const style = getComputedStyle(ancestor);
      if (/^(auto|scroll|overlay)$/.test(style.overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1) {
        const nextTop = Math.min(1400, ancestor.scrollHeight - ancestor.clientHeight - 1);
        // Assign directly so the check is independent of the user's
        // scroll-behaviour motion preference.
        ancestor.scrollTop = nextTop;
        return { owner: 'local' as const, amount: ancestor.scrollTop };
      }
      ancestor = ancestor.parentElement;
    }

    const documentOwner = document.scrollingElement ?? document.documentElement;
    const nextTop = Math.min(1400, documentOwner.scrollHeight - window.innerHeight - 1);
    documentOwner.scrollTop = nextTop;
    return { owner: 'document' as const, amount: documentOwner.scrollTop };
  });
  expect(scroll.amount).toBeGreaterThan(0);
  await waitForTwoAnimationFrames(page);

  const save = workspace.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeVisible();
  const geometry = await save.evaluate((saveElement) => {
    const saveBox = saveElement.getBoundingClientRect();
    const chromeBottom = Array.from(document.querySelectorAll<HTMLElement>(['[data-portal-mobile-top-bar]', '[data-project-masthead-slot-sticky="true"]'].join(','))).reduce((bottom, element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const occupiesViewportTop = (style.position === 'fixed' || style.position === 'sticky') && style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0;
      return occupiesViewportTop ? Math.max(bottom, box.bottom) : bottom;
    }, 0);
    const centreHit = document.elementFromPoint(saveBox.left + saveBox.width / 2, saveBox.top + saveBox.height / 2);
    return {
      saveTop: saveBox.top,
      saveBottom: saveBox.bottom,
      chromeBottom,
      centreHitsSave: Boolean(centreHit && (centreHit === saveElement || saveElement.contains(centreHit))),
      viewportHeight: window.innerHeight,
    };
  });

  expect(geometry.saveTop).toBeGreaterThanOrEqual(geometry.chromeBottom - 1);
  expect(geometry.saveTop).toBeGreaterThanOrEqual(0);
  expect(geometry.saveBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.centreHitsSave).toBe(true);
  if (await save.isEnabled()) {
    await save.click({ trial: true });
    await save.focus();
    await expect(save).toBeFocused();
  } else {
    await expect(save).toBeDisabled();
  }

  return {
    scrollOwner: scroll.owner,
    scrollAmount: scroll.amount,
    saveTop: geometry.saveTop,
    saveBottom: geometry.saveBottom,
    chromeBottom: geometry.chromeBottom,
  };
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

async function expectLocatorContainedWithoutOverflow(locator: Locator) {
  const dimensions = await locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function expectFocusedControlUsable(locator: Locator) {
  await expect(locator).toBeFocused();
  await expect(locator).toBeInViewport();
  const focus = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const centreHit = document.elementFromPoint(
      box.left + box.width / 2,
      box.top + box.height / 2,
    );
    return {
      centreHitsControl: Boolean(
        centreHit && (centreHit === element || element.contains(centreHit)),
      ),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(focus.centreHitsControl).toBe(true);
  expect(focus.outlineStyle).not.toBe('none');
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(
    await computedContrastRatio(locator, {
      foregroundProperty: 'outlineColor',
      backgroundOrigin: 'parent',
    }),
  ).toBeGreaterThanOrEqual(3);
}

async function exerciseBreakdownDisclosures({
  page,
  inspector,
  tabName,
  regionName,
  groupSelector,
  rowSelector,
  sourceId,
  narrow,
}: {
  page: Page;
  inspector: Locator;
  tabName: 'Materials' | 'Labour';
  regionName: 'Materials breakdown' | 'Labour breakdown';
  groupSelector: string;
  rowSelector: string;
  sourceId: string;
  narrow: boolean;
}) {
  const tab = inspector.getByRole('tab', { name: tabName, exact: true });
  await tab.click();
  const region = inspector.getByRole('region', { name: regionName });
  await expect(region).toBeVisible();

  const groups = region.locator(groupSelector);
  const groupCount = await groups.count();
  expect(groupCount).toBeGreaterThan(1);
  await expect(groups.first()).toHaveAttribute('open', '');
  for (let index = 1; index < groupCount; index += 1) {
    await expect(groups.nth(index)).not.toHaveAttribute('open', '');
  }

  const firstSummary = groups.first().locator(':scope > summary');
  await firstSummary.focus();
  await firstSummary.press('Enter');
  await expect(groups.first()).not.toHaveAttribute('open', '');
  await firstSummary.press('Enter');
  await expect(groups.first()).toHaveAttribute('open', '');

  if (narrow) {
    const heights = await groups.locator(':scope > summary').evaluateAll((summaries) =>
      summaries.map((summary) => summary.getBoundingClientRect().height),
    );
    expect(heights.every((height) => height >= 44)).toBe(true);
  }

  const whySummary = groups.first().getByText('Why this quantity?', { exact: true }).first();
  await whySummary.click();
  const routineVisibleText = await region.evaluate((element) => (element as HTMLElement).innerText);
  expect(routineVisibleText).not.toMatch(
    /@sp\/costing|stock allocator|package-owned|engine driver|costing engine/i,
  );

  const technicalSource = groups.first().getByText('Technical source', { exact: true }).first();
  await technicalSource.click();
  await expect(groups.first().getByText(sourceId, { exact: true }).first()).toBeVisible();

  const expectedRowCount = await region.locator(rowSelector).count();
  expect(expectedRowCount).toBeGreaterThan(0);
  for (let index = 0; index < groupCount; index += 1) {
    const group = groups.nth(index);
    if ((await group.getAttribute('open')) === null) {
      await group.locator(':scope > summary').click();
    }
  }
  await expect(region.locator(`${rowSelector}:visible`)).toHaveCount(expectedRowCount);
  await expectLocatorContainedWithoutOverflow(region);
  await expectNoDocumentOverflow(page);

  await groups.first().locator(':scope > summary').click();
  await expect(groups.first()).not.toHaveAttribute('open', '');
  await inspector.getByRole('tab', { name: 'Pricing', exact: true }).click();
  await tab.click();
  await expect(groups.first()).not.toHaveAttribute('open', '');
  await expect(groups.nth(1)).toHaveAttribute('open', '');
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
    await expectOneRoundedCustomerSummary(page);
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

  expect(evidence.responseFailures).toEqual([]);
  expect(evidence.failedRequests.filter((request) => request.failureText !== 'net::ERR_ABORTED')).toEqual([]);
  expect(evidence.consoleMessages).toEqual([]);
  expect(evidence.pageErrors).toEqual([]);
});

test('registered Calculator scenarios contain every configuration control at the reviewed widths', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));

  for (const registeredScenario of registeredContainmentScenarios) {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page, registeredScenario.route);

    for (const viewport of [
      { width: 1600, height: 1000 },
      { width: 1366, height: 900 },
      { width: 1024, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await waitForTwoAnimationFrames(page);
      await expectConfigurationWorkspaceContained(page);
      await expectOneRoundedCustomerSummary(page);
      await expectNoDocumentOverflow(page);
      if (viewport.width === 1366) {
        await expectConfigurationControlsReachable(page);
      }
    }
  }
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
  await expect(
    page.getByText('Live', { exact: true }).filter({ visible: true }).first(),
  ).toBeVisible({ timeout: 60_000 });
  await page.screenshot({
    path: path.join(layoutReviewDir, 'after-mobile-390x844.png'),
    fullPage: false,
  });
});

test('Calculator material and labour disclosures remain complete and scan-friendly', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) =>
    request.fulfill({ status: 204, body: '' }),
  );

  for (const viewport of [
    { width: 1600, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openCalculator(page);
    const inspector = page.getByRole('region', { name: 'Calculator result inspector' });

    await exerciseBreakdownDisclosures({
      page,
      inspector,
      tabName: 'Materials',
      regionName: 'Materials breakdown',
      groupSelector: '[data-material-breakdown-group]',
      rowSelector: '[data-material-breakdown-row]',
      sourceId: '@sp/costing/materials-v1',
      narrow: viewport.width === 390,
    });

    await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    await exerciseBreakdownDisclosures({
      page,
      inspector,
      tabName: 'Labour',
      regionName: 'Labour breakdown',
      groupSelector: '[data-labour-breakdown-group]',
      rowSelector: '[data-labour-breakdown-row]',
      sourceId: '@sp/costing/install-actions-v1',
      narrow: viewport.width === 390,
    });
  }
});

test('Calculator command order, focus, and causal readiness remain clear when stacked', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) =>
    request.fulfill({ status: 204, body: '' }),
  );

  let delayNextCosting = false;
  let heldCosting: Promise<void> | null = null;
  let releaseCosting: (() => void) | null = null;
  await page.route('**/api/staff/costing/v1/job', async (request) => {
    if (
      delayNextCosting
      && heldCosting
      && request.request().method() === 'POST'
    ) {
      delayNextCosting = false;
      await heldCosting;
    }
    await request.continue();
  });

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await openCalculator(page);

    const commandBar = page.locator('[data-calculator-command-bar]');
    const readiness = commandBar.locator('[data-calculator-command-readiness]');
    const identityAction = commandBar.locator('[data-calculator-project-picker="enabled"]');
    const basic = commandBar.getByRole('button', { name: 'Basic', exact: true });
    const advanced = commandBar.getByRole('button', { name: 'Advanced', exact: true });
    const save = commandBar.locator('[data-calculator-command-save]');
    const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
    const pricingTab = inspector.getByRole('tab', { name: 'Pricing', exact: true });

    const order = await commandBar.evaluate((element) => {
      const selectors = [
        '[data-calculator-command-identity]',
        '[data-calculator-command-readiness]',
        '[data-calculator-command-mode]',
        '[data-calculator-command-save]',
      ];
      const nodes = selectors.map((selector) => element.querySelector<HTMLElement>(selector));
      if (nodes.some((node) => !node)) {
        return { source: false, visual: false, identityGap: Number.POSITIVE_INFINITY };
      }
      const resolved = nodes as HTMLElement[];
      const source = resolved.slice(0, -1).every(
        (node, index) =>
          Boolean(node.compareDocumentPosition(resolved[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
      const boxes = resolved.map((node) => node.getBoundingClientRect());
      const visual = boxes.slice(0, -1).every((box, index) => {
        const next = boxes[index + 1]!;
        const sameRow = box.top < next.bottom - 2 && next.top < box.bottom - 2;
        return sameRow ? box.left <= next.left + 1 : box.top < next.top;
      });
      return {
        source,
        visual,
        identityGap: boxes[1]!.top - boxes[0]!.bottom,
      };
    });
    expect(order.source).toBe(true);
    expect(order.visual).toBe(true);
    // Allow the compact draft-help line to wrap while guarding against the
    // former large blank band between identity and readiness.
    expect(order.identityGap).toBeLessThanOrEqual(32);
    const commandContainment = await commandBar.evaluate((element) => {
      const bar = element.getBoundingClientRect();
      const directChildren = Array.from(element.children).map((child) => {
        const box = child.getBoundingClientRect();
        return {
          left: box.left,
          right: box.right,
        };
      });
      return {
        nestedOverflow: element.scrollWidth - element.clientWidth,
        childrenContained: directChildren.every(
          (child) => child.left >= bar.left - 1 && child.right <= bar.right + 1,
        ),
      };
    });
    expect(commandContainment.nestedOverflow).toBeLessThanOrEqual(1);
    expect(commandContainment.childrenContained).toBe(true);
    await expect(commandBar.locator('[data-calculator-command-save]')).toHaveCount(1);

    await expect(readiness).toHaveText('Ready to save');
    expect(await computedContrastRatio(readiness)).toBeGreaterThanOrEqual(4.5);
    expect(await computedContrastRatio(basic)).toBeGreaterThanOrEqual(4.5);
    expect(await computedContrastRatio(pricingTab)).toBeGreaterThanOrEqual(4.5);

    await page.keyboard.press('Tab');
    await identityAction.focus();
    for (const [index, control] of [identityAction, basic, advanced, save].entries()) {
      await expectFocusedControlUsable(control);
      if (index < 3) await page.keyboard.press('Tab');
    }

    const issuesTab = inspector.getByRole('tab', { name: 'Issues', exact: true });
    await issuesTab.click();
    expect(await computedContrastRatio(issuesTab)).toBeGreaterThanOrEqual(4.5);
    const quoteStatus = inspector.getByRole('region', { name: 'Quote status' });

    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    const originalLength = await roofLength.inputValue();
    await roofLength.fill('0');
    await expect(readiness).toHaveText('1 input issue blocks Save');
    await expect(readiness).toHaveAttribute(
      'aria-label',
      '1 input issue blocks Save. 2 readiness checks blocked.',
    );
    await expect(save).toBeDisabled();
    expect(await computedContrastRatio(readiness)).toBeGreaterThanOrEqual(4.5);

    const inputError = page.locator('#lengthM-error');
    await expect(inputError).toBeVisible();
    expect(await computedContrastRatio(inputError)).toBeGreaterThanOrEqual(4.5);

    await expect(quoteStatus.getByText('2 readiness checks blocked', { exact: true })).toBeVisible();
    await expect(quoteStatus.locator('[data-status-item="inputs"]')).toContainText(
      '1 input issue to fix',
    );
    await expect(quoteStatus.locator('[data-status-item="engine"]')).toContainText(
      'Blocked by input issues',
    );

    await roofLength.fill(originalLength);
    await expect(readiness).toHaveText('Ready to save', { timeout: 60_000 });

    heldCosting = new Promise<void>((resolve) => {
      releaseCosting = resolve;
    });
    delayNextCosting = true;
    await roofLength.fill((Number(originalLength) + 0.1).toFixed(2));
    try {
      await expect(readiness).toHaveText(
        'Updating - Save waits for a current result',
        { timeout: 15_000 },
      );
      await expect(readiness).toHaveAttribute(
        'aria-label',
        'Updating - Save waits for a current result. 1 readiness check blocked.',
      );
      await expect(save).toBeDisabled();
      expect(await computedContrastRatio(readiness)).toBeGreaterThanOrEqual(4.5);
      await expect(quoteStatus.getByText('1 readiness check blocked', { exact: true })).toBeVisible();
      await expect(quoteStatus.locator('[data-status-item="engine"]')).toContainText(
        'Waiting for a current result',
      );
    } finally {
      releaseCosting?.();
      releaseCosting = null;
      heldCosting = null;
    }

    await expect(readiness).toHaveText('Ready to save', { timeout: 60_000 });
    await roofLength.fill(originalLength);
    await expect(readiness).toHaveText('Ready to save', { timeout: 60_000 });
    await expectNoDocumentOverflow(page);
  }
});

test('Calculator Save remains unobscured after deep scrolling in standalone and project workspaces', async ({ page }) => {
  await page.route('**/api/staff/v1/performance/web-vitals', (request) => request.fulfill({ status: 204, body: '' }));
  const observedScrollOwners = new Set<StickySaveGeometry['scrollOwner']>();

  for (const workspaceRoute of [
    { kind: 'standalone', route, workspace: 'standalone' },
    { kind: 'project', route: projectCalculatorRoute, workspace: 'project' },
  ] as const) {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('about:blank');
    await page.goto(workspaceRoute.route);
    const workspace = page.locator(`[data-calculator-workspace="${workspaceRoute.workspace}"]:visible`);
    await expect(workspace).toBeVisible({ timeout: 60_000 });
    await expect(
      workspace.getByText('Live', { exact: true }).filter({ visible: true }).first(),
    ).toBeVisible({ timeout: 60_000 });

    for (const viewport of [
      { width: 1600, height: 1000 },
      { width: 1366, height: 900 },
      { width: 1024, height: 900 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await waitForTwoAnimationFrames(page);
      const normal = await expectStickySaveUnobscuredAfterDeepScroll(page, workspace);
      observedScrollOwners.add(normal.scrollOwner);

      if (viewport.width === 768 || viewport.width === 390) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const reduced = await expectStickySaveUnobscuredAfterDeepScroll(page, workspace);
        expect(reduced.scrollOwner).toBe(normal.scrollOwner);
        // Each mode is checked independently for viewport containment and
        // clickability; sub-pixel sticky placement may differ after media
        // emulation without obscuring the action.
        expect(Math.abs(reduced.chromeBottom - normal.chromeBottom)).toBeLessThanOrEqual(1);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
      }
    }
  }

  expect(observedScrollOwners).toEqual(new Set(['local', 'document']));
});
