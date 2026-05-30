import { expect, test } from '@playwright/test';
import {
  expect3DViewportEvidence,
  openWorkbenchFixture,
  readVisibleHouseBodyIds,
  selectRailObject,
  switchWorkbenchMode,
} from './support/workbenchFixture';

const MULTI_OBJECT_FIXTURE = 'multi-house-u-two-pergola';

test.describe('workbench fixture route', () => {
  test('keeps project house plan bodies stable when switching pergolas', async ({ page }) => {
    await openWorkbenchFixture(page, MULTI_OBJECT_FIXTURE);
    await switchWorkbenchMode(page, 'Plan Editor');
    await expect(page.locator('[data-plan-viewport="true"]')).toBeVisible();

    await selectRailObject(page, 'pergolas', 'pergola-1');
    const pergolaOneHouseBodyIds = await readVisibleHouseBodyIds(page);
    expect(pergolaOneHouseBodyIds.some((id) => id.includes('house_roof_material:house-main'))).toBe(true);
    expect(pergolaOneHouseBodyIds.some((id) => id.includes('house_roof_material:house-form-2'))).toBe(true);

    await selectRailObject(page, 'pergolas', 'pergola-2');
    const pergolaTwoHouseBodyIds = await readVisibleHouseBodyIds(page);
    expect(pergolaTwoHouseBodyIds).toEqual(pergolaOneHouseBodyIds);

    const pergolaTwoSelectionIds = await page.locator('[data-plan-selection-shape-id]').evaluateAll((nodes) =>
      nodes
        .map((node) => node.getAttribute('data-plan-selection-shape-id'))
        .filter((value): value is string => Boolean(value)),
    );
    expect(pergolaTwoSelectionIds.some((id) => id.includes('pergola-2'))).toBe(true);

    await selectRailObject(page, 'pergolas', 'pergola-1');
    const pergolaOneAgainHouseBodyIds = await readVisibleHouseBodyIds(page);
    expect(pergolaOneAgainHouseBodyIds).toEqual(pergolaOneHouseBodyIds);
  });

  test('renders finite 3D evidence for the multi-object fixture', async ({ page }) => {
    await openWorkbenchFixture(page, MULTI_OBJECT_FIXTURE);
    await switchWorkbenchMode(page, '3D Review');
    await expect3DViewportEvidence(page);
  });
});
