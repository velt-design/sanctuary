import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { buildVersionLabelMap, mapEstimateDetail, normaliseEstimateStatus } from '@/lib/estimates/server';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

type ActionKind = 'request_approval' | 'approve' | 'reject';

function parseAction(value: unknown): ActionKind | null {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return null;
  if (raw === 'request_approval' || raw === 'request-approval') return 'request_approval';
  if (raw === 'approve') return 'approve';
  if (raw === 'reject') return 'reject';
  return null;
}

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

  const currentStatus = normaliseEstimateStatus(res.data.status);
  const action = parseAction(body.action);
  const comment = parseNote(body.comment ?? body.approval_comment);
  const internalNotes = parseNote(body.internal_notes ?? body.internalNotes);

  const now = new Date().toISOString();
  const actor = typeof session.user?.email === 'string' ? session.user.email.trim() : null;

  const patch: Record<string, any> = {};

  if (internalNotes !== null) {
    patch.internal_notes = internalNotes || null;
  }

  if (action) {
    if (action === 'request_approval') {
      if (currentStatus !== 'draft') return jsonError('Approval can only be requested from draft.', 409);
      patch.status = 'in_review';
      patch.approval_requested_at = now;
      patch.approval_requested_by = actor;
      patch.approved_at = null;
      patch.approved_by = null;
      patch.rejected_at = null;
      patch.rejected_by = null;
    }

    if (action === 'approve') {
      if (currentStatus !== 'in_review') return jsonError('Approve requires in_review status.', 409);
      patch.status = 'approved';
      patch.approved_at = now;
      patch.approved_by = actor;
      patch.rejected_at = null;
      patch.rejected_by = null;
    }

    if (action === 'reject') {
      if (currentStatus !== 'in_review') return jsonError('Reject requires in_review status.', 409);
      patch.status = 'rejected';
      patch.rejected_at = now;
      patch.rejected_by = actor;
      patch.approved_at = null;
      patch.approved_by = null;
    }

    if ((action === 'approve' || action === 'reject') && comment !== null) {
      patch.approval_comment = comment || null;
    }
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
