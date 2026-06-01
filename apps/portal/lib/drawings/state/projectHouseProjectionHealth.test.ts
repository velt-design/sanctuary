import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildWorkbenchSolvedModel } from './workbenchSolvedModel';

describe('project house projection health', () => {
  it('is stable for the multi-house fixture across active pergola switches', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('multi-house-u-two-pergola');
    if (!fixture) throw new Error('Missing multi-house fixture.');
    const pergolaOneActive = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: 'pergola-1',
    });
    const pergolaTwoActive = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: 'pergola-2',
    });

    expect(pergolaOneActive.projectHouseProjectionHealth).toEqual(
      pergolaTwoActive.projectHouseProjectionHealth,
    );
    expect(pergolaOneActive.projectHouseProjectionHealth).toEqual(
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
  });
});
