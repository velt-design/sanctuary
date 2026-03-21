import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildEstimateDrawingModules } from '@/lib/estimates/moduleDrawing';
import { buildAssemblyModel } from './buildAssemblyModel';

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
    overhangEnabled: true,
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
    postCount: '4',
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

function makeResult(): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: 'pitched',
    },
    derived: {
      length_m: 6,
      projection_m: 3,
      slope_direction: 'away_from_house',
      roof_pitch_deg_used: 5,
      height_house_side_m: 2.4,
      height_outer_side_m: 2.1,
    },
  } as unknown as CostOutputV1;
}

describe('buildAssemblyModel', () => {
  it('derives a semantic assembly model from the current drawing models', () => {
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
        pergolas: [{ id: 'pergola-1', modules: [makeResult()] }],
      },
    } satisfies Record<string, unknown>;

    const drawingModule = buildEstimateDrawingModules(snapshot)[0]!;
    const assembly = buildAssemblyModel({
      id: drawingModule.id,
      label: 'M1 - Pitched',
      moduleIndex: 0,
      moduleInput: drawingModule.input,
      moduleResult: drawingModule.result,
      planModel: drawingModule.planModel,
      sectionModel: drawingModule.sectionModel,
    });

    expect(assembly.roof.roofType).toBe('pitched');
    expect(assembly.roof.footprint.lengthA).toBeCloseTo(6);
    expect(assembly.houseContext.connectionType).toBe('soffit');
    expect(assembly.houseContext.soffitBrackets.count).toBeGreaterThan(0);
    expect(assembly.structure.rafters.countA).toBeGreaterThan(0);
    expect(assembly.structure.ridgeBeam.present).toBe(true);
    expect(assembly.supportConditions.postCount).toBe(4);
    expect(assembly.roof.fallVector).toEqual({ x: 0, y: 1, source: 'plan_local' });
    expect(assembly.capabilities.canEditHouseFootprint).toBe(true);
  });
});
