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

async function waitForCalculatorLayout(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

async function documentScrollTop(page: Page) {
  return page.evaluate(
    () => (document.scrollingElement ?? document.documentElement).scrollTop,
  );
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

  const pricing = page.locator('[data-rounded-customer-summary]:visible');
  await expect(pricing.locator('strong').first()).toHaveText(/^\$\d{1,3}(?:,\d{3})*$/);
  await expect(pricing.getByText(/^Customer price \(rounded, ex GST\)/)).toHaveText(
    /^Customer price \(rounded, ex GST\) \$\d{1,3}(?:,\d{3})*$/,
  );
}

async function expectVisualRefinementSurfaces(page: Page) {
  await expect(page.locator('[data-section-surface="card"]')).toHaveCount(2);
  await expect(page.locator('[data-calculator-configuration-sheet]')).toHaveCount(2);
  await expect(page.locator('[data-module-actions="compact"]')).toHaveCount(1);
  await expect(
    page.locator('[data-calculator-field="roofPitchDeg"] [data-field-part="resolved"]'),
  ).toHaveText(/^Auto - current result uses /, { timeout: 60_000 });
  await expect(
    page.locator('[data-calculator-field="downpipeCount"] [data-field-part="resolved"]'),
  ).toHaveText(/^Auto - current result uses /, { timeout: 60_000 });
  const configurationGuidance = await page
    .locator(
      '[data-calculator-configuration-form] [data-field-part="helper"], '
      + '[data-calculator-configuration-form] [data-field-part="resolved"]',
    )
    .evaluateAll((elements) =>
      elements.map((element) => ({
        fieldId: element.closest<HTMLElement>('[data-calculator-field]')?.dataset.calculatorField ?? null,
        part: element.getAttribute('data-field-part'),
        text: element.textContent?.trim() ?? '',
      })),
    );
  expect(configurationGuidance.filter(({ part }) => part === 'helper')).toEqual([]);
  expect(
    configurationGuidance.every(({ fieldId, part, text }) =>
      part === 'resolved'
      && (fieldId === 'roofPitchDeg' || fieldId === 'downpipeCount')
      && /^Auto - current result uses /.test(text),
    ),
  ).toBe(true);
  expect(configurationGuidance.map(({ fieldId }) => fieldId).sort()).toEqual([
    'downpipeCount',
    'roofPitchDeg',
  ]);

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
  await expect(page.locator('[data-rounded-customer-summary]:visible')).toHaveCount(1);

  const tabs = inspector.getByRole('tab');
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText(['Pricing', 'Materials', 'Labour', 'Workings', 'Issues']);
  await expect(inspector.getByRole('tab', { name: 'Pricing', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(inspector.getByRole('tabpanel', { name: 'Pricing' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Materials', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Materials breakdown' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Labour', exact: true }).click();
  await expect(inspector.getByRole('region', { name: 'Labour breakdown' })).toBeVisible();

  await inspector.getByRole('tab', { name: 'Workings', exact: true }).click();
  const moduleViews = inspector.getByRole('region', { name: 'Module views' });
  const rafterWorking = inspector.getByRole('region', { name: 'Rafter cut length workings' });
  await expect(moduleViews).toBeVisible();
  await expect(rafterWorking).toBeVisible();
  const resultPrecedesDiagram = await inspector
    .getByRole('tabpanel', { name: 'Workings' })
    .evaluate((panel) => {
      const result = panel.querySelector('[aria-label="Rafter cut length workings"]');
      const diagram = panel.querySelector('[aria-label="Module views"]');
      return Boolean(
        result
        && diagram
        && (result.compareDocumentPosition(diagram) & Node.DOCUMENT_POSITION_FOLLOWING),
      );
    });
  expect(resultPrecedesDiagram).toBe(true);
  if (expectModuleViewInViewport) {
    await expect(rafterWorking).toBeInViewport();
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

type CalculatorIssueScrollOwner = 'configuration' | 'workspace' | 'document' | 'other';

async function selectCalculatorModule(page: Page, label: string) {
  const launcher = page.locator('[data-calculator-module-launcher]:visible');
  if (await launcher.count()) {
    if ((await launcher.innerText()).includes(label)) return;
    await launcher.click();
    const dialog = page.getByRole('dialog', { name: 'Module navigator' });
    await dialog.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}`) }).click();
    await expect(dialog).toHaveCount(0);
    return;
  }

  await moduleNavigatorButton(page, label).click();
}

async function openCalculatorInputIssuesDialog(page: Page) {
  const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
  const issuesTab = inspector.getByRole('tab', { name: 'Issues', exact: true });
  await issuesTab.click();
  await expect(issuesTab).toHaveAttribute('aria-selected', 'true');
  await inspector
    .getByRole('region', { name: 'Quote status' })
    .getByRole('button', { name: 'View errors', exact: true })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Issues' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function moveCalculatorIssueScrollOwnerToEnd(field: Locator) {
  return field.evaluate((element) => {
    const canScrollVertically = (candidate: HTMLElement) => {
      const style = window.getComputedStyle(candidate);
      const overflowY = style.overflowY || style.overflow;
      return /^(auto|scroll|overlay)$/.test(overflowY)
        && candidate.scrollHeight > candidate.clientHeight + 1;
    };
    let owner = element.parentElement;
    while (owner && !canScrollVertically(owner)) owner = owner.parentElement;
    owner = owner
      ?? (document.scrollingElement as HTMLElement | null)
      ?? document.documentElement;

    const workspace = element.closest<HTMLElement>('[data-calculator-workspace]');
    const configurationOwner = workspace
      ?.querySelector<HTMLElement>('[data-calculator-configuration-workspace]')
      ?.parentElement;
    const ownerKind: CalculatorIssueScrollOwner =
      owner === document.scrollingElement || owner === document.documentElement || owner === document.body
        ? 'document'
        : owner === workspace
          ? 'workspace'
          : owner === configurationOwner
            ? 'configuration'
            : 'other';

    owner.scrollTop = Math.max(0, owner.scrollHeight - owner.clientHeight);
    return {
      kind: ownerKind,
      maxScrollTop: Math.max(0, owner.scrollHeight - owner.clientHeight),
      scrollTop: owner.scrollTop,
    };
  });
}

async function readCalculatorIssueTargetGeometry(field: Locator) {
  return field.evaluate((element) => {
    const canScrollVertically = (candidate: HTMLElement) => {
      const style = window.getComputedStyle(candidate);
      const overflowY = style.overflowY || style.overflow;
      return /^(auto|scroll|overlay)$/.test(overflowY)
        && candidate.scrollHeight > candidate.clientHeight + 1;
    };
    const revealNode =
      element.closest<HTMLElement>('[data-calculator-field]')
      ?? element;
    let owner = revealNode.parentElement;
    while (owner && !canScrollVertically(owner)) owner = owner.parentElement;
    owner = owner
      ?? (document.scrollingElement as HTMLElement | null)
      ?? document.documentElement;

    const workspace = revealNode.closest<HTMLElement>('[data-calculator-workspace]');
    const configurationOwner = workspace
      ?.querySelector<HTMLElement>('[data-calculator-configuration-workspace]')
      ?.parentElement;
    const ownerKind: CalculatorIssueScrollOwner =
      owner === document.scrollingElement || owner === document.documentElement || owner === document.body
        ? 'document'
        : owner === workspace
          ? 'workspace'
          : owner === configurationOwner
            ? 'configuration'
            : 'other';

    const isDocumentOwner =
      owner === document.scrollingElement
      || owner === document.documentElement
      || owner === document.body;
    const ownerRect = owner.getBoundingClientRect();
    let usableTop = isDocumentOwner ? 0 : Math.max(0, ownerRect.top);
    const usableBottom = isDocumentOwner
      ? window.innerHeight
      : Math.min(window.innerHeight, ownerRect.bottom);
    const stickyChrome = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-portal-mobile-top-bar],'
        + '[data-project-masthead-slot-sticky="true"],'
        + '[data-calculator-command-bar]',
      ),
    )
      .map((candidate) => ({
        rect: candidate.getBoundingClientRect(),
        style: window.getComputedStyle(candidate),
      }))
      .filter(({ rect, style }) =>
        (style.position === 'fixed' || style.position === 'sticky')
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && rect.width > 0
        && rect.height > 0,
      )
      .sort((left, right) => left.rect.top - right.rect.top);
    for (const { rect } of stickyChrome) {
      if (rect.bottom <= usableTop || rect.top > usableTop + 2) continue;
      usableTop = Math.max(usableTop, rect.bottom);
    }

    const controlRect = element.getBoundingClientRect();
    const revealRect = revealNode.getBoundingClientRect();
    const describedIds = (element.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    const describedElements = describedIds
      .map((id) => document.getElementById(id))
      .filter((candidate): candidate is HTMLElement => Boolean(candidate));
    const errorElement = describedElements.find(
      (candidate) => candidate.dataset.fieldPart === 'error',
    );
    const errorRect = errorElement?.getBoundingClientRect() ?? null;
    const hit = document.elementFromPoint(
      controlRect.left + controlRect.width / 2,
      controlRect.top + controlRect.height / 2,
    );

    return {
      ownerKind,
      ownerScrollTop: owner.scrollTop,
      usableTop,
      usableBottom,
      controlTop: controlRect.top,
      controlBottom: controlRect.bottom,
      revealTop: revealRect.top,
      revealBottom: revealRect.bottom,
      errorTop: errorRect?.top ?? null,
      errorBottom: errorRect?.bottom ?? null,
      focused: document.activeElement === element,
      ariaInvalid: element.getAttribute('aria-invalid'),
      describedIds,
      errorText: errorElement?.textContent?.trim() ?? null,
      centerHit: hit === element || element.contains(hit),
    };
  });
}

async function withCalculatorEvidence(page: Page, testInfo: TestInfo, callback: () => Promise<void>) {
  await withPortalBrowserEvidence(
    page,
    testInfo,
    { routeId: 'calculator', scenarioId: scenario.scenarioId, phase: 'calculator-module-navigator' },
    callback,
  );
}

async function expectCrossModuleIssueJump({
  page,
  expectedOwner,
  reducedMotion = false,
}: {
  page: Page;
  expectedOwner: CalculatorIssueScrollOwner;
  reducedMotion?: boolean;
}) {
  const issueModuleLabel = 'Pergola 2 \u00b7 Module 1';
  const returnModuleLabel = 'Pergola 1 \u00b7 Module 1';

  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' });
  await selectCalculatorModule(page, issueModuleLabel);
  const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
  const originalLength = await roofLength.inputValue();
  await roofLength.fill('');
  await selectCalculatorModule(page, returnModuleLabel);

  const issueDialog = await openCalculatorInputIssuesDialog(page);

  const ownerBefore = await moveCalculatorIssueScrollOwnerToEnd(roofLength);
  expect(ownerBefore.kind).toBe(expectedOwner);
  expect(ownerBefore.maxScrollTop).toBeGreaterThan(0);
  expect(ownerBefore.scrollTop).toBeGreaterThan(0);

  const inspector = page.getByRole('complementary', { name: 'Preview outputs' });
  const inspectorBefore = await inspector.evaluate((element) => {
    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    element.scrollTop = Math.min(120, maxScrollTop);
    return element.scrollTop;
  });

  await issueDialog
    .getByRole('button', {
      name: new RegExp(`${escapeRegExp(issueModuleLabel)}.*Roof Length`),
    })
    .click();
  await expect(issueDialog).toHaveCount(0);
  await expect(roofLength).toBeFocused();
  await expect(roofLength).toHaveAttribute('aria-invalid', 'true');
  await expect(roofLength).toHaveAttribute('aria-describedby', /\blengthM-error\b/);
  await expect(page.locator('#lengthM-error')).toHaveText('Enter a length > 0');
  await expect(
    page.locator('button[aria-current="true"]', { hasText: issueModuleLabel }),
  ).toHaveCount(1);
  const visibleLauncher = page.locator('[data-calculator-module-launcher]:visible');
  if (await visibleLauncher.count()) {
    await expect(visibleLauncher).toContainText(issueModuleLabel);
  }

  await expect
    .poll(async () => {
      const geometry = await readCalculatorIssueTargetGeometry(roofLength);
      return (
        geometry.focused
        && geometry.centerHit
        && geometry.errorText === 'Enter a length > 0'
        && geometry.revealTop >= geometry.usableTop + 14
        && geometry.revealBottom <= geometry.usableBottom - 14
        && geometry.errorTop !== null
        && geometry.errorBottom !== null
        && geometry.errorTop >= geometry.usableTop
        && geometry.errorBottom <= geometry.usableBottom
      );
    })
    .toBe(true);

  const geometry = await readCalculatorIssueTargetGeometry(roofLength);
  expect(geometry.ownerKind).toBe(expectedOwner);
  expect(Math.abs(geometry.ownerScrollTop - ownerBefore.scrollTop)).toBeGreaterThan(1);
  expect(await inspector.evaluate((element) => element.scrollTop)).toBe(inspectorBefore);

  await roofLength.fill(originalLength);
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
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
    await expect(page.locator('[data-pricing-summary-variant="compact"]')).toBeHidden();
    await expect(page.locator('[data-calculator-configuration-section="context"]')).toHaveAttribute('data-section-density', 'compact');
    const previewWidth = await page.getByRole('complementary', { name: 'Preview outputs' }).evaluate(
      (element) => element.getBoundingClientRect().width,
    );
    expect(previewWidth).toBeGreaterThanOrEqual(479);
    expect(previewWidth).toBeLessThanOrEqual(481);
    await expectStructureColumnCount(page, 3);
    await expect(moduleNavigatorButton(page, 'Pergola 1 · Module 1')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText('Pergola 2 · Module 1', { exact: true }).first()).toBeVisible();
    const pricing = page.locator('[data-rounded-customer-summary]:visible');
    await expect(pricing.getByText('Customer price (rounded, inc GST)', { exact: true })).toBeVisible();
    await expect(pricing.getByText('1.25× internal true cost · pergola only', { exact: true })).toHaveCount(0);
    await expect(pricing.getByText('Customer quote add-ons', { exact: true })).toHaveCount(0);
    const pricingDetails = page.getByRole('region', { name: 'Pricing details' });
    const internalDetails = pricingDetails.locator('details', { hasText: 'Internal costing' });
    await expect(internalDetails).not.toHaveAttribute('open', '');
    await internalDetails.locator('summary').click();
    await expect(internalDetails).toHaveAttribute('open', '');

    const customerInc = parseCurrency(await pricing.locator('strong').innerText());
    const itemPricing = page.getByRole('region', { name: 'Price by item' });
    await expect(itemPricing.getByText('Pergola 1', { exact: true })).toBeVisible();
    await expect(itemPricing.getByText('Pergola 2', { exact: true })).toBeVisible();
    const exactItemTotal = parseCurrency(await itemPricing.locator('tfoot th').last().innerText());
    expect(customerInc).toBe(Math.round(exactItemTotal));
  });
});

test('automatic pitch and downpipe cues explain the current result without rewriting raw inputs', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const roofPitch = page.getByLabel('Roof pitch (deg)', { exact: true });
    const downpipeCount = page.getByLabel('Downpipes (count)', { exact: true });
    const roofPitchField = page.locator('[data-calculator-field="roofPitchDeg"]');
    const downpipeField = page.locator('[data-calculator-field="downpipeCount"]');

    for (const viewport of [
      { width: 1600, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await expect(roofPitch).toHaveValue('');
      await expect(downpipeCount).toHaveValue('0');
      await expect(roofPitchField.locator('[data-field-part="resolved"]')).toHaveText(
        'Auto - current result uses 5 deg',
      );
      await expect(downpipeField.locator('[data-field-part="resolved"]')).toHaveText(
        'Auto - current result uses 1 downpipe',
      );
      await expect(roofPitch).toHaveAttribute('aria-describedby', /\broofPitchDeg-help\b/);
      await expect(downpipeCount).toHaveAttribute('aria-describedby', /\bdownpipeCount-help\b/);
      await expect(
        page.locator('[data-calculator-configuration-form] [data-field-part="helper"]'),
      ).toHaveCount(0);
    }

    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    const originalLength = await roofLength.inputValue();
    await roofLength.fill('');
    await expect(roofPitch).toHaveValue('');
    await expect(downpipeCount).toHaveValue('0');
    await expect(roofPitchField.locator('[data-field-part="resolved"]')).toHaveText(
      'Auto - last valid result used 5 deg; fix inputs to confirm',
    );
    await expect(downpipeField.locator('[data-field-part="resolved"]')).toHaveText(
      'Auto - last valid result used 1 downpipe; fix inputs to confirm',
    );
    await roofLength.fill(originalLength);
    await expect(roofPitchField.locator('[data-field-part="resolved"]')).toHaveText(
      'Auto - current result uses 5 deg',
      { timeout: 60_000 },
    );
    await expect(roofPitch).toHaveValue('');
    await expect(downpipeCount).toHaveValue('0');
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

test('result inspector keyboard navigation reaches every trust surface', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
    const pricingTab = inspector.getByRole('tab', { name: 'Pricing', exact: true });
    const materialsTab = inspector.getByRole('tab', { name: 'Materials', exact: true });
    const issuesTab = inspector.getByRole('tab', { name: 'Issues', exact: true });

    await pricingTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(materialsTab).toBeFocused();
    await expect(materialsTab).toHaveAttribute('aria-selected', 'true');
    await expect(inspector.getByRole('region', { name: 'Materials breakdown' })).toBeVisible();

    await page.keyboard.press('End');
    await expect(issuesTab).toBeFocused();
    await expect(issuesTab).toHaveAttribute('aria-selected', 'true');
    await expect(inspector.getByRole('region', { name: 'Quote status' })).toBeVisible();
    await expect(inspector.getByRole('region', { name: 'Warnings' })).toBeVisible();

    await page.keyboard.press('Home');
    await expect(pricingTab).toBeFocused();
    await expect(pricingTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(issuesTab).toBeFocused();
    await expect(issuesTab).toHaveAttribute('aria-selected', 'true');
  });
});

test('wide Inspector tab changes reset its rail while same-tab selection preserves position', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 650 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const resultRail = page.getByRole('complementary', { name: 'Preview outputs' });
    const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
    const workingsTab = inspector.getByRole('tab', { name: 'Workings', exact: true });
    const materialsTab = inspector.getByRole('tab', { name: 'Materials', exact: true });

    await workingsTab.click();
    const scrolledTop = await resultRail.evaluate((element) => {
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      element.scrollTop = Math.min(320, maxScrollTop);
      return element.scrollTop;
    });
    expect(scrolledTop).toBeGreaterThan(0);

    await workingsTab.click();
    await waitForCalculatorLayout(page);
    expect(await resultRail.evaluate((element) => element.scrollTop)).toBe(scrolledTop);

    await materialsTab.click();
    await expect.poll(() => resultRail.evaluate((element) => element.scrollTop)).toBe(0);
  });
});

test('stacked result shortcuts route explicitly and ordinary tabs preserve page scroll', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const actions = page.locator('[data-calculator-stacked-result-actions]');
    const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
    const pricingTab = inspector.getByRole('tab', { name: 'Pricing', exact: true });
    const materialsTab = inspector.getByRole('tab', { name: 'Materials', exact: true });
    const issuesTab = inspector.getByRole('tab', { name: 'Issues', exact: true });
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    const originalLength = await roofLength.inputValue();

    await expect(actions).toBeVisible();
    await expect(actions.getByRole('button', { name: 'Review issues', exact: true })).toHaveCount(0);

    await materialsTab.click();
    await roofLength.focus();
    await actions.getByRole('button', { name: 'View results', exact: true }).click();
    await expect(pricingTab).toHaveAttribute('aria-selected', 'true');
    await expect(pricingTab).toBeFocused();
    await expect(pricingTab).toBeInViewport();

    await expect(materialsTab).toBeInViewport();
    const beforeOrdinaryTabChange = await documentScrollTop(page);
    await materialsTab.click();
    await waitForCalculatorLayout(page);
    expect(Math.abs((await documentScrollTop(page)) - beforeOrdinaryTabChange)).toBeLessThanOrEqual(1);

    await page.getByRole('button', { name: 'Back to configuration', exact: true }).click();
    await expect(roofLength).toBeFocused();
    await expect(roofLength).toBeInViewport();

    await roofLength.fill('');
    const reviewIssues = actions.getByRole('button', { name: 'Review issues', exact: true });
    await expect(reviewIssues).toBeVisible();
    await reviewIssues.click();
    await expect(issuesTab).toHaveAttribute('aria-selected', 'true');
    await expect(issuesTab).toBeFocused();
    await expect(issuesTab).toBeInViewport();

    await roofLength.fill(originalLength);
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});

test('materials and labour explain whole-job quantities without losing trust state', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const inspector = page.getByRole('region', { name: 'Calculator result inspector' });
    await inspector.getByRole('tab', { name: 'Materials', exact: true }).click();
    const materials = inspector.getByRole('region', { name: 'Materials breakdown' });
    await expect(materials).toHaveAttribute('data-trusted-materials-status', 'ready');
    await expect(materials).toHaveAttribute('data-result-freshness', 'current');
    await expect(materials.getByRole('heading', { name: 'Structure & framing' })).toBeVisible();
    await expect(materials.locator('[data-material-breakdown-row]')).not.toHaveCount(0);
    expect(await materials.locator('[data-material-breakdown-row]').count()).toBeGreaterThan(10);
    await expect(materials.getByText(/Pergola .* Module/).first()).toBeVisible();
    const materialWhy = materials.locator('details', { hasText: 'Why this quantity?' }).first();
    await materialWhy.locator('summary').click();
    await expect(materialWhy).toHaveAttribute('open', '');
    await expect(materialWhy).toContainText('@sp/costing/materials-v1');
    await expect(materials.locator('[data-internal-material-cost]').first()).toBeVisible();

    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    const originalLength = await roofLength.inputValue();
    await roofLength.fill('');
    await expect(materials).toHaveAttribute('data-result-freshness', 'invalid');
    await expect(materials).toContainText('may not match unsaved edits');
    await roofLength.fill(originalLength);
    await expect(materials).toHaveAttribute('data-result-freshness', 'current', {
      timeout: 60_000,
    });

    await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    await inspector.getByRole('tab', { name: 'Labour', exact: true }).click();
    const labour = inspector.getByRole('region', { name: 'Labour breakdown' });
    await expect(labour).toHaveAttribute('data-trusted-labour-status', 'ready');
    await expect(labour).toHaveAttribute('data-result-freshness', 'current');
    await expect(labour.getByRole('heading', { name: 'Roof installation' })).toBeVisible();
    await expect(labour.locator('[data-labour-breakdown-row]').first()).toBeVisible();
    await expect(labour.getByText(/crew hr/).first()).toBeVisible();
    await expect(labour.locator('[data-internal-labour-cost]').first()).toBeVisible();
    const labourWhy = labour.locator('details', { hasText: 'Why this quantity?' }).first();
    await labourWhy.locator('summary').click();
    await expect(labourWhy).toHaveAttribute('open', '');
    await expect(labourWhy).toContainText('@sp/costing/install-actions-v1');

    for (const width of [1024, 768, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await labour.scrollIntoViewIfNeeded();
      await expect(labour).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(1);
      const dimensions = await labour.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }

    await inspector.getByRole('tab', { name: 'Materials', exact: true }).click();
    await materialWhy.scrollIntoViewIfNeeded();
    await expect(materialWhy).toBeInViewport();
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

test('embedded Context is hidden only in stacked layouts', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);
    await expect(
      page.locator(
        '[data-calculator-workspace="standalone"] '
        + '[data-calculator-configuration-section="context"]',
      ),
    ).toBeVisible();

    await openPortalPage(page, projectCalculatorRoute, { heading: scenario.labels.projectName });
    const embeddedContext = page.locator(
      '[data-calculator-workspace="project"] '
      + '[data-calculator-configuration-section="context"]',
    );
    await expect(embeddedContext).toBeHidden();

    for (const viewport of [
      { width: 768, height: 1024, visible: false, layout: 'stacked' },
      { width: 1024, height: 900, visible: false, layout: 'stacked' },
      { width: 1366, height: 900, visible: true, layout: 'split' },
      { width: 1600, height: 1000, visible: true, layout: 'split' },
    ]) {
      await page.setViewportSize(viewport);
      await waitForCalculatorLayout(page);
      if (viewport.visible) {
        await expect(embeddedContext).toBeVisible();
      } else {
        await expect(embeddedContext).toBeHidden();
      }

      const stackedActions = page.locator(
        '[data-calculator-workspace="project"] [data-calculator-stacked-result-actions]',
      );
      const visibleSummary = page.locator(
        '[data-calculator-workspace="project"] [data-rounded-customer-summary]:visible',
      );
      await expect(visibleSummary).toHaveCount(1);
      if (viewport.layout === 'split') {
        await expect(stackedActions).toBeHidden();
        await expect(page.getByRole('separator', { name: 'Resize preview panel width' })).toBeVisible();
        await expect(visibleSummary).toHaveAttribute('data-pricing-summary-variant', 'inspector');
      } else {
        await expect(stackedActions).toBeVisible();
        await expect(page.getByRole('separator', { name: 'Resize preview panel width' })).toBeHidden();
        await expect(visibleSummary).toHaveAttribute('data-pricing-summary-variant', 'compact');
      }
    }
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

test('Issue Jump reveals an Advanced-only Flashings error and focuses the invalid row', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openCalculator(page);

    await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    const flashingsSection = page.locator(
      '[data-calculator-configuration-section="flashings"]',
    );
    await expect(flashingsSection).toBeVisible();
    await flashingsSection.getByRole('button', { name: /Add flashing row/ }).click();
    const invalidLength = flashingsSection.locator(
      'input[id^="flashing-row-length-"]',
    ).last();
    const originalLength = await invalidLength.inputValue();
    await invalidLength.fill('-1');
    await expect(invalidLength).toHaveAttribute('aria-invalid', 'true');
    await expect(invalidLength).toHaveAttribute('aria-describedby', 'flashings-error');

    await page.getByRole('button', { name: 'Basic', exact: true }).click();
    await expect(flashingsSection).toHaveCount(0);
    const issueDialog = await openCalculatorInputIssuesDialog(page);
    await issueDialog.getByRole('button', { name: /Flashings/ }).click();

    await expect(page.getByRole('button', { name: 'Advanced', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(flashingsSection).toBeVisible();
    await expect(invalidLength).toBeFocused();
    await expect(invalidLength).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#flashings-error')).toHaveText(
      'Enter a flashing length of 0 or more.',
    );

    await invalidLength.fill(originalLength);
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({
      timeout: 60_000,
    });
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
    await expect(page.locator('[data-pricing-summary-variant="compact"]')).toBeHidden();

    const internalDetails = page
      .getByRole('region', { name: 'Pricing details' })
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
      const compactPricing = page.locator('[data-pricing-summary-variant="compact"]');
      const itemPricing = page.getByRole('region', { name: 'Price by item' });
      await expect(compactPricing).toBeVisible();
      const compactBox = await compactPricing.boundingBox();
      expect(compactBox?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(768);
      expect((compactBox?.y ?? 0) + (compactBox?.height ?? 0)).toBeLessThanOrEqual(768);
      expect(parseCurrency(await compactPricing.locator('strong').innerText())).toBe(
        Math.round(parseCurrency(await itemPricing.locator('tfoot th').last().innerText())),
      );

      const addBlind = page.getByRole('button', { name: 'Add blind', exact: true });
      await expect(addBlind).toHaveCSS('text-transform', 'none');
      await expect(page.getByText('Front 0', { exact: true })).toHaveCount(0);

      if (width === 768) {
        const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
        const originalLength = await roofLength.inputValue();
        await roofLength.fill('');
        await expect(compactPricing.getByText('Last valid customer price (rounded, inc GST)', { exact: true })).toBeVisible();
        await expect(compactPricing.locator('strong')).toHaveText(/^\$\d{1,3}(?:,\d{3})*$/);
        expect(parseCurrency(await compactPricing.locator('strong').innerText())).toBe(
          Math.round(parseCurrency(await itemPricing.locator('tfoot th').last().innerText())),
        );
        await roofLength.fill(originalLength);
        await expect(compactPricing.getByText('Live', { exact: true })).toBeVisible({ timeout: 60_000 });
      }

      const main = page.locator('main').first();
      const before = await main.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
      await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.getByRole('complementary', { name: 'Preview outputs' })).toBeVisible();
      const previewDimensions = await itemPricing.evaluate((element) => ({
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

for (const issueJumpCase of [
  {
    name: 'split standalone configuration rail at 1600px',
    width: 1600,
    height: 1000,
    embedded: false,
    expectedOwner: 'configuration',
    reducedMotion: false,
  },
  {
    name: 'stacked standalone Calculator at 768px',
    width: 768,
    height: 1024,
    embedded: false,
    expectedOwner: 'workspace',
    reducedMotion: false,
  },
  {
    name: 'stacked project Calculator at 390px with reduced motion',
    width: 390,
    height: 844,
    embedded: true,
    expectedOwner: 'document',
    reducedMotion: true,
  },
] as const) {
  test(`issue Jump reveals its cross-module field in the ${issueJumpCase.name}`, async ({ page }, testInfo) => {
    await withCalculatorEvidence(page, testInfo, async () => {
      await page.setViewportSize({
        width: issueJumpCase.width,
        height: issueJumpCase.height,
      });
      await clearPreviewSplitPreference(page);
      if (issueJumpCase.embedded) {
        await openPortalPage(page, projectCalculatorRoute, { heading: scenario.labels.projectName });
        await expect(page.locator('[data-calculator-workspace="project"]')).toBeVisible({
          timeout: 60_000,
        });
        await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({
          timeout: 60_000,
        });
      } else {
        await openCalculator(page);
      }

      await expectCrossModuleIssueJump({
        page,
        expectedOwner: issueJumpCase.expectedOwner,
        reducedMotion: issueJumpCase.reducedMotion,
      });
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
    const pricing = page.locator('[data-rounded-customer-summary]:visible');
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    await roofLength.fill('');
    await expect(pricing.getByText('Last valid result — fix inputs', { exact: true })).toBeVisible();
    await expect(pricing.getByText('Last valid customer price (rounded, inc GST)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    await expect(moduleNavigatorButton(page, 'Pergola 2 · Module 1')).toContainText('1 issue');
    const issueDialog = await openCalculatorInputIssuesDialog(page);
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

test('repriced save reconciles the Live customer total with the saved quote handoff', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await clearPreviewSplitPreference(page);
    await openCalculator(page);

    const itemPricing = page.getByRole('region', { name: 'Price by item' });

    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    const confirmation = page.getByRole('dialog', { name: 'Save design confirmation' });
    await expect(confirmation).toBeVisible();
    const warningAcknowledgement = confirmation.getByLabel('I acknowledge the review warnings');
    if (await warningAcknowledgement.count()) await warningAcknowledgement.check();
    await confirmation.getByRole('button', { name: 'Reprice and save', exact: true }).click();

    const outcome = page.getByRole('dialog', { name: 'Design saved' });
    await expect(outcome).toBeVisible({ timeout: 60_000 });
    const reconciliation = outcome.getByRole('region', { name: 'Pricing reconciliation' });
    await expect(reconciliation).toHaveAttribute('data-pricing-reconciliation', 'matched');
    await expect(reconciliation.getByText('Exact match', { exact: true })).toBeVisible();

    const exactCalculatorTotalCents = await itemPricing.getAttribute(
      'data-customer-total-inc-gst-cents',
    );
    expect(exactCalculatorTotalCents).toMatch(/^\d+$/);
    const liveTotal = reconciliation.locator('[data-live-calculator-total-inc-gst-cents]');
    const handoffTotal = reconciliation.locator('[data-quote-handoff-total-inc-gst-cents]');
    await expect(liveTotal).toHaveAttribute(
      'data-live-calculator-total-inc-gst-cents',
      exactCalculatorTotalCents!,
    );
    await expect(handoffTotal).toHaveAttribute(
      'data-quote-handoff-total-inc-gst-cents',
      exactCalculatorTotalCents!,
    );
    await expect(outcome.getByRole('button', { name: 'Create quote from this design' })).toBeEnabled({
      timeout: 60_000,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await reconciliation.scrollIntoViewIfNeeded();
    await expect(reconciliation).toBeInViewport();
    const dimensions = await outcome.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
