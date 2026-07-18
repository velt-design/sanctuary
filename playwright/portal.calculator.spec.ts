import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { openPortalPage, withPortalBrowserEvidence } from './support/portalAgent';
import {
  getPortalScenarioState,
  loadPortalScenarioState,
} from './support/portalScenarioRegistry';

const scenarioState = loadPortalScenarioState();
const scenario = getPortalScenarioState(scenarioState, 'project-with-estimate');
const projectId = scenario.projectId as string;
const estimateId = scenario.estimateId as string;
const calculatorRoute = `/staff/calculator?projectId=${encodeURIComponent(projectId)}&editEstimateId=${encodeURIComponent(estimateId)}`;

async function openCalculator(page: Page) {
  await openPortalPage(page, calculatorRoute, { heading: 'Calculator' });
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
}

async function expectLocalDraftProtected(page: Page) {
  await expect(page.getByText('Saved locally', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Browser draft only — use Save to update the estimate.', { exact: true })).toBeVisible();
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
    await openCalculator(page);
    await expect(page.getByText(scenario.labels.projectName).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Basic', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeEnabled();
    await expectLocalDraftProtected(page);
    await expect(page.getByRole('navigation', { name: 'Pergolas and modules' })).toBeVisible();
    await expect(moduleNavigatorButton(page, 'Pergola 1 · Module 1')).toHaveAttribute('aria-current', 'true');
    await expect(page.getByText('Pergola 2 · Module 1', { exact: true }).first()).toBeVisible();
    const pricing = page.getByRole('region', { name: 'Pricing preview' });
    await expect(pricing.getByText('Customer price (inc GST)', { exact: true })).toBeVisible();
    await expect(pricing.getByText('1.25× internal true cost · pergola only', { exact: true })).toBeVisible();
    await expect(pricing.getByText('Internal costing', { exact: true })).toBeVisible();
    await expect(pricing.getByText('Blind customer price (ex GST)', { exact: true })).toBeVisible();

    const customerInc = parseCurrency(await pricing.locator('strong').first().innerText());
    const internalEx = parseCurrency(
      await pricing.locator('dt', { hasText: 'True cost (ex GST)' }).locator('..').locator('dd').innerText(),
    );
    const expectedCustomerEx = Math.round(internalEx * 1.25 * 100) / 100;
    const expectedCustomerInc = Math.round(expectedCustomerEx * 1.15 * 100) / 100;
    expect(customerInc).toBe(expectedCustomerInc);
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

test('module navigator supports fresh add, duplicate, move, and confirmed remove', async ({ page }, testInfo) => {
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
    const removeDialog = page.getByRole('dialog', { name: 'Remove module?' });
    await expect(removeDialog).toContainText('browser draft');
    await removeDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(navigator.getByRole('listitem')).toHaveCount(5);

    await navigator.getByRole('button', { name: 'Remove', exact: true }).click();
    await page.getByRole('dialog', { name: 'Remove module?' }).getByRole('button', { name: 'Remove module', exact: true }).click();
    await expect(navigator.getByRole('listitem')).toHaveCount(4);
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
    await expect(dialog.getByRole('button', { name: 'Save design — keep stored costing', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reprice and save', exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp('/staff/calculator'));
    await expect(page.getByText('Draft quote created locally.', { exact: false })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  });
});

test('calculator preview does not clip horizontally at 1366px', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await openCalculator(page);
    await expectLocalDraftProtected(page);
    const dimensions = await page.getByRole('complementary', { name: 'Preview outputs' }).evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

    const houseConnectionBox = await page.getByLabel('House connection', { exact: true }).boundingBox();
    const postConnectionBox = await page.getByLabel('Post connection', { exact: true }).boundingBox();
    expect(houseConnectionBox).not.toBeNull();
    expect(postConnectionBox).not.toBeNull();
    expect(Math.abs((houseConnectionBox?.y ?? 0) - (postConnectionBox?.y ?? 0))).toBeLessThan(4);
    expect(postConnectionBox?.x ?? 0).toBeGreaterThan((houseConnectionBox?.x ?? 0) + (houseConnectionBox?.width ?? 0));

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
      await openCalculator(page);
      await expectLocalDraftProtected(page);
      await expect(page.getByRole('button', { name: /^Pergola 1 · Module 1/ })).toBeVisible();
      const main = page.locator('main').first();
      const before = await main.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
      await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.getByRole('complementary', { name: 'Preview outputs' })).toBeVisible();
      const previewDimensions = await page.getByRole('region', { name: 'Pricing preview' }).evaluate((element) => ({
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

test('invalid edits retain but relabel the last valid result and block save', async ({ page }, testInfo) => {
  await withCalculatorEvidence(page, testInfo, async () => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await openCalculator(page);
    await moduleNavigatorButton(page, 'Pergola 2 · Module 1').click();
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    await roofLength.fill('');
    await expect(page.getByText('Last valid result — fix inputs', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Last valid customer price (inc GST)', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
    await expect(moduleNavigatorButton(page, 'Pergola 2 · Module 1')).toContainText('1 issue');
    await page.getByRole('button', { name: 'Errors (1)', exact: true }).click();
    const issueDialog = page.getByRole('dialog', { name: 'Issues' });
    await expect(issueDialog).toContainText('Pergola 2 · Module 1 · Roof Length (m)');
    await issueDialog.getByRole('button', { name: /Pergola 2 · Module 1 · Roof Length/ }).click();
    await expect(roofLength).toBeFocused();
    await roofLength.fill('6');
    await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
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
