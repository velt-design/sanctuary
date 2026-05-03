import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { normalizeHouseFootprintParams } from '@/lib/types/calculator';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildEstimateDrawingDraftFromSnapshot } from '@/lib/estimates/drawingEdits';
import { ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY } from '@/lib/estimates/costingPayload';
import { buildDrawingWorkbenchStore } from './drawingWorkbenchStore';
import {
  createDrawingWorkbenchUiState,
  deriveDrawingWorkbenchCompatibilitySelection,
  normalizeDrawingWorkbenchUiState,
} from './drawingWorkbenchUiState';
import { makeHouseFirstDeckSupportSnapshotFixture } from './houseFirstWorkbenchFixtures';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from './objectFirstWorkbenchAdapter';
import {
  type ObjectWorkbenchCompatibilityDraft,
  buildObjectFirstDeckDraftsFromCompatibilityDrafts,
  buildObjectFirstOpeningDraftsFromCompatibilityDrafts,
} from './legacyObjectFirstCompatibilityAdapter';
import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { makeObjectFirstWorkbenchProjectFixture } from './objectFirstWorkbenchFixtures';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  const base: Partial<CalculatorModuleInputs> = {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    roofPitchDeg: '5',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxGutterHouseEdge: 'house',
    boxGutterFarEdge: 'our',
    downpipeCount: '0',
    downpipeJoinCount: '0',
    downpipeElbowCount: '0',
    separateGutterEnabled: false,
    overhangEnabled: false,
    overhangAmountM: '0',
    overhangSupportBeamProfile: '150x50',
    invertedEnabled: false,
    invertedHouseGutter: false,
    mixedSkylightStripCount: '0',
    mixedSkylightStripWidthM: '0',
    mixedAcrylicBaysMain: '0',
    mixedAcrylicBaysA: '0',
    mixedAcrylicBaysB: '0',
    timberRoofAboveType: 'insulated_panels',
    timberInsulatedPanelThicknessMm: '50',
    timberTrayWidthMm: '500',
    postCount: '2',
    houseConnectionType: 'soffit',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    postCutHeightM: '2.4',
    timberRoofAllowanceExGst: '0',
    flashings: { rows: [] },
    overrides: {},
    infills: { items: [] },
  };
  return { ...base, ...overrides } as CalculatorModuleInputs;
}

function makeResult(params: { lengthA?: number; spanA?: number } = {}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: 'pitched',
      gutter_type: 'SP Gutter',
    },
    derived: {
      length_m: params.lengthA ?? 6,
      projection_m: params.spanA ?? 3,
      slope_direction: 'away_from_house',
      roof_pitch_deg_used: 5,
      post_cut_height_house_side_m: 2.4,
      post_cut_height_outer_side_m: 2.1,
      post_profile_used: '90x90',
      rafter_profile_auto: '50x150',
      ledger_profile_used: '50x100',
      support_beam_profile_used: '50x150',
      front_beam_profile_used: '50x150',
      rafter_count: 11,
      rafter_spacing_mm: 600,
      gutter_assembly_mode: 'integrated',
      integrated_gutter_beam: true,
      has_our_gutter: true,
      overhang_enabled: false,
      overhang_amount_m: 0,
      effective_run_m: 2.85,
      acrylic_required_downslope_m: 2.88088653699854,
      joiner_piece_length_m: 2.88088653699854,
      joiner_runs_total: 11,
      rafter_house_allowance_m: 0.05,
      rafter_far_allowance_m: 0.1,
      acrylic_area_m2: 18.06875707578025,
    },
  } as unknown as CostOutputV1;
}

function applyObjectFirstCompatibilityDraft(input: {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
  compatibility: ObjectWorkbenchCompatibilityDraft;
}): EstimateDrawingDraft {
  const baselineStore = buildDrawingWorkbenchStore({
    snapshot: input.snapshot,
    draft: input.draft,
    ui: createDrawingWorkbenchUiState(),
  });
  const objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(baselineStore.persisted.projectModel);
  const houseForm = objectFirst.houseAssembly?.houseForms[0] ?? null;
  const derivedEnvelope = baselineStore.persisted.projectModel.houseAssembly?.derivedEnvelope ?? null;

  if (input.compatibility.roof && houseForm) {
    const roofPatch = input.compatibility.roof;
    houseForm.roofIntentAuthored = true;
    houseForm.roofIntent = {
      ...houseForm.roofIntent,
      form: roofPatch.form ?? houseForm.roofIntent.form,
      material: roofPatch.material ?? houseForm.roofIntent.material,
      primaryPitchDeg: roofPatch.primaryPitchDeg ?? houseForm.roofIntent.primaryPitchDeg,
      primaryFallDirection: roofPatch.primaryFallDirection ?? houseForm.roofIntent.primaryFallDirection,
      ridgeAxis: roofPatch.ridgeAxis ?? houseForm.roofIntent.ridgeAxis,
      openGableEndIds: roofPatch.openGableEndIds ?? houseForm.roofIntent.openGableEndIds,
      appendage: {
        enabled: roofPatch.appendage?.enabled ?? houseForm.roofIntent.appendage.enabled,
        form: roofPatch.appendage?.form ?? houseForm.roofIntent.appendage.form,
        hostEdge: roofPatch.appendage?.hostEdge ?? houseForm.roofIntent.appendage.hostEdge,
        pitchDeg: roofPatch.appendage?.pitchDeg ?? houseForm.roofIntent.appendage.pitchDeg,
        dropMm: roofPatch.appendage?.dropMm ?? houseForm.roofIntent.appendage.dropMm,
      },
    };
  }
  if (input.compatibility.decks) {
    objectFirst.decks = buildObjectFirstDeckDraftsFromCompatibilityDrafts(input.compatibility.decks);
  }
  if (input.compatibility.openings) {
    const openings = input.compatibility.openings.map((opening) => {
      const hostWallId =
        opening.hostWallId ??
        (opening.hostEdgeId
          ? derivedEnvelope?.edges.find((edge) => edge.id === opening.hostEdgeId)?.hostWallId ?? null
          : null) ??
        (opening.wallId
          ? derivedEnvelope?.attachmentZones.find((zone) => zone.side === opening.wallId)?.hostWallId ?? null
          : null);
      return {
        ...opening,
        hostWallId,
      };
    });
    objectFirst.openings = buildObjectFirstOpeningDraftsFromCompatibilityDrafts(
      openings,
      houseForm?.id ?? null,
    );
  }
  if (input.compatibility.pergolas) {
    objectFirst.pergolas = input.compatibility.pergolas.map((pergola) => {
      const objectPergola = baselineStore.persisted.projectModel.pergolas.find((candidate) => candidate.id === pergola.id);
      return {
        id: pergola.id,
        label: objectPergola?.label ?? pergola.id,
        family: objectPergola?.family ?? 'unknown',
        attachmentEdgeId: pergola.attachmentEdgeId ?? null,
        attachmentZoneId: pergola.attachmentZoneId ?? null,
        side: objectPergola?.side ?? 'rear',
        strategy: objectPergola?.strategy ?? null,
      };
    });
  }

  input.draft.objectFirst = objectFirst;
  return input.draft;
}

function makeStaleGableFixtureSnapshot(houseConnectionType: 'none' | 'soffit' = 'soffit') {
  const fixture = getSanctuaryGeometryWorkbenchFixture('gable-standard');
  if (!fixture) {
    throw new Error('Missing gable-standard fixture.');
  }
  const snapshot = structuredClone(fixture.snapshot) as {
    inputs?: {
      modules?: Array<{
        houseConnectionType?: string;
        gableEndFramesMode?: string;
        gableHouseEdgeGutter?: string;
        gableOuterEdgeGutter?: string;
      }>;
    };
  };
  const module = snapshot.inputs?.modules?.[0];
  if (!module) {
    throw new Error('Expected fixture module.');
  }
  module.houseConnectionType = houseConnectionType;
  module.gableEndFramesMode = 'none';
  module.gableHouseEdgeGutter = 'house';
  module.gableOuterEdgeGutter = 'our';
  return snapshot as Record<string, unknown>;
}

describe('buildDrawingWorkbenchStore', () => {
  it('builds shared module, assembly, and plan-view state from one snapshot', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Test Project',
        quoteRef: 'Q-1000',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule({ lengthM: '6' }), makeModule({ lengthM: '4.5', projectionM: '2.5' })],
      },
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult({ lengthA: 6, spanA: 3 }), makeResult({ lengthA: 4.5, spanA: 2.5 })] }],
      },
    } satisfies Record<string, unknown>;

    const store = buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState({
        activeModuleIndex: 7,
        activeObjectRef: { family: 'house_forms', objectId: 'house-main' },
        activeView: 'plan',
        viewportMode: 'model',
        viewportTransform: { zoom: 99, panX: 12, panY: -4 },
      }),
      moduleLabels: ['M1 - Pitched - 6m x 3m', 'M2 - Pitched - 4.5m x 2.5m'],
    });

    expect(store.persisted.modules).toHaveLength(2);
    expect(store.ui.activeModuleIndex).toBe(1);
    expect(store.ui.viewportTransform.zoom).toBe(6);
    expect(store.derived.activeModuleLabel).toBe('M2 - Pitched - 4.5m x 2.5m');
    expect(store.derived.solvedModel.modules).toHaveLength(2);
    expect(store.derived.activeSolution).toBe(store.derived.activeModule?.solution);
    expect(store.derived.activeSolution?.id).toBe(store.derived.activeModule?.id);
    expect(store.derived.activeSolution?.trust.status).toBe('geometry_ready');
    expect(store.derived.activeTrustGate.status).toBe('warn');
    expect(store.derived.activeTrustGate.warningIssues).toContain('approximate');
    expect(store.derived.exportReadiness.canExport).toBe(true);
    expect(store.derived.reviewReadiness.canReview).toBe(true);
    expect(store.derived.activeSolution?.planModel).toBe(store.derived.activeLegacyPlanModel);
    expect(store.derived.activeSolution?.sectionModel).toBe(store.derived.activeLegacySectionModel);
    expect(store.derived.activeViewportGeometry).toBe(store.derived.activeSolution?.viewportGeometry);
    expect(store.derived.activeViewportGeometry?.artifact).toBe(store.derived.activeSolution?.geometryArtifact);
    expect(store.derived.activeViewportGeometry?.legacyFallback.planModel).toBe(store.derived.activeLegacyPlanModel);
    expect(store.derived.activeViewportGeometry?.legacyFallback.sectionModel).toBe(store.derived.activeLegacySectionModel);
    expect(store.derived.activeDrawingSurfaceGeometry).toBe(store.derived.activeModule?.drawingSurfaceGeometry);
    expect(store.derived.activeDrawingSurfaceGeometry?.source).toBe('solved_geometry');
    expect(store.derived.activeDrawingSurfaceGeometry?.artifact).toBe(store.derived.activeViewportGeometry?.artifact);
    expect(store.derived.activeDrawingSurfaceGeometry?.legacyFallback).toEqual({
      planModel: store.derived.activeLegacyPlanModel,
      sectionModel: store.derived.activeLegacySectionModel,
    });
    expect(store.derived.activeDrawingSurfaceGeometry?.legacyPlanModel).toBe(store.derived.activeLegacyPlanModel);
    expect(store.derived.activeDrawingSurfaceGeometry?.legacySectionModel).toBe(store.derived.activeLegacySectionModel);
    expect(store.derived.activeSolution?.geometryPlan).toBe(store.derived.activeModule?.geometryPlanViewModel);
    expect(store.derived.activeSolution?.geometryArtifact?.plan).toBe(store.derived.activeSolution?.geometryPlan);
    expect(store.derived.activeSolution?.geometryArtifact?.topProjection).toBe(
      store.derived.activeSolution?.geometryTopProjection,
    );
    expect(store.derived.activeDrawingSurfaceGeometry?.geometryPlan).toBe(
      store.derived.activeSolution?.geometryArtifact?.plan,
    );
    expect(store.derived.activeDrawingSurfaceGeometry?.geometrySection).toBe(
      store.derived.activeSolution?.geometryArtifact?.section,
    );
    expect(store.derived.activeDrawingSurfaceGeometry?.geometryTopProjection).toBe(
      store.derived.activeSolution?.geometryArtifact?.topProjection,
    );
    expect(store.derived.activePlanViewModel?.modelSpacePergola.geometryArtifactDiagnostics).toEqual({
      source: 'solved_geometry',
      fallback: null,
      topProjectionFromViewerSceneArtifact: true,
    });
    expect(store.derived.activeSolution?.geometryPreview.kind).toBe('ready');
    if (store.derived.activeSolution?.geometryPreview.kind !== 'ready') {
      throw new Error('Expected ready solved geometry preview.');
    }
    expect(store.derived.activeSolution.geometryPreview.config).toBe(store.derived.activeSolution.config);
    expect(store.derived.activeSolution.geometryPreview.assembly).toBe(store.derived.activeSolution.assembly);
    expect(store.derived.activeSolution.geometryPreview.scene).toBe(store.derived.activeSolution.viewerScene);
    expect(store.derived.activeSolution.geometryPreview.topProjection).toBe(store.derived.activeSolution.geometryTopProjection);
    expect(store.derived.activeViewportGeometry?.preview.kind).toBe('ready');
    if (store.derived.activeViewportGeometry?.preview.kind !== 'ready') {
      throw new Error('Expected ready viewport geometry preview.');
    }
    expect(store.derived.activeViewportGeometry.preview.assembly).toBe(
      store.derived.activeSolution.geometryArtifact?.assembly,
    );
    expect(store.derived.activeViewportGeometry.preview.scene).toBe(
      store.derived.activeSolution.geometryArtifact?.viewerScene,
    );
    expect(store.derived.activeViewportGeometry.preview.topProjection).toBe(
      store.derived.activeSolution.geometryArtifact?.topProjection,
    );
    expect(store.derived.activeAssemblyModel?.roof.footprint.lengthA).toBeCloseTo(4.5);
    expect(store.derived.activeLegacyPlanModel?.lengthA).toBeCloseTo(4.5);
    expect(store.derived.activeLegacyPlanModel?.attachmentEdgeLengthM).toBeCloseTo(4.5);
    expect(store.derived.activeLegacySectionModel?.spanA).toBeCloseTo(2.5);
    expect(store.derived.activeLegacySectionModel?.leftEdgeHeightM).toBeCloseTo(2.4);
    expect(store.derived.activeLegacySectionModel?.rightEdgeHeightM).toBeCloseTo(2.1);
    expect(store.derived.activePlanViewModel?.annotations.suppressDocumentAnnotationsInModelSpace).toBe(true);
    expect(store.persisted.projectModel.houseAssembly?.id).toBe('assembly-main');
    expect(store.persisted.projectModel.houseAssembly?.houseForms[0]?.id).toBe('house-main');
    expect('house' in (store.persisted.projectModel as Record<string, unknown>)).toBe(false);
    expect('compatibilityBridge' in (store.persisted as Record<string, unknown>)).toBe(false);
    expect('compatibilityProjectModel' in (store.persisted as Record<string, unknown>)).toBe(false);
    expect(store.derived.houseAssembly?.id).toBe('assembly-main');
    expect(store.derived.houseForms.map((houseForm) => houseForm.id)).toEqual(['house-main']);
    expect(store.derived.houseFormCount).toBe(1);
    expect(store.derived.activeHouseForm?.id).toBe('house-main');
    expect(store.persisted.projectModel.houseAssembly?.houseForms[0]?.footprint.preset).toBe('straight');
    expect(store.persisted.projectModel.pergolas).toHaveLength(1);
    expect(store.persisted.projectModel.houseAssembly?.houseForms).toHaveLength(1);
    expect(store.persisted.projectModel.decks).toEqual([]);
    expect(store.persisted.projectModel.openings).toEqual([]);
    expect(store.derived.objectWorkbench.activeDeck).toBeNull();
    expect(store.derived.objectWorkbench.activeOpening).toBeNull();
    expect(store.derived.objectWorkbench.activePergola).toBeNull();
    expect(store.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('approximate');
    expect(store.derived.objectWorkbench.houseForm.warnings).toEqual([]);
    expect(store.derived.objectWorkbench.houseForm.lowConfidence).toBe(false);
    expect(store.derived.railModel.familySummaries.map((family) => family.family)).toEqual([
      'house_forms',
      'decks',
      'openings',
      'pergolas',
    ]);
    expect(store.derived.railModel.objectLists.house_forms[0]?.ref).toEqual({
      family: 'house_forms',
      objectId: store.derived.houseForms[0]?.id ?? null,
    });
    expect(store.derived.railModel.objectLists.pergolas[0]?.ref).toEqual({
      family: 'pergolas',
      objectId: 'pergola-1',
    });
    expect(store.derived.status).toBe('ready');
  });

  it('keeps sheet models available while marking supported hip families as geometry-ready', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Test Project',
        quoteRef: 'Q-1001',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule({ pergolaStyle: 'hip' })],
      },
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
      },
    } satisfies Record<string, unknown>;

    const store = buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
      }),
    });

    expect(store.persisted.modules[0]?.drawingModule.planModel).not.toBeNull();
    expect(store.persisted.modules[0]?.drawingModule.sectionModel).not.toBeNull();
    expect(store.persisted.modules[0]?.geometryPlanViewModel).not.toBeNull();
    expect(store.persisted.modules[0]?.planRenderSource).toBe('geometry');
    expect(store.persisted.modules[0]?.planRenderStatus).toBe('geometry_ready');
    expect(store.derived.activeSolution?.trust.status).toBe('geometry_ready');
    expect(store.derived.activeSolution?.renderStatus).toBe('geometry_ready');
    expect(store.derived.activeTrustGate.status).toBe('warn');
    expect(store.derived.activeTrustGate.warningIssues).toContain('approximate');
    expect(store.derived.exportReadiness.canExport).toBe(true);
    expect(store.derived.activeSolution?.geometryPlan).toBe(store.persisted.modules[0]?.geometryPlanViewModel);
    expect(store.derived.activeSolution?.geometryTopProjection).toBe(store.persisted.modules[0]?.geometryTopProjectionViewModel);
    expect(store.derived.activeLegacyPlanModel).not.toBeNull();
    expect(store.derived.activePlanViewModel?.modelSpacePergola.renderSource).toBe('geometry');
    expect(store.derived.activePlanViewModel?.modelSpacePergola.renderStatus).toBe('geometry_ready');
    expect(store.derived.activeLegacyPlanModel?.roofType).toBe('hip');
    expect(store.derived.activeLegacySectionModel).not.toBeNull();
    expect(store.derived.status).toBe('ready');
  });

  it('exposes invalid solved-module trust when geometry cannot normalize', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<Record<string, unknown>> };
      outputs?: { pergolas?: Array<{ modules?: Array<Record<string, unknown>> }> };
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs?.pergolas?.[0]?.modules?.[0]) {
      throw new Error('Expected fixture snapshot modules.');
    }
    snapshot.inputs.modules[0].lengthM = '';
    snapshot.outputs.pergolas[0].modules[0].derived = {
      ...(snapshot.outputs.pergolas[0].modules[0].derived ?? {}),
      length_m: null,
    };

    const store = buildDrawingWorkbenchStore({
      snapshot: snapshot as Record<string, unknown>,
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
      }),
    });

    expect(store.derived.activeSolution?.trust.status).toBe('invalid_geometry');
    expect(store.derived.activeSolution?.renderStatus).toBe('invalid_geometry');
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Invalid geometry',
    });
    expect(store.derived.activeTrustGate.blockingIssues).toContain('invalid_geometry');
    expect(store.derived.activeSolution?.geometryPreview.kind).toBe('error');
    expect(store.derived.activeViewportGeometry?.artifact).toBeNull();
    expect(store.derived.activeViewportGeometry?.preview.kind).toBe('error');
    expect(store.derived.activeViewportGeometry?.legacyFallback.planModel).toBeNull();
    expect(store.derived.activeDrawingSurfaceGeometry?.source).toBe('unavailable');
    expect(store.derived.activeLegacyPlanModel).toBeNull();
    expect(store.derived.status).toBe('empty');
  });

  it('warns on legacy fallback geometry while keeping fallback sheet models available', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Legacy Pergola',
        quoteRef: 'Q-1002',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [
          makeModule({
            pergolaStyle: 'curved' as unknown as CalculatorModuleInputs['pergolaStyle'],
          }),
        ],
      },
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
      },
    } satisfies Record<string, unknown>;

    const store = buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
        workbenchMode: 'pergolas',
        activeObjectFamily: 'pergolas',
        activeObjectRef: { family: 'pergolas', objectId: 'pergola-1' },
      }),
    });

    expect(store.derived.activeSolution?.trust.status).toBe('legacy_unsupported_family');
    expect(store.derived.activeSolution?.trust.issues).toContain('legacy_fallback');
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'warn',
      canExport: true,
      canReview: true,
      label: 'Warning: Legacy fallback',
    });
    expect(store.derived.activeLegacyPlanModel).not.toBeNull();
    expect(store.derived.activeLegacySectionModel).not.toBeNull();
    expect(store.derived.activeViewportGeometry?.artifact).toBeNull();
    expect(store.derived.activeViewportGeometry?.preview.kind).toBe('unsupported');
    expect(store.derived.activeViewportGeometry?.legacyFallback.planModel).toBe(store.derived.activeLegacyPlanModel);
    expect(store.derived.activeViewportGeometry?.legacyFallback.sectionModel).toBe(store.derived.activeLegacySectionModel);
    expect(store.derived.activeDrawingSurfaceGeometry?.source).toBe('legacy_fallback');
    expect(store.derived.activeDrawingSurfaceGeometry?.artifact).toBeNull();
    expect(store.derived.activeDrawingSurfaceGeometry?.legacyFallback).toEqual({
      planModel: store.derived.activeLegacyPlanModel,
      sectionModel: store.derived.activeLegacySectionModel,
    });
    expect(store.derived.activeDrawingSurfaceGeometry?.legacyPlanModel).toBe(store.derived.activeLegacyPlanModel);
    expect(store.derived.activeDrawingSurfaceGeometry?.legacySectionModel).toBe(store.derived.activeLegacySectionModel);
    expect(store.derived.activeDrawingSurfaceGeometry?.geometryPlan).toBeNull();
    expect(store.derived.railModel.objectLists.pergolas[0]).toMatchObject({
      status: 'approximate',
      trustStatus: 'legacy_fallback',
      trustLabel: 'Legacy fallback',
      statusLabel: 'Legacy fallback',
    });
    expect(store.derived.objectWorkbench.activePergola).toMatchObject({
      trustStatus: 'legacy_fallback',
      trustLabel: 'Legacy fallback',
    });
  });

  it('passes export and review when the active object-workbench view is geometry-ready', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseConnectionType = 'none';
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        roof: {
          form: 'gable',
        },
      },
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(store.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('valid');
    expect(store.derived.objectWorkbench.houseForm).toMatchObject({
      trustStatus: 'geometry_ready',
      trustLabel: 'Geometry ready',
    });
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'pass',
      canExport: true,
      canReview: true,
      label: 'Geometry ready',
    });
    expect(store.derived.exportReadiness).toBe(store.derived.activeTrustGate);
    expect(store.derived.reviewReadiness).toBe(store.derived.activeTrustGate);
  });

  it('locally resolves stale pricing outputs so sheet models remain available', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const snapshot = structuredClone(fixture.snapshot) as {
      inputs?: { modules?: Array<{ lengthM?: string }> };
      outputs?: Record<string, unknown>;
    };
    if (!snapshot.inputs?.modules?.[0] || !snapshot.outputs) throw new Error('Expected fixture snapshot.');
    snapshot.inputs.modules[0].lengthM = '8.4';
    snapshot.outputs[ESTIMATE_PRICING_SYNC_STATE_OUTPUT_KEY] = 'stale';

    const store = buildDrawingWorkbenchStore({
      snapshot: snapshot as Record<string, unknown>,
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
      }),
    });

    expect(store.derived.status).toBe('ready');
    expect(store.persisted.modules[0]?.drawingModule.result?.derived.length_m).toBeCloseTo(8.4);
    expect(store.derived.activeLegacyPlanModel?.lengthA).toBeCloseTo(8.4);
    expect(store.derived.activeLegacySectionModel).not.toBeNull();
  });

  it('builds 2D models from locally resolved draft geometry instead of stale snapshot outputs', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.lengthM = '6.4';
    draft.inputs.modules[0]!.roofPitchDeg = '10';

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        activeView: 'section',
      }),
    });

    expect(store.derived.status).toBe('ready');
    expect(store.persisted.modules[0]?.drawingModule.input.lengthM).toBe('6.4');
    expect(store.persisted.modules[0]?.drawingModule.result?.derived.length_m).toBeCloseTo(6.4);
    expect(store.derived.activeLegacyPlanModel?.lengthA).toBeCloseTo(6.4);
    expect(store.derived.activeLegacySectionModel?.pitchDeg).toBeCloseTo(10);
  });

  it('builds sheet models from explicit attached gable no-frame snapshots while constraining gutters', () => {
    const store = buildDrawingWorkbenchStore({
      snapshot: makeStaleGableFixtureSnapshot('soffit'),
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
      }),
    });

    expect(store.derived.status).toBe('ready');
    expect(store.derived.activeLegacyPlanModel?.roofType).toBe('gable');
    expect(store.derived.activeLegacySectionModel?.roofType).toBe('gable');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableEndFramesMode).toBe('none');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableHouseEdgeGutter).toBe('house');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableOuterEdgeGutter).toBe('our');
  });

  it('builds freestanding sheet models from explicit gable no-frame snapshots while constraining gutters', () => {
    const store = buildDrawingWorkbenchStore({
      snapshot: makeStaleGableFixtureSnapshot('none'),
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
      }),
    });

    expect(store.derived.status).toBe('ready');
    expect(store.derived.activeLegacyPlanModel?.roofType).toBe('gable');
    expect(store.derived.activeLegacySectionModel?.roofType).toBe('gable');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableEndFramesMode).toBe('none');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableHouseEdgeGutter).toBe('our');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableOuterEdgeGutter).toBe('our');
  });

  it('normalizes workbench selection state when switching between house and pergolas modes', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Shared House',
        quoteRef: 'Q-2000',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [
          { id: 'pergola-1', label: 'Pergola 1' },
          { id: 'pergola-2', label: 'Pergola 2' },
        ],
        modules: [
          makeModule({ pergolaId: 'pergola-1', houseFootprintPreset: 'straight' }),
          makeModule({ pergolaId: 'pergola-2', houseFootprintPreset: 'straight', lengthM: '4.5' }),
        ],
      },
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult(), makeResult({ lengthA: 4.5 })] }],
      },
    } satisfies Record<string, unknown>;

    const pergolaStore = buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'pergolas',
        activePergolaId: 'missing',
        activeHouseSelection: { kind: 'roof', targetId: 'roof-1' },
      }),
    });

    const pergolaCompatibility = deriveDrawingWorkbenchCompatibilitySelection(pergolaStore.ui);
    expect(pergolaCompatibility.workbenchMode).toBe('pergolas');
    expect(pergolaCompatibility.activePergolaId).toBe('pergola-1');
    expect(pergolaStore.ui.activeRailTab).toBe('pergolas');
    expect(pergolaCompatibility.activeHouseSelection).toEqual({ kind: 'house', targetId: null });
    expect(pergolaStore.derived.objectWorkbench.activePergola?.id).toBe('pergola-1');
    expect(pergolaStore.derived.objectFirstPergolas.map((pergola) => pergola.id)).toEqual(['pergola-1', 'pergola-2']);
    expect(pergolaStore.derived.activeObjectFirstPergola?.id).toBe('pergola-1');
    expect(pergolaStore.derived.activePergolaAttachmentResolution?.status).toBe('resolved');
    expect(pergolaStore.derived.unresolvedPergolaAttachmentCount).toBe(0);

    const houseStore = buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activePergolaId: 'pergola-2',
        activeHouseSelection: { kind: 'footprint', targetId: 'house-main' },
      }),
    });

    const houseCompatibility = deriveDrawingWorkbenchCompatibilitySelection(houseStore.ui);
    expect(houseCompatibility.workbenchMode).toBe('house');
    expect(houseCompatibility.activePergolaId).toBeNull();
    expect(houseStore.ui.activeRailTab).toBe('house_forms');
    expect(houseCompatibility.activeHouseSelection).toEqual({ kind: 'footprint', targetId: 'house-main' });
  });

  it('uses object-first derived attachment resolution for pergola rail state without retargeting stale hosts', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const staleEdgeDraft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!staleEdgeDraft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft: staleEdgeDraft,
      compatibility: {
        pergolas: [
          {
            id: 'pergola-1',
            attachmentEdgeId: 'footprint-edge-99',
          },
        ],
      },
    });

    const staleEdgeStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: staleEdgeDraft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'pergolas',
        activePergolaId: 'pergola-1',
      }),
    });

    expect(staleEdgeStore.derived.objectFirstPergolas[0]).toMatchObject({
      id: 'pergola-1',
      attachmentEdgeId: 'footprint-edge-99',
    });
    expect(staleEdgeStore.derived.activePergolaAttachmentResolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_attachment_edge',
      attachmentEdgeId: 'footprint-edge-99',
      edge: null,
      zone: null,
    });
    expect(staleEdgeStore.derived.unresolvedPergolaAttachmentCount).toBe(1);
    expect(staleEdgeStore.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Unresolved host',
    });
    expect(staleEdgeStore.derived.activeTrustGate.blockingIssues).toContain('unresolved_host');
    expect(staleEdgeStore.derived.railModel.objectLists.pergolas[0]).toMatchObject({
      status: 'blocked',
      trustStatus: 'unresolved_host',
      trustLabel: 'Unresolved host',
      statusLabel: 'Unresolved host',
      meta: 'Mono | Unresolved host edge',
    });

    const staleZoneDraft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!staleZoneDraft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft: staleZoneDraft,
      compatibility: {
        pergolas: [
          {
            id: 'pergola-1',
            attachmentEdgeId: 'footprint-edge-3',
            attachmentZoneId: 'zone-soffit-footprint-edge-99',
          },
        ],
      },
    });

    const staleZoneStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: staleZoneDraft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'pergolas',
        activePergolaId: 'pergola-1',
      }),
    });

    expect(staleZoneStore.derived.activePergolaAttachmentResolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_attachment_zone',
      attachmentEdgeId: 'footprint-edge-3',
      attachmentZoneId: 'zone-soffit-footprint-edge-99',
    });
    expect(staleZoneStore.derived.activePergolaAttachmentResolution?.edge?.id).toBe('footprint-edge-3');
    expect(staleZoneStore.derived.unresolvedPergolaAttachmentCount).toBe(1);
    expect(staleZoneStore.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Unresolved host',
    });
    expect(staleZoneStore.derived.railModel.objectLists.pergolas[0]).toMatchObject({
      status: 'blocked',
      trustStatus: 'unresolved_host',
      trustLabel: 'Unresolved host',
      statusLabel: 'Unresolved host',
      meta: 'Mono | Rear wall | Unresolved host zone',
    });
  });

  it('uses object-first draft objects as the persisted workbench source', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const baselineStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      ui: createDrawingWorkbenchUiState(),
    });
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.objectFirst = {
      ...buildObjectFirstWorkbenchDraftFromProjectModel(baselineStore.persisted.projectModel),
      decks: [
        {
          id: 'deck-object',
          label: 'Object deck',
          kind: 'deck',
          shape: 'preset',
          presetType: 'rect_attached',
          presetRect: { widthM: '4', depthM: '2', centerOffsetM: '0' },
          outline: [],
          elevationMode: 'aligned_to_threshold',
          levelOffsetMm: '0',
          isAttached: true,
          surfaceMaterial: 'timber_decking',
          hostEdgeId: 'rear',
        },
      ],
      openings: [
        {
          id: 'opening-object',
          label: 'Object opening',
          kind: 'window',
          panelCount: null,
          hostWallId: 'wall-footprint-edge-3',
          wallId: 'rear',
          hostEdgeId: 'footprint-edge-3',
          widthM: '1.2',
          heightM: '1.2',
          sillHeightM: '0.9',
          offsetAlongWallM: '0.6',
        },
      ],
      pergolas: [
        {
          id: 'pergola-1',
          label: 'Object pergola',
          family: 'mono',
          attachmentEdgeId: 'footprint-edge-3',
          attachmentZoneId: 'zone-soffit-footprint-edge-3',
          side: 'rear',
          strategy: null,
        },
      ],
    };

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'decks', objectId: 'deck-object' },
      }),
    });

    expect(store.persisted.projectModel.decks.map((deck) => deck.id)).toEqual(['deck-object']);
    expect(store.derived.objectWorkbench.decks[0]).toMatchObject({
      id: 'deck-object',
      label: 'Object deck',
      hostEdgeId: 'rear',
      validation: { status: 'valid' },
    });
    expect(store.derived.objectFirstOpenings.map((opening) => opening.id)).toEqual(['opening-object']);
    expect(store.derived.objectWorkbench.openings[0]).toMatchObject({
      id: 'opening-object',
      label: 'Object opening',
      hostWallId: 'wall-footprint-edge-3',
    });
    expect(store.derived.objectFirstPergolas[0]).toMatchObject({
      id: 'pergola-1',
      attachmentEdgeId: 'footprint-edge-3',
    });
    expect(store.derived.objectWorkbench.pergolas[0]).toMatchObject({
      id: 'pergola-1',
      label: 'Object pergola',
      attachmentEdgeId: 'footprint-edge-3',
      attachmentZoneId: 'zone-soffit-footprint-edge-3',
    });
    expect(store.derived.objectWorkbench.activeDeck?.id).toBe('deck-object');
    expect(store.derived.unresolvedPergolaAttachmentCount).toBe(0);
  });

  it('populates the object-workbench facade from object-first draft objects', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        decks: [{ id: 'object-deck', name: 'Object deck', hostEdgeId: 'rear' }],
        openings: [{ id: 'object-opening', label: 'Object opening', wallId: 'rear' }],
      },
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        activeObjectFamily: 'openings',
        activeObjectRef: { family: 'openings', objectId: 'object-opening' },
      }),
    });

    expect(store.derived.objectWorkbench.houseForm.houseForm?.id).toBe('house-main');
    expect(store.derived.objectWorkbench.decks[0]).toMatchObject({
      id: 'object-deck',
      label: 'Object deck',
      hostEdgeId: 'rear',
    });
    expect(store.derived.objectWorkbench.openings[0]).toMatchObject({
      id: 'object-opening',
      label: 'Object opening',
      wallId: 'rear',
    });
    expect(store.derived.objectWorkbench.activeOpening?.id).toBe('object-opening');
  });

  it('preserves stable deck ids and normalizes invalid deck selection state', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    const deckDrafts = [
      {
        id: 'deck-a',
        name: 'Deck A',
        kind: 'deck' as const,
        shape: 'preset' as const,
        presetType: 'rect_attached' as const,
        presetRect: {
          widthM: '3.6',
          depthM: '3',
          centerOffsetM: '0',
          detachedGapM: null,
        },
        outline: [
          { alongM: '0', depthM: '0' },
          { alongM: '3.6', depthM: '0' },
          { alongM: '3.6', depthM: '3' },
          { alongM: '0', depthM: '3' },
        ],
        elevationMode: 'aligned_to_threshold' as const,
        levelOffsetMm: '0',
        hostEdgeId: 'rear',
        isAttached: true,
        surfaceMaterial: 'timber_decking' as const,
      },
      {
        id: 'deck-b',
        name: 'Deck B',
        kind: 'deck' as const,
        shape: 'custom' as const,
        outline: [
          { alongM: '8', depthM: '2' },
          { alongM: '11', depthM: '2' },
          { alongM: '11', depthM: '5' },
          { alongM: '8', depthM: '5' },
        ],
        elevationMode: 'stepped' as const,
        levelOffsetMm: '350',
        isAttached: false,
        surfaceMaterial: 'composite' as const,
      },
    ];
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: { decks: deckDrafts },
    });

    const selectedStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-b' },
      }),
    });

    expect(selectedStore.persisted.projectModel.decks.map((deck) => deck.id)).toEqual(['deck-a', 'deck-b']);
    expect(selectedStore.derived.objectWorkbench.diagnostics.activeDeckId).toBe('deck-b');
    expect(selectedStore.ui.activeObjectRef).toEqual({ family: 'decks', objectId: 'deck-b' });
    expect(deriveDrawingWorkbenchCompatibilitySelection(selectedStore.ui).activeHouseSelection).toEqual({
      kind: 'deck',
      targetId: 'deck-b',
    });

    const removedDraft = structuredClone(draft);
    if (removedDraft.objectFirst) {
      removedDraft.objectFirst.decks = removedDraft.objectFirst.decks.filter((deck) => deck.id !== 'deck-b');
    }

    const removedStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: removedDraft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeRailTab: 'decks',
        activeObjectFamily: 'decks',
        activeObjectRef: { family: 'decks', objectId: 'deck-b' },
        activeHouseSelection: { kind: 'deck', targetId: 'deck-b' },
      }),
    });

    expect(removedStore.persisted.projectModel.decks.map((deck) => deck.id)).toEqual(['deck-a']);
    expect(removedStore.ui.activeRailTab).toBe('decks');
    expect(removedStore.ui.activeObjectFamily).toBe('decks');
    expect(removedStore.ui.activeObjectRef).toEqual({ family: 'decks', objectId: null });
    expect(removedStore.derived.objectWorkbench.diagnostics.activeDeckId).toBeNull();
    expect(deriveDrawingWorkbenchCompatibilitySelection(removedStore.ui).activeHouseSelection).toEqual({
      kind: 'house',
      targetId: null,
    });
    expect(removedStore.derived.railModel.selectedInspector.hasSelection).toBe(false);
    expect(removedStore.derived.railModel.objectLists.decks.map((deck) => deck.ref.objectId)).toEqual(['deck-a']);

    const pergolaStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'pergolas',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-a' },
      }),
    });

    expect(deriveDrawingWorkbenchCompatibilitySelection(pergolaStore.ui).activeHouseSelection).toEqual({
      kind: 'house',
      targetId: null,
    });
    expect(pergolaStore.derived.objectWorkbench.diagnostics.activeDeckId).toBeNull();
  });

  it('normalizes object-family selections against object-first fixture ids', () => {
    const project = makeObjectFirstWorkbenchProjectFixture('touching_merged_forms');
    const ids = {
      houseFormIds: project.houseAssembly?.houseForms.map((form) => form.id) ?? [],
      deckIds: project.decks.map((deck) => deck.id),
      openingIds: project.openings.map((opening) => opening.id),
      pergolaIds: project.pergolas.map((pergola) => pergola.id),
    };

    const openingSelection = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        activeRailTab: 'openings',
        activeObjectFamily: 'openings',
        activeObjectRef: { family: 'openings', objectId: 'opening-merged' },
        activeHouseSelection: { kind: 'house', targetId: null },
      }),
      { moduleCount: 1, ...ids },
    );
    const pergolaSelection = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        activeRailTab: 'pergolas',
        activeObjectFamily: 'pergolas',
        activeObjectRef: { family: 'pergolas', objectId: 'pergola-merged' },
        activePergolaId: null,
      }),
      { moduleCount: 1, ...ids },
    );
    const staleSelection = normalizeDrawingWorkbenchUiState(
      createDrawingWorkbenchUiState({
        activeRailTab: 'openings',
        activeObjectFamily: 'openings',
        activeObjectRef: { family: 'openings', objectId: 'opening-removed' },
        activeHouseSelection: { kind: 'opening', targetId: 'opening-removed' },
      }),
      { moduleCount: 1, ...ids },
    );

    const openingCompatibility = deriveDrawingWorkbenchCompatibilitySelection(openingSelection);
    const pergolaCompatibility = deriveDrawingWorkbenchCompatibilitySelection(pergolaSelection);
    const staleCompatibility = deriveDrawingWorkbenchCompatibilitySelection(staleSelection);

    expect(openingSelection.activeObjectRef).toEqual({ family: 'openings', objectId: 'opening-merged' });
    expect(openingCompatibility.activeHouseSelection).toEqual({ kind: 'opening', targetId: 'opening-merged' });
    expect(pergolaCompatibility.workbenchMode).toBe('pergolas');
    expect(pergolaCompatibility.activePergolaId).toBe('pergola-merged');
    expect(staleSelection.activeObjectRef).toEqual({ family: 'openings', objectId: null });
    expect(staleCompatibility.activeHouseSelection).toEqual({ kind: 'house', targetId: null });
  });

  it('preserves stable opening ids and normalizes invalid opening selection state', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        openings: [
          {
            id: 'opening-1',
            label: 'Window 1',
            kind: 'window',
            wallId: 'rear',
            widthM: '1.8',
            heightM: '1.2',
            sillHeightM: '0.9',
            offsetAlongWallM: '0.6',
          },
        ],
      },
    });

    const selectedStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'opening', targetId: 'opening-1' },
      }),
    });

    expect(selectedStore.derived.openingCount).toBe(1);
    expect(selectedStore.derived.sliderOpeningCount).toBe(0);
    expect(selectedStore.derived.objectWorkbench.diagnostics.activeOpeningId).toBe('opening-1');
    expect(selectedStore.derived.objectFirstOpenings.map((opening) => opening.id)).toEqual(['opening-1']);
    expect(selectedStore.derived.activeObjectFirstOpening?.id).toBe('opening-1');
    expect(selectedStore.derived.activeOpeningHostResolution?.status).toBe('resolved');
    expect(selectedStore.derived.activeOpeningHostResolution?.wall?.id).toBe(
      selectedStore.derived.objectWorkbench.activeOpening?.hostWallId,
    );
    expect(selectedStore.derived.unresolvedOpeningHostCount).toBe(0);
    expect(deriveDrawingWorkbenchCompatibilitySelection(selectedStore.ui).activeHouseSelection).toEqual({
      kind: 'opening',
      targetId: 'opening-1',
    });

    const removedDraft = structuredClone(draft);
    if (removedDraft.objectFirst) {
      removedDraft.objectFirst.openings = [];
    }

    const removedStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: removedDraft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'opening', targetId: 'opening-1' },
      }),
    });

    expect(removedStore.derived.objectWorkbench.diagnostics.activeOpeningId).toBeNull();
    expect(deriveDrawingWorkbenchCompatibilitySelection(removedStore.ui).activeHouseSelection).toEqual({
      kind: 'house',
      targetId: null,
    });
  });

  it('uses object-first derived wall resolution for opening rail state without source-form fallback', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        openings: [
          {
            id: 'opening-stale',
            label: 'Stale opening',
            kind: 'window',
            hostWallId: 'wall-footprint-edge-99',
            wallId: 'rear',
            hostEdgeId: 'footprint-edge-3',
            widthM: '1.8',
            heightM: '1.2',
            sillHeightM: '0.9',
            offsetAlongWallM: '0.6',
          },
        ],
      },
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'opening', targetId: 'opening-stale' },
      }),
    });

    expect(store.persisted.projectModel.openings.map((opening) => opening.id)).toEqual(['opening-stale']);
    expect(store.derived.objectFirstOpenings[0]).toMatchObject({
      id: 'opening-stale',
      sourceFormId: store.derived.houseForms[0]?.id,
      hostWallId: 'wall-footprint-edge-99',
    });
    expect(store.derived.activeOpeningHostResolution).toMatchObject({
      status: 'unresolved',
      code: 'missing_host_wall',
      hostWallId: 'wall-footprint-edge-99',
      wall: null,
    });
    expect(store.derived.unresolvedOpeningHostCount).toBe(1);
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Unresolved host',
    });
    expect(store.derived.activeTrustGate.blockingIssues).toContain('unresolved_host');
    expect(store.derived.railModel.objectLists.openings[0]).toMatchObject({
      status: 'blocked',
      trustStatus: 'unresolved_host',
      trustLabel: 'Unresolved host',
      statusLabel: 'Unresolved host',
      meta: 'window | Unresolved host wall',
    });
    expect(store.derived.objectWorkbench.activeOpening).toMatchObject({
      trustStatus: 'unresolved_host',
      trustLabel: 'Unresolved host',
    });
    expect(store.derived.objectWorkbench.activeOpening?.hostEdgeId).toBe('footprint-edge-3');
    expect(deriveDrawingWorkbenchCompatibilitySelection(store.ui).activeHouseSelection).toEqual({
      kind: 'opening',
      targetId: 'opening-stale',
    });
  });

  it('marks the shared house as low confidence when legacy modules disagree on house context', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Conflict House',
        quoteRef: 'Q-2001',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [
          { id: 'pergola-1', label: 'Pergola 1' },
          { id: 'pergola-2', label: 'Pergola 2' },
        ],
        modules: [
          makeModule({ pergolaId: 'pergola-1', houseFootprintPreset: 'straight' }),
          makeModule({ pergolaId: 'pergola-2', houseFootprintPreset: 'u_shape', houseRoofMaterial: 'shingles' }),
        ],
      },
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult(), makeResult()] }],
      },
    } satisfies Record<string, unknown>;

    const store = buildDrawingWorkbenchStore({
      snapshot,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(store.persisted.projectModel.houseAssembly?.houseForms[0]?.footprint.preset).toBe('straight');
    expect(store.derived.objectWorkbench.houseForm.lowConfidence).toBe(true);
    expect(store.derived.objectWorkbench.houseForm.warnings.length).toBeGreaterThan(0);
    expect(store.derived.objectWorkbench.houseForm).toMatchObject({
      trustStatus: 'approximate',
      trustLabel: 'Approximate',
    });
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'warn',
      canExport: true,
      canReview: true,
      label: 'Warning: Approximate',
    });
  });

  it('exposes shared roof diagnostics through derived store state', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    draft.inputs.modules[0]!.houseConnectionType = 'none';
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        roof: {
          form: 'gable',
        },
      },
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(store.derived.objectWorkbench.houseForm.roof.intent.form).toBe('gable');
    expect(store.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('valid');
    expect(store.derived.objectWorkbench.houseForm.roof.validationCode).toBeNull();
    expect(store.derived.objectWorkbench.houseForm.roof.validationMessage).toBeNull();
    expect(store.derived.objectWorkbench.houseForm.roof.approximationReasons).toEqual([]);
    expect(store.derived.objectWorkbench.houseForm.roof.provenance.form).toBe('object_first_draft');
    expect(store.derived.objectWorkbench.houseForm.roof.provenance.ridgeAxis).toBe('object_first_draft');
    expect(store.derived.objectWorkbench.houseForm.roof.geometryKind).toBe('bent_spine_joined_gable');
    expect(store.derived.objectWorkbench.houseForm.roof.intent.appendage.enabled).toBe(false);
    expect(store.derived.objectWorkbench.houseForm).toMatchObject({
      trustStatus: 'geometry_ready',
      trustLabel: 'Geometry ready',
    });
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'pass',
      canExport: true,
      canReview: true,
      label: 'Geometry ready',
    });
  });

  it('exposes orthogonal mono presets as valid through derived store state', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    draft.inputs.modules[0]!.houseConnectionType = 'none';

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(store.derived.objectWorkbench.houseForm.roof.intent.form).toBe('mono');
    expect(store.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('approximate');
    expect(store.derived.objectWorkbench.houseForm.roof.validationCode).toBeNull();
    expect(store.derived.objectWorkbench.houseForm.roof.validationMessage).toBeNull();
    expect(store.derived.objectWorkbench.houseForm.roof.approximationReasons).toEqual(['inferred_form']);
    expect(store.derived.objectWorkbench.houseForm).toMatchObject({
      trustStatus: 'approximate',
      trustLabel: 'Approximate',
    });
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'warn',
      canExport: true,
      canReview: true,
      label: 'Warning: Approximate',
    });
  });

  it('exposes blocked roof review state for invalid mono fall and ridge selections', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const monoDraft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!monoDraft) throw new Error('Expected drawing draft.');
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft: monoDraft,
      compatibility: {
        roof: {
          form: 'mono',
          primaryFallDirection: 'positive_y',
        },
      },
    });

    const monoStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: monoDraft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(monoStore.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('invalid');
    expect(monoStore.derived.objectWorkbench.houseForm.roof.validationCode).toBe('invalid_mono_fall_direction');
    expect(monoStore.derived.objectWorkbench.houseForm).toMatchObject({
      trustStatus: 'invalid_geometry',
      trustLabel: 'Invalid geometry',
    });
    expect(monoStore.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Invalid geometry',
    });

    const ridgeDraft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!ridgeDraft) throw new Error('Expected drawing draft.');
    ridgeDraft.inputs.modules[0]!.houseFootprintMode = 'custom_polygon';
    ridgeDraft.inputs.modules[0]!.houseFootprintPolygon = [
      { alongM: '0', depthM: '0' },
      { alongM: '6', depthM: '0' },
      { alongM: '6', depthM: '1.8' },
      { alongM: '0', depthM: '1.8' },
    ];
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft: ridgeDraft,
      compatibility: {
        roof: {
          form: 'gable',
          ridgeAxis: 'y',
        },
      },
    });

    const ridgeStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft: ridgeDraft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(ridgeStore.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('invalid');
    expect(ridgeStore.derived.objectWorkbench.houseForm.roof.validationCode).toBe('invalid_ridge_axis');
    expect(ridgeStore.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Invalid geometry',
    });
  });

  it('heals stale object-first preset ridge intent before deriving roof and rail state', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.attachmentSide = 'rear';
    draft.inputs.modules[0]!.houseFootprintPreset = 'wrap_left';
    draft.inputs.modules[0]!.houseFootprintParams = {
      ...normalizeHouseFootprintParams(draft.inputs.modules[0]!.houseFootprintParams),
      widthM: '10',
      offsetXM: '-.5',
      setbackM: '.5',
      bandDepthM: '6',
      sideRunM: '4',
    };

    const baselineStore = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });
    draft.objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(baselineStore.persisted.projectModel);
    const houseForm = draft.objectFirst.houseAssembly?.houseForms[0];
    if (!houseForm) throw new Error('Expected object-first house form.');
    houseForm.roofIntentAuthored = true;
    houseForm.roofIntent = {
      ...houseForm.roofIntent,
      form: 'hipped',
      primaryPitchDeg: '0',
      ridgeAxis: 'y',
      openGableEndIds: ['house-gable-end-y-1'],
      appendage: {
        ...houseForm.roofIntent.appendage,
        enabled: true,
      },
    };

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeObjectFamily: 'house_forms',
        activeObjectRef: { family: 'house_forms', objectId: houseForm.id },
      }),
    });

    expect(store.derived.objectWorkbench.houseForm.roof.validationStatus).not.toBe('invalid');
    expect(store.derived.objectWorkbench.houseForm.roof.validationCode).toBeNull();
    expect(store.persisted.projectModel.houseAssembly?.houseForms[0]?.roofIntent).toMatchObject({
      form: 'hipped',
      primaryPitchDeg: '5',
      ridgeAxis: 'x',
      openGableEndIds: [],
      appendage: expect.objectContaining({ enabled: false }),
    });
  });

  it('derives appendage support edges and blocks unsupported host edges without hiding support metadata', () => {
    const fixture = getSanctuaryGeometryWorkbenchFixture('mono-standard');
    if (!fixture) throw new Error('Missing mono-standard fixture.');
    const draft = buildEstimateDrawingDraftFromSnapshot(fixture.snapshot);
    if (!draft) throw new Error('Expected drawing draft.');
    draft.inputs.modules[0]!.houseFootprintPreset = 'u_shape';
    applyObjectFirstCompatibilityDraft({
      snapshot: fixture.snapshot,
      draft,
      compatibility: {
        roof: {
          appendage: {
            enabled: true,
            hostEdge: 'rear',
            pitchDeg: '5',
            dropMm: '450',
          },
        },
      },
    });

    const store = buildDrawingWorkbenchStore({
      snapshot: fixture.snapshot,
      draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(store.derived.objectWorkbench.houseForm.roof.validationStatus).toBe('invalid');
    expect(store.derived.objectWorkbench.houseForm.roof.validationCode).toBe('invalid_appendage_topology');
    expect(store.derived.activeTrustGate).toMatchObject({
      status: 'block',
      canExport: false,
      canReview: false,
      label: 'Blocked: Invalid geometry',
    });
    expect(store.derived.objectWorkbench.houseForm.roof.appendageSupportedHostEdges).toEqual([]);
    expect(store.derived.objectWorkbench.houseForm.roof.appendageSupportReason).toContain('Appendage bands require at least one continuous exterior perimeter run');
  });

  it('derives active-side deck support diagnostics for attached and detached deck scenarios', () => {
    const attachedFixture = makeHouseFirstDeckSupportSnapshotFixture('rear_threshold_attached');
    const detachedFixture = makeHouseFirstDeckSupportSnapshotFixture('detached_rear_near_house');

    const attachedStore = buildDrawingWorkbenchStore({
      snapshot: attachedFixture.snapshot,
      draft: attachedFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });
    const detachedStore = buildDrawingWorkbenchStore({
      snapshot: detachedFixture.snapshot,
      draft: detachedFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(attachedStore.derived.activeDeckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: true,
        resolvedClassification: 'threshold_attached',
        deckBracketEligible: true,
      }),
    );
    expect(detachedStore.derived.activeDeckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: true,
        resolvedClassification: 'ground_supported',
        deckBracketEligible: false,
      }),
    );
  });

  it('limits active-side deck support diagnostics to the current host side while keeping attached warnings advisory', () => {
    const sideFixture = makeHouseFirstDeckSupportSnapshotFixture('left_threshold_attached');
    const nonRelevantFixture = makeHouseFirstDeckSupportSnapshotFixture(
      'left_non_relevant_when_rear_active',
    );
    const warningFixture = makeHouseFirstDeckSupportSnapshotFixture('rear_warning_heavy_attached');

    const sideStore = buildDrawingWorkbenchStore({
      snapshot: sideFixture.snapshot,
      draft: sideFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });
    const nonRelevantStore = buildDrawingWorkbenchStore({
      snapshot: nonRelevantFixture.snapshot,
      draft: nonRelevantFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });
    const warningStore = buildDrawingWorkbenchStore({
      snapshot: warningFixture.snapshot,
      draft: warningFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
      }),
    });

    expect(sideStore.derived.activeDeckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'left',
        hasRelevantDeck: true,
        resolvedClassification: 'threshold_attached',
        deckBracketEligible: true,
      }),
    );
    expect(nonRelevantStore.derived.activeDeckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: false,
        resolvedClassification: 'none',
        deckBracketEligible: false,
      }),
    );
    expect(warningStore.derived.activeDeckSupport).toEqual(
      expect.objectContaining({
        activeHostSide: 'rear',
        hasRelevantDeck: true,
        resolvedClassification: 'threshold_attached',
        deckBracketEligible: true,
      }),
    );
    expect(warningStore.derived.activeDeckSupport?.warningCodes).toContain(
      'threshold_alignment_offset',
    );
  });

  it('derives active deck interaction diagnostics for attached, detached, and custom decks', () => {
    const attachedFixture = makeHouseFirstDeckSupportSnapshotFixture('rear_threshold_attached');
    const detachedFixture = makeHouseFirstDeckSupportSnapshotFixture('detached_rear_near_house');
    const customFixture = makeHouseFirstDeckSupportSnapshotFixture('rear_threshold_attached');

    if (!customFixture.draft?.objectFirst?.decks?.[0]) {
      const baselineStore = buildDrawingWorkbenchStore({
        snapshot: customFixture.snapshot,
        draft: customFixture.draft,
        ui: createDrawingWorkbenchUiState(),
      });
      customFixture.draft.objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(
        baselineStore.persisted.projectModel,
      );
    }
    if (!customFixture.draft.objectFirst?.decks[0]) {
      throw new Error('Expected object-first deck drafts in fixture.');
    }

    customFixture.draft.objectFirst.decks[0] = {
      ...customFixture.draft.objectFirst.decks[0],
      shape: 'custom',
      outline: [
        { alongM: '0', depthM: '0' },
        { alongM: '4', depthM: '0' },
        { alongM: '4', depthM: '-3' },
        { alongM: '0', depthM: '-3' },
      ],
    };

    const attachedStore = buildDrawingWorkbenchStore({
      snapshot: attachedFixture.snapshot,
      draft: attachedFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-1' },
      }),
    });
    const detachedStore = buildDrawingWorkbenchStore({
      snapshot: detachedFixture.snapshot,
      draft: detachedFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-1' },
      }),
    });
    const customStore = buildDrawingWorkbenchStore({
      snapshot: customFixture.snapshot,
      draft: customFixture.draft,
      ui: createDrawingWorkbenchUiState({
        workbenchMode: 'house',
        activeHouseSelection: { kind: 'deck', targetId: 'deck-1' },
      }),
    });

    expect(attachedStore.derived.activeDeckInteraction).toEqual(
      expect.objectContaining({
        selectedDeckType: 'preset_snapped',
        dragEligible: true,
        hostEdgeResolvable: true,
        relationshipDimensionsAvailable: true,
      }),
    );
    expect(detachedStore.derived.activeDeckInteraction).toEqual(
      expect.objectContaining({
        selectedDeckType: 'preset_floating',
        dragEligible: true,
        hostEdgeResolvable: true,
        relationshipDimensionsAvailable: true,
      }),
    );
    expect(customStore.derived.activeDeckInteraction).toEqual(
      expect.objectContaining({
        selectedDeckType: 'custom_outline',
        dragEligible: true,
        hostEdgeResolvable: true,
        relationshipDimensionsAvailable: true,
      }),
    );
  });
});
