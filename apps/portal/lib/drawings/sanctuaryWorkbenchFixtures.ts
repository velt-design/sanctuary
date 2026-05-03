import 'server-only';

import type { CostOutputV1, RoofType } from '@sp/costing';
import type { CalculatorModuleInputs } from '@/lib/types/calculator';
import {
  buildEstimateDrawingDraftFromSnapshot,
  updateEstimateDrawingObjectFirstWorkbenchDraft,
  type EstimateDrawingDraft,
} from '@/lib/estimates/drawingEdits';
import { buildObjectWorkbenchCompatibilityProjectModel } from './state/compat/objectWorkbenchCompatibilityModel';
import {
  buildObjectFirstWorkbenchDraftFromProjectModel,
} from './state/objectFirstWorkbenchAdapter';
import {
  buildObjectFirstWorkbenchProjectModel,
} from './state/legacyObjectFirstCompatibilityAdapter';
import type { HouseFormRoofIntentModel } from './state/objectFirstWorkbenchModel';
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

function makeHouseRoofDraftFixtureDraft(input: {
  snapshot: Record<string, unknown>;
  roof: Partial<HouseFormRoofIntentModel>;
}): EstimateDrawingDraft {
  const draft = buildEstimateDrawingDraftFromSnapshot(input.snapshot);
  if (!draft) {
    throw new Error('Expected drawing draft from fixture snapshot.');
  }
  const compatibilityProjectModel = buildObjectWorkbenchCompatibilityProjectModel({
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
    appendage: {
      ...houseForm.roofIntent.appendage,
      ...(input.roof.appendage ?? {}),
    },
  };
  return updateEstimateDrawingObjectFirstWorkbenchDraft({
    draft,
    objectFirst,
  });
}

function makeScreenshotStyleUSnapshot(): Record<string, unknown> {
  return makeSnapshot(
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
      roofPlaneCount: 2,
      roofSurfaceAreaM2: 26.604,
      ridgeBeamProfileUsed: '50x150',
    }),
    'Gable U Hipped Screenshot',
  );
}

function makeGableUHippedScreenshotFixtureSource(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const snapshot = makeScreenshotStyleUSnapshot();
  return {
    snapshot,
    draft: makeHouseRoofDraftFixtureDraft({
      snapshot,
      roof: {
        form: 'hipped',
        primaryPitchDeg: '20',
      },
    }),
  };
}

function makeMonoJoinScreenshotFixtureSource(): {
  snapshot: Record<string, unknown>;
  draft: EstimateDrawingDraft;
} {
  const snapshot = makeScreenshotStyleUSnapshot();
  return {
    snapshot,
    draft: makeHouseRoofDraftFixtureDraft({
      snapshot,
      roof: {
        form: 'mono',
        material: 'trapezoidal_5_rib',
        primaryPitchDeg: '20',
        primaryFallDirection: 'positive_y',
      },
    }),
  };
}

const FIXTURES: SanctuaryGeometryWorkbenchFixture[] = [
  {
    slug: 'mono-standard',
    label: 'Mono Standard',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Baseline attached mono acrylic fixture for calculator/workbench parity.',
      parityCritical: true,
      shapeFamily: 'mono',
      houseRoofForm: 'hipped',
      expectedModule: {
        lengthM: 6,
        projectionM: 3,
        roofMaterial: 'acrylic',
        attachmentSide: 'rear',
        roofPitchDeg: 5,
        roofType: 'pitched',
        roofPlaneCount: 1,
      },
    },
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
        roofPlaneCount: 1,
        roofSurfaceAreaM2: 18.06875707578025,
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
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Baseline attached gable fixture with installed end-frame defaults.',
      parityCritical: true,
      shapeFamily: 'gable',
      houseRoofForm: 'hipped',
      expectedModule: {
        lengthM: 6.5,
        projectionM: 4,
        roofMaterial: 'mixed',
        attachmentSide: 'rear',
        roofPitchDeg: 25,
        roofType: 'gable',
        roofPlaneCount: 2,
      },
    },
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
        roofPlaneCount: 2,
        roofSurfaceAreaM2: 28.691,
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
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Baseline attached box-perimeter fixture for geometry takeoff parity.',
      parityCritical: true,
      shapeFamily: 'box',
      houseRoofForm: 'hipped',
      expectedModule: {
        lengthM: 5.5,
        projectionM: 3.5,
        roofMaterial: 'timber',
        attachmentSide: 'rear',
        roofPitchDeg: 3,
        roofType: 'pitched',
        roofPlaneCount: 1,
      },
    },
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
        roofPlaneCount: 1,
        roofSurfaceAreaM2: 19.276,
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
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Screenshot-style U footprint with authored hipped house roof topology.',
      parityCritical: true,
      shapeFamily: 'gable',
      houseRoofForm: 'hipped',
      expectedModule: {
        lengthM: 5,
        projectionM: 5,
        roofMaterial: 'acrylic',
        attachmentSide: 'front',
        roofPitchDeg: 20,
        roofType: 'gable',
        roofPlaneCount: 2,
      },
    },
    ...makeGableUHippedScreenshotFixtureSource(),
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
  {
    slug: 'mono-join-screenshot',
    label: 'Mono Join Screenshot',
    qa: {
      source: 'baked_workbench_fixture',
      purpose: 'Screenshot-style U footprint with mono house roof join cleanup coverage.',
      parityCritical: true,
      shapeFamily: 'gable',
      houseRoofForm: 'mono',
      expectedModule: {
        lengthM: 5,
        projectionM: 5,
        roofMaterial: 'acrylic',
        attachmentSide: 'front',
        roofPitchDeg: 20,
        roofType: 'gable',
        roofPlaneCount: 2,
      },
    },
    ...makeMonoJoinScreenshotFixtureSource(),
    moduleLabels: ['M1 - Mono Join Screenshot - 5m x 5m - Trapezoidal 5 Rib'],
    estimate: {
      id: 'est_00000000-0000-4000-8000-000000000125',
      versionLabel: 'V-FIX-U2',
      status: 'draft',
      createdAt: '2026-04-22T00:00:00.000Z',
    },
    request: {
      id: 'dpr_00000000-0000-4000-8000-000000000125',
      requestVersion: 1,
      status: 'OPEN',
      priorityTier: 'TIER_2',
    },
  },
];

export function listSanctuaryGeometryWorkbenchFixtures(): SanctuaryGeometryWorkbenchFixture[] {
  return FIXTURES.slice();
}

export function listParityCriticalSanctuaryGeometryWorkbenchFixtures(): SanctuaryGeometryWorkbenchFixture[] {
  return FIXTURES.filter((fixture) => fixture.qa.parityCritical);
}

export function getSanctuaryGeometryWorkbenchFixture(slug: string): SanctuaryGeometryWorkbenchFixture | null {
  return FIXTURES.find((fixture) => fixture.slug === slug) ?? null;
}
