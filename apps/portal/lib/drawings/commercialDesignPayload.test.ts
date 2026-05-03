import { describe, expect, it } from 'vitest';
import {
  compareCommercialDesignInputsV1,
  type CommercialModuleInputV1,
  type CostOutputV1,
  type SiteOutputV1,
} from '@sp/costing';
import { listSanctuaryGeometryWorkbenchFixtures } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildCommercialDesignInputFromCalculatorInputs } from '@/lib/estimates/commercialDesignPayload';
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

const PARITY_CRITICAL_FIXTURE_SLUGS = [
  'mono-standard',
  'gable-standard',
  'box-standard',
  'gable-u-hipped-screenshot',
  'mono-join-screenshot',
] as const;

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
    expect(module?.quantityTakeoff.posts?.count).toBe(2);
    expect(module?.quantityTakeoff.rafters?.count ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.beams?.ledgerLengthM).toBe(6);
    expect(module?.quantityTakeoff.gutters?.ourGutterLengthM ?? 0).toBeGreaterThan(0);
    expect(module?.quantityTakeoff.gutters?.downpipeCount).toBe(2);
    expect(module?.quantityTakeoff.flashings?.totalLengthM).toBe(1.5);
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
    const fixtureBySlug = new Map(listSanctuaryGeometryWorkbenchFixtures().map((fixture) => [fixture.slug, fixture]));

    for (const slug of PARITY_CRITICAL_FIXTURE_SLUGS) {
      const fixture = fixtureBySlug.get(slug);
      if (!fixture) throw new Error(`Missing parity-critical workbench fixture: ${slug}.`);
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
        roofMaterial: calculatorModule.designIntent.roofMaterial,
        roofType: calculatorModule.designIntent.roofType,
        attachmentSide: calculatorModule.designIntent.attachmentSide,
        roofPitchDeg: calculatorModule.designIntent.roofPitchDeg,
      });
      expectCloseOrEqual(
        workbenchModule.designIntent.dimensions.lengthM,
        calculatorModule.designIntent.dimensions.lengthM,
        `${fixture.slug} authored length`,
      );
      expectCloseOrEqual(
        workbenchModule.designIntent.dimensions.projectionM,
        calculatorModule.designIntent.dimensions.projectionM,
        `${fixture.slug} authored projection`,
      );
      expect(workbenchModule.solvedGeometry.roofPlaneCount, `${fixture.slug} roof planes`).toBe(
        calculatorModule.solvedGeometry.roofPlaneCount,
      );
      expectCloseOrEqual(
        workbenchModule.quantityTakeoff.primaryDimensions?.lengthM,
        calculatorModule.quantityTakeoff.primaryDimensions?.lengthM,
        `${fixture.slug} takeoff length`,
      );
      expectCloseOrEqual(
        workbenchModule.quantityTakeoff.primaryDimensions?.projectionM,
        calculatorModule.quantityTakeoff.primaryDimensions?.projectionM,
        `${fixture.slug} takeoff projection`,
      );
    }
  });
});
