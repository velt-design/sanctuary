import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { openPortalPage, withPortalBrowserEvidence } from './support/portalAgent';

async function openCustomInfill(page: Page, width: number): Promise<Locator> {
  await page.setViewportSize({ width, height: width <= 1024 ? 768 : 1000 });
  await openPortalPage(page, '/staff/calculator', { heading: 'Calculator' });
  await expect(page.getByText('Live', { exact: true }).first()).toBeVisible({ timeout: 60_000 });
  const addInfill = page.getByRole('button', { name: 'Add infill', exact: true });
  await expect(addInfill).toHaveCount(1);
  await addInfill.click();
  const dialog = page.getByRole('dialog', { name: 'Infills' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function setNumber(dialog: Locator, label: string, value: string): Promise<void> {
  const input = dialog.getByLabel(label, { exact: true });
  await expect(input).toHaveCount(1);
  await input.fill(value);
  await input.press('Enter');
}

async function advanceToResults(dialog: Locator, useKeyboard = false): Promise<void> {
  await expect(dialog.getByRole('button', { name: /^1 Opening$/ })).toHaveAttribute('aria-current', 'step');
  const firstContinue = dialog.getByRole('button', { name: 'Continue', exact: true });
  if (useKeyboard) {
    await firstContinue.focus();
    await firstContinue.press('Enter');
  } else {
    await firstContinue.click();
  }
  await expect(dialog.getByRole('button', { name: /^2 Existing supports$/ })).toHaveAttribute('aria-current', 'step');
  const secondContinue = dialog.getByRole('button', { name: 'Continue', exact: true });
  if (useKeyboard) {
    await secondContinue.focus();
    await secondContinue.press('Enter');
  } else {
    await secondContinue.click();
  }
  await expect(dialog.getByRole('button', { name: /^3 Results/ })).toHaveAttribute('aria-current', 'step');
}

async function openResults(dialog: Locator, useKeyboard = false): Promise<void> {
  await advanceToResults(dialog, useKeyboard);
  await expect(dialog.getByRole('heading', { name: 'Pieces to cut', exact: true })).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Materials to purchase', exact: true })).toBeVisible();
}

async function attachCalculatorScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.describe.configure({ mode: 'serial' });

test('authenticated calculator resolves and displays automatic choices', async ({ page }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { routeId: 'calculator', phase: 'infill-automatic-selection' }, async () => {
    const dialog = await openCustomInfill(page, 1600);
    await dialog.getByText('Change automatic choices', { exact: true }).click();
    await expect(dialog.getByLabel('Panel material', { exact: true })).toHaveValue('auto');
    await expect(dialog.getByLabel('Joiner direction', { exact: true })).toHaveValue('auto');
    await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    await setNumber(dialog, 'Width (m)', '1.2');
    await setNumber(dialog, 'Height (m)', '1');
    await expect(dialog.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    await openResults(dialog);

    await expect(dialog.getByText('Panel material', { exact: true }).locator('..')).toContainText('Sheet panels');
    await expect(dialog.getByText('Joiner direction', { exact: true }).locator('..')).toContainText('Vertical');
    await expect(dialog.getByText('Cost and technical details', { exact: true }).locator('..')).not.toHaveAttribute('open', '');
  });
});

test('authenticated calculator shows exact 2.4m x 2.1m sheet pieces, purchases, and CSV at desktop', async ({ page, context }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { routeId: 'calculator', phase: 'infill-sheet-accuracy' }, async () => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const dialog = await openCustomInfill(page, 1600);
    await dialog.getByText('Change automatic choices', { exact: true }).click();
    await expect(dialog.getByLabel('Panel material', { exact: true })).toHaveValue('auto');
    await expect(dialog.getByLabel('Joiner direction', { exact: true })).toHaveValue('auto');
    await dialog.getByLabel('Panel material', { exact: true }).selectOption('sheet_panels');
    await dialog.getByLabel('Joiner direction', { exact: true }).selectOption('vertical');
    await setNumber(dialog, 'Width (m)', '2.4');
    await setNumber(dialog, 'Height (m)', '2.1');
    await openResults(dialog);

    await expect(dialog.getByText('Panel material').locator('..')).toContainText('Sheet panels');
    await expect(dialog.getByText('Joiner direction').locator('..')).toContainText('Vertical');

    const pieces = dialog.getByRole('table', { name: 'Pieces to cut · Infill cut list estimate' });
    const purchases = dialog.getByRole('table', { name: 'Materials to purchase · Infill cut list estimate' });
    await expect(pieces.getByRole('row').filter({ hasText: 'Acrylic panel 1' })).toContainText('1.200m × 2.100m');
    await expect(pieces.getByRole('row').filter({ hasText: 'Acrylic panel 2' })).toContainText('1.200m × 2.100m');
    await expect(pieces.getByRole('row').filter({ hasText: 'Joiner · Top' })).toContainText('2.400m');
    await expect(pieces.getByRole('row').filter({ hasText: 'Joiner · Bottom' })).toContainText('2.400m');
    await expect(pieces.getByRole('row').filter({ hasText: 'Joiner · Left' })).toContainText('2.100m');
    await expect(pieces.getByRole('row').filter({ hasText: 'Joiner · Right' })).toContainText('2.100m');
    await expect(pieces.getByRole('row').filter({ hasText: 'Joiner · Internal' })).toContainText('2.100m');
    const sheetRow = purchases.getByRole('row').filter({ hasText: 'Plexi sheet 3050 × 2030' });
    await expect(sheetRow).toContainText('2');
    await expect(sheetRow).toContainText('3.050m');

    await dialog.getByRole('button', { name: 'Copy as CSV', exact: true }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Pieces to cut,panel,rectangle,Acrylic panel 1,1,2.100m,1.200m,2.100m');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Materials to purchase,stock,acrylic_sheet,Plexi sheet 3050 × 2030,2,3.050m,2.030m');
    await attachCalculatorScreenshot(page, testInfo, 'infill-sheet-desktop.png');
  });
});

test('authenticated calculator shows kerf-safe 3m x 1m strip purchasing at 1024px', async ({ page }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { routeId: 'calculator', phase: 'infill-strip-accuracy-1024' }, async () => {
    const dialog = await openCustomInfill(page, 1024);
    await dialog.getByText('Change automatic choices', { exact: true }).click();
    await dialog.getByLabel('Panel material', { exact: true }).selectOption('strip_620');
    await dialog.getByLabel('Joiner direction', { exact: true }).selectOption('horizontal');
    await setNumber(dialog, 'Width (m)', '3');
    await setNumber(dialog, 'Height (m)', '1');
    await openResults(dialog, true);

    const pieces = dialog.getByRole('table', { name: 'Pieces to cut · Infill cut list estimate' });
    const purchases = dialog.getByRole('table', { name: 'Materials to purchase · Infill cut list estimate' });
    await expect(pieces.getByRole('row').filter({ hasText: 'Acrylic panel' })).toHaveCount(2);
    await expect(pieces.getByRole('row').filter({ hasText: 'Joiner · Internal' })).toContainText('3.000m');
    const stripRow = purchases.getByRole('row').filter({ hasText: 'Crystalite 620 · 4m' });
    await expect(stripRow).toContainText('2');
    await expect(stripRow).toContainText('4.000m');
    const dimensions = await dialog.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    const piecesHeading = dialog.getByRole('heading', { name: 'Pieces to cut', exact: true });
    const purchasesHeading = dialog.getByRole('heading', { name: 'Materials to purchase', exact: true });
    const diagramHeading = dialog.getByRole('heading', { name: 'Cutting diagram', exact: true });
    const productionOrder = await piecesHeading.evaluate((heading) => {
      let scrollOwner = heading.parentElement;
      while (scrollOwner) {
        const overflowY = window.getComputedStyle(scrollOwner).overflowY;
        if ((overflowY === 'auto' || overflowY === 'scroll') && scrollOwner.scrollHeight > scrollOwner.clientHeight) break;
        scrollOwner = scrollOwner.parentElement;
      }
      const headingBounds = heading.getBoundingClientRect();
      const ownerBounds = scrollOwner?.getBoundingClientRect();
      return {
        scrollTop: scrollOwner?.scrollTop ?? -1,
        headingTop: headingBounds.top,
        ownerTop: ownerBounds?.top ?? -1,
        ownerBottom: ownerBounds?.bottom ?? -1,
      };
    });
    expect(productionOrder.scrollTop).toBeLessThanOrEqual(12);
    expect(productionOrder.headingTop).toBeGreaterThanOrEqual(productionOrder.ownerTop);
    expect(productionOrder.headingTop).toBeLessThan(productionOrder.ownerBottom);
    const [piecesBox, purchasesBox, diagramBox] = await Promise.all([
      piecesHeading.boundingBox(),
      purchasesHeading.boundingBox(),
      diagramHeading.boundingBox(),
    ]);
    expect(piecesBox).not.toBeNull();
    expect(purchasesBox).not.toBeNull();
    expect(diagramBox).not.toBeNull();
    expect(piecesBox?.y ?? 0).toBeLessThan(purchasesBox?.y ?? 0);
    expect(purchasesBox?.y ?? 0).toBeLessThan(diagramBox?.y ?? 0);
    await attachCalculatorScreenshot(page, testInfo, 'infill-strip-1024.png');
  });
});

test('authenticated calculator blocks unmanufacturable stock and routes the fix to Opening', async ({ page }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { routeId: 'calculator', phase: 'infill-stock-blocker' }, async () => {
    const dialog = await openCustomInfill(page, 1600);
    await setNumber(dialog, 'Width (m)', '7');
    await setNumber(dialog, 'Height (m)', '7');
    await advanceToResults(dialog);

    await expect(dialog.getByText('Cannot manufacture', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copy as CSV', exact: true })).toHaveCount(0);
    await dialog.getByRole('button', { name: /Fix details$/ }).first().click();
    await expect(dialog.getByRole('button', { name: /^1 Opening$/ })).toHaveAttribute('aria-current', 'step');
    await expect(dialog.getByLabel('Panel material', { exact: true })).toBeFocused();
  });
});

test('authenticated calculator routes invalid partial-edge rafter matching to Existing supports', async ({ page }, testInfo) => {
  await withPortalBrowserEvidence(page, testInfo, { routeId: 'calculator', phase: 'infill-partial-rafter-blocker' }, async () => {
    const dialog = await openCustomInfill(page, 1600);
    await dialog.getByLabel('Location', { exact: true }).selectOption('front');
    await setNumber(dialog, 'Width (m)', '6');
    await setNumber(dialog, 'Height (m)', '1');
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await dialog.getByLabel('Existing internal supports', { exact: true }).selectOption('match_roof_rafters');
    await dialog.getByRole('button', { name: 'Back', exact: true }).click();
    await setNumber(dialog, 'Width (m)', '5');
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();

    await expect(dialog.getByLabel('Existing internal supports', { exact: true })).toHaveValue('match_roof_rafters');
    await expect(dialog).toContainText('Roof-rafter matching only works on a full front or house edge. Choose explicit positions.');
    await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(dialog.getByText('Cannot manufacture', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copy as CSV', exact: true })).toHaveCount(0);

    await dialog.getByRole('button', { name: /Fix details$/ }).first().click();
    await expect(dialog.getByRole('button', { name: /^2 Existing supports$/ })).toHaveAttribute('aria-current', 'step');
    await expect(dialog.getByLabel('Existing internal supports', { exact: true })).toBeFocused();
    await dialog.getByLabel('Existing internal supports', { exact: true }).selectOption('none');
    await dialog.getByRole('button', { name: /^3 Results/ }).click();
    await expect(dialog.getByText('Ready', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Copy as CSV', exact: true })).toBeVisible();
  });
});
