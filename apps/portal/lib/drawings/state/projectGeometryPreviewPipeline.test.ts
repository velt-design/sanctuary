import { describe, expect, it } from 'vitest';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import {
  buildProjectGeometryPreviewFromModules,
  PROJECT_GEOMETRY_PREVIEW_SOURCE_METADATA_KEY,
} from './projectGeometryPreviewPipeline';
import type { ProjectPergolaRenderHealth } from './projectObjectRenderPipeline';
import { buildWorkbenchSolvedModel, type WorkbenchSolvedModel } from './workbenchSolvedModel';

function buildMultiHouseModel(activePergolaId: string): WorkbenchSolvedModel {
  const fixture = getSanctuaryGeometryWorkbenchFixture('multi-house-u-two-pergola');
  if (!fixture) throw new Error('Missing multi-house fixture.');
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

function sceneObjectIds(preview: ReturnType<typeof buildProjectGeometryPreviewFromModules>): string[] {
  expect(preview.kind).toBe('ready');
  if (preview.kind !== 'ready') return [];
  return preview.scene.layers.flatMap((layer) => layer.objects.map((object) => object.id)).sort();
}

describe('project geometry preview pipeline', () => {
  it('builds a diagnostic project scene instead of falling back to an unresolved active module', () => {
    const model = buildMultiHouseModel('pergola-2');
    const activeModule = model.modules.find(
      (module) => module.moduleInput.pergolaId === 'pergola-2',
    ) ?? null;
    expect(activeModule?.geometryPreview.kind).toBe('ready');

    const suppressedHealth: ProjectPergolaRenderHealth[] = model.projectPergolaRenderHealth.map(
      (entry) => ({
        ...entry,
        canRenderCommittedBody: false,
        suppressedCommittedBodyReason: 'unresolved_host',
      }),
    );
    const preview = buildProjectGeometryPreviewFromModules({
      modules: model.modules,
      activeModule,
      projectHouseGeometries: model.projectHouseGeometries,
      projectPergolaRenderHealth: suppressedHealth,
      projectPergolaFallbackPlanShapes: model.projectPergolaFallbackPlanShapes,
    });

    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.scene.metadata?.[PROJECT_GEOMETRY_PREVIEW_SOURCE_METADATA_KEY]).toBe(
      'diagnostic_project_scene',
    );
    expect(sceneObjectIds(preview).some((id) => id.startsWith('project_pergola:pergola-2:'))).toBe(false);
    expect(sceneObjectIds(preview).some((id) => id.startsWith('project_pergola_fallback:pergola-2:'))).toBe(true);
  });

  it('marks normal project scene previews as project pipeline owned', () => {
    const model = buildMultiHouseModel('pergola-1');
    const preview = model.projectGeometryPreview;
    expect(preview.kind).toBe('ready');
    if (preview.kind !== 'ready') return;
    expect(preview.scene.metadata?.[PROJECT_GEOMETRY_PREVIEW_SOURCE_METADATA_KEY]).toBe(
      'project_pipeline',
    );
  });
});
