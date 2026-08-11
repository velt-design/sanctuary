import 'server-only';

import { supabaseServiceRole } from '@/lib/supabaseClient';
import { appIdFromUuid, isRecord } from '@/lib/supabase/mappers';
import { computeEstimateEditability, emptyEstimateEditability } from './editability';
import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from './flow';
import { summarizeCalculatorSnapshot } from './summarize';
import type { EstimateDetail, EstimateEditability, EstimateFlowState, EstimateMeta, EstimateStatus, EstimateSummary } from './types';
import { commercialScopeKind, normalizeCommercialScopeId } from '@/lib/commercial/scope';

type AnyRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normaliseEstimateStatus(value: unknown): EstimateStatus {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'archived') return 'archived';
  return 'draft';
}

export function extractVersionNumber(row: any): number | null {
  const raw = row?.version ?? row?.outputs?.version;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

export function buildVersionLabelMap(rows: any[]): Map<string, string> {
  const labels = new Map<string, string>();
  if (!Array.isArray(rows) || rows.length === 0) return labels;

  const allHaveVersion = rows.every((row) => extractVersionNumber(row) !== null);
  if (allHaveVersion) {
    for (const row of rows) {
      const version = extractVersionNumber(row);
      if (version !== null) labels.set(String(row?.id ?? ''), `V${version}`);
    }
    return labels;
  }

  const asc = rows.slice().sort((a, b) => String(a?.created_at ?? '').localeCompare(String(b?.created_at ?? '')));
  asc.forEach((row, idx) => {
    labels.set(String(row?.id ?? ''), `V${idx + 1}`);
  });
  return labels;
}

function summaryFromRow(row: any): EstimateSummary {
  const summaryRaw = row?.summary_json ?? row?.summary;
  if (isRecord(summaryRaw)) return summaryRaw as EstimateSummary;
  if (typeof summaryRaw === 'string') {
    try {
      const parsed = JSON.parse(summaryRaw) as unknown;
      if (isRecord(parsed)) return parsed as EstimateSummary;
    } catch {
      // ignore
    }
  }

  const snapshot = calculatorSnapshotFromRow(row);
  return summarizeCalculatorSnapshot(snapshot);
}

export function calculatorSnapshotFromRow(row: any): Record<string, unknown> {
  const inputs = isRecord(row?.inputs) ? (row.inputs as AnyRecord) : {};
  const outputs = isRecord(row?.outputs) ? (row.outputs as AnyRecord) : {};
  const warnings = Array.isArray(row?.warnings) ? row.warnings : [];

  const snapshot: Record<string, unknown> = {
    inputs,
    outputs,
    warnings,
  };

  const costingManifest = asString(row?.costing_manifest);
  if (costingManifest) snapshot.costing_manifest = costingManifest;

  const costingRules = asString(row?.costing_rules);
  if (costingRules) snapshot.costing_rules = costingRules;

  return snapshot;
}

export function mapEstimateMeta(row: any, versionLabel: string): EstimateMeta {
  const commercialScopeId = normalizeCommercialScopeId(row?.commercial_scope_id);
  const flowState: EstimateFlowState = {
    isActiveDraft: Boolean(row?.isActiveDraft),
    hasSentQuote: Boolean(row?.hasSentQuote),
    jobPackEligible: Boolean(row?.jobPackEligible),
    jobPackGeneratedAt: typeof row?.jobPackGeneratedAt === 'string' ? row.jobPackGeneratedAt : null,
    jobPackQuoteVersionId: typeof row?.jobPackQuoteVersionId === 'string' ? row.jobPackQuoteVersionId : null,
  };
  return {
    id: appIdFromUuid('est', String(row?.id ?? '')),
    projectId: appIdFromUuid('proj', String(row?.project_id ?? '')),
    commercialScopeId,
    commercialScopeKind: commercialScopeKind(commercialScopeId),
    internalName: asString(row?.internal_name),
    createdAt: typeof row?.created_at === 'string' ? row.created_at : new Date().toISOString(),
    status: normaliseEstimateStatus(row?.status),
    summary: summaryFromRow(row),
    createdBy: asString(row?.created_by),
    versionLabel,
    ...flowState,
  };
}

export function mapEstimateDetail(
  row: any,
  versionLabel: string,
  editability?: EstimateEditability | null,
  flowState?: EstimateFlowState | null,
): EstimateDetail {
  const meta = mapEstimateMeta(row, versionLabel);
  return {
    ...meta,
    ...(flowState ?? null),
    calculatorSnapshot: calculatorSnapshotFromRow(row),
    internalNotes: asString(row?.internal_notes),
    editability: editability ?? emptyEstimateEditability(),
  };
}

export async function loadEstimateEditability(estimateUuid: string): Promise<EstimateEditability> {
  const quoteVersionsRes = await supabaseServiceRole
    .from('quote_versions')
    .select('id, status, sent_at, created_at, version_number, quotes(quote_ref)')
    .eq('source_estimate_version_id', estimateUuid);

  if (quoteVersionsRes.error) throw new Error(quoteVersionsRes.error.message ?? 'Failed to load related quotes');
  const quoteVersions = Array.isArray(quoteVersionsRes.data) ? quoteVersionsRes.data : [];
  const quoteVersionIds = quoteVersions
    .map((row) => asString(row?.id))
    .filter((value): value is string => Boolean(value));

  let sendLogs: any[] = [];
  if (quoteVersionIds.length) {
    const sendLogsRes = await supabaseServiceRole
      .from('quote_send_logs')
      .select('quote_version_id, status, sent_at, created_at')
      .in('quote_version_id', quoteVersionIds);

    if (sendLogsRes.error) throw new Error(sendLogsRes.error.message ?? 'Failed to load quote send logs');
    sendLogs = Array.isArray(sendLogsRes.data) ? sendLogsRes.data : [];
  }

  return computeEstimateEditability({ quoteVersions, sendLogs });
}

async function loadEstimateDetailForRow(row: any, versionLabel: string): Promise<EstimateDetail> {
  const projectUuid = String(row?.project_id ?? '');
  const estimateUuid = String(row?.id ?? '');
  const flowMaps = await loadProjectEstimateFlowMaps(projectUuid);
  const editability = flowMaps.editabilityByEstimateId.get(estimateUuid) ?? emptyEstimateEditability();
  const flowState = estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid);
  return mapEstimateDetail(row, versionLabel, editability, flowState);
}
