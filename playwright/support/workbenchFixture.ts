import { expect, type Page } from '@playwright/test';

export async function openWorkbenchFixture(page: Page, fixtureSlug: string) {
  await page.goto(`/qa/design-workbench-fixture?fixture=${encodeURIComponent(fixtureSlug)}`);
  await expect(page.locator('[data-workbench-fixture]').first()).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState('networkidle');
}

export async function switchWorkbenchMode(page: Page, modeName: string) {
  await page.getByRole('tab', { name: modeName }).first().click();
}

export async function selectRailObject(page: Page, family: string, objectId: string) {
  await page.locator(`[data-workbench-object-button="${family}:${objectId}"]`).click();
  await expect(page.locator(`[data-active-workbench-object="${family}:${objectId}"]`).first()).toBeVisible();
}

export async function clearPlanSelection(page: Page) {
  await page.locator('[data-plan-viewport="true"]').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('[data-plan-viewport="true"]')).toHaveAttribute(
    'data-plan-selection-halo-count',
    '0',
  );
}

async function readPlanShapeIds(page: Page, selector = '[data-plan-shape-id]'): Promise<string[]> {
  return page.locator(selector).evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-plan-shape-id'))
      .filter((value): value is string => Boolean(value))
      .sort(),
  );
}

export async function readVisibleHouseBodyIds(page: Page): Promise<string[]> {
  const ids = await readPlanShapeIds(
    page,
    '[data-plan-shape-family="house"][data-plan-shape-id]',
  );
  return ids.filter((id) => id.startsWith('house_roof_material:') || id.startsWith('house_surface_solid:'));
}

export async function readVisiblePergolaShapeIds(page: Page): Promise<string[]> {
  return readPlanShapeIds(
    page,
    '[data-plan-shape-family="pergola"][data-plan-shape-id]',
  );
}

export async function readHouseHitTargetIds(page: Page): Promise<string[]> {
  return page
    .locator('[data-plan-shape-family="house"][data-plan-hit-shape-id]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-plan-hit-shape-id'))
        .filter((value): value is string => Boolean(value))
        .sort(),
    );
}

export async function readPlanSelectionIds(page: Page): Promise<string[]> {
  return page.locator('[data-plan-selection-shape-id]').evaluateAll((nodes) =>
    nodes
      .map((node) => node.getAttribute('data-plan-selection-shape-id'))
      .filter((value): value is string => Boolean(value))
      .sort(),
  );
}

export async function expect3DViewportEvidence(page: Page) {
  const shell = page.locator('[data-testid="geometry-3d-canvas-shell"]').first();
  await expect(shell).toBeVisible();

  const diagnostics = page.locator('[data-testid="geometry-3d-viewport-diagnostics"]').first();
  await expect(diagnostics).toHaveAttribute('data-finite-bounds', 'true');

  const objectCount = Number(await diagnostics.getAttribute('data-scene-object-count'));
  const layerCount = Number(await diagnostics.getAttribute('data-layer-count'));
  expect(Number.isFinite(objectCount)).toBe(true);
  expect(Number.isFinite(layerCount)).toBe(true);
  expect(objectCount).toBeGreaterThan(0);
  expect(layerCount).toBeGreaterThan(0);

  const box = await shell.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(100);
  expect(box?.height ?? 0).toBeGreaterThan(100);
}
