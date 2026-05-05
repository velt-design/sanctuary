import { describe, expect, it } from 'vitest';
import {
  calculateSiteCostV1,
  compareCommercialDesignInputsV1,
  type CommercialModuleInputV1,
  type CommercialTrustStatusV1,
  type CostOutputV1,
  type SiteOutputV1,
} from '@sp/costing';
import { listParityCriticalSanctuaryGeometryWorkbenchFixtures } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildCommercialDesignInputFromCalculatorInputs } from '@/lib/estimates/commercialDesignPayload';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import type { CalculatorInputs, CalculatorModuleInputs } from '@/lib/types/calculator';
import { buildWorkbenchSolvedModel, type WorkbenchSolvedModel, type WorkbenchSolvedModule } from './state/workbenchSolvedModel';
import {
  buildCommercialDesignInputFromWorkbenchSolvedModel,
  buildCommercialModuleInputFromWorkbenchSolvedModule,
} from './commercialDesignPayload';

const SITE_COMMERCIAL = {
  jobType: 'residential',
  access: 'normal',
  height: 'single_storey',
  travelExGst: 12,
  extrasAllowanceExGst: 45,
  quoteDiscountPct: 5,
} as const;

type SnapshotWithCalculatorInputs = Record<string, unknown> & {
  inputs: CalculatorInputs;
  outputs: SiteOutputV1;
};

type SavedEstimateSnapshotCase = {
  slug: string;
  purpose: string;
  expectedModuleCount: number;
  expectedTrustStatuses: CommercialTrustStatusV1[];
  expectedModules: Array<{
    lengthM: number;
    projectionM: number;
    secondaryLengthM?: number | null;
    secondaryProjectionM?: number | null;
    roofPlaneCount: number;
  }>;
  inputs: CalculatorInputs;
  outputs: SiteOutputV1;
  snapshot: SnapshotWithCalculatorInputs;
};

const DRIFT_ORIGINS = new Set([
  'authored_intent',
  'solved_geometry',
  'physical_takeoff',
  'commercial_mapping',
]);

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
    downpipeCount: '2',
    downpipeJoinCount: '1',
    downpipeElbowCount: '3',
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
    flashings: {
      rows: [{ id: 'flash-1', kind: 'extra', band: '201-300', lengthM: '1.5', purpose: 'CUSTOM' }],
    },
    overrides: { ledgerProfile: '150x50', rafterProfile: '100x50' },
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

function makeSnapshot(input?: {
  modules?: CalculatorModuleInputs[];
  results?: CostOutputV1[];
  pergolas?: Array<{ id: string; label: string }>;
}): Record<string, unknown> {
  const modules = input?.modules ?? [makeModule()];
  const results = input?.results ?? modules.map((module) => makeResult({ lengthA: Number(module.lengthM), spanA: Number(module.projectionM) }));
  return {
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
      pergolas: input?.pergolas ?? [{ id: 'pergola-1', label: 'Pergola 1' }],
      modules,
    },
    outputs: {
      pergolas: [{ id: 'pergola-1', modules: results }],
    },
  };
}

function makeSavedEstimateSnapshotCase(input: {
  slug: string;
  purpose: string;
  projectName: string;
  quoteRef: string;
  modules: CalculatorModuleInputs[];
  pergolas?: Array<{ id: string; label: string }>;
  inputOverrides?: Partial<CalculatorInputs>;
  expectedModuleCount: number;
  expectedTrustStatuses: CommercialTrustStatusV1[];
  expectedModules: SavedEstimateSnapshotCase['expectedModules'];
}): SavedEstimateSnapshotCase {
  const inputs: CalculatorInputs = {
    schemaVersion: 'v2',
    projectName: input.projectName,
    quoteRef: input.quoteRef,
    access: 'normal',
    height: 'single_storey',
    jobType: 'residential',
    travelExGst: '18',
    extrasAllowanceExGst: '95',
    quoteDiscountPct: '4',
    pergolas: input.pergolas ?? [{ id: 'pergola-1', label: 'Pergola 1' }],
    modules: input.modules,
    blinds: { items: [] },
    ...input.inputOverrides,
  };
  const outputs = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(inputs));
  return {
    slug: input.slug,
    purpose: input.purpose,
    expectedModuleCount: input.expectedModuleCount,
    expectedTrustStatuses: input.expectedTrustStatuses,
    expectedModules: input.expectedModules,
    inputs,
    outputs,
    snapshot: {
      inputs,
      outputs,
    },
  };
}

function representativeSavedEstimateSnapshots(): SavedEstimateSnapshotCase[] {
  return [
    makeSavedEstimateSnapshotCase({
      slug: 'saved-mono-acrylic-commercial-options',
      purpose: 'Single mono acrylic snapshot with commercial options, powdercoat, flashings, and estimate-scoped blinds.',
      projectName: 'Saved Mono Acrylic',
      quoteRef: 'Q-SAVED-MONO',
      modules: [
        makeModule({
          pergolaStyle: 'pitched',
          roofMaterial: 'acrylic',
          extrusionColour: 'Black',
          lengthM: '6.2',
          projectionM: '3.4',
          roofPitchDeg: '7',
          postCount: '3',
          downpipeCount: '1',
          powdercoatStandardColour: 'Black',
          powdercoatIsCustom: true,
          powdercoatCustomColour: 'Monument',
          flashings: {
            rows: [
              { id: 'flash-primary', kind: 'primary', band: '201-300', lengthM: '6.2', purpose: 'CUSTOM' },
              { id: 'flash-extra', kind: 'extra', band: '301-400', lengthM: '1.1', purpose: 'CUSTOM' },
            ],
          },
          overrides: {
            ledgerProfile: '150x50',
            rafterProfile: '100x50',
            frontBeamProfile: '200x50',
          },
        }),
      ],
      expectedModuleCount: 1,
      expectedTrustStatuses: ['ready'],
      expectedModules: [
        {
          lengthM: 6.2,
          projectionM: 3.4,
          roofPlaneCount: 1,
        },
      ],
      inputOverrides: {
        blinds: {
          items: [
            {
              id: 'blind-1',
              label: 'Front blind',
              system: 'ZIPTRAK',
              widthMm: '2400',
              coverLengthMm: '2100',
              fabric: 'MESH',
              motorised: 'NONE',
            },
          ],
        },
      },
    }),
    makeSavedEstimateSnapshotCase({
      slug: 'saved-gable-mixed',
      purpose: 'Single gable mixed-roof snapshot that exercises two roof planes and mixed acrylic bay options.',
      projectName: 'Saved Gable Mixed',
      quoteRef: 'Q-SAVED-GABLE',
      modules: [
        makeModule({
          pergolaStyle: 'gable',
          roofMaterial: 'mixed',
          lengthM: '6.5',
          projectionM: '4',
          roofPitchDeg: '25',
          postCutHeightM: '2.7',
          gableEndFramesMode: 'outer_end_only',
          mixedAcrylicBaysMain: '2',
          mixedAcrylicBaysA: '1',
          mixedAcrylicBaysB: '1',
        }),
      ],
      expectedModuleCount: 1,
      expectedTrustStatuses: ['ready'],
      expectedModules: [
        {
          lengthM: 6.5,
          projectionM: 4,
          roofPlaneCount: 2,
        },
      ],
      inputOverrides: {
        travelExGst: '42',
        extrasAllowanceExGst: '180',
        quoteDiscountPct: '2.5',
      },
    }),
    makeSavedEstimateSnapshotCase({
      slug: 'saved-multi-module',
      purpose: 'Multi-module snapshot that keeps pergola grouping and mixed trust allowances explicit.',
      projectName: 'Saved Multi Module',
      quoteRef: 'Q-SAVED-MULTI',
      pergolas: [{ id: 'pergola-1', label: 'Main' }],
      modules: [
        makeModule({
          pergolaId: 'pergola-1',
          pergolaStyle: 'pitched',
          roofMaterial: 'acrylic',
          lengthM: '5.8',
          projectionM: '3',
          roofPitchDeg: '5',
        }),
        makeModule({
          pergolaId: 'pergola-1',
          pergolaStyle: 'pitched',
          roofMaterial: 'timber',
          lengthM: '4.2',
          projectionM: '2.8',
          roofPitchDeg: '3',
          boxPerimeterEnabled: true,
        }),
      ],
      expectedModuleCount: 2,
      expectedTrustStatuses: ['approximate', 'approximate'],
      expectedModules: [
        {
          lengthM: 5.8,
          projectionM: 3,
          roofPlaneCount: 1,
        },
        {
          lengthM: 4.2,
          projectionM: 2.8,
          roofPlaneCount: 1,
        },
      ],
      inputOverrides: {
        access: 'hard',
        height: 'two_storey',
        jobType: 'commercial',
      },
    }),
    makeSavedEstimateSnapshotCase({
      slug: 'saved-box-perimeter-timber',
      purpose: 'Single box-perimeter timber snapshot for box support and takeoff mapping parity.',
      projectName: 'Saved Box Timber',
      quoteRef: 'Q-SAVED-BOX',
      modules: [
        makeModule({
          pergolaStyle: 'pitched',
          boxPerimeterEnabled: true,
          internalRoofType: 'pitched',
          roofMaterial: 'timber',
          lengthM: '5.5',
          projectionM: '3.5',
          roofPitchDeg: '3',
          fallDistanceMm: '40',
          postCount: '3',
          downpipeCount: '1',
          overrides: {
            boxPerimeterBeamProfile: '300x50',
            rafterProfile: '80x50',
          },
        }),
      ],
      expectedModuleCount: 1,
      expectedTrustStatuses: ['ready'],
      expectedModules: [
        {
          lengthM: 5.5,
          projectionM: 3.5,
          roofPlaneCount: 1,
        },
      ],
    }),
    makeSavedEstimateSnapshotCase({
      slug: 'saved-hip-corner-secondary-dimensions',
      purpose: 'Single hip-corner snapshot for secondary authored dimensions and multi-plane takeoff parity.',
      projectName: 'Saved Hip Corner',
      quoteRef: 'Q-SAVED-HIP-CORNER',
      modules: [
        makeModule({
          pergolaStyle: 'hip_corner',
          roofMaterial: 'timber',
          lengthM: '6',
          projectionM: '3',
          hipCornerLengthBM: '4',
          hipCornerProjectionBM: '2',
          roofPitchDeg: '5',
          postCount: '3',
          downpipeCount: '1',
        }),
      ],
      expectedModuleCount: 1,
      expectedTrustStatuses: ['ready'],
      expectedModules: [
        {
          lengthM: 6,
          projectionM: 3,
          secondaryLengthM: 4,
          secondaryProjectionM: 2,
          roofPlaneCount: 2,
        },
      ],
    }),
  ];
}

function makeSolvedModel(snapshot = makeSnapshot()): WorkbenchSolvedModel {
  return buildWorkbenchSolvedModel({
    snapshot,
    geometryIdentity: {
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designRequestId: 'request-1',
    },
  });
}

function requireModule(model: WorkbenchSolvedModel, index = 0): WorkbenchSolvedModule {
  const module = model.modules[index];
  if (!module) throw new Error(`Missing solved module ${index}.`);
  return module;
}

function cloneFixtureSnapshot(snapshot: Record<string, unknown>): SnapshotWithCalculatorInputs {
  const cloned = structuredClone(snapshot) as Partial<SnapshotWithCalculatorInputs>;
  if (!cloned.inputs?.modules?.length) {
    throw new Error('Fixture snapshot is missing calculator inputs.');
  }
  if (!cloned.outputs?.pergolas?.length) {
    throw new Error('Fixture snapshot is missing calculator outputs.');
  }
  return cloned as SnapshotWithCalculatorInputs;
}

function requireCommercialModule(input: { pergolas: Array<{ modules: CommercialModuleInputV1[] }> }): CommercialModuleInputV1 {
  const module = input.pergolas[0]?.modules[0];
  if (!module) throw new Error('Expected comparable commercial module.');
  return module;
}

function expectCloseOrEqual(left: number | null | undefined, right: number | null | undefined, label: string): void {
  expect(left, `${label} left`).not.toBeNull();
  expect(right, `${label} right`).not.toBeNull();
  expect(left ?? Number.NaN, label).toBeCloseTo(right ?? Number.NaN, 3);
}

function expectFiniteNumber(value: number | null | undefined, label: string): number {
  expect(typeof value, label).toBe('number');
  expect(Number.isFinite(value), label).toBe(true);
  return value as number;
}

function expectPositiveNumber(value: number | null | undefined, label: string): number {
  const number = expectFiniteNumber(value, label);
  expect(number, label).toBeGreaterThan(0);
  return number;
}

describe('workbench commercialDesignPayload', () => {
  it('builds a workbench-solved commercial payload with explicit site commercial fields and identity', () => {
    const solvedModel = makeSolvedModel();
    const commercial = buildCommercialDesignInputFromWorkbenchSolvedModel({
      solvedModel,
      siteCommercial: SITE_COMMERCIAL,
    });

    expect(commercial.schemaVersion).toBe('commercial_design_v1');
    expect(commercial.source).toBe('workbench_solved');
    expect(commercial.identity).toEqual({
      projectId: 'project-1',
      estimateId: 'estimate-1',
      designRequestId: 'request-1',
    });
    expect(commercial.siteCommercial).toEqual(SITE_COMMERCIAL);
    expect(commercial.trustStatus).toBe('ready');
    expect(commercial.pergolas).toHaveLength(1);
    expect(commercial.pergolas[0]?.trustStatus).toBe('ready');
  });

  it('fills stable geometry and quantity buckets from assembly dimensions, members, and quantity hooks', () => {
    const solvedModel = makeSolvedModel();
    const commercial = buildCommercialDesignInputFromWorkbenchSolvedModel({
      solvedModel,
      siteCommercial: SITE_COMMERCIAL,
    });
    const module = commercial.pergolas[0]?.modules[0];
    const geometryTakeoff = requireModule(solvedModel).geometryArtifact?.quantityTakeoff;
    const geometryPlane = geometryTakeoff?.roofPlanes.items[0];

    expect(module?.trustStatus).toBe('ready');
    expect(module?.designIntent).toMatchObject({
      pergolaStyle: 'pitched',
      roofMaterial: 'acrylic',
      roofType: 'pitched',
      dimensions: { lengthM: 6, projectionM: 3 },
    });
    expect(module?.solvedGeometry.primaryDimensionsM).toEqual({ length: 6, projection: 3 });
    expect(module?.solvedGeometry.roofPlaneCount).toBe(1);
    expect(module?.quantityTakeoff.primaryDimensions?.roofAreaM2 ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.roofPlanes).toHaveLength(1);
    expectPositiveNumber(module?.quantityTakeoff.roofPlanes?.[0]?.areaM2, 'mono roof plane area');
    expectPositiveNumber(module?.quantityTakeoff.roofPlanes?.[0]?.rafterLengthM, 'mono roof plane rafter length');
    expectFiniteNumber(module?.quantityTakeoff.roofPlanes?.[0]?.bayCount, 'mono roof plane bay count');
    expect(module?.quantityTakeoff.roofPlanes?.[0]).toMatchObject({
      rafterProjectedRunM: geometryPlane?.rafterProjectedRunM,
      rafterCutLengthM: geometryPlane?.rafterCutLengthM,
      rafterCount: geometryPlane?.rafterCount,
      rafterSpacingMm: geometryPlane?.rafterAverageSpacingMm,
      rafterTotalLengthM: geometryPlane?.rafterTotalLengthM,
      claddingAreaM2: geometryPlane?.claddingAreaM2,
      claddingDownslopeLengthM: geometryPlane?.claddingDownslopeLengthM,
      claddingPanelCount: geometryPlane?.claddingPanelCount,
      joinerCount: geometryPlane?.joinerCount,
      joinerTargetLengthM: geometryPlane?.joinerTargetLengthM,
      joinerTotalLengthM: geometryPlane?.joinerTotalLengthM,
    });
    expect(module?.quantityTakeoff.posts?.count).toBe(2);
    expect(module?.quantityTakeoff.rafters?.count ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.rafters?.bayCount).toBe(geometryPlane?.rafterBayCount);
    expect(module?.quantityTakeoff.rafters?.spacingMm).toBe(geometryPlane?.rafterAverageSpacingMm);
    expect(module?.quantityTakeoff.rafters?.effectiveRunM).toBe(geometryTakeoff?.rafters.effectiveRunM);
    expect(module?.quantityTakeoff.rafters?.projectedRunM).toBe(geometryTakeoff?.rafters.averageProjectedRunM);
    expect(module?.quantityTakeoff.rafters?.totalLengthM).toBe(geometryTakeoff?.members.byRole.rafter.totalLengthM);
    expect(module?.quantityTakeoff.beams?.ledgerLengthM).toBe(6);
    expect(module?.quantityTakeoff.beams?.totalBeamLengthM).toBe(geometryTakeoff?.beams.totalBeamLengthM);
    expect(module?.quantityTakeoff.gutters?.ourGutterLengthM ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.gutters?.totalLengthM).toBe(geometryTakeoff?.gutters.totalLengthM);
    expect(module?.quantityTakeoff.gutters?.downpipeCount).toBe(2);
    expectFiniteNumber(module?.quantityTakeoff.roofCladding?.joinerRuns, 'mono joiner runs');
    expect(module?.quantityTakeoff.roofCladding?.panelCount).toBe(geometryTakeoff?.roofCladding.panelCount);
    expect(module?.quantityTakeoff.roofCladding?.effectiveRunM).toBe(geometryTakeoff?.roofCladding.effectiveRunM);
    expect(module?.quantityTakeoff.roofCladding?.acrylicRequiredDownslopeM).toBe(
      geometryTakeoff?.roofCladding.acrylicRequiredDownslopeM,
    );
    expect(module?.quantityTakeoff.roofCladding?.averageDownslopeLengthM).toBe(
      geometryTakeoff?.roofCladding.averageDownslopeLengthM,
    );
    expect(module?.quantityTakeoff.roofCladding?.totalAreaM2).toBe(geometryTakeoff?.roofCladding.totalAreaM2);
    expect(module?.quantityTakeoff.joiners).toMatchObject({
      count: geometryTakeoff?.joiners.count,
      totalLengthM: geometryTakeoff?.joiners.totalLengthM,
      averageLengthM: geometryTakeoff?.joiners.averageLengthM,
    });
    expect(module?.quantityTakeoff.flashings).toMatchObject({
      totalLengthM: geometryTakeoff?.flashings.totalLengthM,
      count: geometryTakeoff?.flashings.count,
      surfaceAreaM2: geometryTakeoff?.flashings.totalSurfaceAreaM2,
    });
    expect(module?.options.flashings).toEqual(makeModule().flashings);
    expect(module?.options.overrides).toEqual({ ledgerProfile: '150x50', rafterProfile: '100x50' });
  });

  it('keeps blocked invalid geometry modules in the payload with diagnostics', () => {
    const solvedModel = makeSolvedModel();
    const ready = requireModule(solvedModel);
    const invalidModule: WorkbenchSolvedModule = {
      ...ready,
      trust: {
        status: 'invalid_geometry',
        issues: [],
        renderSource: 'legacy',
        message: 'Geometry solve failed.',
      },
      assembly: null,
    };

    const module = buildCommercialModuleInputFromWorkbenchSolvedModule({ module: invalidModule });

    expect(module.trustStatus).toBe('blocked');
    expect(module.solvedGeometry.status).toBe('blocked');
    expect(module.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'workbench_invalid_geometry',
        severity: 'blocking',
      }),
    );
  });

  it('includes unsupported legacy modules instead of dropping them', () => {
    const solvedModel = makeSolvedModel();
    const ready = requireModule(solvedModel);
    const unsupportedModule: WorkbenchSolvedModule = {
      ...ready,
      trust: {
        status: 'legacy_unsupported_family',
        issues: ['legacy_fallback'],
        renderSource: 'legacy',
        message: 'Unsupported family.',
      },
      assembly: null,
    };

    const commercial = buildCommercialDesignInputFromWorkbenchSolvedModel({
      solvedModel: { ...solvedModel, modules: [unsupportedModule], activeModule: unsupportedModule },
      siteCommercial: SITE_COMMERCIAL,
    });

    expect(commercial.trustStatus).toBe('blocked');
    expect(commercial.pergolas[0]?.modules[0]?.trustStatus).toBe('unsupported');
    expect(commercial.pergolas[0]?.modules[0]?.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'workbench_legacy_unsupported_family',
        severity: 'warning',
      }),
    );
  });

  it('groups multiple solved modules by module pergolaId and project pergola labels', () => {
    const snapshot = makeSnapshot({
      pergolas: [
        { id: 'pergola-1', label: 'Main' },
        { id: 'pergola-2', label: 'Pool' },
      ],
      modules: [
        makeModule({ pergolaId: 'pergola-2', lengthM: '4.5', projectionM: '2.5' }),
        makeModule({ pergolaId: 'pergola-1', lengthM: '6', projectionM: '3' }),
      ],
      results: [makeResult({ lengthA: 4.5, spanA: 2.5 }), makeResult({ lengthA: 6, spanA: 3 })],
    });
    const solvedModel = makeSolvedModel(snapshot);

    const commercial = buildCommercialDesignInputFromWorkbenchSolvedModel({
      solvedModel,
      siteCommercial: SITE_COMMERCIAL,
    });

    expect(commercial.pergolas.map((pergola) => ({ id: pergola.id, label: pergola.label }))).toEqual([
      { id: 'pergola-2', label: 'Pool' },
      { id: 'pergola-1', label: 'Main' },
    ]);
    expect(commercial.pergolas[0]?.modules.map((module) => module.sourceModuleIndex)).toEqual([0]);
    expect(commercial.pergolas[1]?.modules.map((module) => module.sourceModuleIndex)).toEqual([1]);
  });

  it('keeps baked fixture commercial parity comparable for geometry-first QA gates', () => {
    for (const fixture of listParityCriticalSanctuaryGeometryWorkbenchFixtures()) {
      const expected = fixture.qa.expectedModule;
      const snapshot = cloneFixtureSnapshot(fixture.snapshot);
      const calculatorCommercial = buildCommercialDesignInputFromCalculatorInputs({
        inputs: snapshot.inputs,
        siteResult: snapshot.outputs,
        identity: {
          projectId: 'fixture-roof',
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
        },
      });
      const solvedModel = buildWorkbenchSolvedModel({
        snapshot,
        draft: fixture.draft,
        moduleLabels: fixture.moduleLabels,
        geometryIdentity: {
          projectId: 'fixture-roof',
          estimateId: fixture.estimate.id,
          designRequestId: fixture.request.id,
        },
      });
      const workbenchCommercial = buildCommercialDesignInputFromWorkbenchSolvedModel({
        solvedModel,
        siteCommercial: calculatorCommercial.siteCommercial,
      });
      const solvedModule = requireModule(solvedModel);

      const report = compareCommercialDesignInputsV1(calculatorCommercial, workbenchCommercial, {
        labelLeft: `${fixture.slug}:calculator_compat`,
        labelRight: `${fixture.slug}:workbench_solved`,
      });

      expect(report.counts.pergolasCompared, fixture.slug).toBeGreaterThan(0);
      expect(report.counts.modulesCompared, fixture.slug).toBeGreaterThan(0);
      expect(report.counts.blockingDifferences, `${fixture.slug} blocking differences`).toBe(0);
      expect(report.differences.filter((difference) => difference.category === 'structure'), fixture.slug).toEqual([]);

      const calculatorModule = requireCommercialModule(calculatorCommercial);
      const workbenchModule = requireCommercialModule(workbenchCommercial);
      expect(workbenchModule.trustStatus, fixture.slug).toBe('ready');
      expect(workbenchModule.designIntent).toMatchObject({
        pergolaStyle: calculatorModule.designIntent.pergolaStyle,
        roofMaterial: expected.roofMaterial,
        roofType: expected.roofType,
        attachmentSide: expected.attachmentSide,
        roofPitchDeg: expected.roofPitchDeg,
      });
      expectCloseOrEqual(
        workbenchModule.designIntent.dimensions?.lengthM,
        expected.lengthM,
        `${fixture.slug} authored length`,
      );
      expectCloseOrEqual(
        workbenchModule.designIntent.dimensions?.projectionM,
        expected.projectionM,
        `${fixture.slug} authored projection`,
      );
      expect(workbenchModule.solvedGeometry.roofPlaneCount, `${fixture.slug} roof planes`).toBe(expected.roofPlaneCount);
      expectCloseOrEqual(
        workbenchModule.quantityTakeoff.primaryDimensions?.lengthM,
        expected.lengthM,
        `${fixture.slug} takeoff length`,
      );
      expectCloseOrEqual(
        workbenchModule.quantityTakeoff.primaryDimensions?.projectionM,
        expected.projectionM,
        `${fixture.slug} takeoff projection`,
      );
      expectPositiveNumber(
        workbenchModule.quantityTakeoff.primaryDimensions?.roofAreaM2,
        `${fixture.slug} takeoff roof area`,
      );
      expect(workbenchModule.quantityTakeoff.roofPlanes, `${fixture.slug} roof plane rows`).toHaveLength(expected.roofPlaneCount);
      expectPositiveNumber(workbenchModule.quantityTakeoff.posts?.count, `${fixture.slug} post count`);
      expectPositiveNumber(workbenchModule.quantityTakeoff.rafters?.count, `${fixture.slug} rafter count`);
      expectPositiveNumber(workbenchModule.quantityTakeoff.beams?.ledgerLengthM, `${fixture.slug} ledger length`);
      expectPositiveNumber(workbenchModule.quantityTakeoff.beams?.frontBeamLengthM, `${fixture.slug} front beam length`);
      expectPositiveNumber(workbenchModule.quantityTakeoff.gutters?.ourGutterLengthM, `${fixture.slug} gutter length`);
      expectFiniteNumber(workbenchModule.quantityTakeoff.roofCladding?.joinerRuns, `${fixture.slug} joiner runs`);
      for (const [index, plane] of (workbenchModule.quantityTakeoff.roofPlanes ?? []).entries()) {
        expectPositiveNumber(plane.areaM2, `${fixture.slug} roof plane ${index + 1} area`);
        const geometryPlane = solvedModule.geometryArtifact?.quantityTakeoff.roofPlanes.items[index];
        expect(plane.rafterProjectedRunM, `${fixture.slug} roof plane ${index + 1} rafter projected run`).toBe(
          geometryPlane?.rafterProjectedRunM,
        );
        expect(plane.rafterCutLengthM, `${fixture.slug} roof plane ${index + 1} rafter cut length`).toBe(
          geometryPlane?.rafterCutLengthM,
        );
        expect(plane.rafterCount, `${fixture.slug} roof plane ${index + 1} rafter count`).toBe(geometryPlane?.rafterCount);
        expect(plane.rafterSpacingMm, `${fixture.slug} roof plane ${index + 1} rafter spacing`).toBe(
          geometryPlane?.rafterAverageSpacingMm,
        );
        expect(plane.rafterTotalLengthM, `${fixture.slug} roof plane ${index + 1} rafter total length`).toBe(
          geometryPlane?.rafterTotalLengthM,
        );
        expect(plane.claddingAreaM2, `${fixture.slug} roof plane ${index + 1} cladding area`).toBe(geometryPlane?.claddingAreaM2);
        expect(plane.claddingDownslopeLengthM, `${fixture.slug} roof plane ${index + 1} cladding downslope`).toBe(
          geometryPlane?.claddingDownslopeLengthM,
        );
        expect(plane.claddingPanelCount, `${fixture.slug} roof plane ${index + 1} cladding panels`).toBe(
          geometryPlane?.claddingPanelCount,
        );
        expect(plane.joinerCount, `${fixture.slug} roof plane ${index + 1} joiner count`).toBe(geometryPlane?.joinerCount);
        expect(plane.joinerTargetLengthM, `${fixture.slug} roof plane ${index + 1} joiner target length`).toBe(
          geometryPlane?.joinerTargetLengthM,
        );
        expect(plane.joinerTotalLengthM, `${fixture.slug} roof plane ${index + 1} joiner total length`).toBe(
          geometryPlane?.joinerTotalLengthM,
        );
        if ((geometryPlane?.rafterCount ?? 0) > 0) {
          expectPositiveNumber(plane.rafterLengthM, `${fixture.slug} roof plane ${index + 1} rafter length`);
          expectFiniteNumber(plane.bayCount, `${fixture.slug} roof plane ${index + 1} bay count`);
        }
      }
      expect(workbenchModule.quantityTakeoff.roofCladding?.panelCount, `${fixture.slug} cladding panel count`).toBe(
        solvedModule.geometryArtifact?.quantityTakeoff.roofCladding.panelCount,
      );
      expect(workbenchModule.quantityTakeoff.roofCladding?.effectiveRunM, `${fixture.slug} cladding effective run`).toBe(
        solvedModule.geometryArtifact?.quantityTakeoff.roofCladding.effectiveRunM,
      );
      expect(
        workbenchModule.quantityTakeoff.roofCladding?.acrylicRequiredDownslopeM,
        `${fixture.slug} acrylic required downslope`,
      ).toBe(solvedModule.geometryArtifact?.quantityTakeoff.roofCladding.acrylicRequiredDownslopeM);
      expect(workbenchModule.quantityTakeoff.roofCladding?.totalAreaM2, `${fixture.slug} cladding total area`).toBe(
        solvedModule.geometryArtifact?.quantityTakeoff.roofCladding.totalAreaM2,
      );
      expect(workbenchModule.quantityTakeoff.joiners?.count, `${fixture.slug} joiner count`).toBe(
        solvedModule.geometryArtifact?.quantityTakeoff.joiners.count,
      );
      expect(workbenchModule.quantityTakeoff.flashings?.count, `${fixture.slug} physical flashing count`).toBe(
        solvedModule.geometryArtifact?.quantityTakeoff.flashings.count,
      );
    }
  });

  it('keeps representative saved estimate snapshots commercially comparable in shadow mode', () => {
    for (const saved of representativeSavedEstimateSnapshots()) {
      const identity = {
        projectId: `project-${saved.slug}`,
        estimateId: `estimate-${saved.slug}`,
        designRequestId: `request-${saved.slug}`,
      };
      const calculatorCommercial = buildCommercialDesignInputFromCalculatorInputs({
        inputs: saved.inputs,
        siteResult: saved.outputs,
        identity,
      });
      const solvedModel = buildWorkbenchSolvedModel({
        snapshot: saved.snapshot,
        geometryIdentity: identity,
      });
      const workbenchCommercial = buildCommercialDesignInputFromWorkbenchSolvedModel({
        solvedModel,
        siteCommercial: calculatorCommercial.siteCommercial,
      });

      const report = compareCommercialDesignInputsV1(calculatorCommercial, workbenchCommercial, {
        labelLeft: `${saved.slug}:calculator_compat`,
        labelRight: `${saved.slug}:workbench_solved`,
      });

      const warningDifferences = report.differences.filter((difference) => difference.severity === 'warning');
      expect(saved.purpose.trim().length, `${saved.slug} purpose`).toBeGreaterThan(0);
      expect(saved.expectedModuleCount, `${saved.slug} explicit expected module count`).toBe(saved.inputs.modules.length);
      expect(report.counts.pergolasCompared, saved.slug).toBe(calculatorCommercial.pergolas.length);
      expect(report.counts.modulesCompared, saved.slug).toBe(saved.expectedModuleCount);
      expect(report.counts.blockingDifferences, `${saved.slug} blocking differences`).toBe(0);
      expect(report.differences.filter((difference) => difference.category === 'structure'), saved.slug).toEqual([]);
      const workbenchModules = workbenchCommercial.pergolas
        .flatMap((pergola) => pergola.modules)
        .sort((left, right) => (left.sourceModuleIndex ?? 0) - (right.sourceModuleIndex ?? 0));
      const solvedModules = [...solvedModel.modules].sort((left, right) => left.index - right.index);
      expect(workbenchModules.map((module) => module.trustStatus), `${saved.slug} trust allowance`).toEqual(
        saved.expectedTrustStatuses,
      );
      expect(workbenchModules, `${saved.slug} module count`).toHaveLength(saved.expectedModuleCount);
      for (const [index, expected] of saved.expectedModules.entries()) {
        const module = workbenchModules[index];
        const solvedModule = solvedModules[index];
        const geometryTakeoff = solvedModule?.geometryArtifact?.quantityTakeoff;
        expect(module, `${saved.slug} expected module ${index + 1}`).toBeDefined();
        expectCloseOrEqual(module?.designIntent.dimensions?.lengthM, expected.lengthM, `${saved.slug} module ${index + 1} authored length`);
        expectCloseOrEqual(
          module?.designIntent.dimensions?.projectionM,
          expected.projectionM,
          `${saved.slug} module ${index + 1} authored projection`,
        );
        if (expected.secondaryLengthM != null || expected.secondaryProjectionM != null) {
          expectCloseOrEqual(
            module?.designIntent.dimensions?.secondaryLengthM,
            expected.secondaryLengthM,
            `${saved.slug} module ${index + 1} authored secondary length`,
          );
          expectCloseOrEqual(
            module?.designIntent.dimensions?.secondaryProjectionM,
            expected.secondaryProjectionM,
            `${saved.slug} module ${index + 1} authored secondary projection`,
          );
        }
        expect(module?.solvedGeometry.roofPlaneCount, `${saved.slug} module ${index + 1} roof planes`).toBe(
          expected.roofPlaneCount,
        );
        expectCloseOrEqual(
          module?.quantityTakeoff.primaryDimensions?.lengthM,
          expected.lengthM,
          `${saved.slug} module ${index + 1} takeoff length`,
        );
        expectCloseOrEqual(
          module?.quantityTakeoff.primaryDimensions?.projectionM,
          expected.projectionM,
          `${saved.slug} module ${index + 1} takeoff projection`,
        );
        expectPositiveNumber(module?.quantityTakeoff.primaryDimensions?.roofAreaM2, `${saved.slug} module ${index + 1} roof area`);
        expect(module?.quantityTakeoff.roofPlanes, `${saved.slug} module ${index + 1} roof plane rows`).toHaveLength(
          expected.roofPlaneCount,
        );
        for (const [planeIndex, plane] of (module?.quantityTakeoff.roofPlanes ?? []).entries()) {
          const geometryPlane = geometryTakeoff?.roofPlanes.items[planeIndex];
          expect(
            plane.rafterProjectedRunM,
            `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} rafter projected run`,
          ).toBe(geometryPlane?.rafterProjectedRunM);
          expect(plane.rafterCutLengthM, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} rafter cut length`).toBe(
            geometryPlane?.rafterCutLengthM,
          );
          expectPositiveNumber(plane.areaM2, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} area`);
          expect(plane.rafterCount, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} rafter count`).toBe(
            geometryPlane?.rafterCount,
          );
          expect(plane.rafterSpacingMm, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} rafter spacing`).toBe(
            geometryPlane?.rafterAverageSpacingMm,
          );
          expect(plane.claddingPanelCount, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} cladding panels`).toBe(
            geometryPlane?.claddingPanelCount,
          );
          expect(
            plane.claddingDownslopeLengthM,
            `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} cladding downslope`,
          ).toBe(geometryPlane?.claddingDownslopeLengthM);
          expect(plane.joinerCount, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} joiner count`).toBe(
            geometryPlane?.joinerCount,
          );
          expect(plane.joinerTargetLengthM, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} joiner target`).toBe(
            geometryPlane?.joinerTargetLengthM,
          );
          expectPositiveNumber(
            plane.rafterLengthM,
            `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} rafter length`,
          );
          expectFiniteNumber(plane.bayCount, `${saved.slug} module ${index + 1} roof plane ${planeIndex + 1} bay count`);
        }
        expect(module?.quantityTakeoff.rafters?.totalLengthM, `${saved.slug} module ${index + 1} rafter total`).toBe(
          geometryTakeoff?.members.byRole.rafter.totalLengthM,
        );
        expect(module?.quantityTakeoff.rafters?.effectiveRunM, `${saved.slug} module ${index + 1} rafter effective run`).toBe(
          geometryTakeoff?.rafters.effectiveRunM,
        );
        expect(module?.quantityTakeoff.roofCladding?.panelCount, `${saved.slug} module ${index + 1} cladding panels`).toBe(
          geometryTakeoff?.roofCladding.panelCount,
        );
        expect(
          module?.quantityTakeoff.roofCladding?.acrylicRequiredDownslopeM,
          `${saved.slug} module ${index + 1} acrylic required downslope`,
        ).toBe(geometryTakeoff?.roofCladding.acrylicRequiredDownslopeM);
        expect(module?.quantityTakeoff.joiners?.count, `${saved.slug} module ${index + 1} joiner count`).toBe(
          geometryTakeoff?.joiners.count,
        );
        expect(module?.quantityTakeoff.flashings?.count, `${saved.slug} module ${index + 1} flashing count`).toBe(
          geometryTakeoff?.flashings.count,
        );
      }
      expect(report.differences.every((difference) => DRIFT_ORIGINS.has(difference.driftOrigin)), saved.slug).toBe(true);
      expect(
        report.differences.every((difference) => difference.originDetail.origin === difference.driftOrigin),
        saved.slug,
      ).toBe(true);
      expect(
        warningDifferences.every((difference) => typeof report.summary?.byDriftOrigin[difference.driftOrigin] === 'number'),
        saved.slug,
      ).toBe(true);
    }
  });
});
