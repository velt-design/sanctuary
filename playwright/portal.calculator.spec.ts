import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { openPortalPage, withPortalBrowserEvidence } from './support/portalAgent';
import {
  CALCULATOR_MULTI_MODULE_SCENARIO_REVISION,
  loadPortalScenarioState,
} from './support/portalScenarioRegistry';

const scenarioState = loadPortalScenarioState();
const scenario = scenarioState.scenarios['calculator-multi-module'];
if (!scenario || scenario.fixtureRevision !== CALCULATOR_MULTI_MODULE_SCENARIO_REVISION) {
  throw new Error(
    'The dedicated calculator fixture is missing or stale. Run npm run portal:calculator-ui:provision with an explicit local or staging target.',
  );
}
const projectId = scenario.projectId as string;
const estimateId = scenario.estimateId as string;
const calculatorRoute = `/staff/calculator?projectId=${encodeURIComponent(projectId)}&editEstimateId=${encodeURIComponent(estimateId)}`;
const projectCalculatorRoute = `/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(estimateId)}`;
const previewSplitStorageKey = 'sanctuary-portal:calculator:previewRightWidthPx:v2';

async function clearPreviewSplitPreference(page: Page) {
  await page.addInitScript((storageKey) => window.localStorage.removeItem(storageKey), previewSplitStorageKey);
}

async function openCalculator(page: Page) {
  await openPortalPage(page, calculatorRoute, { heading: 'Calculator' });
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText('3 modules across 2 pergolas', { exact: true }).first(),
    'The dedicated calculator fixture has drifted. Run npm run portal:calculator-ui:provision to reconcile it.',
  ).toHaveText('3 modules across 2 pergolas');
}

async function expectLocalDraftProtected(page: Page) {
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Browser draft only — use Save to update the estimate.', { exact: true })).toBeVisible();
}

async function expectStructureColumnCount(page: Page, expectedColumns: number) {
  const fieldGrid = page.locator(
    '[data-calculator-configuration-section="structure"] [data-calculator-field-grid]',
  );
  await expect(fieldGrid).toBeVisible();
  const firstRowColumnCount = await fieldGrid.locator(':scope > [data-calculator-field]').evaluateAll((elements) => {
    const boxes = elements.map((element) => element.getBoundingClientRect()).filter((box) => box.width > 0 && box.height > 0);
    const firstRowTop = Math.min(...boxes.map((box) => box.top));
    return boxes.filter((box) => Math.abs(box.top - firstRowTop) < 4).length;
  });
  expect(firstRowColumnCount).toBe(expectedColumns);
}

async function expectSmallVisualCorrections(page: Page) {
  await expect(page.locator('[data-calculator-field="roofOrientation"]')).toHaveCount(0);
  await expect(page.getByLabel('Roof orientation diagram')).toHaveCount(0);

  const blinds = page.locator('[data-calculator-configuration-section="blinds"]');
  const infills = page.locator('[data-calculator-configuration-section="infills"]');
  await expect(blinds).toBeVisible();
  await expect(infills).toBeVisible();
  await expect(blinds.locator('[data-calculator-field="blindsList"]')).toHaveCount(1);
  await expect(infills.locator('[data-calculator-field="infillsEditor"]')).toHaveCount(1);
  expect(
    await blinds.evaluate((element) =>
      element.nextElementSibling?.getAttribute('data-calculator-configuration-section'),
    ),
  ).toBe('infills');

  const pricing = page.getByRole('region', { name: 'Pricing preview' });
  await expect(pricing.locator('strong').first()).toHaveText(/^\$\d{1,3}(?:,\d{3})*$/);
  await expect(pricing.getByText(/^Customer price \(ex GST\)/)).toHaveText(
    /^Customer price \(ex GST\) \$\d{1,3}(?:,\d{3})*$/,
  );
}

async function expectVisualRefinementSurfaces(page: Page) {
  await expect(page.locator('[data-section-surface="card"]')).toHaveCount(2);
  await expect(page.locator('[data-calculator-configuration-sheet]')).toHaveCount(2);
  await expect(page.locator('[data-module-actions="compact"]')).toHaveCount(1);
  await expect(
    page.locator('[data-calculator-configuration-form] [data-field-part="helper"]'),
  ).toHaveCount(0);

  const toggleHeight = await page.locator('[data-field-part="toggle"]').first().evaluate(
    (element) => Math.round(element.getBoundingClientRect().height),
  );
  const inputHeight = await page.getByLabel('Roof material', { exact: true }).evaluate(
    (element) => Math.round(element.getBoundingClientRect().height),
  );
  expect(Math.abs(toggleHeight - inputHeight)).toBeLessThanOrEqual(1);
}

async function expectPreviewHierarchy(page: Page, expectModuleViewInViewport: boolean) {
  const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
  await expect(inspector).toBeVisible();
  await expect(inspector.getByRole('region', { name: 'Result overview' })).toBeVisible();

  const tabs = inspector.getByRole('tab');
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(['Pricing', 'Materials', 'Labour', 'Workings', 'Issues']);
  await expect(inspector.getByRole('tab', { name: 'Pricing', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(inspector.getByRole('region', { name: 'Pricing preview' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Materials', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Materials breakdown' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Labour', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Labour breakdown' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Workings', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Module views' })).toBeVisible();
  await expect(inspector.getByRole('region', { name: 'Rafter cut length workings' })).toBeVisible();
  if (expectModuleViewInViewport) {
    await expect(inspector.getByRole('region', { name: 'Module views' })).toBeInViewport();
  }

  await inspector.getByRole('tab', { name: 'Issues', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Quote status' })).toBeVisible();
  await expect(inspector.getByRole('region', { name: 'Warnings' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Pricing', exact: true }).click();
}

async function openTrustedRafterWorking(page: Page) {
  const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
  await inspector.getByRole('tab', { name: 'Workings', exact: true }).click();
  const moduleViews = inspector.getByRole('region', { name: 'Module views' });
  await moduleViews.getByRole('tab', { name: 'Section', exact: true }).click();
  await expect(moduleViews.getByRole('img', { name: 'Module section view' })).toBeVisible();

  const working = inspector.getByRole('region', { name: 'Rafter cut length workings' });
  await expect(working).toBeVisible();
  await expect(working).toHaveAttribute('data-rafter-explanation-status', 'ready');
  return { inspector, moduleViews, working };
}

async function expectDiagramAndWorkingParity(
  moduleViews: Locator,
  working: Locator,
) {
  const workingLengths = await working.locator('[data-rafter-plane]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-rafter-cut-length-mm')),
  );
  const diagramLengths = await moduleViews
    .locator('[data-rafter-dimension-source="costing"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-rafter-cut-length-mm')),
    );

  expect(workingLengths.length).toBeGreaterThan(0);
  expect(diagramLengths.length).toBeGreaterThan(0);
  expect(diagramLengths.every((value) => workingLengths.includes(value))).toBe(true);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseCurrency(value: string): number {
  return Number.parseFloat(value.replace(/[^0-9.-]/g, ''));
}

function moduleNavigatorButton(page: Page, label: string) {
  return page.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) });
}

async function withCalculatorEvidence(page: Page, testInfo: TestInfo, callback: () => Promise<void>) {
  await withPortalBrowserEvidence(
    page,
    testInfo,
    { routeId: 'calculator', scenarioId: scenario.scenarioId, phase: 'calculator-module-navigator' },
    callback,
  );
}

test.describe.configure({ mode: 'serial' });

test('calculator command bar loads a current seeded draft at 1600px', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);
    await expect(page.getByText(scenario.labels.projectName).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
    await expectLocalDraftProtected(page);
    await expectSmallVisualCorrections(page);
    await expectVisualRefinementSurfaces(page);
    await expectPreviewHierarchy(page, true);
    await expect(page.getByRole('navigation', { name: 'Pergolas and modules' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Current customer price' })).toBeHidden();
    await expect(page.locator('[data-calculator-configuration-section="context"]')).toHaveAttribute('data-section-density', 'compact');
    const previewWidth = await page.getByRole('complementary', { name: 'Preview outputs' }).evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(previewWidth).toBeGreaterThanOrEqual(479);
    expect(previewWidth).toBeLessThanOrEqual(481);
    await expectStructureColumnCount(page, 3);
    await expect(moduleNavigatorButton(page, 'Pergola 1 · Module 1')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText('Pergola 2 · Module 1', { exact: true }).first()).toBeVisible();
    const pricing = page.getByRole('region', { name: 'Pricing preview' });
    await expect(pricing.getByText('Customer price (inc GST)', { exact: true })).toBeVisible();
    await expect(pricing.getByText('1.25× internal true cost · pergola only', { exact: true })).toHaveCount(0);
    await expect(pricing.getByText('Customer quote add-ons', { exact: true })).toHaveCount(0);
    const internalDetails = pricing.locator('details', { hasText: 'Internal costing' });
    await expect(internalDetails).not.toHaveAttribute('open', '');
    await internalDetails.locator('summary').click();
    await expect(internalDetails).toHaveAttribute('open', '');

    const customerInc = parseCurrency(await pricing.locator('strong').first().innerText());
    const itemPricing = page.getByRole('region', { name: 'Price by item' });
    await expect(itemPricing.getByText('Pergola 1', { exact: true })).toBeVisible();
    await expect(itemPricing.getByText('Pergola 2', { exact: true })).toBeVisible();
    const exactItemTotal = parseCurrency(await itemPricing.locator('tfoot th').last().innerText());
    expect(customerInc).toBe(Math.round(exactItemTotal));
  });
});

test('rafter workings use one authoritative fact across module switching and retained results', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const first = await openTrustedRafterWorking(page);
    await expect(first.working).toHaveAttribute('data-result-freshness', 'current');
    await expect(first.working).toContainText('@sp/costing/engine/rafter-takeoff-v1');
    await expectDiagramAndWorkingParity(first.moduleViews, first.working);

    await page.getByRole('button', { name: /Pergola 1 .* Module 2/ }).click();
    await expect(first.working).toContainText(/Pergola 1 .* Module 2/);
    await expect(first.working).toHaveAttribute('data-result-freshness', 'current');
    await expectDiagramAndWorkingParity(first.moduleViews, first.working);

    const roofSpan = page.getByLabel(/^Roof Span/);
    const originalSpan = await roofSpan.inputValue();
    await roofSpan.fill('');
    await expect(first.working).toHaveAttribute('data-result-freshness', 'invalid');
    await expect(first.working).toContainText('may not match unsaved edits');

    await roofSpan.fill(originalSpan);
    await expect(first.working).toHaveAttribute('data-result-freshness', 'current', {
      timeout: 60_000,
    });
    await expectDiagramAndWorkingParity(first.moduleViews, first.working);
    await first.working.scrollIntoViewIfNeeded();
    await expect(first.working).toBeInViewport();
  });
});

test('real project route embeds the seeded Calculator without a project picker', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openPortalPage(page, projectCalculatorRoute, { heading: scenario.labels.projectName });
    await expect(page.locator('[data-calculator-workspace="project"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('tab', { name: 'Calculator' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-calculator-project-picker="fixed"]')).toHaveCount(0);
    await expect(page.locator('[data-calculator-project-picker="enabled"]')).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`tab=estimates.*estimateId=${encodeURIComponent(estimateId)}`));
  });
});

test('project Calculator keeps a compact command bar without horizontal overflow', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openPortalPage(page, projectCalculatorRoute, { heading: scenario.labels.projectName });
    await expect(page.locator('[data-calculator-workspace="project"]')).toBeVisible({ timeout: 60_000 });

    for (const width of [1600, 1366, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: width >= 1366 ? 1000 : 844 });
      const masthead = page.locator('[aria-label="Project summary"]');
      const commandBar = page.locator('[data-calculator-command-bar]');
      await expect(masthead).toBeVisible();
      await expect(commandBar).toBeVisible();
      await expect(page.getByLabel('Design version')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeVisible();

      const metrics = await page.evaluate(() => {
        const mastheadElement = document.querySelector<HTMLElement>('[aria-label="Project summary"]');
        const commandElement = document.querySelector<HTMLElement>('[data-calculator-command-bar]');
        const workspaceElement = document.querySelector<HTMLElement>('[data-calculator-split="true"]');
        if (!mastheadElement || !commandElement || !workspaceElement) return null;
        const commandBox = commandElement.getBoundingClientRect();
        return {
          commandHeight: Math.round(commandBox.height),
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        };
      });
      expect(metrics).not.toBeNull();
      expect(metrics?.horizontalOverflow ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(1);
      if (width >= 1366) {
        expect(metrics?.commandHeight ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(60);
      }
    }

    const designSelector = page.getByLabel('Design version');
    const currentDesignValue = await designSelector.inputValue();
    await designSelector.selectOption('new');
    await expect(page).toHaveURL(/newDesign=1/);
    await designSelector.selectOption(currentDesignValue);
    await expect(page).toHaveURL(new RegExp(`estimateId=${encodeURIComponent(estimateId)}`));

    const moreButton = page.getByRole('button', { name: 'More', exact: true });
    await moreButton.click();
    await expect(page.getByRole('menu', { name: 'Project actions' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu', { name: 'Project actions' })).toHaveCount(0);
  });
});

test('local draft survives module switching and restores after reload', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page);
    await expectLocalDraftProtected(page);

    await expect(page.getByRole('navigation', { name: 'Pergolas and modules' }).getByRole('listitem')).toHaveCount(3);
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    const firstModuleLength = '6.25';
    const secondModuleLength = '4.95';

    await roofLength.fill(firstModuleLength);
    await expectLocalDraftProtected(page);
    await moduleNavigatorButton(page, 'Pergola 1 · Module 2').click();
    await expect(roofLength).toHaveValue('4.8');
    await roofLength.fill(secondModuleLength);
    await expectLocalDraftProtected(page);

    await moduleNavigatorButton(page, 'Pergola 1 · Module 1').click();
    await expect(roofLength).toHaveValue(firstModuleLength);
    await moduleNavigatorButton(page, 'Pergola 1 · Module 2').click();
    await expect(roofLength).toHaveValue(secondModuleLength);
    await expectLocalDraftProtected(page);

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Calculator', exact: true })).toBeVisible();
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Restored unsaved work', { exact: true })).toBeVisible();
    await expect(moduleNavigatorButton(page, 'Pergola 1 · Module 2')).toHaveAttribute('aria-current', 'true');
    await expect(roofLength).toHaveValue(secondModuleLength);

    await moduleNavigatorButton(page, 'Pergola 1 · Module 1').click();
    await expect(roofLength).toHaveValue(firstModuleLength);
  });
});

test('module navigator supports fresh add, duplicate, move, and immediate draft removal', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page);
    const navigator = page.getByRole('navigation', { name: 'Pergolas and modules' });
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });

    await roofLength.fill('8.4');
    await navigator.getByRole('button', { name: 'Add module to Pergola 1', exact: true }).click();
    await expect(roofLength).toHaveValue('6');
    await expect(navigator.getByRole('listitem')).toHaveCount(4);

    await roofLength.fill('7.35');
    await navigator.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await expect(roofLength).toHaveValue('7.35');
    await expect(navigator.getByRole('listitem')).toHaveCount(5);

    await navigator.getByRole('button', { name: 'Move', exact: true }).click();
    await navigator.getByLabel('Move to pergola').selectOption('pergola-2');
    await navigator.getByRole('button', { name: 'Move module', exact: true }).click();
    await expect(moduleNavigatorButton(page, 'Pergola 2 · Module 2')).toHaveAttribute('aria-current', 'true');
    await expect(roofLength).toHaveValue('7.35');

    await navigator.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(navigator.getByRole('listitem')).toHaveCount(4);
    await expect(page.getByRole('dialog', { name: 'Remove module?' })).toHaveCount(0);
    await expectLocalDraftProtected(page);
  });
});

test('common job template applies to the active module without a confirmation modal', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page);

    await page.getByLabel('Common job template', { exact: true }).selectOption('attached_gable_acrylic');
    await page.getByRole('button', { name: 'Apply to active module', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Apply starting template?' })).toHaveCount(0);
    await expect(page.getByLabel('Pergola style', { exact: true })).toHaveValue('gable');
    await expect(page.getByLabel(/^Roof Span/)).toHaveValue('4');
    await expectLocalDraftProtected(page);
  });
});

test('editing save always shows stored versus live costing without creating a quote', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page);
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    const originalLength = await roofLength.inputValue();
    await roofLength.fill(String(Number(originalLength || '6') + 0.1));
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Save design confirmation' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Stored estimate', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Live calculator', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Cost-affecting design inputs have changed.', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Keep stored costing', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reprice and save', exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/staff/calculator'));
    await expect(page.getByText('Draft quote created locally.', { exact: false })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
});

test('calculator preview does not clip horizontally at 1366px', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);
    await expectLocalDraftProtected(page);
    await expectSmallVisualCorrections(page);
    await expectVisualRefinementSurfaces(page);
    await expectPreviewHierarchy(page, true);
    const dimensions = await page.getByRole('complementary', { name: 'Preview outputs' }).evaluate((element) => {
      const boundary = element.getBoundingClientRect().right;
      return {
        clientWidth: element.clientWidth,
        offsetWidth: element.offsetWidth,
        scrollWidth: element.scrollWidth,
        overflowing: Array.from(element.querySelectorAll<HTMLElement>('*'))
          .filter((child) => child.getBoundingClientRect().right > boundary + 2)
          .slice(0, 10)
          .map((child) => ({
            className: child.className,
            clientWidth: child.clientWidth,
            scrollWidth: child.scrollWidth,
            right: Math.round(child.getBoundingClientRect().right),
          })),
      };
    });
    expect(dimensions.overflowing).toEqual([]);
    // A stable vertical scrollbar gutter reduces clientWidth without creating horizontal clipping.
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.offsetWidth + 2);
    const previewWidth = await page.getByRole('complementary', { name: 'Preview outputs' }).evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(previewWidth).toBeGreaterThanOrEqual(439);
    expect(previewWidth).toBeLessThanOrEqual(441);
    await expect(page.getByRole('region', { name: 'Current customer price' })).toBeHidden();

    const internalDetails = page
      .getByRole('region', { name: 'Pricing preview' })
      .locator('details', { hasText: 'Internal costing' });
    await expect(internalDetails).not.toHaveAttribute('open', '');
    await internalDetails.locator('summary').click();
    const internalValues = internalDetails.locator('dd');
    await expect(internalValues).toHaveCount(7);
    const internalValuePresentation = await internalValues.evaluateAll((elements) =>
      elements.map((element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const styles = window.getComputedStyle(element);
        return {
          flexShrink: styles.flexShrink,
          lineCount: new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size,
          overflowWrap: styles.overflowWrap,
          whiteSpace: styles.whiteSpace,
          wordBreak: styles.wordBreak,
        };
      }),
    );
    expect(internalValuePresentation.every((value) => value.flexShrink === '0')).toBe(true);
    expect(internalValuePresentation.every((value) => value.overflowWrap === 'normal')).toBe(true);
    expect(internalValuePresentation.every((value) => value.whiteSpace === 'nowrap')).toBe(true);
    expect(internalValuePresentation.every((value) => value.wordBreak === 'normal')).toBe(true);
    expect(internalValuePresentation.every((value) => value.lineCount === 1)).toBe(true);

    const internalLabels = internalDetails.locator('dt');
    await expect(internalLabels).toHaveCount(7);
    const internalLabelPresentation = await internalLabels.evaluateAll((elements) =>
      elements.map((element) => {
        const styles = window.getComputedStyle(element);
        return {
          clipped: element.scrollWidth > element.clientWidth + 1,
          flexShrink: styles.flexShrink,
          whiteSpace: styles.whiteSpace,
        };
      }),
    );
    expect(internalLabelPresentation.every((label) => label.flexShrink === '1')).toBe(true);
    expect(internalLabelPresentation.every((label) => label.whiteSpace === 'normal')).toBe(true);
    expect(internalLabelPresentation.every((label) => !label.clipped)).toBe(true);

    const impact = page.getByRole('region', { name: 'Price impact' });
    const resetBox = await impact.getByRole('button', { name: 'Reset baseline', exact: true }).boundingBox();
    const impactBox = await impact.boundingBox();
    expect(resetBox?.width ?? 0).toBeLessThan((impactBox?.width ?? 0) / 2);

    const houseConnectionBox = await page.getByLabel('House connection', { exact: true }).boundingBox();
    const postConnectionBox = await page.getByLabel('Post connection', { exact: true }).boundingBox();
    expect(houseConnectionBox).not.toBeNull();
    expect(postConnectionBox).not.toBeNull();
    expect(Math.abs((houseConnectionBox?.y ?? 0) - (postConnectionBox?.y ?? 0))).toBeLessThan(4);
    expect(postConnectionBox?.x ?? 0).toBeGreaterThan((houseConnectionBox?.x ?? 0) + (houseConnectionBox?.width ?? 0));
    await expectStructureColumnCount(page, 2);

    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Save design confirmation' });
    const dialogDimensions = await dialog.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dialogDimensions.scrollWidth).toBeLessThanOrEqual(dialogDimensions.clientWidth + 1);
  });
});

for (const width of [1024, 768]) {
  test(`calculator uses reachable page scrolling at ${width}px`, async ({ page }, testInfo) => {
    await withCalculatorEvidence(page, testInfo, async () => {
      await page.setViewportSize({ width, height: 768 });
      await clearPreviewSplitPreference(page);
      await openCalculator(page);
      await expectLocalDraftProtected(page);
      await expectSmallVisualCorrections(page);
      await expectVisualRefinementSurfaces(page);
      await expectPreviewHierarchy(page, false);
      await expectStructureColumnCount(page, width === 1024 ? 3 : 2);
      await expect(page.getByRole('button', { name: /^Pergola 1 · Module 1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeInViewport();
      const compactPricing = page.getByRole('region', { name: 'Current customer price' });
      const fullPricing = page.getByRole('region', { name: 'Pricing preview' });
      await expect(compactPricing).toBeVisible();
      const compactBox = await compactPricing.boundingBox();
      expect(compactBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(768);
      expect((compactBox?.y ?? 0) + (compactBox?.height ?? 0)).toBeLessThanOrEqual(768);
      expect(parseCurrency(await compactPricing.locator('strong').innerText())).toBe(
        parseCurrency(await fullPricing.locator('strong').first().innerText()),
      );

      const addBlind = page.getByRole('button', { name: 'Add blind', exact: true });
      await expect(addBlind).toHaveCSS('text-transform', 'none');
      await expect(page.getByText('Front 0', { exact: true })).toHaveCount(0);

      if (width === 768) {
        const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
        const originalLength = await roofLength.inputValue();
        await roofLength.fill('');
        await expect(compactPricing.getByText('Last valid customer price (inc GST)', { exact: true })).toBeVisible();
        await expect(compactPricing.locator('strong')).toHaveText(/^\$\d{1,3}(?:,\d{3})*$/);
        expect(parseCurrency(await compactPricing.locator('strong').innerText())).toBe(
          parseCurrency(await fullPricing.locator('strong').first().innerText()),
        );
        await fullPricing.getByRole('button', { name: 'Errors (1)', exact: true }).click();
        const issueDialog = page.getByRole('dialog', { name: 'Issues' });
        await issueDialog.getByRole('button', { name: /Pergola 1 .* Module 1 .* Roof Length/ }).click();
        await expect(roofLength).toBeFocused();
        await expect
          .poll(async () => {
            const commandBarBox = await page.locator('[data-calculator-command-bar]').boundingBox();
            const focusedFieldBox = await roofLength.boundingBox();
            return (focusedFieldBox?.y ?? Number.NEGATIVE_INFINITY)
              - ((commandBarBox?.y ?? 0) + (commandBarBox?.height ?? 0));
          })
          .toBeGreaterThanOrEqual(0);
        await roofLength.fill(originalLength);
        await expect(compactPricing.getByText('Live', { exact: true })).toBeVisible({ timeout: 60_000 });
      }

      const main = page.locator('main').first();
      const before = await main.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
      await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.getByRole('complementary', { name: 'Preview outputs' })).toBeVisible();
      const previewDimensions = await fullPricing.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(previewDimensions.scrollWidth).toBeLessThanOrEqual(previewDimensions.clientWidth + 1);
      await page.getByRole('button', { name: 'Save', exact: true }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Save design confirmation' });
      await expect(dialog.getByText('Stored estimate', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Save design — keep stored costing', exact: true })).toBeVisible();
    });
  });
}

test('blind roll covers price live, restore from the local draft, and stay responsive', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const blinds = page.locator('[data-calculator-configuration-section="blinds"]');
    await blinds.getByRole('button', { name: 'Add blind', exact: true }).click();
    await blinds.getByLabel('System', { exact: true }).selectOption('OMNI');
    await blinds.getByLabel('Width (m)', { exact: true }).fill('2');
    await blinds.getByLabel('Width (m)', { exact: true }).press('Tab');
    await blinds.getByLabel('Blind drop (m)', { exact: true }).fill('2');
    await blinds.getByLabel('Blind drop (m)', { exact: true }).press('Tab');

    const rollCover = blinds.getByLabel('Blind roll cover', { exact: true });
    await expect(rollCover).toHaveValue('NONE');
    await expect(blinds.getByText('$1782.50', { exact: true }).first()).toBeVisible();

    await rollCover.selectOption('FLASHING');
    await expect(blinds.getByText('$1870.50', { exact: true }).first()).toBeVisible();
    await rollCover.selectOption('PELMET');
    await expect(blinds.getByText('$2072.50', { exact: true }).first()).toBeVisible();
    await expectLocalDraftProtected(page);

    await page.reload();
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    const restoredBlinds = page.locator('[data-calculator-configuration-section="blinds"]');
    await expect(restoredBlinds.getByLabel('Blind roll cover', { exact: true })).toHaveValue('PELMET');
    await expect(restoredBlinds.getByText('$2072.50', { exact: true }).first()).toBeVisible();

    for (const width of [1600, 768, 390]) {
      await page.setViewportSize({ width, height: width === 1600 ? 1000 : 844 });
      await expect(restoredBlinds.getByLabel('Blind drop (m)', { exact: true })).toBeVisible();
      await expect(restoredBlinds.getByLabel('Blind roll cover', { exact: true })).toBeVisible();
      const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(horizontalOverflow).toBeLessThanOrEqual(1);
    }
  });
});

test('invalid edits retain but relabel the last valid result and block save', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page);
    await moduleNavigatorButton(page, 'Pergola 2 · Module 1').click();
    const pricing = page.getByRole('region', { name: 'Pricing preview' });
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    await roofLength.fill('');
    await expect(pricing.getByText('Last valid result — fix inputs', { exact: true })).toBeVisible();
    await expect(pricing.getByText('Last valid customer price (inc GST)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    await expect(moduleNavigatorButton(page, 'Pergola 2 · Module 1')).toContainText('1 issue');
    await page.getByRole('button', { name: 'Errors (1)', exact: true }).click();
    const issueDialog = page.getByRole('dialog', { name: 'Issues' });
    await expect(issueDialog).toContainText('Pergola 2 · Module 1 · Roof Length (m)');
    await issueDialog.getByRole('button', { name: /Pergola 2 · Module 1 · Roof Length/ }).click();
    await expect(roofLength).toBeFocused();
    await roofLength.fill('6');
    await expect(pricing.getByText('Live', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
  });
});

test('scratch calculator can search and open a project workflow', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await openPortalPage(page, '/staff/calculator', { heading: 'Calculator' });
    await page.getByRole('button', { name: 'Select project', exact: true }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Select calculator project' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Search active projects').fill(scenario.labels.projectName);
    await dialog.getByRole('button', { name: new RegExp(scenario.labels.projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).click();
    await expect(page).toHaveURL(new RegExp(`/staff/calculator\\?projectId=${encodeURIComponent(projectId)}`));
    await expect(page).toHaveURL(new RegExp(`editEstimateId=${encodeURIComponent(estimateId)}`), { timeout: 60_000 });
    await expect(page.getByText('not compatible', { exact: false })).toHaveCount(0);
  });
});
