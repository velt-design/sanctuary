import { expect, test } from '@playwright/test';
import {
  clearPlanSelection,
  expect3DViewportEvidence,
  expectPlanHitTargetPaintIsInvisible,
  expectPlanVisibleReferenceFallbackIsOutlineOnly,
  hoverPlanHitTarget,
  openWorkbenchFixture,
  readCommittedBodyShapeIdsInPaintOrder,
  readHouseHitTargetIds,
  readPlanHouseProjectionHealth,
  readPlanHouseRenderDiagnostics,
  readPlanLocalHoverIds,
  readPlanSelectionIds,
  readVisibleHouseBodyIds,
  readVisibleHouseReferenceFallbackIds,
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
    const pergolaOneReferenceFallbackIds = await readVisibleHouseReferenceFallbackIds(page);
    const pergolaOneDiagnostics = await readPlanHouseRenderDiagnostics(page);
    const pergolaOneProjectionHealth = await readPlanHouseProjectionHealth(page);
    expect(pergolaOneHouseBodyIds.some((id) => id.includes('house_roof_material:house-main'))).toBe(true);
    expect(pergolaOneHouseBodyIds.some((id) => id.includes('house_roof_material:house-form-2'))).toBe(true);
    expect(pergolaOneHouseBodyIds.every((id) => !id.startsWith('house_reference:'))).toBe(true);
    expect(pergolaOneReferenceFallbackIds).toEqual([]);
    expect(pergolaOneDiagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          houseFormId: 'house-main',
          visibleReferenceFallbackIds: [],
        }),
        expect.objectContaining({
          houseFormId: 'house-form-2',
          visibleReferenceFallbackIds: [],
        }),
      ]),
    );
    expect(pergolaOneProjectionHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          houseFormId: 'house-main',
          roofMaterialBodyCount: expect.any(Number),
          visibleReferenceFallbackIds: [],
        }),
        expect.objectContaining({
          houseFormId: 'house-form-2',
          roofMaterialBodyCount: expect.any(Number),
          visibleReferenceFallbackIds: [],
        }),
      ]),
    );
    expect(pergolaOneHouseHitTargetIds).toEqual(
      expect.arrayContaining(['house_reference:house-main', 'house_reference:house-form-2']),
    );
    expect(pergolaOnePergolaShapeIds.some((id) => id.includes('pergola-1'))).toBe(true);
    expect(pergolaOnePergolaShapeIds.some((id) => id.includes('pergola-2'))).toBe(true);

    await selectRailObject(page, 'pergolas', 'pergola-2');
    const pergolaTwoHouseBodyIds = await readVisibleHouseBodyIds(page);
    const pergolaTwoPergolaShapeIds = await readVisiblePergolaShapeIds(page);
    const pergolaTwoHouseHitTargetIds = await readHouseHitTargetIds(page);
    const pergolaTwoReferenceFallbackIds = await readVisibleHouseReferenceFallbackIds(page);
    const pergolaTwoProjectionHealth = await readPlanHouseProjectionHealth(page);
    expect(pergolaTwoHouseBodyIds).toEqual(pergolaOneHouseBodyIds);
    expect(pergolaTwoPergolaShapeIds).toEqual(pergolaOnePergolaShapeIds);
    expect(pergolaTwoHouseHitTargetIds).toEqual(pergolaOneHouseHitTargetIds);
    expect(pergolaTwoReferenceFallbackIds).toEqual(pergolaOneReferenceFallbackIds);
    expect(pergolaTwoProjectionHealth).toEqual(pergolaOneProjectionHealth);

    const pergolaTwoSelectionIds = await readPlanSelectionIds(page);
    expect(pergolaTwoSelectionIds.some((id) => id.includes('pergola-2'))).toBe(true);

    await selectRailObject(page, 'pergolas', 'pergola-1');
    const pergolaOneAgainHouseBodyIds = await readVisibleHouseBodyIds(page);
    const pergolaOneAgainPergolaShapeIds = await readVisiblePergolaShapeIds(page);
    expect(pergolaOneAgainHouseBodyIds).toEqual(pergolaOneHouseBodyIds);
    expect(pergolaOneAgainPergolaShapeIds).toEqual(pergolaOnePergolaShapeIds);

    const paintOrderedBodyIds = await readCommittedBodyShapeIdsInPaintOrder(page);
    const lastPergolaIndex = Math.max(
      ...paintOrderedBodyIds
        .map((id, index) => (id.startsWith('project_pergola:') ? index : -1))
        .filter((index) => index >= 0),
    );
    const firstHouseRoofMaterialIndex = paintOrderedBodyIds.findIndex((id) =>
      id.startsWith('house_roof_material:'),
    );
    expect(lastPergolaIndex).toBeGreaterThanOrEqual(0);
    expect(firstHouseRoofMaterialIndex).toBeGreaterThan(lastPergolaIndex);

    await selectRailObject(page, 'house_forms', 'house-main');
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);
    expect(await readPlanSelectionIds(page)).toEqual(['house_reference:house-main']);
    await hoverPlanHitTarget(page, 'house_reference:house-main');
    await expectPlanHitTargetPaintIsInvisible(page, 'house_reference:house-main');
    expect(await readPlanLocalHoverIds(page)).toEqual([]);
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);

    await selectRailObject(page, 'house_forms', 'house-form-2');
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);
    expect(await readPlanSelectionIds(page)).toEqual(['house_reference:house-form-2']);
    await hoverPlanHitTarget(page, 'house_reference:house-form-2');
    await expectPlanHitTargetPaintIsInvisible(page, 'house_reference:house-form-2');
    expect(await readPlanLocalHoverIds(page)).toEqual([]);
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);

    await clearPlanSelection(page);
    await hoverPlanHitTarget(page, 'house_reference:house-form-2');
    await expectPlanHitTargetPaintIsInvisible(page, 'house_reference:house-form-2');
    expect(await readPlanLocalHoverIds(page)).toEqual(['house_reference:house-form-2']);
    expect(await readVisibleHouseBodyIds(page)).toEqual(pergolaOneHouseBodyIds);
  });

  test('surfaces outline-only diagnostics for visible house reference fallbacks', async ({ page }) => {
    await openWorkbenchFixture(page, MULTI_OBJECT_FIXTURE);
    await switchWorkbenchMode(page, 'Plan Editor');
    const planViewport = page.locator('[data-plan-viewport="true"]');
    await expect(planViewport).toHaveAttribute('data-plan-visible-reference-fallback-count', '0');

    const diagnostics = await readPlanHouseRenderDiagnostics(page);
    for (const house of diagnostics) {
      expect(house.referenceIds.length).toBeGreaterThan(0);
      expect(house.hitTargetIds.length).toBeGreaterThan(0);
      for (const fallbackId of house.visibleReferenceFallbackIds) {
        await expectPlanVisibleReferenceFallbackIsOutlineOnly(page, fallbackId);
      }
    }
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
