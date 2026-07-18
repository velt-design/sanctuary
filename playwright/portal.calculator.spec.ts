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

async function withCalculatorEvidence(page: Page, testInfo: TestInfo, callback: () => Promise<void>) {
  await withPortalBrowserEvidence(
    page,
    testInfo,
    { routeId: 'calculator', scenarioId: scenario.scenarioId, phase: 'calculator-trust-slice' },
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
    await expect(page.getByText('Internal true cost (ex‑GST)', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Blind customer price (ex‑GST)', { exact: true }).first()).toBeVisible();
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
    const dimensions = await page.getByRole('complementary', { name: 'Preview outputs' }).evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

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
      const main = page.locator('main').first();
      const before = await main.evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
      expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
      await main.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
      await expect(page.getByRole('complementary', { name: 'Preview outputs' })).toBeVisible();
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
    const roofLength = page.getByLabel('Roof Length (m)', { exact: true });
    await roofLength.fill('');
    await expect(page.getByText('Last valid result — fix inputs', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save', exact: true }).first()).toBeDisabled();
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
