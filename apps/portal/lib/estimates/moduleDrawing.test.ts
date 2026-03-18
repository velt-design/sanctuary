import { describe, expect, it } from 'vitest';
import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorModuleInputs, LegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import { buildEstimateDrawingModules } from './moduleDrawing';

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
    overhangAmountM: '0.2',
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

function makeResult(params: {
  roofType?: RoofType;
  lengthA?: number;
  spanA?: number;
  slopeDirection?: 'away_from_house' | 'toward_house' | null;
} = {}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: params.roofType ?? 'pitched',
    },
    derived: {
      length_m: params.lengthA ?? 6,
      projection_m: params.spanA ?? 3,
      slope_direction: params.slopeDirection ?? 'away_from_house',
    },
  } as unknown as CostOutputV1;
}

describe('buildEstimateDrawingModules', () => {
  it('builds drawing models from V2 estimate snapshots', () => {
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
        modules: [makeModule()],
      },
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult({ roofType: 'pitched', lengthA: 6.4, spanA: 3.2 })] }],
      },
    } satisfies Record<string, unknown>;

    const modules = buildEstimateDrawingModules(snapshot);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.label).toBe('M1');
    expect(modules[0]?.planModel?.dataSource).toBe('derived');
    expect(modules[0]?.planModel?.lengthA).toBeCloseTo(6.4);
    expect(modules[0]?.sectionModel?.dataSource).toBe('derived');
  });

  it('migrates legacy V1 estimate snapshots before building drawings', () => {
    const legacyInputs: LegacyCalculatorInputsV1 = {
      projectName: 'Legacy Project',
      quoteRef: 'Q-2000',
      pergolaStyle: 'pitched',
      roofMaterial: 'acrylic',
      extrusionColour: 'White',
      boxPerimeterEnabled: false,
      internalRoofType: 'pitched',
      fallDistanceMm: '0',
      roofPitchDeg: '7',
      mixedSkylightStripCount: '0',
      mixedSkylightStripWidthM: '0',
      postCount: '2',
      houseConnectionType: 'soffit',
      postConnectionType: 'slab_anchors',
      access: 'normal',
      height: 'single_storey',
      ground: 'easy',
      lengthM: '5.5',
      projectionM: '2.8',
      postCutHeightM: '2.4',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      timberRoofAllowanceExGst: '0',
      quoteDiscountPct: '0',
    };

    const snapshot = {
      inputs: legacyInputs,
      outputs: {
        pergolas: [{ id: 'pergola-1', modules: [makeResult({ roofType: 'pitched', lengthA: 5.5, spanA: 2.8 })] }],
      },
    } satisfies Record<string, unknown>;

    const modules = buildEstimateDrawingModules(snapshot);

    expect(modules).toHaveLength(1);
    expect(modules[0]?.input.pergolaStyle).toBe('pitched');
    expect(modules[0]?.planModel).not.toBeNull();
    expect(modules[0]?.sectionModel).not.toBeNull();
  });

  it('returns one drawing module per saved input module even when results are missing', () => {
    const snapshot = {
      inputs: {
        schemaVersion: 'v2',
        projectName: 'Input fallback',
        quoteRef: 'Q-3000',
        access: 'normal',
        height: 'single_storey',
        jobType: 'residential',
        travelExGst: '0',
        extrasAllowanceExGst: '0',
        quoteDiscountPct: '0',
        pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
        modules: [makeModule({ lengthM: '6.2' }), makeModule({ lengthM: '4.4', projectionM: '2.4' })],
      },
      outputs: {},
    } satisfies Record<string, unknown>;

    const modules = buildEstimateDrawingModules(snapshot);

    expect(modules).toHaveLength(2);
    expect(modules[0]?.planModel?.dataSource).toBe('input_fallback');
    expect(modules[1]?.label).toBe('M2');
    expect(modules[1]?.sectionModel?.dataSource).toBe('input_fallback');
  });
});
