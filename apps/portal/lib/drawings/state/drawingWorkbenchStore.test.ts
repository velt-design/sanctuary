import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
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
    },
    derived: {
      length_m: params.lengthA ?? 6,
      projection_m: params.spanA ?? 3,
      slope_direction: 'away_from_house',
      roof_pitch_deg_used: 5,
      height_house_side_m: 2.4,
      height_outer_side_m: 2.1,
    },
  } as unknown as CostOutputV1;
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
    expect(store.derived.activePlanViewModel?.annotations.suppressDocumentAnnotationsInModelSpace).toBe(true);
    expect(store.derived.status).toBe('ready');
  });
});
