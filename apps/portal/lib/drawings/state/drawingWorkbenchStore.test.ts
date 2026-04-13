import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildDrawingWorkbenchStore } from './drawingWorkbenchStore';
import { createDrawingWorkbenchUiState } from './drawingWorkbenchUiState';

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
    expect(store.derived.activeAssemblyModel?.roof.footprint.lengthA).toBeCloseTo(4.5);
    expect(store.derived.activePlanModel?.lengthA).toBeCloseTo(4.5);
    expect(store.derived.activePlanModel?.attachmentEdgeLengthM).toBeCloseTo(4.5);
    expect(store.derived.activeSectionModel?.spanA).toBeCloseTo(2.5);
    expect(store.derived.activeSectionModel?.leftEdgeHeightM).toBeCloseTo(2.4);
    expect(store.derived.activeSectionModel?.rightEdgeHeightM).toBeCloseTo(2.1);
    expect(store.derived.activePlanViewModel?.annotations.suppressDocumentAnnotationsInModelSpace).toBe(true);
    expect(store.derived.status).toBe('ready');
  });

  it('returns empty plan state instead of falling back to legacy plan geometry when geometry solving is unsupported', () => {
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
    expect(store.derived.activePlanModel).toBeNull();
    expect(store.derived.activePlanViewModel).toBeNull();
    expect(store.derived.activeSectionModel).toBeNull();
    expect(store.derived.status).toBe('empty');
  });

  it('builds sheet models from explicit attached gable no-frame snapshots while constraining gutters', () => {
    const store = buildDrawingWorkbenchStore({
      snapshot: makeStaleGableFixtureSnapshot('soffit'),
      ui: createDrawingWorkbenchUiState({
        activeView: 'plan',
      }),
    });

    expect(store.derived.status).toBe('ready');
    expect(store.derived.activePlanModel?.roofType).toBe('gable');
    expect(store.derived.activeSectionModel?.roofType).toBe('gable');
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
    expect(store.derived.activePlanModel?.roofType).toBe('gable');
    expect(store.derived.activeSectionModel?.roofType).toBe('gable');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableEndFramesMode).toBe('none');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableHouseEdgeGutter).toBe('our');
    expect(store.derived.activeAssemblyModel?.moduleInput.gableOuterEdgeGutter).toBe('our');
  });
});
