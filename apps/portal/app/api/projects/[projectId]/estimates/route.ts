import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';
import { buildEstimateDbPayload } from '@/lib/estimates/persistence';
import { buildVersionLabelMap, calculatorSnapshotFromRow, extractVersionNumber, mapEstimateDetail, mapEstimateMeta } from '@/lib/estimates/server';
import { supabaseServer } from '@/lib/supabaseClient';
import { isRecord, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

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
  const flowMaps = await loadProjectEstimateFlowMaps(projectUuid, rows as any[]);

  const estimates = rows.map((row) => {
    const label = versionLabels.get(String(row?.id ?? '')) ?? 'V-';
    return mapEstimateMeta({ ...row, ...estimateFlowStateFor(flowMaps.flowByEstimateId, String(row?.id ?? '')) }, label);
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

  const existingVersions = existingRows.map((row) => extractVersionNumber(row)).filter((v): v is number => v !== null);

  const nextVersion =
    existingVersions.length === existingRows.length && existingVersions.length > 0
      ? Math.max(...existingVersions) + 1
      : existingRows.length + 1;

  const inputs = isRecord(snapshot.inputs) ? (snapshot.inputs as AnyRecord) : {};
  const outputs = isRecord(snapshot.outputs) ? (snapshot.outputs as AnyRecord) : {};
  const createdBy = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  const payload: Record<string, any> = {
    project_id: projectUuid,
    ...buildEstimateDbPayload({
      status: 'draft',
      inputs,
      outputs,
      derived: outputs.derived,
      projectSnapshot: outputs.projectSnapshot,
      snapshot: outputs.snapshot,
      configVersions: outputs.configVersions,
      version: nextVersion,
      createdBy,
    }),
  };

  const insertRes = await insertEstimateWithRetry(payload);
  if (insertRes.error || !insertRes.data) {
    return jsonError(insertRes.error?.message ?? 'Failed to create estimate', 500);
  }

  const row = insertRes.data;
  const label = versionLabels.get(String(row?.id ?? '')) ?? `V${nextVersion}`;
  const flowMaps = await loadProjectEstimateFlowMaps(projectUuid);
  const estimate = mapEstimateDetail(
    row,
    label,
    flowMaps.editabilityByEstimateId.get(String(row?.id ?? '')) ?? null,
    estimateFlowStateFor(flowMaps.flowByEstimateId, String(row?.id ?? '')),
  );
  return jsonOk({ estimate }, 201);
}
