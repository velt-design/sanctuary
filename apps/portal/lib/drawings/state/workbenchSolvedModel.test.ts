import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchProjectModelFromObjectFirstDraft,
  type ObjectFirstHouseFormDraft,
  type ObjectFirstWorkbenchDraftVNext,
} from './objectFirstWorkbenchModel';
import { buildWorkbenchSolvedModel } from './workbenchSolvedModel';

function makeHouseForm(
  overrides: Partial<ObjectFirstHouseFormDraft> = {},
): ObjectFirstHouseFormDraft {
  return {
    id: 'house-main',
    label: 'House',
    transform: { offsetXM: 0, offsetYM: 0, rotationQuarterTurns: 0 },
    footprint: {
      mode: 'preset',
      preset: 'straight',
      params: {
        widthM: '8',
        bandDepthM: '6',
      } as ObjectFirstHouseFormDraft['footprint']['params'],
      polygon: [],
      attachmentSide: 'rear',
    },
    roofIntent: {
      form: 'hipped',
      material: 'corrugated_iron',
      primaryPitchDeg: '5',
      primaryFallDirection: 'negative_y',
      ridgeAxis: 'x',
      openGableEndIds: [],
    } as ObjectFirstHouseFormDraft['roofIntent'],
    storeyMode: 'single_storey',
    attachmentStrategy: null,
    ...overrides,
  };
}

function makeProjectDraft(): ObjectFirstWorkbenchDraftVNext {
  return {
    houseAssembly: {
      id: 'assembly-main',
      label: 'House Assembly',
      houseForms: [makeHouseForm()],
    },
    decks: [],
    openings: [],
    pergolas: [],
  };
}

describe('WorkbenchSolvedProjectArtifact', () => {
  it('bundles project geometry, plan layers, snap sources, and diagnostics by object id', () => {
    const projectModel = buildWorkbenchProjectModelFromObjectFirstDraft(makeProjectDraft());
    const solvedModel = buildWorkbenchSolvedModel({
      projectModel,
      geometryIdentity: {
        projectId: 'project-1',
        estimateId: 'estimate-1',
      },
    });

    const artifact = solvedModel.projectArtifact;
    expect(Object.keys(solvedModel).sort()).toEqual([
      'geometryIdentity',
      'projectArtifact',
      'projectModel',
      'trust',
    ]);
    expect(artifact.source).toBe('workbench_solved_project');
    expect(artifact.geometryPreview.kind).toBe('ready');
    expect(artifact.viewportGeometry?.preview).toBe(artifact.geometryPreview);
    expect(artifact.planProjection?.coordinateSpace).toBe('world_xy_mm');
    expect(artifact.drawingSurfaceGeometry.artifact).toBe(
      artifact.viewportGeometry?.artifact ?? null,
    );

    expect(artifact.planLayers.houseCommittedShapes.length).toBeGreaterThan(0);
    expect(
      artifact.planLayers.houseCommittedShapes.every(
        (shape) => shape.sourceType === 'house_reference',
      ),
    ).toBe(true);
    expect(artifact.snapSources.house).toHaveLength(1);
    expect(artifact.snapSources.house[0]?.houseFormId).toBe('house-main');
    expect(artifact.snapSources.house[0]?.model).toBeTruthy();
    expect(artifact.diagnostics.projectHouseProjectionHealth.length).toBe(1);
    expect(artifact.diagnostics.projectHouseProjectionHealth[0]?.houseFormId).toBe('house-main');
    expect(artifact.diagnostics.projectPergolaRenderHealth).toEqual([]);
    expect(artifact.objectsById.houses['house-main']).toMatchObject({
      objectId: 'house-main',
      houseFormId: 'house-main',
      hasGeometryModel: true,
    });
  });
});
