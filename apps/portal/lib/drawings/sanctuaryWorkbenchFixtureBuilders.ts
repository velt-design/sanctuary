import 'server-only';

import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  buildEstimateDrawingDraftFromSnapshot,
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildHouseFirstWorkbenchProjectModel } from './state/houseFirstWorkbenchAdapter';
import { buildObjectFirstWorkbenchDraftFromProjectModel } from './state/objectFirstWorkbenchAdapter';
import { buildObjectFirstWorkbenchProjectModel } from './state/legacyObjectFirstCompatibilityAdapter';
import type { HouseFormRoofIntentModel } from './state/objectFirstWorkbenchModel';

export function makeModule(overrides: Partial<CalculatorModuleInputs> = {}): CalculatorModuleInputs {
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
    postCount: '4',
    houseConnectionType: 'soffit',
    attachmentSide: 'rear',
    houseFootprintPreset: 'straight',
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

export function makeResult(params: {
  roofType?: RoofType;
  lengthA?: number;
  spanA?: number;
  slopeDirection?: 'away_from_house' | 'toward_house' | null;
  roofPitchDegUsed?: number;
  heightHouseSideM?: number;
  heightOuterSideM?: number;
  boxPitchDegUsed?: number;
  postProfileUsed?: string;
  rafterProfileAuto?: string;
  ledgerProfileUsed?: string;
  supportBeamProfileUsed?: string;
  ridgeBeamProfileUsed?: string;
  boxPerimeterBeamProfileUsed?: string;
  gutterType?: string;
  rafterCount?: number;
  rafterSpacingMm?: number;
  effectiveRunM?: number;
  acrylicRequiredDownslopeM?: number;
  joinerPieceLengthM?: number;
  joinerRunsTotal?: number;
  roofPlaneCount?: number;
  roofSurfaceAreaM2?: number;
  rafterHouseAllowanceM?: number;
  rafterFarAllowanceM?: number;
  acrylicAreaM2?: number;
  boxEffectiveRunM?: number;
  boxRiseMm?: number;
  boxMaxFallMm?: number;
}): CostOutputV1 {
  return {
    inputs_normalized: {
      roof_type: params.roofType ?? 'pitched',
      gutter_type: params.gutterType ?? 'SP Gutter',
    },
    derived: {
      length_m: params.lengthA ?? 6,
      projection_m: params.spanA ?? 3,
      slope_direction: params.slopeDirection ?? 'away_from_house',
      roof_pitch_deg_used: params.roofPitchDegUsed ?? 5,
      height_house_side_m: params.heightHouseSideM ?? 2.4,
      height_outer_side_m: params.heightOuterSideM ?? 2.1,
      post_cut_height_house_side_m: params.heightHouseSideM ?? 2.4,
      post_cut_height_outer_side_m: params.heightOuterSideM ?? 2.1,
      post_profile_used: params.postProfileUsed ?? '90x90',
      rafter_profile_auto: params.rafterProfileAuto ?? '50x150',
      ledger_profile_used: params.ledgerProfileUsed ?? '50x100',
      support_beam_profile_used: params.supportBeamProfileUsed ?? '50x150',
      front_beam_profile_used: params.supportBeamProfileUsed ?? '50x150',
      ridge_beam_profile_used: params.ridgeBeamProfileUsed ?? '50x150',
      box_perimeter_beam_profile_used: params.boxPerimeterBeamProfileUsed ?? '50x300',
      rafter_count: params.rafterCount ?? 11,
      rafter_spacing_mm: params.rafterSpacingMm ?? 600,
      effective_run_m: params.effectiveRunM ?? null,
      acrylic_required_downslope_m: params.acrylicRequiredDownslopeM ?? null,
      joiner_piece_length_m: params.joinerPieceLengthM ?? null,
      joiner_runs_total: params.joinerRunsTotal ?? null,
      roof_plane_count: params.roofPlaneCount ?? 1,
      roof_surface_area_m2: params.roofSurfaceAreaM2 ?? null,
      roof_planes: Array.from({ length: params.roofPlaneCount ?? 1 }, (_, index) => ({
        id: `fixture-roof-plane-${index + 1}`,
        roof_area_m2: params.roofSurfaceAreaM2 == null ? null : params.roofSurfaceAreaM2 / (params.roofPlaneCount ?? 1),
      })),
      rafter_house_allowance_m: params.rafterHouseAllowanceM ?? null,
      rafter_far_allowance_m: params.rafterFarAllowanceM ?? null,
      acrylic_area_m2: params.acrylicAreaM2 ?? null,
      gutter_assembly_mode: 'integrated',
      integrated_gutter_beam: true,
      has_our_gutter: true,
      overhang_enabled: false,
      overhang_amount_m: 0,
      box_pitch_deg_used: params.boxPitchDegUsed ?? params.roofPitchDegUsed ?? 5,
      box_effective_run_m: params.boxEffectiveRunM ?? null,
      box_rise_mm: params.boxRiseMm ?? null,
      box_max_fall_mm: params.boxMaxFallMm ?? null,
    },
  } as unknown as CostOutputV1;
}

export function makeSnapshot(module: CalculatorModuleInputs, result: CostOutputV1, label: string): Record<string, unknown> {
  return {
    inputs: {
      schemaVersion: 'v2',
      projectName: 'Sanctuary Fixture Project',
      quoteRef: 'Q-FIXTURE',
      access: 'normal',
      height: 'single_storey',
      jobType: 'residential',
      travelExGst: '0',
      extrasAllowanceExGst: '0',
      quoteDiscountPct: '0',
      pergolas: [{ id: 'pergola-1', label }],
      modules: [module],
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: [result] }],
    },
  } satisfies Record<string, unknown>;
}

export function makeHouseRoofDraftFixtureDraft(input: {
  snapshot: Record<string, unknown>;
  roof: Partial<HouseFormRoofIntentModel>;
}): EstimateDrawingDraft {
  const draft = buildEstimateDrawingDraftFromSnapshot(input.snapshot);
  if (!draft) {
    throw new Error('Expected drawing draft from fixture snapshot.');
  }
  const compatibilityProjectModel = buildHouseFirstWorkbenchProjectModel({
    snapshot: input.snapshot,
    draft,
  });
  const projectModel = buildObjectFirstWorkbenchProjectModel({
    compatibilityProjectModel,
  });
  const objectFirst = buildObjectFirstWorkbenchDraftFromProjectModel(projectModel);
  const houseForm = objectFirst.houseAssembly?.houseForms[0];
  if (!houseForm) {
    throw new Error('Expected object-first house form from fixture snapshot.');
  }
  houseForm.roofIntentAuthored = true;
  houseForm.roofIntent = {
    ...houseForm.roofIntent,
    ...input.roof,
  };
  return updateEstimateDrawingObjectFirstWorkbenchDraft({
    draft,
    objectFirst,
  });
}
