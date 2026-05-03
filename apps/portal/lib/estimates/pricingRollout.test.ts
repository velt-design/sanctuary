import { describe, expect, it } from 'vitest';
import {
  ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
  ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
  evaluateWorkbenchSolvedPricingReadiness,
  type EstimateLivePricingSource,
  type EstimateQuantityTakeoffReadinessSource,
  type EstimateWorkbenchSolvedReadinessGate,
  type EstimateWorkbenchSolvedReadinessGateCode,
  type EstimateWorkbenchSolvedReadinessInput,
  type EstimateWorkbenchSolvedReadinessReport,
} from './pricingRollout';
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
