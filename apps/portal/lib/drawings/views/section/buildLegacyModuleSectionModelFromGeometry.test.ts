import { describe, expect, it } from 'vitest';
import type { CostOutputV1 } from '@sp/costing';
import { buildSectionViewModel as buildGeometrySectionViewModel, normalizeGeometryConfig, solveAssembly3D } from '@sp/geometry';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildModuleSectionModel } from '@/app/staff/calculator/moduleViews';
import { buildRawGeometryModuleInput } from '@/lib/drawings/geometry/buildRawGeometryModuleInput';
import { buildLegacyModuleSectionModelFromGeometry } from './buildLegacyModuleSectionModelFromGeometry';

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
    gableEndFramesMode: 'none',
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
    attachmentSide: 'rear',
    houseFootprintPreset: 'straight',
    drawingRotationQuarterTurns: 2,
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

function makeResult(overrides: Partial<Record<string, unknown>> = {}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: 'pitched',
      gutter_type: 'SP Gutter',
    },
    derived: {
      length_m: 6,
      projection_m: 3,
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
      ...overrides,
    },
  } as unknown as CostOutputV1;
}

function buildGeometrySection(module: CalculatorModuleInputs, result: CostOutputV1) {
  const raw = buildRawGeometryModuleInput({
    projectId: 'proj',
    estimateId: 'est',
    moduleId: 'module-1',
    module,
    result,
  });
  const normalized = normalizeGeometryConfig(raw);
  if (!normalized.ok) {
    throw new Error(normalized.error);
  }

  const solved = solveAssembly3D(normalized.value);
  if (!solved.ok) {
    throw new Error(solved.error);
  }

  return buildGeometrySectionViewModel(solved.value);
}

describe('buildLegacyModuleSectionModelFromGeometry', () => {
  it('builds a valid legacy-compatible ModuleSectionModel from geometry projection', () => {
    const module = makeModule();
    const result = makeResult();
    const sectionModel = buildLegacyModuleSectionModelFromGeometry({
      geometrySection: buildGeometrySection(module, result),
      module,
      fallbackMetadata: buildModuleSectionModel(module, result),
    });

    expect(sectionModel.sectionKind).toBe('mono');
    expect(sectionModel.spanA).toBe(3);
    expect(sectionModel.leftEdgeHeightM).toBe(2.4);
    expect(sectionModel.rightEdgeHeightM).toBe(2.1);
    expect(sectionModel.pitchDeg).toBeCloseTo(5, 2);
    expect(sectionModel.houseContext?.surfaces.map((surface) => surface.kind)).toEqual(
      expect.arrayContaining(['wall', 'roof', 'soffit', 'fascia']),
    );
    expect(sectionModel.houseContext?.lines.map((line) => line.kind)).toEqual(
      expect.arrayContaining(['house_reference', 'gutter', 'attachment_target']),
    );
    expect(sectionModel.houseContext?.surfaces.find((surface) => surface.kind === 'wall')?.boundary.some((point) => point.y >= 2.4)).toBe(true);
  });

  it('takes geometric section fields from the geometry projection instead of fallback metadata', () => {
    const module = makeModule();
    const result = makeResult();
    const poisonedFallback = {
      ...buildModuleSectionModel(module, result)!,
      spanA: 99,
      leftEdgeHeightM: 8.8,
      rightEdgeHeightM: 7.7,
      pitchDeg: 44,
    };

    const sectionModel = buildLegacyModuleSectionModelFromGeometry({
      geometrySection: buildGeometrySection(module, result),
      module,
      fallbackMetadata: poisonedFallback,
    });

    expect(sectionModel.spanA).toBe(3);
    expect(sectionModel.leftEdgeHeightM).toBe(2.4);
    expect(sectionModel.rightEdgeHeightM).toBe(2.1);
    expect(sectionModel.pitchDeg).not.toBe(44);
  });

  it('preserves metadata-only passthrough such as sectionSpanField from fallback metadata', () => {
    const module = makeModule({ attachmentSide: 'left' });
    const result = makeResult();
    const fallback = buildModuleSectionModel(module, result)!;

    const sectionModel = buildLegacyModuleSectionModelFromGeometry({
      geometrySection: buildGeometrySection(module, result),
      module,
      fallbackMetadata: fallback,
    });

    expect(fallback.sectionSpanField).toBe('lengthM');
    expect(sectionModel.sectionSpanField).toBe('lengthM');
  });
});
