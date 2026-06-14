import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchProjectModelFromObjectFirstDraft,
  type ObjectFirstHouseFormDraft,
  type ObjectFirstPergolaDraft,
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

function makePergola(
  overrides: Partial<ObjectFirstPergolaDraft> = {},
): ObjectFirstPergolaDraft {
  return {
    id: 'pergola-main',
    label: 'Pergola',
    family: 'mono',
    connectionKind: 'freestanding',
    attachmentEdgeId: null,
    attachmentZoneId: null,
    side: 'rear',
    strategy: null,
    geometry: {
      dimensions: {
        lengthM: '6',
        projectionM: '3',
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
      },
      roof: {
        material: 'acrylic',
        pitchDeg: '5',
      },
      gable: {
        endFramesMode: 'outer_end_only',
        houseEaveGutterMode: 'house',
        outerEaveGutterMode: 'our',
      },
      supports: {
        postCount: '4',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      },
    },
    position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
    attachment: {
      spatialKind: 'freestanding',
      method: 'none',
      host: null,
    },
    ...overrides,
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

  it('integrates solved pergola artifacts into project Plan and 3D output', () => {
    const draft = makeProjectDraft();
    draft.pergolas = [
      makePergola({
        id: 'pergola-a',
        label: 'Pergola A',
        position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
      }),
      makePergola({
        id: 'pergola-b',
        label: 'Pergola B',
        position: { originXMm: '9000', originYMm: '0', rotationDeg: '0' },
      }),
    ];
    const projectModel = buildWorkbenchProjectModelFromObjectFirstDraft(draft);
    const solvedModel = buildWorkbenchSolvedModel({
      projectModel,
      geometryIdentity: {
        projectId: 'project-1',
        estimateId: 'estimate-1',
      },
    });

    const artifact = solvedModel.projectArtifact;
    const health = artifact.diagnostics.projectPergolaRenderHealth;
    expect(health).toHaveLength(2);
    expect(health.map((entry) => entry.pergolaId).sort()).toEqual(['pergola-a', 'pergola-b']);
    expect(health.every((entry) => entry.solveStatus === 'geometry_ready')).toBe(true);
    expect(health.every((entry) => entry.canRenderCommittedBody)).toBe(true);

    expect(artifact.planLayers.committedPergolaShapes.length).toBeGreaterThan(0);
    expect(
      artifact.planLayers.committedPergolaShapes.some((shape) =>
        shape.id.startsWith('project_pergola:pergola-a:'),
      ),
    ).toBe(true);
    expect(
      artifact.planLayers.committedPergolaShapes.some((shape) =>
        shape.id.startsWith('project_pergola:pergola-b:'),
      ),
    ).toBe(true);
    expect(artifact.geometryPreview.kind).toBe('ready');
    if (artifact.geometryPreview.kind === 'ready') {
      expect(artifact.geometryPreview.scene.metadata?.projectPergolaSceneCount).toBe(2);
      expect(artifact.geometryPreview.scene.metadata?.projectPergolaSceneIds).toBe('pergola-a,pergola-b');
    }
  });

  it('reports invalid and unresolved pergolas without committed bodies', () => {
    const draft = makeProjectDraft();
    draft.pergolas = [
      makePergola({
        id: 'invalid-pergola',
        family: 'unknown',
      }),
      makePergola({
        id: 'unresolved-pergola',
        connectionKind: 'soffit',
        strategy: 'soffit_brackets',
        attachment: null,
      }),
    ];
    const projectModel = buildWorkbenchProjectModelFromObjectFirstDraft(draft);
    const solvedModel = buildWorkbenchSolvedModel({
      projectModel,
      geometryIdentity: {
        projectId: 'project-1',
        estimateId: 'estimate-1',
      },
    });

    const artifact = solvedModel.projectArtifact;
    expect(artifact.diagnostics.projectPergolaRenderHealth).toHaveLength(2);
    expect(
      artifact.diagnostics.projectPergolaRenderHealth.every(
        (entry) => entry.solveStatus === 'invalid_geometry' && !entry.canRenderCommittedBody,
      ),
    ).toBe(true);
    expect(
      artifact.diagnostics.projectPergolaRenderHealth.find(
        (entry) => entry.pergolaId === 'unresolved-pergola',
      )?.hostAttachmentStatus,
    ).toBe('unresolved');
    expect(artifact.planLayers.committedPergolaShapes).toHaveLength(0);
    expect(solvedModel.trust.issues).toEqual(expect.arrayContaining(['invalid_geometry', 'unresolved_host']));
  });
});
