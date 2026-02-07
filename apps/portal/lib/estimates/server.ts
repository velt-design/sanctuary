import 'server-only';

import { appIdFromUuid, isRecord } from '@/lib/supabase/mappers';
import { summarizeCalculatorSnapshot } from './summarize';
import type { EstimateDetail, EstimateMeta, EstimateStatus, EstimateSummary } from './types';

type AnyRecord = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function normaliseEstimateStatus(value: unknown): EstimateStatus {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'approved') return 'approved';
  if (raw === 'in_review') return 'in_review';
  if (raw === 'rejected') return 'rejected';
  if (raw === 'superseded') return 'superseded';
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
      if (version !== null) labels.set(String(row?.id ?? ''), `v${version}`);
    }
    return labels;
  }

  const asc = rows.slice().sort((a, b) => String(a?.created_at ?? '').localeCompare(String(b?.created_at ?? '')));
  asc.forEach((row, idx) => {
    labels.set(String(row?.id ?? ''), `v${idx + 1}`);
  });
  return labels;
}

export function summaryFromRow(row: any): EstimateSummary {
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
  return {
    id: appIdFromUuid('est', String(row?.id ?? '')),
    projectId: appIdFromUuid('proj', String(row?.project_id ?? '')),
    createdAt: typeof row?.created_at === 'string' ? row.created_at : new Date().toISOString(),
    status: normaliseEstimateStatus(row?.status),
    summary: summaryFromRow(row),
    createdBy: asString(row?.created_by),
    versionLabel,
  };
}

export function mapEstimateDetail(row: any, versionLabel: string): EstimateDetail {
  const meta = mapEstimateMeta(row, versionLabel);
  return {
    ...meta,
    calculatorSnapshot: calculatorSnapshotFromRow(row),
    internalNotes: asString(row?.internal_notes),
    approvalRequestedAt: asString(row?.approval_requested_at),
    approvalRequestedBy: asString(row?.approval_requested_by),
    approvedAt: asString(row?.approved_at),
    approvedBy: asString(row?.approved_by),
    rejectedAt: asString(row?.rejected_at),
    rejectedBy: asString(row?.rejected_by),
    approvalComment: asString(row?.approval_comment),
  };
}
