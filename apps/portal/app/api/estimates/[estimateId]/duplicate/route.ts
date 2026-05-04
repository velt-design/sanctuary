import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { buildEstimateDbPayload } from '@/lib/estimates/persistence';
import {
  ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE,
  buildEstimateWorkbenchSolvedReadinessFromSnapshot,
  logEstimatePricingSourceAudit,
  normalizeRequestedEstimatePricingSource,
  resolveEstimatePricingSourceForSave,
} from '@/lib/estimates/pricingRollout';
import { buildVersionLabelMap, calculatorSnapshotFromRow, loadEstimateEditability, mapEstimateDetail } from '@/lib/estimates/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecord, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

function isEstimatePricingSourceColumn(column: string): boolean {
  return column === 'pricing_source' || column === 'pricing_source_metadata' || column === 'commercial_design_input';
}

function estimateLockedResponse(editability: Awaited<ReturnType<typeof loadEstimateEditability>>) {
  return jsonError('Estimate is locked because it has been sent with a quote and can no longer be edited.', 409, null, {
    code: 'ESTIMATE_LOCKED',
    editability,
  });
}

async function insertEstimateWithRetry(supabase: SupabaseClient, payload: Record<string, any>) {
  const working: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabase.from('estimates').insert(working).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in working) {
      if (working.pricing_source === 'workbench_solved' && isEstimatePricingSourceColumn(missing)) return res;
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

  const editability = await loadEstimateEditability(estimateUuid);
  if (editability.isLocked) return estimateLockedResponse(editability);

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
  const outputsWithVersion: AnyRecord = {
    ...outputs,
    version: nextVersion,
  };

  const inputs = isRecord(snapshot.inputs) ? (snapshot.inputs as AnyRecord) : {};

  const createdBy = typeof auth.session.user?.email === 'string' ? auth.session.user.email.trim() : null;
  const actorUserId = typeof auth.session.user?.id === 'string' ? auth.session.user.id : null;
  const sourceRequest = normalizeRequestedEstimatePricingSource();
  const sourceGate = resolveEstimatePricingSourceForSave({
    actor: createdBy,
    requestedSourceRaw: sourceRequest.raw,
    readiness:
      sourceRequest.requestedPricingSource === ESTIMATE_WORKBENCH_SOLVED_PRICING_SOURCE
        ? buildEstimateWorkbenchSolvedReadinessFromSnapshot({
            snapshot: {
              inputs,
              outputs: outputsWithVersion,
            },
            projectId: projectUuid,
            estimateId: estimateUuid,
          })
        : null,
  });
  if (!sourceGate.ok) {
    await logEstimatePricingSourceAudit(supabase, {
      projectUuid,
      estimateUuid,
      type: 'estimate.pricing_source_blocked',
      actor: actorUserId ?? createdBy,
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

  const payload: Record<string, any> = {
    project_id: projectUuid,
    ...buildEstimateDbPayload({
      status: 'draft',
      inputs,
      outputs: outputsWithVersion,
      derived: outputsWithVersion.derived,
      projectSnapshot: outputsWithVersion.projectSnapshot,
      snapshot: outputsWithVersion.snapshot,
      configVersions: outputsWithVersion.configVersions,
      version: nextVersion,
      createdBy,
      internalNotes: null,
      pricingSourceContext: sourceGate.context,
    }),
  };

  const insertRes = await insertEstimateWithRetry(supabase, payload);
  if (insertRes.error || !insertRes.data) {
    return jsonError(insertRes.error?.message ?? 'Failed to duplicate estimate', 500);
  }

  const row = insertRes.data;
  await logEstimatePricingSourceAudit(supabase, {
    projectUuid,
    estimateUuid: String(row?.id ?? ''),
    type: 'estimate.pricing_source_saved',
    actor: actorUserId ?? createdBy,
    payload: {
      source: sourceGate.context.pricingSource,
      requestedSource: sourceGate.normalizedRequest.requestedPricingSource,
      requestedSourceRaw: sourceGate.normalizedRequest.raw,
      gateVersion: sourceGate.context.pricingSourceMetadata.gateVersion,
      duplicatedFromEstimateId: estimateUuid,
    },
  });
  const label = versionLabels.get(String(row?.id ?? '')) ?? `v${nextVersion}`;
  const estimate = mapEstimateDetail(row, label);
  return jsonOk({ estimate }, 201);
}
