import type { SupabaseClient } from '@supabase/supabase-js';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { estimateFlowStateFor, loadProjectEstimateFlowMaps } from '@/lib/estimates/flow';
import { buildEstimateDbPayload } from '@/lib/estimates/persistence';
import {
  ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
  buildEstimateWorkbenchSolvedReadinessFromSnapshot,
  logEstimatePricingSourceAudit,
  normalizeRequestedEstimatePricingSource,
  resolveEstimatePricingSourceForSave,
} from '@/lib/estimates/pricingRollout';
import { buildVersionLabelMap, extractVersionNumber, loadEstimateEditability, mapEstimateDetail } from '@/lib/estimates/server';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { NextResponse } from 'next/server';
import { validateCommercialInternalName } from '@/lib/commercial/internalName';

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

function isEstimatePricingSourceColumn(column: string): boolean {
  return column === 'pricing_source' || column === 'pricing_source_metadata' || column === 'commercial_design_input';
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

async function updateEstimateWithRetry(supabase: SupabaseClient, estimateUuid: string, payloadIn: Record<string, any>) {
  const payload = { ...payloadIn };
  if (!Object.keys(payload).length) return { data: null, error: null };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabase.from('estimates').update(payload).eq('id', estimateUuid).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in payload) {
      if (payload.pricing_source === 'workbench_solved' && isEstimatePricingSourceColumn(missing)) return res;
      delete payload[missing];
      if (!Object.keys(payload).length) return { data: null, error: null };
      continue;
    }

    return res;
  }

  return { data: null, error: { message: 'Supabase update failed after retries', code: 'CLIENT_RETRY' } };
}

async function resolveVersionLabel(supabase: SupabaseClient, row: any): Promise<string> {
  if (!row?.project_id) return 'V-';
  const all = await supabase
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

  const label = await resolveVersionLabel(supabase, res.data);
  const flowMaps = await loadProjectEstimateFlowMaps(String(res.data.project_id ?? ''));
  const editability = flowMaps.editabilityByEstimateId.get(estimateUuid) ?? (await loadEstimateEditability(estimateUuid));
  const estimate = mapEstimateDetail(res.data, label, editability, estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid));
  return jsonOk({ estimate });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ estimateId: string }> }) {
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

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body: AnyRecord = parsed.body ?? {};
  const hasInternalName = Object.prototype.hasOwnProperty.call(body, 'internalName');
  const internalName = hasInternalName ? validateCommercialInternalName(body.internalName) : null;
  if (internalName && !internalName.ok) return jsonError(internalName.error, 400);

  const res = await supabase.from('estimates').select('*').eq('id', estimateUuid).maybeSingle();
  if (res.error) return jsonError(res.error.message ?? 'Failed to load estimate', 500);
  if (!res.data) return jsonError('Estimate not found', 404);

  const internalNotes = parseNote(body.internal_notes ?? body.internalNotes);
  const estimateUpdate = parseEstimateUpdate(body.estimate_update ?? body.estimateUpdate);
  if (body.action) {
    return jsonError('Estimate approvals are no longer supported.', 400);
  }

  const now = new Date().toISOString();
  const patch: Record<string, any> = {};

  if (internalName?.ok) {
    patch.internal_name = internalName.value;
  }

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

    const actor = typeof auth.session.user?.email === 'string' ? auth.session.user.email.trim() : null;
    const actorUserId = typeof auth.session.user?.id === 'string' ? auth.session.user.id : null;
    const existingOutputs = isRecord(res.data.outputs) ? res.data.outputs : {};
    const candidateOutputs = {
      ...estimateUpdate.outputs,
      derived: estimateUpdate.derived ?? existingOutputs.derived,
      projectSnapshot: estimateUpdate.projectSnapshot ?? existingOutputs.projectSnapshot,
      snapshot: estimateUpdate.snapshot ?? existingOutputs.snapshot,
      configVersions: estimateUpdate.configVersions ?? existingOutputs.configVersions,
    };
    const sourceRequest = normalizeRequestedEstimatePricingSource();
    const sourceGate = resolveEstimatePricingSourceForSave({
      actor,
      selectedAt: now,
      requestedSourceRaw: sourceRequest.raw,
      readiness:
        sourceRequest.requestedPricingSource === ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE
          ? buildEstimateWorkbenchSolvedReadinessFromSnapshot({
              snapshot: {
                inputs: estimateUpdate.inputs,
                outputs: candidateOutputs,
              },
              projectId: typeof res.data.project_id === 'string' ? res.data.project_id : null,
              estimateId: estimateUuid,
            })
          : null,
    });
    if (!sourceGate.ok) {
      await logEstimatePricingSourceAudit(supabase, {
        projectUuid: typeof res.data.project_id === 'string' ? res.data.project_id : null,
        estimateUuid,
        type: 'estimate.pricing_source_blocked',
        actor: actorUserId ?? actor,
        payload: {
          requestedSource: sourceGate.normalizedRequest.requestedPricingSource,
          requestedSourceRaw: sourceGate.normalizedRequest.raw,
          blockingGateCodes: sourceGate.readinessReport.blockingGateCodes,
          gateVersion: sourceGate.metadata.gateVersion,
        },
      });
      return jsonError(sourceGate.message, sourceGate.status, null, {
        code: sourceGate.code,
        readinessReport: sourceGate.readinessReport,
      });
    }

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
        pricingSourceContext: sourceGate.context,
      }),
    );
  }

  if (!Object.keys(patch).length) {
    return jsonError('No changes submitted', 400);
  }

  if (!('updated_at' in patch)) patch.updated_at = now;

  const updateRes = await updateEstimateWithRetry(supabase, estimateUuid, patch);
  if (updateRes.error) return jsonError(updateRes.error.message ?? 'Failed to update estimate', 500);

  const row = updateRes.data ?? res.data;
  if (estimateUpdate) {
    const actor = typeof auth.session.user?.email === 'string' ? auth.session.user.email.trim() : null;
    const actorUserId = typeof auth.session.user?.id === 'string' ? auth.session.user.id : null;
    const source = typeof patch.pricing_source === 'string' ? patch.pricing_source : 'calculator_live';
    await logEstimatePricingSourceAudit(supabase, {
      projectUuid: typeof row?.project_id === 'string' ? row.project_id : null,
      estimateUuid,
      type: 'estimate.pricing_source_saved',
      actor: actorUserId ?? actor,
      payload: {
        source,
        requestedSource: isRecord(patch.pricing_source_metadata) ? patch.pricing_source_metadata.requestedSource : source,
        requestedSourceRaw: isRecord(patch.pricing_source_metadata) ? patch.pricing_source_metadata.requestedSourceRaw : null,
        gateVersion: isRecord(patch.pricing_source_metadata) ? patch.pricing_source_metadata.gateVersion : null,
      },
    });
  }
  const syncedQuoteVersionIds: string[] = [];
  const label = await resolveVersionLabel(supabase, row);
  const flowMaps = await loadProjectEstimateFlowMaps(String(row?.project_id ?? ''));
  const editability = flowMaps.editabilityByEstimateId.get(estimateUuid) ?? (await loadEstimateEditability(estimateUuid));
  const estimate = mapEstimateDetail(row, label, editability, estimateFlowStateFor(flowMaps.flowByEstimateId, estimateUuid));
  return jsonOk({ estimate, syncedQuoteVersionIds });
}
