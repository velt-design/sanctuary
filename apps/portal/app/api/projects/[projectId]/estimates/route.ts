import type { SupabaseClient } from '@supabase/supabase-js';
import { createRouteDiagnostics, measureRouteStep } from '@/lib/api/routeDiagnostics';
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
import { buildVersionLabelMap, extractVersionNumber, mapEstimateDetail, mapEstimateMeta } from '@/lib/estimates/server';
import { isRecord, uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

type AnyRecord = Record<string, unknown>;

function privateNoStore<T extends Response>(response: T): T {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

function isEstimatePricingSourceColumn(column: string): boolean {
  return column === 'pricing_source' || column === 'pricing_source_metadata' || column === 'commercial_design_input';
}

async function insertEstimateWithRetry(supabase: SupabaseClient, payload: Record<string, any>) {
  const working: Record<string, any> = { ...payload };

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabase.from('estimates').insert(working).select('*').single();
    if (!res.error && res.data) return res;

    const missing = missingColumnFromError(res.error);
    if (missing && missing in working) {
      if (missing === 'client_intent_id') return res;
      if (working.pricing_source === 'workbench_solved' && isEstimatePricingSourceColumn(missing)) return res;
      delete working[missing];
      continue;
    }

    return res;
  }

  return { data: null, error: { message: 'Supabase insert failed after retries', code: 'CLIENT_RETRY' } };
}

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/projects/[projectId]/estimates');
  const auth = await measureRouteStep(diagnostics, 'auth', () => requireStaffContext(diagnostics));
  if (!auth.ok) return privateNoStore(auth.response);
  const supabase = auth.supabase;

  let projectUuid: string;
  try {
    const { projectId } = await ctx.params;
    projectUuid = uuidFromAppId(projectId, 'proj');
  } catch {
    return privateNoStore(jsonError('Invalid projectId', 400, diagnostics));
  }

  const res = await measureRouteStep(diagnostics, 'estimates', async () => await supabase
    .from('estimates')
    .select('id, project_id, created_at, status, created_by, summary_json, summary, inputs, outputs, warnings, costing_manifest, costing_rules, total_true_cost_ex_gst, total_true_cost_inc_gst, internal_notes')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false }));

  if (res.error) return privateNoStore(jsonError(res.error.message ?? 'Failed to load estimates', 500, diagnostics));

  const rows = Array.isArray(res.data) ? res.data : [];
  const versionLabels = buildVersionLabelMap(rows);
  const flowMaps = await measureRouteStep(
    diagnostics,
    'flow',
    () => loadProjectEstimateFlowMaps(projectUuid, rows as any[], supabase),
  );

  const estimates = rows.map((row) => {
    const label = versionLabels.get(String(row?.id ?? '')) ?? 'V-';
    return mapEstimateMeta({ ...row, ...estimateFlowStateFor(flowMaps.flowByEstimateId, String(row?.id ?? '')) }, label);
  });
  const activeDraftRow = rows.find((row) => String(row?.id ?? '') === flowMaps.activeDraftEstimateId);
  const activeDraftEstimate = activeDraftRow
    ? mapEstimateDetail(
        activeDraftRow,
        versionLabels.get(String(activeDraftRow.id ?? '')) ?? 'V-',
        flowMaps.editabilityByEstimateId.get(String(activeDraftRow.id ?? '')) ?? null,
        estimateFlowStateFor(flowMaps.flowByEstimateId, String(activeDraftRow.id ?? '')),
      )
    : null;

  return privateNoStore(jsonOk({ estimates, activeDraftEstimate }, 200, diagnostics));
}

export async function POST(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

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
  const clientIntentId =
    typeof body.clientIntentId === 'string' ? body.clientIntentId.trim() : '';
  if (
    clientIntentId.length < 8 ||
    clientIntentId.length > 128 ||
    !/^[A-Za-z0-9._:-]+$/.test(clientIntentId)
  ) {
    return jsonError('clientIntentId is required', 400);
  }

  const existing = await supabase
    .from('estimates')
    .select('*')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false });

  if (existing.error) return jsonError(existing.error.message ?? 'Failed to load existing estimates', 500);
  const existingRows = Array.isArray(existing.data) ? existing.data : [];
  const versionLabels = buildVersionLabelMap(existingRows);
  const existingIntent = existingRows.find(
    (row) => String((row as any)?.client_intent_id ?? '') === clientIntentId,
  );
  if (existingIntent) {
    const flowMaps = await loadProjectEstimateFlowMaps(projectUuid, existingRows as any[]);
    const existingId = String(existingIntent?.id ?? '');
    const estimate = mapEstimateDetail(
      existingIntent,
      versionLabels.get(existingId) ?? 'V-',
      flowMaps.editabilityByEstimateId.get(existingId) ?? null,
      estimateFlowStateFor(flowMaps.flowByEstimateId, existingId),
    );
    return jsonOk({ estimate, idempotentReplay: true });
  }

  const snapshot = isRecord(body?.calculator_snapshot)
    ? (body.calculator_snapshot as Record<string, unknown>)
    : null;
  if (!snapshot) {
    return jsonError(
      'This save has no calculator result attached. Recalculate before saving.',
      409,
    );
  }

  const existingVersions = existingRows.map((row) => extractVersionNumber(row)).filter((v): v is number => v !== null);

  const nextVersion =
    existingVersions.length === existingRows.length && existingVersions.length > 0
      ? Math.max(...existingVersions) + 1
      : existingRows.length + 1;

  const inputs = isRecord(snapshot.inputs) ? (snapshot.inputs as AnyRecord) : {};
  const outputs = isRecord(snapshot.outputs) ? (snapshot.outputs as AnyRecord) : {};
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
              outputs,
            },
            projectId: projectUuid,
            estimateId: null,
          })
        : null,
  });
  if (!sourceGate.ok) {
    await logEstimatePricingSourceAudit(supabase, {
      projectUuid,
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
    client_intent_id: clientIntentId,
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
      pricingSourceContext: sourceGate.context,
    }),
  };

  const insertRes = await insertEstimateWithRetry(supabase, payload);
  if (insertRes.error || !insertRes.data) {
    if (String(insertRes.error?.code ?? '') === '23505') {
      const replay = await supabase
        .from('estimates')
        .select('*')
        .eq('project_id', projectUuid)
        .eq('client_intent_id', clientIntentId)
        .maybeSingle();
      if (replay.data) {
        const replayRows = [...existingRows, replay.data];
        const replayLabels = buildVersionLabelMap(replayRows);
        const replayMaps = await loadProjectEstimateFlowMaps(
          projectUuid,
          replayRows as any[],
        );
        const replayId = String((replay.data as any).id ?? '');
        const estimate = mapEstimateDetail(
          replay.data,
          replayLabels.get(replayId) ?? `V${nextVersion}`,
          replayMaps.editabilityByEstimateId.get(replayId) ?? null,
          estimateFlowStateFor(replayMaps.flowByEstimateId, replayId),
        );
        return jsonOk({ estimate, idempotentReplay: true });
      }
    }
    return jsonError(insertRes.error?.message ?? 'Failed to create estimate', 500);
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
    },
  });
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
