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
    expect(artifact.source).toBe('workbench_solved_project');
    expect(artifact.geometryPreview).toBe(solvedModel.projectGeometryPreview);
    expect(artifact.viewportGeometry).toBe(solvedModel.projectViewportGeometry);
    expect(artifact.planProjection).toBe(solvedModel.projectPlanProjection);
    expect(artifact.drawingSurfaceGeometry.artifact).toBe(
      solvedModel.projectViewportGeometry?.artifact ?? null,
    );

    expect(artifact.planLayers.houseCommittedShapes.length).toBeGreaterThan(0);
    expect(
      artifact.planLayers.houseCommittedShapes.every(
        (shape) => shape.sourceType === 'house_reference',
      ),
    ).toBe(true);
    expect(artifact.snapSources.house).toEqual([
      {
        houseFormId: 'house-main',
        model: solvedModel.projectHouseGeometries[0]?.model,
      },
    ]);
    expect(artifact.diagnostics.projectHouseProjectionHealth).toEqual(
      solvedModel.projectHouseProjectionHealth,
    );
    expect(artifact.diagnostics.projectPergolaRenderHealth).toEqual(
      solvedModel.projectPergolaRenderHealth,
    );
    expect(artifact.objectsById.houses['house-main']).toMatchObject({
      objectId: 'house-main',
      houseFormId: 'house-main',
      hasGeometryModel: true,
    });
  });
});
