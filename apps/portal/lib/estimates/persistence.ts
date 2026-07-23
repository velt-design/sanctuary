import { summarizeCalculatorSnapshot } from './summarize';
import type { EstimatePricingSourceSaveContext } from './pricingSourceTypes';

type AnyRecord = Record<string, unknown>;

type LegacySummaryFields = {
  crew_hours: number | null;
  duration_days: number | null;
  materials_ex_gst: number | null;
  install_payout_ex_gst: number | null;
  overhead_ex_gst: number | null;
  total_true_cost_ex_gst: number | null;
  total_true_cost_inc_gst: number | null;
};

type EstimatePayloadParams = {
  status?: unknown;
  inputs?: unknown;
  outputs?: unknown;
  derived?: unknown;
  projectSnapshot?: unknown;
  snapshot?: unknown;
  configVersions?: unknown;
  version?: number | null;
  createdBy?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  internalNotes?: string | null;
  pricingSourceContext?: EstimatePricingSourceSaveContext | null;
};

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readPath(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = cursor[key];
  }
  return cursor;
}

function readNumber(source: unknown, path: string[]): number | null {
  return toNumber(readPath(source, path));
}

function normalizeStatus(value: unknown): 'draft' | 'archived' {
  return typeof value === 'string' && value.trim().toLowerCase() === 'archived' ? 'archived' : 'draft';
}

function normalizeVersion(value: unknown): number | null {
  const parsed = toNumber(value);
  if (parsed === null) return null;
  const rounded = Math.trunc(parsed);
  return rounded > 0 ? rounded : null;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeUuid(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function computeLegacySummary(snapshot: Record<string, unknown>, workHoursPerDay = 9): LegacySummaryFields {
  const outputs = isRecord(snapshot.outputs) ? snapshot.outputs : null;

  const crewHours = readNumber(outputs, ['install', 'totals', 'crew_hours']);
  const crewMinutes = readNumber(outputs, ['install', 'totals', 'crew_minutes']);
  const derivedCrewHours = crewHours ?? (typeof crewMinutes === 'number' ? crewMinutes / 60 : null);
  const durationDays = typeof derivedCrewHours === 'number' ? derivedCrewHours / workHoursPerDay : null;

  return {
    crew_hours: derivedCrewHours,
    duration_days: durationDays,
    materials_ex_gst: readNumber(outputs, ['materials', 'totals', 'materials_ex_gst']),
    install_payout_ex_gst: readNumber(outputs, ['install', 'totals', 'install_ex_gst']),
    overhead_ex_gst: readNumber(outputs, ['overhead', 'total_ex_gst']) ?? readNumber(outputs, ['overhead', 'ops_ex_gst']),
    total_true_cost_ex_gst: readNumber(outputs, ['totals', 'cost_ex_gst']),
    total_true_cost_inc_gst: readNumber(outputs, ['totals', 'cost_inc_gst']),
  };
}

export function buildEstimateSnapshotPayload(params: EstimatePayloadParams): {
  snapshot: Record<string, unknown>;
  summaryJson: Record<string, unknown>;
  legacySummary: LegacySummaryFields;
  warnings: unknown[];
  costingManifest: string | null;
  costingRules: string | null;
  version: number | null;
} {
  const inputs = isRecord(params.inputs) ? params.inputs : {};
  const baseOutputs = isRecord(params.outputs) ? params.outputs : {};
  const configVersions = isRecord(params.configVersions) ? params.configVersions : null;
  const version = normalizeVersion(params.version) ?? normalizeVersion(baseOutputs.version);

  const outputs: Record<string, unknown> = {
    ...baseOutputs,
    derived: isRecord(params.derived) ? params.derived : {},
    configVersions,
    projectSnapshot: isRecord(params.projectSnapshot) ? params.projectSnapshot : null,
    snapshot: isRecord(params.snapshot) ? params.snapshot : null,
  };
  if (version !== null) outputs.version = version;

  const warnings = Array.isArray(baseOutputs.warnings) ? baseOutputs.warnings : [];
  const costingManifest = normalizeText((configVersions as any)?.manifest);
  const costingRules = normalizeText((configVersions as any)?.rules);

  const snapshot: Record<string, unknown> = {
    inputs,
    outputs,
    warnings,
  };
  if (costingManifest) snapshot.costing_manifest = costingManifest;
  if (costingRules) snapshot.costing_rules = costingRules;

  const summaryJson = summarizeCalculatorSnapshot(snapshot);
  const legacySummary = computeLegacySummary(snapshot);

  return {
    snapshot,
    summaryJson,
    legacySummary,
    warnings,
    costingManifest,
    costingRules,
    version,
  };
}

export function buildEstimateDbPayload(params: EstimatePayloadParams): Record<string, unknown> {
  const built = buildEstimateSnapshotPayload(params);
  const snapshotOutputs = (built.snapshot.outputs ?? {}) as Record<string, unknown>;

  const payload: Record<string, unknown> = {
    status: normalizeStatus(params.status),
    summary_json: built.summaryJson,
    inputs: built.snapshot.inputs ?? {},
    outputs: snapshotOutputs,
    warnings: built.warnings,
    costing_manifest: built.costingManifest,
    costing_rules: built.costingRules,
    costing_config_version_id: normalizeUuid(
      readPath(snapshotOutputs, ['configVersions', 'costingControl', 'versionId']),
    ),
    ...built.legacySummary,
  };

  if (typeof params.createdBy === 'string' || params.createdBy === null) payload.created_by = params.createdBy;
  if (typeof params.createdAt === 'string') payload.created_at = params.createdAt;
  if (typeof params.updatedAt === 'string') payload.updated_at = params.updatedAt;
  if (typeof params.internalNotes === 'string' || params.internalNotes === null) payload.internal_notes = params.internalNotes;
  if (params.pricingSourceContext) {
    payload.pricing_source = params.pricingSourceContext.pricingSource;
    payload.pricing_source_metadata = params.pricingSourceContext.pricingSourceMetadata;
    payload.commercial_design_input = params.pricingSourceContext.commercialDesignInput;
  }

  return payload;
}
