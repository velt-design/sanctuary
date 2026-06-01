import { describe, expect, it } from 'vitest';
import type { GeometryTopProjectionViewModel } from '@sp/geometry';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { planHouseFormOwner } from '@/lib/drawings/views/plan/planShapeOwnership';
import { buildWorkbenchSolvedModel } from './workbenchSolvedModel';
import { buildProjectPlanProjection } from './projectPlanProjection';

function getFixture(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) throw new Error(`Missing ${name} workbench fixture.`);
  return fixture;
}

function houseShapeIds(
  projection: GeometryTopProjectionViewModel | null,
  houseFormId: string,
): string[] {
  if (!projection) throw new Error('Expected project plan projection.');
  return projection.shapes
    .filter((shape) => shape.family === 'house' && planHouseFormOwner(shape) === houseFormId)
    .map((shape) => shape.id)
    .sort();
}

describe('buildProjectPlanProjection', () => {
  it('emits stable project-level house references and roof bodies independent of active pergola', () => {
    const fixture = getFixture('multi-house-u-two-pergola');
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

    const rebuiltProjection = buildProjectPlanProjection({
      projectHouseGeometries: pergolaOneActive.projectHouseGeometries,
      projectPergolaPlanShapes: pergolaOneActive.projectPergolaPlanShapes,
    });

    expect(rebuiltProjection).toEqual(pergolaOneActive.projectPlanProjection);
    for (const houseFormId of ['house-main', 'house-form-2']) {
      const ids = houseShapeIds(rebuiltProjection, houseFormId);
      expect(ids.some((id) => id === `house_reference:${houseFormId}`)).toBe(true);
      expect(ids.some((id) => id.startsWith(`house_roof_material:${houseFormId}:`))).toBe(true);
      expect(ids).toEqual(houseShapeIds(pergolaTwoActive.projectPlanProjection, houseFormId));
    }
  });
});
