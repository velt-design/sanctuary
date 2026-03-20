import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';
import { buildEstimateDbPayload } from '@/lib/estimates/persistence';
import { buildVersionLabelMap, extractVersionNumber, loadEstimateEditability, mapEstimateDetail } from '@/lib/estimates/server';
import { syncDraftQuoteVersionsFromEstimate } from '@/lib/quotes/server';
import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

function isRecord(value: unknown): value is AnyRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseNote(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') return String(value);
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
}

function parseEstimateUpdate(value: unknown): AnyRecord | null {
  return isRecord(value) ? value : null;
}

function estimateLockedResponse(editability: Awaited<ReturnType<typeof loadEstimateEditability>>) {
  return NextResponse.json(
    {
      error: 'Estimate is locked because it has been sent with a quote and can no longer be edited.',
      code: 'ESTIMATE_LOCKED',
      editability,
    },
    { status: 409 },
  );
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
  if (!row?.project_id) return 'V-';
  const all = await supabaseServer
    .from('estimates')
    .select('id, created_at, outputs')
    .eq('project_id', row.project_id)
    .order('created_at', { ascending: false });
  if (all.error) return 'V-';
  const rows = Array.isArray(all.data) ? all.data : [];
  const labels = buildVersionLabelMap(rows);
  return labels.get(String(row?.id ?? '')) ?? 'V-';
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
  const flowMaps = await loadProjectEstimateFlowMaps(String(res.data.project_id ?? ''));
  const editability = flowMaps.editabilityByEstimateId.get(estimateUuid) ?? (await loadEstimateEditability(estimateUuid));
  const estimate = mapEstimateDetail(res.data, label, editability, estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid));
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
  const estimateUpdate = parseEstimateUpdate(body.estimate_update ?? body.estimateUpdate);
  if (body.action) {
    return jsonError('Estimate approvals are no longer supported.', 400);
  }

  const now = new Date().toISOString();
  const patch: Record<string, any> = {};

  if (internalNotes !== null) {
    patch.internal_notes = internalNotes || null;
  }

  if (estimateUpdate) {
    const editability = await loadEstimateEditability(estimateUuid);
    if (editability.isLocked) return estimateLockedResponse(editability);

    if (!isRecord(estimateUpdate.inputs)) {
      return jsonError('estimate_update.inputs must be an object', 400);
    }
    if (!isRecord(estimateUpdate.outputs)) {
      return jsonError('estimate_update.outputs must be an object', 400);
    }

    const existingOutputs = isRecord(res.data.outputs) ? res.data.outputs : {};
    const currentVersion = extractVersionNumber(res.data);

    Object.assign(
      patch,
      buildEstimateDbPayload({
        status: estimateUpdate.status ?? res.data.status,
        inputs: estimateUpdate.inputs,
        outputs: estimateUpdate.outputs,
        derived: estimateUpdate.derived ?? existingOutputs.derived,
        projectSnapshot: estimateUpdate.projectSnapshot ?? existingOutputs.projectSnapshot,
        snapshot: estimateUpdate.snapshot ?? existingOutputs.snapshot,
        configVersions: estimateUpdate.configVersions ?? existingOutputs.configVersions,
        version: currentVersion,
        updatedAt: now,
        internalNotes: internalNotes !== null ? internalNotes || null : parseNote(res.data.internal_notes),
      }),
    );
  }

  if (!Object.keys(patch).length) {
    return jsonError('No changes submitted', 400);
  }

  if (!('updated_at' in patch)) patch.updated_at = now;

  const updateRes = await updateEstimateWithRetry(estimateUuid, patch);
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update estimate', 500);

  const row = updateRes.data ?? res.data;
  let syncedQuoteVersionIds: string[] = [];
  if (estimateUpdate) {
    try {
      const refreshedDraftQuotes = await syncDraftQuoteVersionsFromEstimate(appIdFromUuid('est', estimateUuid));
      syncedQuoteVersionIds = refreshedDraftQuotes.map((quote) => quote.id);
    } catch (error) {
      console.error('[estimate_update] failed to sync draft quotes from design', {
        estimateId: estimateUuid,
        error,
      });
    }
  }
  const label = await resolveVersionLabel(row);
  const flowMaps = await loadProjectEstimateFlowMaps(String(row?.project_id ?? ''));
  const editability = flowMaps.editabilityByEstimateId.get(estimateUuid) ?? (await loadEstimateEditability(estimateUuid));
  const estimate = mapEstimateDetail(row, label, editability, estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid));
  return jsonOk({ estimate, syncedQuoteVersionIds });
}
