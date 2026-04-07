import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { summarizeCalculatorSnapshot } from '@/lib/estimates/summarize';
import { buildVersionLabelMap, calculatorSnapshotFromRow, mapEstimateDetail } from '@/lib/estimates/server';
import { isRecord, uuidFromAppId } from '@/lib/supabase/mappers';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';

export const runtime = 'nodejs';

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

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
}

function readPath(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const key of path) {
    if (!isRecord(cursor)) return null;
    cursor = (cursor as AnyRecord)[key];
  }
  return cursor;
}

function readNumber(source: unknown, path: string[]): number | null {
  return toNumber(readPath(source, path));
}

function computeLegacySummary(snapshot: Record<string, unknown>): LegacySummaryFields {
  const outputs = isRecord(snapshot.outputs) ? (snapshot.outputs as AnyRecord) : null;

  const crewHours = readNumber(outputs, ['install', 'totals', 'crew_hours']);
  const crewMinutes = readNumber(outputs, ['install', 'totals', 'crew_minutes']);
  const derivedCrewHours = crewHours ?? (typeof crewMinutes === 'number' ? crewMinutes / 60 : null);
  const durationDays = typeof derivedCrewHours === 'number' ? derivedCrewHours / WORK_HOURS_PER_DAY : null;

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

async function insertEstimateWithRetry(payload: Record<string, any>) {
  const working: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabase.from('estimates').insert(working).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in working) {
      delete working[missing];
      continue;
    }

    return res;
  }

  return { data: null, error: { message: 'Supabase insert failed after retries', code: 'CLIENT_RETRY' } };
}

export async function POST(_req: Request, ctx: { params: Promise<{ estimateId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  let estimateUuid: string;
  try {
    const { estimateId } = await ctx.params;
    estimateUuid = uuidFromAppId(estimateId, 'est');
  } catch {
    return jsonError('Invalid estimateId', 400);
  }

  const res = await supabase.from('estimates').select('*').eq('id', estimateUuid).maybeSingle();
  if (res.error) return jsonError(res.error.message ?? 'Failed to load estimate', 500);
  if (!res.data) return jsonError('Estimate not found', 404);

  const source = res.data;
  const projectUuid = String(source?.project_id ?? '');
  if (!projectUuid) return jsonError('Estimate project missing', 500);

  const existing = await supabase
    .from('estimates')
    .select('id, outputs, created_at')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });
  if (existing.error) return jsonError(existing.error.message ?? 'Failed to load existing estimates', 500);

  const existingRows = Array.isArray(existing.data) ? existing.data : [];
  const versionLabels = buildVersionLabelMap(existingRows);

  const existingVersions = existingRows
    .map((row) => (typeof row?.outputs?.version === 'number' && Number.isFinite(row.outputs.version) ? row.outputs.version : null))
    .filter((v): v is number => typeof v === 'number');

  const nextVersion = existingVersions.length === existingRows.length && existingVersions.length > 0
    ? Math.max(...existingVersions) + 1
    : existingRows.length + 1;

  const snapshot = calculatorSnapshotFromRow(source);
  const outputs = isRecord(snapshot.outputs) ? (snapshot.outputs as AnyRecord) : {};
  const outputsWithVersion = {
    ...outputs,
    version: nextVersion,
  };

  const inputs = isRecord(snapshot.inputs) ? (snapshot.inputs as AnyRecord) : {};
  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];

  const summary = isRecord(source?.summary_json) ? (source.summary_json as Record<string, unknown>) : summarizeCalculatorSnapshot(snapshot);
  const legacySummary = computeLegacySummary({ ...snapshot, outputs: outputsWithVersion });

  const createdBy = typeof auth.session.user?.email === 'string' ? auth.session.user.email.trim() : null;

  const payload: Record<string, any> = {
    project_id: projectUuid,
    status: 'draft',
    created_by: createdBy,
    summary_json: summary,
    inputs,
    outputs: outputsWithVersion,
    warnings,
    costing_manifest: typeof (snapshot as any).costing_manifest === 'string' ? (snapshot as any).costing_manifest : null,
    costing_rules: typeof (snapshot as any).costing_rules === 'string' ? (snapshot as any).costing_rules : null,
    internal_notes: null,
    ...legacySummary,
  };

  const insertRes = await insertEstimateWithRetry(payload);
  if (insertRes.error || !insertRes.data) {
    return jsonError(insertRes.error?.message ?? 'Failed to duplicate estimate', 500);
  }

  const row = insertRes.data;
  const label = versionLabels.get(String(row?.id ?? '')) ?? `v${nextVersion}`;
  const estimate = mapEstimateDetail(row, label);
  return jsonOk({ estimate }, 201);
}
