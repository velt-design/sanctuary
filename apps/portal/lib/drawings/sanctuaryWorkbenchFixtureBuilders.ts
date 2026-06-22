import 'server-only';

import type { EstimateDrawingDraft } from '@/lib/estimates/drawingEdits';
import { addHouseFormToObjectFirstDraft } from './state/objectFirstWorkbenchAdapter';
import {
  EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT,
  normalizeObjectFirstWorkbenchDraftVNext,
  type HouseFormFootprintModel,
  type HouseFormRoofIntentModel,
  type ObjectFirstHouseFormDraft,
  type ObjectFirstPergolaConnectionKind,
  type ObjectFirstPergolaDraft,
  type ObjectFirstWorkbenchDraftVNext,
  type WorkbenchAttachmentSide,
  type WorkbenchPergolaGableEndFramesMode,
  type WorkbenchPergolaGroundCondition,
  type WorkbenchPergolaHouseEdgeGutterMode,
  type WorkbenchPergolaPostConnectionType,
  type WorkbenchPergolaRoofMaterial,
} from './state/objectFirstWorkbenchModel';

type FixtureRoofType = 'pitched' | 'low_gable' | 'gable' | 'hip' | 'hip_corner';
type FixtureCostOutput = Record<string, unknown>;

export type FixtureModuleInput = {
  pergolaId?: string;
  pergolaStyle?: 'pitched' | 'gable' | 'hip' | 'hip_corner' | 'box';
  roofMaterial?: WorkbenchPergolaRoofMaterial;
  lengthM?: string;
  projectionM?: string;
  hipCornerLengthBM?: string;
  hipCornerProjectionBM?: string;
  roofPitchDeg?: string;
  postCutHeightM?: string;
  postCount?: string;
  postConnectionType?: WorkbenchPergolaPostConnectionType;
  ground?: WorkbenchPergolaGroundCondition;
  houseConnectionType?: ObjectFirstPergolaConnectionKind | 'none';
  attachmentSide?: WorkbenchAttachmentSide;
  houseAttachmentStrategy?: ObjectFirstPergolaDraft['strategy'];
  /** Retired post PR-WB-COMPOSITION-ONLY; kept as inert fields for backward-compat fixtures. */
  houseFootprintMode?: string;
  houseFootprintPreset?: string;
  houseFootprintParams?: unknown;
  houseRoofPitchDeg?: string;
  houseFasciaHeightMm?: string;
  houseEaveOverhangMm?: string;
  gableEndFramesMode?: WorkbenchPergolaGableEndFramesMode;
  gableHouseEdgeGutter?: WorkbenchPergolaHouseEdgeGutterMode;
  gableOuterEdgeGutter?: WorkbenchPergolaHouseEdgeGutterMode;
  boxPerimeterEnabled?: boolean;
  internalRoofType?: string;
  fallDistanceMm?: string;
};

export function makeModule(overrides: Partial<FixtureModuleInput> = {}): FixtureModuleInput {
  return {
    pergolaId: 'pergola-1',
    pergolaStyle: 'pitched',
    roofMaterial: 'acrylic',
    lengthM: '6',
    projectionM: '3',
    hipCornerLengthBM: '0',
    hipCornerProjectionBM: '0',
    roofPitchDeg: '5',
    postCutHeightM: '2.4',
    postCount: '4',
    postConnectionType: 'slab_anchors',
    ground: 'easy',
    houseConnectionType: 'soffit',
    attachmentSide: 'rear',
    houseAttachmentStrategy: 'soffit_brackets',
    houseFootprintMode: 'preset',
    houseFootprintPreset: 'straight',
    houseFootprintParams: {
      widthM: '6',
      offsetXM: '0',
      setbackM: '0',
      bandDepthM: '4',
      returnRunM: '0',
      recessWidthM: '0',
      recessDepthM: '0',
      leftLegRunM: '0',
      rightLegRunM: '0',
      sideRunM: '0',
    },
    houseRoofPitchDeg: '5',
    houseFasciaHeightMm: '180',
    houseEaveOverhangMm: '450',
    gableEndFramesMode: 'outer_end_only',
    gableHouseEdgeGutter: 'house',
    gableOuterEdgeGutter: 'our',
    boxPerimeterEnabled: false,
    internalRoofType: 'pitched',
    fallDistanceMm: '0',
    ...overrides,
  };
}

export function makeResult(params: {
  roofType?: FixtureRoofType;
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
}): FixtureCostOutput {
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
  };
}

export function makeSnapshot(module: FixtureModuleInput, result: FixtureCostOutput, label: string): Record<string, unknown> {
  return {
    fixtureSource: 'object_first_workbench_fixture',
    label,
    module,
    result,
  };
}

function familyFromFixtureModule(module: FixtureModuleInput): ObjectFirstPergolaDraft['family'] {
  if (module.boxPerimeterEnabled) return 'box';
  if (module.pergolaStyle === 'gable') return 'gable';
  if (module.pergolaStyle === 'hip') return 'hip';
  if (module.pergolaStyle === 'hip_corner') return 'hip_corner';
  return 'mono';
}

function connectionKindFromFixtureModule(
  value: FixtureModuleInput['houseConnectionType'],
): ObjectFirstPergolaConnectionKind {
  return value && value !== 'none' ? value : 'freestanding';
}

function buildObjectFirstDraftFromFixtureModule(module: FixtureModuleInput): ObjectFirstWorkbenchDraftVNext {
  const withHouse = addHouseFormToObjectFirstDraft({
    draft: EMPTY_OBJECT_FIRST_WORKBENCH_DRAFT,
    label: 'House 1',
  });
  const houseForms = withHouse.houseAssembly?.houseForms ?? [];
  const house = houseForms[0];
  if (!house) {
    throw new Error('Expected object-first house form for fixture.');
  }

  // PR-WB-COMPOSITION-ONLY (2026-06-19): fixture composition is
  // taken from the default house produced by
  // `addHouseFormToObjectFirstDraft`. Tests that wanted to dial
  // in legacy footprint params now author the composition
  // directly (or override the fixture builder's return).
  const pergolaConnectionKind = connectionKindFromFixtureModule(module.houseConnectionType);
  const nextHouse: ObjectFirstHouseFormDraft = {
    ...house,
    attachmentSide: module.attachmentSide ?? 'rear',
    roofIntentAuthored: true,
    roofIntent: {
      ...house.roofIntent,
      form: 'hipped',
      primaryPitchDeg: module.houseRoofPitchDeg ?? module.roofPitchDeg ?? house.roofIntent.primaryPitchDeg,
    } satisfies HouseFormRoofIntentModel,
    attachmentStrategy: module.houseAttachmentStrategy ?? null,
    fasciaHeightMm: module.houseFasciaHeightMm ?? house.fasciaHeightMm,
    eaveOverhangMm: module.houseEaveOverhangMm ?? house.eaveOverhangMm,
  };

  const pergola: ObjectFirstPergolaDraft = {
    id: module.pergolaId ?? 'pergola-1',
    label: 'Pergola 1',
    family: familyFromFixtureModule(module),
    connectionKind: pergolaConnectionKind,
    attachmentEdgeId: null,
    attachmentZoneId: null,
    side: module.attachmentSide ?? 'rear',
    strategy: pergolaConnectionKind === 'freestanding'
      ? null
      : module.houseAttachmentStrategy ?? 'soffit_brackets',
    geometry: {
      dimensions: {
        lengthM: module.lengthM ?? '6',
        projectionM: module.projectionM ?? '3',
        hipCornerLengthBM: module.hipCornerLengthBM ?? '0',
        hipCornerProjectionBM: module.hipCornerProjectionBM ?? '0',
      },
      roof: {
        material: module.roofMaterial ?? 'acrylic',
        pitchDeg: module.roofPitchDeg ?? '5',
      },
      gable: {
        endFramesMode: module.gableEndFramesMode ?? 'outer_end_only',
        houseEaveGutterMode: module.gableHouseEdgeGutter ?? 'house',
        outerEaveGutterMode: module.gableOuterEdgeGutter ?? 'our',
      },
      supports: {
        postCount: module.postCount ?? '4',
        postCutHeightM: module.postCutHeightM ?? '2.4',
        postConnectionType: module.postConnectionType ?? 'slab_anchors',
        ground: module.ground ?? 'easy',
      },
    },
    position: { originXMm: '0', originYMm: '0', rotationDeg: '0' },
    attachment: null,
  };

  return normalizeObjectFirstWorkbenchDraftVNext({
    ...withHouse,
    houseAssembly: {
      ...withHouse.houseAssembly!,
      houseForms: [nextHouse],
    },
    pergolas: [pergola],
  });
}

export function makeHouseRoofDraftFixtureDraft(input: {
  snapshot: Record<string, unknown>;
  roof: Partial<HouseFormRoofIntentModel>;
}): EstimateDrawingDraft {
  const module = (input.snapshot.module ?? makeModule()) as FixtureModuleInput;
  const objectFirst = buildObjectFirstDraftFromFixtureModule(module);
  const houseForm = objectFirst.houseAssembly?.houseForms[0];
  if (!houseForm) {
    throw new Error('Expected object-first house form from fixture module.');
  }
  houseForm.roofIntentAuthored = true;
  houseForm.roofIntent = {
    ...houseForm.roofIntent,
    ...input.roof,
  };
  return {
    inputs: {} as EstimateDrawingDraft['inputs'],
    overrides: {},
    objectFirst,
  };
}
