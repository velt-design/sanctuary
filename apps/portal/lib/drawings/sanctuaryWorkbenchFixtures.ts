import 'server-only';

import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import type { SanctuaryGeometryWorkbenchFixture } from './sanctuaryWorkbenchFixtures.types';

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

function makeResult(params: {
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

function makeSnapshot(module: CalculatorModuleInputs, result: CostOutputV1, label: string): Record<string, unknown> {
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

const FIXTURES: SanctuaryGeometryWorkbenchFixture[] = [
  {
    slug: 'mono-standard',
    label: 'Mono Standard',
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'pitched',
        roofMaterial: 'acrylic',
        lengthM: '6',
        projectionM: '3',
        roofPitchDeg: '5',
      }),
      makeResult({
        roofType: 'pitched',
        lengthA: 6,
        spanA: 3,
        roofPitchDegUsed: 5,
        heightHouseSideM: 2.4,
        heightOuterSideM: 2.1,
        gutterType: 'SP Gutter',
        rafterCount: 11,
        rafterSpacingMm: 600,
        effectiveRunM: 2.85,
        acrylicRequiredDownslopeM: 2.88088653699854,
        joinerPieceLengthM: 2.88088653699854,
        joinerRunsTotal: 11,
        rafterHouseAllowanceM: 0.05,
        rafterFarAllowanceM: 0.1,
        acrylicAreaM2: 18.06875707578025,
      }),
      'Mono Standard',
    ),
    moduleLabels: ['M1 - Mono Standard - 6m x 3m - Acrylic'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000101',
      versionLabel: 'V-FIX-M1',
      status: 'draft',
      createdAt: '2026-04-08T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000101',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_3',
    },
  },
  {
    slug: 'gable-standard',
    label: 'Gable Standard',
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'mixed',
        lengthM: '6.5',
        projectionM: '4',
        roofPitchDeg: '25',
        postCutHeightM: '2.7',
        gableEndFramesMode: 'outer_end_only',
      }),
      makeResult({
        roofType: 'gable',
        lengthA: 6.5,
        spanA: 4,
        roofPitchDegUsed: 25,
        heightHouseSideM: 2.7,
        heightOuterSideM: 2.7,
        gutterType: 'SP Gutter',
        rafterCount: 12,
        rafterSpacingMm: 590,
        ridgeBeamProfileUsed: '50x150',
      }),
      'Gable Standard',
    ),
    moduleLabels: ['M1 - Gable Standard - 6.5m x 4m - Insulated'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000102',
      versionLabel: 'V-FIX-G1',
      status: 'draft',
      createdAt: '2026-04-08T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000102',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
  {
    slug: 'box-standard',
    label: 'Box Standard',
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'pitched',
        boxPerimeterEnabled: true,
        internalRoofType: 'pitched',
        roofMaterial: 'timber',
        lengthM: '5.5',
        projectionM: '3.5',
        roofPitchDeg: '3',
        fallDistanceMm: '40',
      }),
      makeResult({
        roofType: 'pitched',
        lengthA: 5.5,
        spanA: 3.5,
        roofPitchDegUsed: 3,
        heightHouseSideM: 2.5,
        heightOuterSideM: 2.35,
        boxPitchDegUsed: 3,
        gutterType: 'box_gutter_100x100x3',
        rafterProfileAuto: '50x80',
        boxPerimeterBeamProfileUsed: '50x300',
        rafterCount: 10,
        rafterSpacingMm: 611,
        boxEffectiveRunM: 3.3,
        boxRiseMm: 173,
        boxMaxFallMm: 200,
      }),
      'Box Standard',
    ),
    moduleLabels: ['M1 - Box Standard - 5.5m x 3.5m - Timber'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000103',
      versionLabel: 'V-FIX-B1',
      status: 'draft',
      createdAt: '2026-04-08T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000103',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_3',
    },
  },
  {
    slug: 'gable-u-hipped-screenshot',
    label: 'Gable U Hipped Screenshot',
    snapshot: makeSnapshot(
      makeModule({
        pergolaStyle: 'gable',
        roofMaterial: 'acrylic',
        lengthM: '5',
        projectionM: '5',
        roofPitchDeg: '20',
        postCutHeightM: '2.5',
        houseConnectionType: 'fascia',
        attachmentSide: 'front',
        houseAttachmentStrategy: 'fascia_under_gutter',
        houseFootprintMode: 'preset',
        houseFootprintPreset: 'u_shape',
        houseFootprintParams: {
          widthM: '8',
          offsetXM: '-1',
          setbackM: '0.4',
          bandDepthM: '1.8',
          returnRunM: '2.4',
          recessWidthM: '2.4',
          recessDepthM: '1.2',
          leftLegRunM: '5',
          rightLegRunM: '5',
          sideRunM: '2.4',
        },
        houseRoofPitchDeg: '20',
        houseFasciaHeightMm: '300',
        houseEaveOverhangMm: '1000',
        gableEndFramesMode: 'outer_end_only',
        gableHouseEdgeGutter: 'house',
        gableOuterEdgeGutter: 'our',
      }),
      makeResult({
        roofType: 'gable',
        lengthA: 5,
        spanA: 5,
        roofPitchDegUsed: 20,
        heightHouseSideM: 2.5,
        heightOuterSideM: 2.5,
        gutterType: 'SP Gutter',
        rafterCount: 10,
        rafterSpacingMm: 556,
        ridgeBeamProfileUsed: '50x150',
      }),
      'Gable U Hipped Screenshot',
    ),
    moduleLabels: ['M1 - Gable U Hipped Screenshot - 5m x 5m - Acrylic'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000124',
      versionLabel: 'V-FIX-U1',
      status: 'draft',
      createdAt: '2026-04-13T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000124',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
];

export function listSanctuaryGeometryWorkbenchFixtures(): SanctuaryGeometryWorkbenchFixture[] {
  return FIXTURES.slice();
}

export function getSanctuaryGeometryWorkbenchFixture(slug: string): SanctuaryGeometryWorkbenchFixture | null {
  return FIXTURES.find((fixture) => fixture.slug === slug) ?? null;
}
