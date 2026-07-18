import { describe, expect, it } from 'vitest';
import {
  ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
  ESTIMATE_PRICING_SOURCE_BLOCKED_CODE,
  ESTIMATE_PRICING_SOURCE_GATE_VERSION,
  ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
  buildEstimateWorkbenchSolvedReadinessFromSnapshot,
  evaluateWorkbenchSolvedPricingReadiness,
  normalizeRequestedEstimatePricingSource,
  resolveEstimatePricingSourceForSave,
  type EstimateLivePricingSource,
  type EstimateQuantityTakeoffReadinessSource,
  type EstimateWorkbenchSolvedReadinessGate,
  type EstimateWorkbenchSolvedReadinessGateCode,
  type EstimateWorkbenchSolvedReadinessInput,
  type EstimateWorkbenchSolvedReadinessReport,
} from './pricingRollout';
import { buildEstimateDbPayload } from './persistence';
import type { CommercialDesignInputV1, CommercialModuleInputV1, CommercialParityReportV1 } from '@sp/costing';

function makeModule(overrides: Partial<CommercialModuleInputV1> = {}): CommercialModuleInputV1 {
  return {
    id: 'module-1',
    label: 'Module 1',
    sourceModuleIndex: 0,
    trustStatus: 'ready',
    designIntent: {
      pergolaStyle: 'pitched',
      roofMaterial: 'acrylic',
      extrusionColour: 'White',
      houseConnectionType: 'fascia',
      attachmentSide: 'rear',
      postConnectionType: 'slab_anchors',
    },
    solvedGeometry: {
      status: 'ready',
      geometrySource: 'workbench_solved',
      primaryDimensionsM: {
        length: 6,
        projection: 4,
      },
    },
    quantityTakeoff: {
      primaryDimensions: {
        lengthM: 6,
        projectionM: 4,
        roofAreaM2: 24,
      },
    },
    options: {},
    diagnostics: [],
    ...overrides,
  };
}

function makeCommercialInput(overrides: Partial<CommercialDesignInputV1> = {}): CommercialDesignInputV1 {
  return {
    schemaVersion: 'commercial_design_v1',
    source: 'workbench_solved',
    trustStatus: 'ready',
    identity: {
      projectId: 'project-1',
      estimateId: 'estimate-1',
    },
    pergolas: [
      {
        id: 'pergola-1',
        label: 'Pergola 1',
        trustStatus: 'ready',
        modules: [makeModule()],
        diagnostics: [],
      },
    ],
    siteCommercial: {
      jobType: 'residential',
      access: 'normal',
      height: 'single_storey',
      travelExGst: 0,
      extrasAllowanceExGst: 0,
      quoteDiscountPct: 0,
    },
    diagnostics: [],
    ...overrides,
  };
}

function makeParityReport(overrides: Partial<CommercialParityReportV1> = {}): CommercialParityReportV1 {
  return {
    status: 'match',
    left: {
      label: 'calculator',
      source: 'calculator_compat',
      trustStatus: 'ready',
    },
    right: {
      label: 'workbench',
      source: 'workbench_solved',
      trustStatus: 'ready',
    },
    counts: {
      pergolasCompared: 1,
      modulesCompared: 1,
      differences: 0,
      blockingDifferences: 0,
      warningDifferences: 0,
    },
    differences: [],
    diagnostics: [],
    summary: {
      byCategory: {},
      byDriftOrigin: {},
      bySeverity: {},
      byModule: {},
    },
    ...overrides,
  };
}

function makeReadinessInput(overrides: Partial<EstimateWorkbenchSolvedReadinessInput> = {}): EstimateWorkbenchSolvedReadinessInput {
  return {
    workbenchCommercialInput: makeCommercialInput(),
    quantityTakeoffSource: 'package_geometry',
    parityReports: [makeParityReport()],
    estimatePersistenceSourceRecorded: true,
    estimateLockBoundaryPreserved: true,
    localFirstBoundaryPreserved: true,
    downstreamPricingBoundaryPreserved: true,
    rollbackToCalculatorLiveConfirmed: true,
    ...overrides,
  };
}

describe('workbench solved pricing rollout readiness', () => {
  it('defaults unset or invalid requested source values to calculator_live', () => {
    expect(normalizeRequestedEstimatePricingSource(null)).toEqual({
      raw: null,
      requestedPricingSource: 'calculator_live',
      defaultedReason: 'unset',
    });
    expect(normalizeRequestedEstimatePricingSource('')).toEqual({
      raw: null,
      requestedPricingSource: 'calculator_live',
      defaultedReason: 'unset',
    });
    expect(normalizeRequestedEstimatePricingSource('workbench')).toEqual({
      raw: 'workbench',
      requestedPricingSource: 'calculator_live',
      defaultedReason: 'invalid',
    });
  });

  it('resolves unset, blank, and invalid save requests to calculator_live with no commercial payload', () => {
    const cases = [
      { raw: null, requestedSourceRaw: null, defaultedReason: 'unset' },
      { raw: null, requestedSourceRaw: '', defaultedReason: 'unset' },
      { raw: 'workbench', requestedSourceRaw: 'workbench', defaultedReason: 'invalid' },
    ] as const;

    for (const entry of cases) {
      const resolved = resolveEstimatePricingSourceForSave({
        actor: 'ops@example.com',
        selectedAt: '2026-05-04T00:00:00.000Z',
        requestedSourceRaw: entry.requestedSourceRaw,
      });

      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error('expected source to resolve');
      expect(resolved.context.pricingSource).toBe('calculator_live');
      expect(resolved.context.commercialDesignInput).toBeNull();
      expect(resolved.context.pricingSourceMetadata).toMatchObject({
        requestedSource: 'calculator_live',
        requestedSourceRaw: entry.raw,
        selectedSource: 'calculator_live',
        defaultedReason: entry.defaultedReason,
        commercialInputSchemaVersion: null,
        quantityTakeoffSource: null,
        trustSummary: null,
        blockingGateCodes: [],
      });

      const payload = buildEstimateDbPayload({
        status: 'draft',
        inputs: { schemaVersion: 'v2' },
        outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
        pricingSourceContext: resolved.context,
      });

      expect(payload.pricing_source).toBe('calculator_live');
      expect(payload.commercial_design_input).toBeNull();
      expect(payload.outputs).not.toHaveProperty('pricingSource');
      expect(payload.outputs).not.toHaveProperty('commercialDesignInput');
    }
  });

  it('builds compact calculator_live source metadata for estimate saves', () => {
    const resolved = resolveEstimatePricingSourceForSave({
      actor: 'ops@example.com',
      selectedAt: '2026-05-04T00:00:00.000Z',
      requestedSourceRaw: 'calculator_live',
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('expected source to resolve');
    expect(resolved.context.pricingSource).toBe('calculator_live');
    expect(resolved.context.commercialDesignInput).toBeNull();
    expect(resolved.context.pricingSourceMetadata).toMatchObject({
      gateVersion: ESTIMATE_PRICING_SOURCE_GATE_VERSION,
      requestedSource: 'calculator_live',
      selectedSource: 'calculator_live',
      selectedBy: 'ops@example.com',
      rollbackProvenance: 'explicit_calculator_live',
      commercialInputSchemaVersion: null,
      commercialInputHash: null,
      parityReportHash: null,
      blockingGateCodes: [],
    });

    const payload = buildEstimateDbPayload({
      status: 'draft',
      inputs: { schemaVersion: 'v2' },
      outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
      pricingSourceContext: resolved.context,
    });

    expect(payload.pricing_source).toBe('calculator_live');
    expect(payload.pricing_source_metadata).toEqual(resolved.context.pricingSourceMetadata);
    expect(payload.commercial_design_input).toBeNull();
    expect(payload.outputs).not.toHaveProperty('pricingSource');
    expect(payload.outputs).not.toHaveProperty('commercialDesignInput');
  });

  it('blocks requested workbench_solved saves without returning a calculator fallback', () => {
    const resolved = resolveEstimatePricingSourceForSave({
      actor: 'ops@example.com',
      selectedAt: '2026-05-04T00:00:00.000Z',
      requestedSourceRaw: 'workbench_solved',
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) throw new Error('expected source to block');
    expect(resolved.code).toBe(ESTIMATE_PRICING_SOURCE_BLOCKED_CODE);
    expect(resolved.status).toBe(409);
    expect((resolved as any).context).toBeUndefined();
    expect(resolved.readinessReport.fallbackPricingSource).toBeNull();
    expect(resolved.readinessReport.blockingGateCodes).toEqual(
      expect.arrayContaining(['workbench_solved_ready', 'quantity_takeoff_owned', 'commercial_parity_stable']),
    );
    expect(resolved.metadata.selectedSource).toBe('workbench_solved');
  });

  it('persists commercial design input only for an eligible workbench_solved save context', () => {
    const readiness = makeReadinessInput();
    const resolved = resolveEstimatePricingSourceForSave({
      actor: 'ops@example.com',
      selectedAt: '2026-05-04T00:00:00.000Z',
      requestedSourceRaw: 'workbench_solved',
      readiness,
    });

    expect(resolved.ok).toBe(true);
    if (!resolved.ok) throw new Error('expected source to resolve');
    expect(resolved.context.pricingSource).toBe('workbench_solved');
    expect(resolved.context.commercialDesignInput).toBe(readiness.workbenchCommercialInput);

    const payload = buildEstimateDbPayload({
      status: 'draft',
      inputs: { schemaVersion: 'v2' },
      outputs: { totals: { cost_ex_gst: 0, cost_inc_gst: 0 } },
      pricingSourceContext: resolved.context,
    });

    expect(payload.pricing_source).toBe('workbench_solved');
    expect(payload.commercial_design_input).toBe(readiness.workbenchCommercialInput);
    expect(payload.outputs).not.toHaveProperty('pricingSource');
    expect(payload.outputs).not.toHaveProperty('commercialDesignInput');
  });

  it('keeps server-side snapshot readiness blocked after the workbench breakaway', () => {
    const readiness = buildEstimateWorkbenchSolvedReadinessFromSnapshot({
      snapshot: { inputs: { schemaVersion: 'v2' } },
      projectId: 'project-1',
      estimateId: 'estimate-1',
    });
    const report = evaluateWorkbenchSolvedPricingReadiness(readiness);

    expect(report.eligibleToEnable).toBe(false);
    expect(report.blockingGateCodes).toEqual([
      'workbench_solved_ready',
      'quantity_takeoff_owned',
      'commercial_parity_stable',
    ]);
    expect(readiness.quantityTakeoffSource).toBe('unknown');
    expect(readiness.workbenchCommercialInput).toBeNull();
    expect(readiness.parityReports).toEqual([]);

    const resolved = resolveEstimatePricingSourceForSave({
      actor: 'ops@example.com',
      selectedAt: '2026-05-04T00:00:00.000Z',
      requestedSourceRaw: 'workbench_solved',
      readiness,
    });

    expect(resolved.ok).toBe(false);
    if (resolved.ok) throw new Error('expected server-derived source to stay blocked');
    expect(resolved.code).toBe(ESTIMATE_PRICING_SOURCE_BLOCKED_CODE);
    expect(resolved.readinessReport.fallbackPricingSource).toBeNull();
    expect(resolved.metadata).toMatchObject({
      gateVersion: ESTIMATE_PRICING_SOURCE_GATE_VERSION,
      requestedSource: 'workbench_solved',
      selectedSource: 'workbench_solved',
      commercialInputSchemaVersion: null,
      quantityTakeoffSource: 'unknown',
      parityReportVersion: null,
      blockingGateCodes: [
        'workbench_solved_ready',
        'quantity_takeoff_owned',
        'commercial_parity_stable',
      ],
    });
  });

  it('keeps calculator live as the current pricing source', () => {
    const currentSource: EstimateLivePricingSource = ESTIMATE_CURRENT_LIVE_PRICING_SOURCE;
    const requestedSource: EstimateLivePricingSource = ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE;
    const report: EstimateWorkbenchSolvedReadinessReport = evaluateWorkbenchSolvedPricingReadiness(makeReadinessInput());

    expect(currentSource).toBe('calculator_live');
    expect(requestedSource).toBe('workbench_solved');
    expect(report.currentLivePricingSource).toBe(currentSource);
    expect(report.requestedPricingSource).toBe(requestedSource);
    expect(report.fallbackPricingSource).toBeNull();
  });

  it('allows future workbench_solved enablement only when every readiness gate passes', () => {
    const quantityTakeoffSource: EstimateQuantityTakeoffReadinessSource = 'package_geometry';
    const report = evaluateWorkbenchSolvedPricingReadiness(makeReadinessInput({ quantityTakeoffSource }));
    const firstGate: EstimateWorkbenchSolvedReadinessGate = report.gates[0]!;
    const firstGateCode: EstimateWorkbenchSolvedReadinessGateCode = firstGate.code;

    expect(report.eligibleToEnable).toBe(true);
    expect(report.blockingGateCodes).toEqual([]);
    expect(report.gates.every((gate) => gate.passed)).toBe(true);
    expect(firstGateCode).toBe('workbench_solved_ready');
  });

  it('blocks rollout when parity is blocked or not yet stable', () => {
    const report = evaluateWorkbenchSolvedPricingReadiness(
      makeReadinessInput({
        parityReports: [
          makeParityReport({
            status: 'blocked',
            counts: {
              pergolasCompared: 1,
              modulesCompared: 1,
              differences: 1,
              blockingDifferences: 1,
              warningDifferences: 0,
            },
          }),
        ],
      }),
    );

    expect(report.eligibleToEnable).toBe(false);
    expect(report.blockingGateCodes).toContain('commercial_parity_stable');
    expect(report.fallbackPricingSource).toBeNull();
  });

  it('blocks rollout when workbench diagnostics are blocking', () => {
    const report = evaluateWorkbenchSolvedPricingReadiness(
      makeReadinessInput({
        workbenchCommercialInput: makeCommercialInput({
          diagnostics: [
            {
              code: 'workbench_unresolved_host',
              message: 'Host edge is unresolved.',
              severity: 'blocking',
            },
          ],
        }),
      }),
    );

    expect(report.eligibleToEnable).toBe(false);
    expect(report.blockingGateCodes).toContain('workbench_solved_ready');
  });

  it('blocks rollout when rollback to calculator_live is not explicit', () => {
    const report = evaluateWorkbenchSolvedPricingReadiness(
      makeReadinessInput({
        rollbackToCalculatorLiveConfirmed: false,
      }),
    );

    expect(report.eligibleToEnable).toBe(false);
    expect(report.blockingGateCodes).toContain('rollback_to_calculator_live_confirmed');
    expect(report.gates.find((gate) => gate.code === 'rollback_to_calculator_live_confirmed')?.details).toContain(
      'not hidden fallback',
    );
  });

  it('reports every failed gate instead of selecting a fallback source', () => {
    const report = evaluateWorkbenchSolvedPricingReadiness(
      makeReadinessInput({
        workbenchCommercialInput: null,
        quantityTakeoffSource: 'app_local_shadow',
        parityReports: [],
        estimatePersistenceSourceRecorded: false,
        estimateLockBoundaryPreserved: false,
        localFirstBoundaryPreserved: false,
        downstreamPricingBoundaryPreserved: false,
        rollbackToCalculatorLiveConfirmed: false,
      }),
    );

    expect(report.eligibleToEnable).toBe(false);
    expect(report.fallbackPricingSource).toBeNull();
    expect(report.blockingGateCodes).toEqual([
      'workbench_solved_ready',
      'quantity_takeoff_owned',
      'commercial_parity_stable',
      'estimate_persistence_source_explicit',
      'estimate_lock_boundary_preserved',
      'local_first_boundary_preserved',
      'downstream_pricing_boundary_preserved',
      'rollback_to_calculator_live_confirmed',
    ]);
  });
});
