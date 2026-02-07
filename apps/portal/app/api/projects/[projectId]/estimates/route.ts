import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { summarizeCalculatorSnapshot } from '@/lib/estimates/summarize';
import { buildVersionLabelMap, calculatorSnapshotFromRow, mapEstimateDetail, mapEstimateMeta } from '@/lib/estimates/server';
import { supabaseServer } from '@/lib/supabaseClient';
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
    const res = await supabaseServer.from('estimates').insert(working).select('*').single();
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

export async function GET(_req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const res = await supabaseServer
    .from('estimates')
    .select('id, project_id, created_at, status, created_by, summary_json, summary, outputs, warnings, costing_manifest, costing_rules, total_true_cost_ex_gst, total_true_cost_inc_gst')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });

  if (res.error) return jsonError(res.error.message ?? 'Failed to load estimates', 500);

  const rows = Array.isArray(res.data) ? res.data : [];
  const versionLabels = buildVersionLabelMap(rows);

  const estimates = rows.map((row) => {
    const label = versionLabels.get(String(row?.id ?? '')) ?? 'v—';
    return mapEstimateMeta(row, label);
  });

  return jsonOk({ estimates });
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return jsonError('Invalid projectId', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  let snapshot: Record<string, unknown> | null = null;
  if (isRecord(body?.calculator_snapshot)) snapshot = body.calculator_snapshot as Record<string, unknown>;

  if (!snapshot) {
    const latest = await supabaseServer
      .from('estimates')
      .select('inputs, outputs, warnings, costing_manifest, costing_rules')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest.data) snapshot = calculatorSnapshotFromRow(latest.data);
  }

  if (!snapshot) {
    return jsonError('No calculator result found. Open calculator and generate one first.', 409);
  }

  const existing = await supabaseServer
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

  const outputs = isRecord(snapshot.outputs) ? (snapshot.outputs as AnyRecord) : {};
  const outputsWithVersion = {
    ...outputs,
    version: nextVersion,
  };

  const inputs = isRecord(snapshot.inputs) ? (snapshot.inputs as AnyRecord) : {};
  const warnings = Array.isArray(snapshot.warnings) ? snapshot.warnings : [];

  const summary = summarizeCalculatorSnapshot(snapshot);
  const legacySummary = computeLegacySummary({ ...snapshot, outputs: outputsWithVersion });

  const createdBy = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

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
    ...legacySummary,
  };

  const insertRes = await insertEstimateWithRetry(payload);
  if (insertRes.error || !insertRes.data) {
    return jsonError(insertRes.error?.message ?? 'Failed to create estimate', 500);
  }

  const row = insertRes.data;
  const label = versionLabels.get(String(row?.id ?? '')) ?? `v${nextVersion}`;
  const estimate = mapEstimateDetail(row, label);
  return jsonOk({ estimate }, 201);
}
