import { describe, expect, it } from 'vitest';
import { buildDrawingWorkbenchStore } from '@/lib/drawings/state/drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from '@/lib/drawings/state/drawingWorkbenchUiState';
import { buildWorkbenchSolvedModel } from '@/lib/drawings/state/workbenchSolvedModel';
import { buildWorkbenchDebugFixtureExport } from '@/lib/drawings/workbenchDebugExport';
import { buildEstimateDrawingModuleInfoRows, buildEstimateDrawingSheetMeta } from '@/lib/estimates/drawingSheet';
import {
  listParityCriticalSanctuaryGeometryWorkbenchFixtures,
  listSanctuaryGeometryWorkbenchFixtures,
} from './sanctuaryWorkbenchFixtures';
import {
  buildCapturedSanctuaryGeometryWorkbenchFixture,
  CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES,
} from './sanctuaryWorkbenchCapturedFixtures';

describe('sanctuary workbench fixtures', () => {
  it('exposes one fixture for each target V1 family', () => {
    expect(listSanctuaryGeometryWorkbenchFixtures().map((fixture) => fixture.slug)).toEqual([
      'mono-standard',
      'gable-standard',
      'box-standard',
      'gable-u-hipped-screenshot',
      'mono-join-screenshot',
      'multi-house-u-two-pergola',
      'multi-house-custom-projection',
      'captured-house-roof-failure-2026-06-02',
    ]);
  });

  it('keeps the live captured failure lane exact and explicit', () => {
    expect(CAPTURED_SANCTUARY_GEOMETRY_WORKBENCH_FIXTURES.map((fixture) => fixture.slug)).toEqual([
      'captured-house-roof-failure-2026-06-02',
    ]);
    expect(
      listSanctuaryGeometryWorkbenchFixtures()
        .map((fixture) => fixture.slug)
        .filter((slug) => /^captured-house-roof-failure-/.test(slug)),
    ).toEqual(['captured-house-roof-failure-2026-06-02']);
  });

  it('keeps parity-critical fixture metadata explicit and stable', () => {
    expect(listParityCriticalSanctuaryGeometryWorkbenchFixtures().map((fixture) => fixture.slug)).toEqual([
      'mono-standard',
      'gable-standard',
      'box-standard',
      'gable-u-hipped-screenshot',
      'mono-join-screenshot',
    ]);

    for (const fixture of listParityCriticalSanctuaryGeometryWorkbenchFixtures()) {
      const module = (
        fixture.snapshot as {
          inputs?: {
            modules?: Array<{
              attachmentSide?: string;
              lengthM?: string;
              projectionM?: string;
              roofMaterial?: string;
              roofPitchDeg?: string;
            }>;
          };
        }
      ).inputs?.modules?.[0];

      expect(fixture.qa.source, fixture.slug).toBe('baked_workbench_fixture');
      expect(fixture.qa.purpose.trim(), fixture.slug).toBeTruthy();
      expect(module?.lengthM, fixture.slug).toBe(String(fixture.qa.expectedModule.lengthM));
      expect(module?.projectionM, fixture.slug).toBe(String(fixture.qa.expectedModule.projectionM));
      expect(module?.roofMaterial, fixture.slug).toBe(fixture.qa.expectedModule.roofMaterial);
      expect(module?.attachmentSide, fixture.slug).toBe(fixture.qa.expectedModule.attachmentSide);
      expect(module?.roofPitchDeg, fixture.slug).toBe(String(fixture.qa.expectedModule.roofPitchDeg));
    }
  });

  it('keeps the gable fixture on the installed end-frame baseline', () => {
    const gable = listSanctuaryGeometryWorkbenchFixtures().find((fixture) => fixture.slug === 'gable-standard');
    const module = (gable?.snapshot as { inputs?: { modules?: Array<{ gableEndFramesMode?: string }> } } | undefined)?.inputs?.modules?.[0];

    expect(module?.gableEndFramesMode).toBe('outer_end_only');
  });

  it('exposes a production-aligned multi-object repro fixture', () => {
    const fixture = listSanctuaryGeometryWorkbenchFixtures().find(
      (candidate) => candidate.slug === 'multi-house-u-two-pergola',
    );
    if (!fixture) throw new Error('Expected multi-object fixture.');

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      ui: createDrawingWorkbenchUiState(),
      moduleLabels: fixture.moduleLabels,
      geometryIdentity: {
        projectId: 'fixture-multi-house',
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
      },
    });
    const objectFirst = fixture.draft?.objectFirst;

    expect(objectFirst?.houseAssembly?.houseForms).toHaveLength(2);
    expect(objectFirst?.pergolas.map((pergola) => pergola.id)).toEqual(['pergola-1', 'pergola-2']);
    expect(store.derived.houseForms.map((houseForm) => houseForm.id)).toEqual(['house-main', 'house-form-2']);
    expect(store.derived.objectWorkbench.pergolas.map((pergola) => pergola.id)).toEqual(['pergola-1', 'pergola-2']);
    expect(store.derived.solvedModel.projectPergolaRenderHealth.find(
      (health) => health.pergolaId === 'pergola-2',
    )).toMatchObject({
      canRenderCommittedBody: false,
      suppressedCommittedBodyReason: 'unresolved_host',
      hostAttachmentCode: 'missing_attachment_edge',
    });
    expect(store.derived.solvedModel.projectPergolaFallbackPlanShapes.some(
      (shape) =>
        shape.sourceType === 'pergola_reference' &&
        (shape.metadata?.pergolaId === 'pergola-2' || shape.sourceObjectId === 'pergola-2'),
    )).toBe(true);
    expect(store.derived.solvedModel.projectHouseGeometries.map((entry) => entry.houseFormId)).toEqual([
      'house-main',
      'house-form-2',
    ]);
    expect(store.derived.solvedModel.projectPlanProjection?.shapes.some(
      (shape) => shape.id === 'house_plan_roof:house-main',
    )).toBe(true);
    expect(store.derived.solvedModel.projectPlanProjection?.shapes.some(
      (shape) => shape.id === 'house_plan_roof:house-form-2',
    )).toBe(true);

    const debugExport = buildWorkbenchDebugFixtureExport({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      ui: store.ui,
      projectGeometryPreview: store.derived.solvedModel.projectGeometryPreview,
      houseGeometryInputsById: store.derived.solvedModel.houseGeometryInputsById,
      projectHouseProjectionHealth: store.derived.solvedModel.projectHouseProjectionHealth,
      projectPergolaRenderHealth: store.derived.solvedModel.projectPergolaRenderHealth,
    });
    expect(debugExport.objectFirst?.houseAssembly?.houseForms).toHaveLength(2);
    expect(debugExport.renderDiagnostics.projectPreviewSource).toBe('project_pipeline');
    expect(Object.keys(debugExport.renderDiagnostics.houseGeometryInputsById).sort()).toEqual([
      'house-form-2',
      'house-main',
    ]);
    expect(debugExport.renderDiagnostics.projectPergolaRenderHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pergolaId: 'pergola-2',
          canRenderCommittedBody: false,
          suppressedCommittedBodyReason: 'unresolved_host',
        }),
      ]),
    );
  });

  it('can convert a copied workbench debug payload into a baked fixture shell', () => {
    const fixture = listSanctuaryGeometryWorkbenchFixtures().find(
      (candidate) => candidate.slug === 'multi-house-u-two-pergola',
    );
    if (!fixture) throw new Error('Expected multi-object fixture.');

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      ui: createDrawingWorkbenchUiState(),
      moduleLabels: fixture.moduleLabels,
      geometryIdentity: {
        projectId: 'fixture-captured-shell',
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
      },
    });
    const debugExport = buildWorkbenchDebugFixtureExport({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      ui: store.ui,
      projectGeometryPreview: store.derived.solvedModel.projectGeometryPreview,
      houseGeometryInputsById: store.derived.solvedModel.houseGeometryInputsById,
      projectHouseProjectionHealth: store.derived.solvedModel.projectHouseProjectionHealth,
      projectPergolaRenderHealth: store.derived.solvedModel.projectPergolaRenderHealth,
    });

    const captured = buildCapturedSanctuaryGeometryWorkbenchFixture({
      slug: 'captured-shell-test',
      label: 'Captured Shell Test',
      payload: debugExport,
      expectedModule: fixture.qa.expectedModule,
      moduleLabels: fixture.moduleLabels,
    });
    const capturedStore = buildDrawingWorkbenchStore({
      snapshot: captured.snapshot,
      draft: captured.draft,
      ui: createDrawingWorkbenchUiState(),
      moduleLabels: captured.moduleLabels,
      geometryIdentity: {
        projectId: 'fixture-captured-shell-replay',
        estimateId: captured.estimate.id,
        designRequestId: captured.request.id,
      },
    });

    expect(captured.qa.source).toBe('baked_workbench_fixture');
    expect(captured.draft?.objectFirst?.houseAssembly?.houseForms).toHaveLength(2);
    expect(Object.keys(capturedStore.derived.solvedModel.houseGeometryInputsById).sort()).toEqual([
      'house-form-2',
      'house-main',
    ]);
    expect(capturedStore.derived.solvedModel.projectPergolaRenderHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pergolaId: 'pergola-2',
          canRenderCommittedBody: false,
          suppressedCommittedBodyReason: 'unresolved_host',
        }),
      ]),
    );
  });

  it('replays the exact captured house roof failure fixture through healthy roof diagnostics', () => {
    const fixture = listSanctuaryGeometryWorkbenchFixtures().find(
      (candidate) => candidate.slug === 'captured-house-roof-failure-2026-06-02',
    );
    if (!fixture) throw new Error('Expected captured house roof fixture.');

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      ui: createDrawingWorkbenchUiState(),
      moduleLabels: fixture.moduleLabels,
      geometryIdentity: {
        projectId: 'fixture-captured-house-roof',
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
      },
    });

    const houseInput = store.derived.solvedModel.houseGeometryInputsById['house-main'];
    const houseHealth = store.derived.solvedModel.projectHouseProjectionHealth.find(
      (entry) => entry.houseFormId === 'house-main',
    );

    expect(fixture.draft?.objectFirst).toBeUndefined();
    expect(store.derived.houseForms.map((houseForm) => houseForm.id)).toEqual(['house-main']);
    expect(houseInput).toEqual(
      expect.objectContaining({
        failureStage: 'none',
        diagnosticCode: null,
        roofPipelineFailureStage: 'none',
        footprintNormalizationStatus: 'ok',
        eavePolygonConstructionStatus: 'ok',
        roofIntentNormalizationStatus: 'ok',
        roofTopologyClassificationStatus: 'ok',
        roofPlaneGenerationStatus: 'ok',
        roofQaValidationStatus: 'ok',
        rawRoofIntentForm: 'hipped',
        resolvedRoofIntentForm: 'hipped',
        roofIntentResolutionSource: 'object_first_unauthed_default',
        roofIntentRepairCode: null,
        roofGeometry: 'rectangular_hipped',
      }),
    );
    expect(houseInput?.roofPlaneCountAfterQa).toBeGreaterThan(0);
    expect(houseInput?.roofMaterialVisualCount).toBeGreaterThan(0);
    expect(houseHealth).toEqual(
      expect.objectContaining({
        failureStage: 'none',
        diagnosticCode: null,
        roofValidationStatus: 'valid',
        canRenderCommittedBody: true,
        visibleReferenceFallbackIds: [],
      }),
    );
    expect(houseHealth?.roofBodyCount).toBeGreaterThan(0);
    expect(houseHealth?.roofMaterialBodyCount).toBe(0);
    expect(houseHealth?.sceneRoofMaterialBodyCount).toBeGreaterThan(0);
  });

  it('exposes a custom multi-house projection diagnostics fixture', () => {
    const fixture = listSanctuaryGeometryWorkbenchFixtures().find(
      (candidate) => candidate.slug === 'multi-house-custom-projection',
    );
    if (!fixture) throw new Error('Expected custom projection fixture.');

    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: fixture.snapshot,
      draft: fixture.draft,
      moduleLabels: fixture.moduleLabels,
      activePergolaId: 'pergola-1',
      geometryIdentity: {
        projectId: 'fixture-multi-house-custom',
        estimateId: fixture.estimate.id,
        designRequestId: fixture.request.id,
      },
    });

    if (!fixture.draft) throw new Error('Expected custom projection fixture draft.');
    expect(fixture.draft.objectFirst?.houseAssembly?.houseForms).toHaveLength(4);
    expect(solvedModel.projectHouseProjectionHealth.map((entry) => entry.houseFormId).sort()).toEqual([
      'house-main',
      'house-form-2',
      'house-form-3',
      'house-form-4',
    ].sort());
    for (const health of solvedModel.projectHouseProjectionHealth) {
      expect(health.referencePresent, health.houseFormId).toBe(true);
      expect(health.modelPresent, health.houseFormId).toBe(true);
      expect(health.failureStage, health.houseFormId).toBe('none');
      expect(health.diagnosticCode, health.houseFormId).toBeNull();
      expect(health.roofPlaneCount, health.houseFormId).toBeGreaterThan(0);
      expect(health.roofBodyCount, health.houseFormId).toBeGreaterThan(0);
      expect(health.roofMaterialBodyCount, health.houseFormId).toBe(0);
      expect(health.sceneBodyCount, health.houseFormId).toBeGreaterThan(0);
      expect(health.sceneRoofMaterialBodyCount, health.houseFormId).toBeGreaterThan(0);
      expect(health.visibleReferenceFallbackIds, health.houseFormId).toEqual([]);
    }
    expect(
      solvedModel.projectHouseProjectionHealth.find(
        (entry) => entry.houseFormId === 'house-form-4',
      ),
    ).toEqual(
      expect.objectContaining({
        diagnosticCode: null,
        roofQaStatus: 'valid',
        roofTopologySolver: 'eave_graph_source_edge_envelope',
        roofTopologySemanticQaStatus: 'valid',
        roofTopologySemanticFailureReason: null,
        roofTopologyExactPartitionQaStatus: expect.stringMatching(/^(valid|invalid)$/),
        roofTopologyExactPartitionFaceCount: expect.any(Number),
        roofTopologyClosedFaceCount: 6,
        roofTopologyExpectedFaceCount: 6,
        roofTopologyCoverageGapAreaMm2: 0,
        roofTopologyOverlapAreaMm2: 0,
        roofTopologyDanglingFeatureCount: 0,
        footprintCanonicalizationStatus: 'canonicalized',
        footprintCanonicalizationPrecisionMm: 0.001,
        footprintCanonicalizationPointCountBefore: 6,
        footprintCanonicalizationPointCountAfter: 6,
      }),
    );
  });

  it('builds a non-empty drawing store and sheet meta for every fixture', () => {
    for (const fixture of listSanctuaryGeometryWorkbenchFixtures()) {
      const store = buildDrawingWorkbenchStore({
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        ui: createDrawingWorkbenchUiState(),
        moduleLabels: fixture.moduleLabels,
      });

      expect(store.persisted.modules.length, fixture.slug).toBeGreaterThan(0);
      expect(store.derived.activeModule, fixture.slug).not.toBeNull();
      expect(store.derived.status, fixture.slug).toBe('ready');

      const meta = buildEstimateDrawingSheetMeta({
        moduleLabel: store.derived.activeModuleLabel,
        moduleInfoRows: buildEstimateDrawingModuleInfoRows(store.derived.activeModule?.drawingModule.input),
        view: store.ui.activeView,
        versionLabel: fixture.estimate.versionLabel,
        estimateDate: fixture.estimate.createdAt,
        projectName: 'Fixture Project',
        siteAddress: '1 Fixture Street',
        clientName: 'Fixture Preview',
      });

      expect(meta.moduleTitle, fixture.slug).toBeTruthy();
      expect(meta.drawingTitle, fixture.slug).toContain(store.derived.activeModuleLabel);
    }
  });

  it('solves every parity-critical fixture through the geometry-ready workbench path', () => {
    for (const fixture of listParityCriticalSanctuaryGeometryWorkbenchFixtures()) {
      const solvedModel = buildWorkbenchSolvedModel({
        snapshot: fixture.snapshot,
        draft: fixture.draft,
        moduleLabels: fixture.moduleLabels,
        geometryIdentity: {
          projectId: 'fixture-roof',
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
        },
      });
      const activeModule = solvedModel.activeModule;

      expect(solvedModel.trust.status, fixture.slug).toBe('geometry_ready');
      expect(activeModule?.trust.status, fixture.slug).toBe('geometry_ready');
      expect(activeModule?.assembly?.family, fixture.slug).toBe(fixture.qa.shapeFamily);
      expect(activeModule?.assembly?.roofPlanes, fixture.slug).toHaveLength(fixture.qa.expectedModule.roofPlaneCount);
      expect(activeModule?.geometryArtifact?.quantityTakeoff?.primaryDimensionsM, fixture.slug).toMatchObject({
        length: fixture.qa.expectedModule.lengthM,
        projection: fixture.qa.expectedModule.projectionM,
      });
    }
  });
});
