import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import { buildRawGeometryModuleInput } from './buildRawGeometryModuleInput';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';

function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
  return {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    extrusionColour: 'White',
    powdercoatStandardColour: '',
    powdercoatIsCustom: false,
    powdercoatCustomColour: '',
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
    attachmentSide: 'left',
    drawingRotationQuarterTurns: 0,
    houseFootprintPreset: 'l_left',
    houseFootprintParams: {
      bandDepthM: '1.8',
      returnRunM: '2.4',
      recessWidthM: '2.4',
      recessDepthM: '1.2',
      leftLegRunM: '2.4',
      rightLegRunM: '2.4',
      sideRunM: '2.4',
    },
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
    ...overrides,
  };
}

function makeResult(overrides: Partial<CostOutputV1['derived']> = {}): CostOutputV1 {
  return {
    inputs_normalized: {} as CostOutputV1['inputs_normalized'],
    derived: {
      length_m: 6.4,
      projection_m: 3.2,
      roof_pitch_deg_used: 7,
      slope_direction: 'toward_house',
      ...overrides,
    } as CostOutputV1['derived'],
    materials: {} as CostOutputV1['materials'],
    install: {} as CostOutputV1['install'],
    overhead: {} as CostOutputV1['overhead'],
    add_ons: {} as CostOutputV1['add_ons'],
    totals: {} as CostOutputV1['totals'],
  };
}

describe('buildRawGeometryModuleInput', () => {
  it('maps mono calculator data into the raw geometry package contract with derived overrides', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      designRequestId: 'dpr_1',
      moduleId: 'mod_1',
      module: makeModule(),
      result: makeResult(),
    });

    expect(raw).toEqual({
      projectId: 'proj_1',
      estimateId: 'est_1',
      designRequestId: 'dpr_1',
      moduleId: 'mod_1',
      pergolaStyle: 'pitched',
      boxPerimeterEnabled: false,
      roof: {
        material: 'acrylic',
        mode: null,
        slopeDirection: 'away_from_house',
        roofPitchDeg: '5',
        overhangEnabled: false,
        overhangM: 0,
      },
      gable: {
        endFramesMode: 'outer_end_only',
        houseEaveGutter: 'house',
        outerEaveGutter: 'our',
      },
      box: {
        houseEdgeGutter: 'house',
        farEdgeGutter: 'our',
      },
      connection: {
        houseConnectionType: 'soffit',
        attachmentSide: 'left',
      },
      supports: expect.objectContaining({
        postCount: '2',
        postCutHeightM: '2.4',
        postConnectionType: 'slab_anchors',
        ground: 'easy',
      }),
      structural: {
        heights: {
          houseUndersideM: '2.4',
          outerUndersideM: null,
          referenceUndersideM: '2.4',
        },
        profiles: {
          post: null,
          rafter: null,
          ledger: null,
          supportBeam: null,
          gutter: null,
          ridge: null,
          boxPerimeter: null,
        },
        framing: {
          rafterCount: null,
          rafterSpacingMm: null,
        },
        drainage: {
          gutterType: null,
          gutterAssemblyMode: null,
          integratedGutterBeam: null,
          hasOurGutter: null,
        },
      },
      houseContext: expect.objectContaining({
        footprintPreset: 'l_left',
      }),
      dimensions: {
        lengthM: '6',
        projectionM: '3',
        hipCornerLengthBM: '0',
        hipCornerProjectionBM: '0',
      },
      derived: {
        lengthM: 6.4,
        projectionM: 3.2,
        roofPitchDeg: 7,
        slopeDirection: 'toward_house',
        boxEffectiveRunM: null,
        boxRiseMm: null,
        boxMaxFallMm: null,
      },
    });
  });

  it('maps gable modules without changing the family-driving pergola style', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'timber',
        gableEndFramesMode: 'none',
      }),
      result: makeResult({
        slope_direction: 'away_from_house',
        ridge_beam_profile_used: '150x50',
      }),
    });

    expect(raw.pergolaStyle).toBe('gable');
    expect(raw.roof.material).toBe('timber');
    expect(raw.derived?.slopeDirection).toBe('away_from_house');
    expect(raw.gable).toEqual({
      endFramesMode: 'none',
      houseEaveGutter: 'house',
      outerEaveGutter: 'our',
    });
    expect(raw.structural?.profiles?.ridge).toBe('150x50');
  });

  it('maps box modules with the box flag and box-specific derived pitch override', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        boxPerimeterEnabled: true,
        roofMaterial: 'timber',
      }),
      result: makeResult({
        box_pitch_deg_used: 2.5,
        roof_pitch_deg_used: 9,
        box_perimeter_beam_profile_used: '300x50',
        box_effective_run_m: 3.3,
        box_rise_mm: 173,
        box_max_fall_mm: 200,
      }),
    });

    expect(raw.boxPerimeterEnabled).toBe(true);
    expect(raw.roof.mode).toBe('box_perimeter');
    expect(raw.derived?.roofPitchDeg).toBe(2.5);
    expect(raw.box).toEqual({
      houseEdgeGutter: 'house',
      farEdgeGutter: 'our',
    });
    expect(raw.structural?.profiles?.boxPerimeter).toBe('300x50');
    expect(raw.derived?.boxEffectiveRunM).toBe(3.3);
    expect(raw.derived?.boxRiseMm).toBe(173);
    expect(raw.derived?.boxMaxFallMm).toBe(200);
  });

  it('falls back to raw inputs when no costing result is available', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        invertedEnabled: true,
        houseConnectionType: 'none',
      }),
      result: null,
    });

    expect(raw.derived).toEqual({
      lengthM: null,
      projectionM: null,
      roofPitchDeg: null,
      slopeDirection: null,
      boxEffectiveRunM: null,
      boxRiseMm: null,
      boxMaxFallMm: null,
    });
    expect(raw.roof.slopeDirection).toBe('toward_house');
    expect(raw.connection.attachmentSide).toBe('rear');
    expect(raw.roof.overhangM).toBe(0);
  });

  it('maps solver-critical mono structure fields from costing-derived data', () => {
    const raw = buildRawGeometryModuleInput({
      projectId: 'proj_1',
      estimateId: 'est_1',
      module: makeModule({
        overhangEnabled: true,
        overhangAmountM: '0.45',
        overrides: {
          ledgerProfile: '100x50',
          rafterProfile: '150x50',
          postProfile: '90x90',
          frontBeamProfile: '150x50',
        },
      }),
      result: makeResult({
        ledger_underside_height_m: 2.55,
        post_cut_height_outer_side_m: 2.31,
        rafter_count: 11,
        rafter_spacing_mm: 601,
        gutter_assembly_mode: 'integrated',
        integrated_gutter_beam: true,
        has_our_gutter: true,
        ledger_profile_used: '100x50',
        post_profile_used: '90x90',
        front_beam_profile_used: '150x50',
        roof_pitch_deg_used: 8,
        overhang_enabled: true,
        overhang_amount_m: 0.35,
      }),
    });

    expect(raw.roof.overhangEnabled).toBe(true);
    expect(raw.roof.overhangM).toBe(0.35);
    expect(raw.structural).toEqual({
      heights: {
        houseUndersideM: 2.55,
        outerUndersideM: 2.31,
        referenceUndersideM: 2.55,
      },
      profiles: {
        post: '90x90',
        rafter: '150x50',
        ledger: '100x50',
        supportBeam: '150x50',
        gutter: '150x50',
        ridge: null,
        boxPerimeter: null,
      },
      framing: {
        rafterCount: 11,
        rafterSpacingMm: 601,
      },
      drainage: {
        gutterType: null,
        gutterAssemblyMode: 'integrated',
        integratedGutterBeam: true,
        hasOurGutter: true,
      },
    });
  });

  it('keeps the adapter independent from legacy drawing assembly code', () => {
    const source = fs.readFileSync(path.resolve(__dirname, './buildRawGeometryModuleInput.ts'), 'utf8');

    expect(source).not.toContain('ModulePlanModel');
    expect(source).not.toContain('ModuleSectionModel');
    expect(source).not.toContain('buildAssemblyModel');
  });
});
