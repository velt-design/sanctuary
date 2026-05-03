import type { CommercialDesignInputV1, CommercialParityReportV1 } from '@sp/costing';

export type EstimateLivePricingSource = 'calculator_live' | 'workbench_solved';

export const ESTIMATE_CURRENT_LIVE_PRICING_SOURCE: EstimateLivePricingSource = 'calculator_live';
export const ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE: EstimateLivePricingSource = 'workbench_solved';

export type EstimateQuantityTakeoffReadinessSource =
  | 'package_geometry'
  | 'solved_geometry_spine'
  | 'app_local_shadow'
  | 'unknown';

export type EstimateWorkbenchSolvedReadinessGateCode =
  | 'workbench_solved_ready'
  | 'quantity_takeoff_owned'
  | 'commercial_parity_stable'
  | 'estimate_persistence_source_explicit'
  | 'estimate_lock_boundary_preserved'
  | 'local_first_boundary_preserved'
  | 'downstream_pricing_boundary_preserved'
  | 'rollback_to_calculator_live_confirmed';

export type EstimateWorkbenchSolvedReadinessGate = {
  code: EstimateWorkbenchSolvedReadinessGateCode;
  label: string;
  passed: boolean;
  details: string;
};

export type EstimateWorkbenchSolvedReadinessInput = {
  workbenchCommercialInput?: CommercialDesignInputV1 | null;
  quantityTakeoffSource: EstimateQuantityTakeoffReadinessSource;
  parityReports: CommercialParityReportV1[];
  estimatePersistenceSourceRecorded: boolean;
  estimateLockBoundaryPreserved: boolean;
  localFirstBoundaryPreserved: boolean;
  downstreamPricingBoundaryPreserved: boolean;
  rollbackToCalculatorLiveConfirmed: boolean;
};

export type EstimateWorkbenchSolvedReadinessReport = {
  currentLivePricingSource: typeof ESTIMATE_CURRENT_LIVE_PRICING_SOURCE;
  requestedPricingSource: typeof ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE;
  fallbackPricingSource: null;
  eligibleToEnable: boolean;
  gates: EstimateWorkbenchSolvedReadinessGate[];
  blockingGateCodes: EstimateWorkbenchSolvedReadinessGateCode[];
};

function gate(
  code: EstimateWorkbenchSolvedReadinessGateCode,
  label: string,
  passed: boolean,
  details: string,
): EstimateWorkbenchSolvedReadinessGate {
  return { code, label, passed, details };
}

function hasBlockingDiagnostics(input: CommercialDesignInputV1): boolean {
  const diagnostics = [
    ...input.diagnostics,
    ...input.pergolas.flatMap((pergola) => pergola.diagnostics),
    ...input.pergolas.flatMap((pergola) => pergola.modules.flatMap((module) => module.diagnostics)),
  ];
  return diagnostics.some((diagnostic) => diagnostic.severity === 'blocking');
}

function hasBlockedTrust(input: CommercialDesignInputV1): boolean {
  if (input.trustStatus !== 'ready') return true;
  return input.pergolas.some(
    (pergola) => pergola.trustStatus !== 'ready' || pergola.modules.some((module) => module.trustStatus !== 'ready'),
  );
}

function isOwnedQuantityTakeoffSource(source: EstimateQuantityTakeoffReadinessSource): boolean {
  return source === 'package_geometry' || source === 'solved_geometry_spine';
}

function allParityReportsStable(reports: CommercialParityReportV1[]): boolean {
  return reports.length > 0 && reports.every((report) => report.status === 'match');
}

export function evaluateWorkbenchSolvedPricingReadiness(
  input: EstimateWorkbenchSolvedReadinessInput,
): EstimateWorkbenchSolvedReadinessReport {
  const workbenchReady = Boolean(
    input.workbenchCommercialInput &&
      input.workbenchCommercialInput.source === ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE &&
      !hasBlockedTrust(input.workbenchCommercialInput) &&
      !hasBlockingDiagnostics(input.workbenchCommercialInput),
  );

  const gates: EstimateWorkbenchSolvedReadinessGate[] = [
    gate(
      'workbench_solved_ready',
      'Workbench solved commercial input is ready',
      workbenchReady,
      workbenchReady
        ? 'Workbench commercial input is source workbench_solved, has ready trust, and has no blocking diagnostics.'
        : 'Workbench commercial input must be source workbench_solved with ready trust and no blocking diagnostics.',
    ),
    gate(
      'quantity_takeoff_owned',
      'Quantity takeoff source is owned',
      isOwnedQuantityTakeoffSource(input.quantityTakeoffSource),
      isOwnedQuantityTakeoffSource(input.quantityTakeoffSource)
        ? 'Quantity takeoff is package-owned or explicitly derived from the solved geometry spine.'
        : 'Quantity takeoff must not rely on app-local shadow policy before live rollout.',
    ),
    gate(
      'commercial_parity_stable',
      'Commercial parity reports are stable',
      allParityReportsStable(input.parityReports),
      allParityReportsStable(input.parityReports)
        ? 'All supplied calculator_compat versus workbench_solved parity reports match.'
        : 'Representative parity reports must exist and all must match before live rollout.',
    ),
    gate(
      'estimate_persistence_source_explicit',
      'Estimate persistence source is explicit',
      input.estimatePersistenceSourceRecorded,
      input.estimatePersistenceSourceRecorded
        ? 'Saved estimate pricing source-of-record is explicit for the future switch.'
        : 'Saved estimate pricing source-of-record must be explicit before any saved price changes.',
    ),
    gate(
      'estimate_lock_boundary_preserved',
      'Estimate lock boundary is preserved',
      input.estimateLockBoundaryPreserved,
      input.estimateLockBoundaryPreserved
        ? 'Locked estimate snapshot updates remain blocked.'
        : 'Estimate locks must continue to block snapshot updates.',
    ),
    gate(
      'local_first_boundary_preserved',
      'Local-first boundary is preserved',
      input.localFirstBoundaryPreserved,
      input.localFirstBoundaryPreserved
        ? 'Local-first aliases, retries, conflicts, and dependent queues remain unchanged.'
        : 'Local-first alias, retry, conflict, and queued dependent action behavior must be preserved.',
    ),
    gate(
      'downstream_pricing_boundary_preserved',
      'Downstream pricing boundary is preserved',
      input.downstreamPricingBoundaryPreserved,
      input.downstreamPricingBoundaryPreserved
        ? 'Quotes, public outputs, invoices, and job packs remain on saved estimate or quote-version boundaries.'
        : 'Quote, public output, invoice, and job-pack pricing boundaries must be preserved.',
    ),
    gate(
      'rollback_to_calculator_live_confirmed',
      'Rollback to calculator live is confirmed',
      input.rollbackToCalculatorLiveConfirmed,
      input.rollbackToCalculatorLiveConfirmed
        ? 'Rollback path is an explicit switch back to calculator_live.'
        : 'Rollback must be an explicit calculator_live switch, not hidden fallback behavior.',
    ),
  ];

  const blockingGateCodes = gates.filter((entry) => !entry.passed).map((entry) => entry.code);

  return {
    currentLivePricingSource: ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
    requestedPricingSource: ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
    fallbackPricingSource: null,
    eligibleToEnable: blockingGateCodes.length === 0,
    gates,
    blockingGateCodes,
  };
}
