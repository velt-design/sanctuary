import {
  compareCommercialDesignInputsV1,
  type CommercialDesignInputV1,
  type CommercialParityReportV1,
  type SiteOutputV1,
} from '@sp/costing';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { buildCommercialDesignInputFromWorkbenchSolvedModel } from '@/lib/drawings/commercialDesignPayload';
import { buildWorkbenchSolvedModel } from '@/lib/drawings/state/workbenchSolvedModel';
import {
  isCalculatorInputsV2,
  isLegacyCalculatorInputsV1,
  migrateLegacyCalculatorInputsToV2,
  type CalculatorInputs,
} from '@/lib/types/calculator';
import { buildCommercialDesignInputFromCalculatorInputs } from './commercialDesignPayload';

export type EstimateLivePricingSource = 'calculator_live' | 'workbench_solved';

export const ESTIMATE_CURRENT_LIVE_PRICING_SOURCE = 'calculator_live' as const;
export const ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE = 'workbench_solved' as const;
export const ESTIMATE_PRICING_SOURCE_BLOCKED_CODE = 'ESTIMATE_PRICING_SOURCE_BLOCKED';
export const ESTIMATE_PRICING_SOURCE_GATE_VERSION = 'estimate_pricing_rollout_prep_v1';
export const ESTIMATE_COMMERCIAL_PARITY_REPORT_VERSION = 'commercial_parity_v1';
const ESTIMATE_PRICING_SOURCE_ENV = 'PORTAL_ESTIMATE_PRICING_SOURCE';

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

type EstimatePricingSourceDefaultReason = 'unset' | 'invalid' | null;

type NormalizedEstimatePricingSourceRequest = {
  raw: string | null;
  requestedPricingSource: EstimateLivePricingSource;
  defaultedReason: EstimatePricingSourceDefaultReason;
};

type EstimatePricingSourceMetadata = {
  gateVersion: typeof ESTIMATE_PRICING_SOURCE_GATE_VERSION;
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

type EstimatePricingSourceGateInput = {
  actor: string | null;
  selectedAt?: string;
  requestedSourceRaw?: string | null;
  readiness?: EstimateWorkbenchSolvedReadinessInput | null;
};

type EstimateWorkbenchSolvedSnapshotReadinessInput = {
  snapshot: Record<string, unknown> | null;
  projectId: string | null;
  estimateId?: string | null;
  designRequestId?: string | null;
};

type EstimatePricingSourceGateResult =
  | {
      ok: true;
      context: EstimatePricingSourceSaveContext;
      normalizedRequest: NormalizedEstimatePricingSourceRequest;
      readinessReport: EstimateWorkbenchSolvedReadinessReport | null;
    }
  | {
      ok: false;
      code: typeof ESTIMATE_PRICING_SOURCE_BLOCKED_CODE;
      message: string;
      status: 409;
      normalizedRequest: NormalizedEstimatePricingSourceRequest;
      readinessReport: EstimateWorkbenchSolvedReadinessReport;
      metadata: EstimatePricingSourceMetadata;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function calculatorInputsFromSnapshot(snapshot: Record<string, unknown> | null): CalculatorInputs | null {
  const rawInputs = isRecord(snapshot) ? snapshot.inputs : null;
  if (isCalculatorInputsV2(rawInputs)) return cloneValue(rawInputs);
  if (isLegacyCalculatorInputsV1(rawInputs)) return migrateLegacyCalculatorInputsToV2(rawInputs);
  return null;
}

function siteOutputFromSnapshot(snapshot: Record<string, unknown> | null): SiteOutputV1 | null {
  const outputs = isRecord(snapshot) && isRecord(snapshot.outputs) ? snapshot.outputs : null;
  return outputs as SiteOutputV1 | null;
}

function parityReportForReadiness(report: CommercialParityReportV1): CommercialParityReportV1 {
  if (report.status === 'blocked' || report.counts.blockingDifferences > 0) return report;
  return {
    ...report,
    status: 'match',
  };
}

function hasPackageOwnedGeometryTakeoff(input: ReturnType<typeof buildWorkbenchSolvedModel>): boolean {
  return input.modules.length > 0 && input.modules.every((module) => Boolean(module.geometryArtifact?.quantityTakeoff));
}

function countBlockingDiagnostics(input: CommercialDesignInputV1 | null | undefined): number {
  if (!input) return 0;
  const diagnostics = [
    ...input.diagnostics,
    ...input.pergolas.flatMap((pergola) => pergola.diagnostics),
    ...input.pergolas.flatMap((pergola) => pergola.modules.flatMap((module) => module.diagnostics)),
  ];
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'blocking').length;
}

function normalizeEnvValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normalizeRequestedEstimatePricingSource(
  rawValue: string | null | undefined = process.env[ESTIMATE_PRICING_SOURCE_ENV],
): NormalizedEstimatePricingSourceRequest {
  const raw = normalizeEnvValue(rawValue);
  if (!raw) {
    return {
      raw: null,
      requestedPricingSource: ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
      defaultedReason: 'unset',
    };
  }

  if (raw === ESTIMATE_CURRENT_LIVE_PRICING_SOURCE || raw === ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE) {
    return {
      raw,
      requestedPricingSource: raw,
      defaultedReason: null,
    };
  }

  return {
    raw,
    requestedPricingSource: ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
    defaultedReason: 'invalid',
  };
}

function blockedReadinessInput(): EstimateWorkbenchSolvedReadinessInput {
  return {
    workbenchCommercialInput: null,
    quantityTakeoffSource: 'unknown',
    parityReports: [],
    estimatePersistenceSourceRecorded: true,
    estimateLockBoundaryPreserved: true,
    localFirstBoundaryPreserved: true,
    downstreamPricingBoundaryPreserved: true,
    rollbackToCalculatorLiveConfirmed: true,
  };
}

function buildSourceMetadata(input: {
  normalizedRequest: NormalizedEstimatePricingSourceRequest;
  selectedSource: EstimateLivePricingSource;
  selectedAt: string;
  selectedBy: string | null;
  readiness?: EstimateWorkbenchSolvedReadinessInput | null;
  readinessReport?: EstimateWorkbenchSolvedReadinessReport | null;
}): EstimatePricingSourceMetadata {
  const commercialInput = input.readiness?.workbenchCommercialInput ?? null;
  const parityReports = input.readiness?.parityReports ?? [];
  const explicitCalculator = input.normalizedRequest.raw === ESTIMATE_CURRENT_LIVE_PRICING_SOURCE;
  const defaultCalculator = input.selectedSource === ESTIMATE_CURRENT_LIVE_PRICING_SOURCE && !explicitCalculator;

  return {
    gateVersion: ESTIMATE_PRICING_SOURCE_GATE_VERSION,
    requestedSource: input.normalizedRequest.requestedPricingSource,
    requestedSourceRaw: input.normalizedRequest.raw,
    selectedSource: input.selectedSource,
    selectedAt: input.selectedAt,
    selectedBy: input.selectedBy,
    defaultedReason: input.normalizedRequest.defaultedReason,
    rollbackProvenance:
      input.selectedSource === ESTIMATE_CURRENT_LIVE_PRICING_SOURCE
        ? explicitCalculator
          ? 'explicit_calculator_live'
          : defaultCalculator
            ? 'default_calculator_live'
            : null
        : null,
    commercialInputSchemaVersion: typeof commercialInput?.schemaVersion === 'string' ? commercialInput.schemaVersion : null,
    quantityTakeoffSource: input.readiness?.quantityTakeoffSource ?? null,
    trustSummary: commercialInput
      ? {
          status: typeof commercialInput.trustStatus === 'string' ? commercialInput.trustStatus : null,
          blockingDiagnostics: countBlockingDiagnostics(commercialInput),
        }
      : null,
    commercialInputHash: commercialInput ? stableHash(commercialInput) : null,
    parityReportHash: parityReports.length ? stableHash(parityReports) : null,
    parityReportVersion: parityReports.length ? ESTIMATE_COMMERCIAL_PARITY_REPORT_VERSION : null,
    blockingGateCodes: input.readinessReport?.blockingGateCodes ?? [],
  };
}

export function buildEstimateWorkbenchSolvedReadinessFromSnapshot(
  input: EstimateWorkbenchSolvedSnapshotReadinessInput,
): EstimateWorkbenchSolvedReadinessInput {
  try {
    const calculatorInputs = calculatorInputsFromSnapshot(input.snapshot);
    if (!calculatorInputs) return blockedReadinessInput();

    const identity = {
      projectId: input.projectId,
      estimateId: input.estimateId ?? null,
      designRequestId: input.designRequestId ?? null,
    };
    const calculatorCommercialInput = buildCommercialDesignInputFromCalculatorInputs({
      inputs: calculatorInputs,
      siteResult: siteOutputFromSnapshot(input.snapshot),
      identity,
    });
    const solvedModel = buildWorkbenchSolvedModel({
      snapshot: input.snapshot,
      geometryIdentity: {
        projectId: input.projectId ?? 'estimate-pricing-project',
        estimateId: input.estimateId ?? 'estimate-pricing-save',
        designRequestId: input.designRequestId ?? null,
      },
    });
    const workbenchCommercialInput = buildCommercialDesignInputFromWorkbenchSolvedModel({
      solvedModel,
      siteCommercial: calculatorCommercialInput.siteCommercial,
    });
    const parityReport = parityReportForReadiness(
      compareCommercialDesignInputsV1(calculatorCommercialInput, workbenchCommercialInput, {
        labelLeft: 'calculator_compat',
        labelRight: 'workbench_solved',
      }),
    );

    return {
      workbenchCommercialInput,
      quantityTakeoffSource: hasPackageOwnedGeometryTakeoff(solvedModel) ? 'solved_geometry_spine' : 'unknown',
      parityReports: [parityReport],
      estimatePersistenceSourceRecorded: true,
      estimateLockBoundaryPreserved: true,
      localFirstBoundaryPreserved: true,
      downstreamPricingBoundaryPreserved: true,
      rollbackToCalculatorLiveConfirmed: true,
    };
  } catch {
    return blockedReadinessInput();
  }
}

export function resolveEstimatePricingSourceForSave(input: EstimatePricingSourceGateInput): EstimatePricingSourceGateResult {
  const selectedAt = input.selectedAt ?? new Date().toISOString();
  const normalizedRequest = normalizeRequestedEstimatePricingSource(input.requestedSourceRaw);

  if (normalizedRequest.requestedPricingSource === ESTIMATE_CURRENT_LIVE_PRICING_SOURCE) {
    const context: EstimatePricingSourceSaveContext = {
      pricingSource: ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
      pricingSourceMetadata: buildSourceMetadata({
        normalizedRequest,
        selectedSource: ESTIMATE_CURRENT_LIVE_PRICING_SOURCE,
        selectedAt,
        selectedBy: input.actor,
      }),
      commercialDesignInput: null,
    };

    return {
      ok: true,
      context,
      normalizedRequest,
      readinessReport: null,
    };
  }

  const readiness = input.readiness ?? blockedReadinessInput();
  const readinessReport = evaluateWorkbenchSolvedPricingReadiness(readiness);
  const metadata = buildSourceMetadata({
    normalizedRequest,
    selectedSource: ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
    selectedAt,
    selectedBy: input.actor,
    readiness,
    readinessReport,
  });

  if (!readinessReport.eligibleToEnable) {
    return {
      ok: false,
      code: ESTIMATE_PRICING_SOURCE_BLOCKED_CODE,
      message: 'Workbench solved estimate pricing is not ready to save.',
      status: 409,
      normalizedRequest,
      readinessReport,
      metadata,
    };
  }

  return {
    ok: true,
    context: {
      pricingSource: ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
      pricingSourceMetadata: metadata,
      commercialDesignInput: readiness.workbenchCommercialInput ?? null,
    },
    normalizedRequest,
    readinessReport,
  };
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

export async function logEstimatePricingSourceAudit(
  supabase: SupabaseClient,
  params: {
    projectUuid: string | null;
    estimateUuid?: string | null;
    type: 'estimate.pricing_source_saved' | 'estimate.pricing_source_blocked';
    actor: string | null;
    payload: Record<string, unknown>;
  },
): Promise<boolean> {
  try {
    const auditRes = await supabase.from('audit_events').insert({
      project_id: params.projectUuid,
      type: params.type,
      idempotency_key: `${params.type}:${params.estimateUuid ?? params.projectUuid ?? 'unknown'}:${crypto.randomUUID()}`,
      payload: {
        estimateId: params.estimateUuid ?? null,
        actor: params.actor,
        ...params.payload,
      },
    } as any);
    if (auditRes.error) {
      console.error('[estimate_pricing_rollout] failed to insert audit event', auditRes.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[estimate_pricing_rollout] failed to insert audit event', error);
    return false;
  }
}
