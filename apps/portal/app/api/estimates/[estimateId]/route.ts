import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { buildVersionLabelMap, mapEstimateDetail } from '@/lib/estimates/server';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

function parseNote(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
}

async function updateEstimateWithRetry(estimateUuid: string, payloadIn: Record<string, any>) {
  const payload = { ...payloadIn };
  if (!Object.keys(payload).length) return { data: null, error: null };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabaseServer.from('estimates').update(payload).eq('id', estimateUuid).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      delete payload[missing];
      if (!Object.keys(payload).length) return { data: null, error: null };
      continue;
    }

    return res;
  }

  return { data: null, error: { message: 'Supabase update failed after retries', code: 'CLIENT_RETRY' } };
}

async function resolveVersionLabel(row: any): Promise<string> {
  if (!row?.project_id) return 'v—';
  const all = await supabaseServer
    .from('estimates')
    .select('id, created_at, outputs')
    .eq('project_id', row.project_id)
    .order('created_at', { ascending: false });
  if (all.error) return 'v—';
  const rows = Array.isArray(all.data) ? all.data : [];
  const labels = buildVersionLabelMap(rows);
  return labels.get(String(row?.id ?? '')) ?? 'v—';
}

export async function GET(_req: Request, ctx: { params: Promise<{ estimateId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let estimateUuid: string;
  try {
    const { estimateId } = await ctx.params;
    estimateUuid = uuidFromAppId(estimateId, 'est');
  } catch {
    return jsonError('Invalid estimateId', 400);
  }

  const res = await supabaseServer.from('estimates').select('*').eq('id', estimateUuid).maybeSingle();
  if (res.error) return jsonError(res.error.message ?? 'Failed to load estimate', 500);
  if (!res.data) return jsonError('Estimate not found', 404);

  const label = await resolveVersionLabel(res.data);
  const estimate = mapEstimateDetail(res.data, label);
  return jsonOk({ estimate });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ estimateId: string }> }) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  let estimateUuid: string;
  try {
    const { estimateId } = await ctx.params;
    estimateUuid = uuidFromAppId(estimateId, 'est');
  } catch {
    return jsonError('Invalid estimateId', 400);
  }

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body: AnyRecord = parsed.body ?? {};

  const res = await supabaseServer.from('estimates').select('*').eq('id', estimateUuid).maybeSingle();
  if (res.error) return jsonError(res.error.message ?? 'Failed to load estimate', 500);
  if (!res.data) return jsonError('Estimate not found', 404);

  const internalNotes = parseNote(body.internal_notes ?? body.internalNotes);
  if (body.action) {
    return jsonError('Estimate approvals are no longer supported.', 400);
  }

  const now = new Date().toISOString();

  const patch: Record<string, any> = {};

  if (internalNotes !== null) {
    patch.internal_notes = internalNotes || null;
  }

  if (!Object.keys(patch).length) {
    return jsonError('No changes submitted', 400);
  }

  patch.updated_at = now;

  const updateRes = await updateEstimateWithRetry(estimateUuid, patch);
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update estimate', 500);

  const row = updateRes.data ?? res.data;
  const label = await resolveVersionLabel(row);
  const estimate = mapEstimateDetail(row, label);
  return jsonOk({ estimate });
}
