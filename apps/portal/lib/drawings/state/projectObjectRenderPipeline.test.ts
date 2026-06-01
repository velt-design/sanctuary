import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildWorkbenchSolvedModel, type WorkbenchSolvedModel } from './workbenchSolvedModel';

function getFixture(name: Parameters<typeof getSanctuaryGeometryWorkbenchFixture>[0]) {
  const fixture = getSanctuaryGeometryWorkbenchFixture(name);
  if (!fixture) {
    throw new Error(`Missing ${name} workbench fixture.`);
  }
  return fixture;
}

function buildMultiHouseModel(activePergolaId: string): WorkbenchSolvedModel {
  const fixture = getFixture('multi-house-u-two-pergola');
  return buildWorkbenchSolvedModel({
    snapshot: fixture.snapshot,
    draft: fixture.draft,
    moduleLabels: fixture.moduleLabels,
    activePergolaId,
    geometryIdentity: {
      projectId: 'fixture-multi-house',
      estimateId: fixture.estimate.id,
      designRequestId: fixture.request.id,
    },
  });
}

function projectPlanPergolaIds(model: WorkbenchSolvedModel): string[] {
  return Array.from(
    new Set(
      model.projectPergolaPlanShapes
        .map((shape) => shape.metadata?.pergolaId)
        .filter((value): value is string => typeof value === 'string'),
    ),
  ).sort();
}

function projectSceneObjectIds(model: WorkbenchSolvedModel): string[] {
  const preview = model.projectGeometryPreview;
  expect(preview.kind).toBe('ready');
  if (preview.kind !== 'ready') return [];
  return preview.scene.layers.flatMap((layer) => layer.objects.map((object) => object.id)).sort();
}

describe('project object render pipeline', () => {
  it('keeps unresolved pergolas out of committed Plan and 3D bodies', () => {
    const model = buildMultiHouseModel('pergola-1');
    const healthByPergolaId = new Map(
      model.projectPergolaRenderHealth.map((entry) => [entry.pergolaId, entry]),
    );

    expect(healthByPergolaId.get('pergola-1')).toMatchObject({
      canRenderCommittedBody: true,
      suppressedCommittedBodyReason: 'none',
    });
    expect(healthByPergolaId.get('pergola-2')).toMatchObject({
      canRenderCommittedBody: false,
      hostAttachmentStatus: 'unresolved',
      hostAttachmentCode: 'missing_attachment_edge',
      suppressedCommittedBodyReason: 'unresolved_host',
    });

    expect(projectPlanPergolaIds(model)).toEqual(['pergola-1']);
    expect(
      model.projectPlanProjection?.shapes.some((shape) =>
        shape.id.startsWith('project_pergola:pergola-2:'),
      ),
    ).toBe(false);
    expect(
      model.projectPlanProjection?.shapes.some(
        (shape) =>
          shape.sourceType === 'pergola_reference' &&
          (shape.metadata?.pergolaId === 'pergola-2' || shape.sourceObjectId === 'pergola-2'),
      ),
    ).toBe(true);

    expect(projectSceneObjectIds(model).some((id) => id.startsWith('project_pergola:pergola-2:'))).toBe(false);
  });

  it('keeps project render ownership stable when active pergola changes', () => {
    const pergolaOneActive = buildMultiHouseModel('pergola-1');
    const pergolaTwoActive = buildMultiHouseModel('pergola-2');

    expect(pergolaTwoActive.projectPergolaRenderHealth).toEqual(
      pergolaOneActive.projectPergolaRenderHealth,
    );
    expect(projectPlanPergolaIds(pergolaTwoActive)).toEqual(projectPlanPergolaIds(pergolaOneActive));
    expect(
      projectSceneObjectIds(pergolaTwoActive).filter((id) => id.startsWith('project_pergola:')),
    ).toEqual(
      projectSceneObjectIds(pergolaOneActive).filter((id) => id.startsWith('project_pergola:')),
    );
    expect(pergolaTwoActive.projectHouseProjectionHealth).toEqual(
      pergolaOneActive.projectHouseProjectionHealth,
    );
  });
});
