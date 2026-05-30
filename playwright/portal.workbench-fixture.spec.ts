import { expect, test } from '@playwright/test';
import {
  clearPlanSelection,
  expect3DViewportEvidence,
  openWorkbenchFixture,
  readHouseHitTargetIds,
  readPlanSelectionIds,
  readVisibleHouseBodyIds,
  readVisiblePergolaShapeIds,
  selectRailObject,
  switchWorkbenchMode,
} from './support/workbenchFixture';

const MULTI_OBJECT_FIXTURE = 'multi-house-u-two-pergola';

test.describe('workbench fixture route', () => {
  test('keeps project house plan bodies stable when switching pergolas', async ({ page }) => {
    await openWorkbenchFixture(page, MULTI_OBJECT_FIXTURE);
    await switchWorkbenchMode(page, 'Plan Editor');
    const planViewport = page.locator('[data-plan-viewport="true"]');
    await expect(planViewport).toBeVisible();
    await clearPlanSelection(page);
    await expect(planViewport).toHaveAttribute('data-plan-selection-halo-count', '0');
    await expect(planViewport).toHaveAttribute('data-plan-dimension-count', '0');

    await selectRailObject(page, 'pergolas', 'pergola-1');
    const pergolaOneHouseBodyIds = await readVisibleHouseBodyIds(page);
    const pergolaOnePergolaShapeIds = await readVisiblePergolaShapeIds(page);
    const pergolaOneHouseHitTargetIds = await readHouseHitTargetIds(page);
    expect(pergolaOneHouseBodyIds.some((id) => id.includes('house_roof_material:house-main'))).toBe(true);
    expect(pergolaOneHouseBodyIds.some((id) => id.includes('house_roof_material:house-form-2'))).toBe(true);
    expect(pergolaOneHouseBodyIds.every((id) => !id.startsWith('house_reference:'))).toBe(true);
    expect(pergolaOneHouseHitTargetIds).toEqual(
      expect.arrayContaining(['house_reference:house-main', 'house_reference:house-form-2']),
    );
    expect(pergolaOnePergolaShapeIds.some((id) => id.includes('pergola-1'))).toBe(true);
    expect(pergolaOnePergolaShapeIds.some((id) => id.includes('pergola-2'))).toBe(true);

    await selectRailObject(page, 'pergolas', 'pergola-2');
    const pergolaTwoHouseBodyIds = await readVisibleHouseBodyIds(page);
    const pergolaTwoPergolaShapeIds = await readVisiblePergolaShapeIds(page);
    const pergolaTwoHouseHitTargetIds = await readHouseHitTargetIds(page);
    expect(pergolaTwoHouseBodyIds).toEqual(pergolaOneHouseBodyIds);
    expect(pergolaTwoPergolaShapeIds).toEqual(pergolaOnePergolaShapeIds);
    expect(pergolaTwoHouseHitTargetIds).toEqual(pergolaOneHouseHitTargetIds);

    const pergolaTwoSelectionIds = await readPlanSelectionIds(page);
    expect(pergolaTwoSelectionIds.some((id) => id.includes('pergola-2'))).toBe(true);

    await selectRailObject(page, 'pergolas', 'pergola-1');
    const pergolaOneAgainHouseBodyIds = await readVisibleHouseBodyIds(page);
    const pergolaOneAgainPergolaShapeIds = await readVisiblePergolaShapeIds(page);
    expect(pergolaOneAgainHouseBodyIds).toEqual(pergolaOneHouseBodyIds);
    expect(pergolaOneAgainPergolaShapeIds).toEqual(pergolaOnePergolaShapeIds);

    await selectRailObject(page, 'house_forms', 'house-main');
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);
    expect(await readPlanSelectionIds(page)).toEqual(['house_reference:house-main']);

    await selectRailObject(page, 'house_forms', 'house-form-2');
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);
    expect(await readPlanSelectionIds(page)).toEqual(['house_reference:house-form-2']);
  });

  test('renders finite 3D evidence for the multi-object fixture', async ({ page }) => {
    await openWorkbenchFixture(page, MULTI_OBJECT_FIXTURE);
    await switchWorkbenchMode(page, '3D Review');
    await selectRailObject(page, 'pergolas', 'pergola-1');
    await expect3DViewportEvidence(page);
    await selectRailObject(page, 'pergolas', 'pergola-2');
    await expect3DViewportEvidence(page);
  });
});
