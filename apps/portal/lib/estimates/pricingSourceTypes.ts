import type { CommercialDesignInputV1 } from '@sp/costing';

export type EstimateLivePricingSource = 'calculator_live' | 'workbench_solved';

export type EstimatePricingSourceDefaultReason = 'unset' | 'invalid' | null;

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

export type EstimatePricingSourceMetadata = {
  gateVersion: string;
  requestedSource: EstimateLivePricingSource;
  requestedSourceRaw: string | null;
  selectedSource: EstimateLivePricingSource;
  selectedAt: string;
  selectedBy: string | null;
  defaultedReason: EstimatePricingSourceDefaultReason;
  rollbackProvenance: 'default_calculator_live' | 'explicit_calculator_live' | null;
  commercialInputSchemaVersion: string | null;
  quantityTakeoffSource: EstimateQuantityTakeoffReadinessSource | null;
  trustSummary: {
    status: string | null;
    blockingDiagnostics: number;
  } | null;
  commercialInputHash: string | null;
  parityReportHash: string | null;
  parityReportVersion: string | null;
  blockingGateCodes: EstimateWorkbenchSolvedReadinessGateCode[];
};

export type EstimatePricingSourceSaveContext = {
  pricingSource: EstimateLivePricingSource;
  pricingSourceMetadata: EstimatePricingSourceMetadata;
  commercialDesignInput: CommercialDesignInputV1 | null;
};
