import { automationRunner } from '@/lib/automation/AutomationRunner';
import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { isMissingColumnError, loadProjectAndContact, missingColumnFromError, parseIso, salespersonSchemaMismatchMessage } from '@/lib/api/siteVisitsServer';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import { SALES_PEOPLE } from '@/src/config/salesPeople';

export const runtime = 'nodejs';

type SupabaseLikeError = { code?: unknown; message?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isOnConflictConstraintMissing(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message).toLowerCase();
  return code === '42P10' || (msg.includes('on conflict') && msg.includes('no unique'));
}

async function manualUpsertByProjectId(projectUuid: string, payloadIn: Record<string, any>): Promise<{ id: string | null; error: any | null }> {
  const payload = { ...payloadIn };
  const patch: any = { ...payload };
  delete patch.project_id;

  // Try update first (works even without a unique constraint).
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const updateRes = await supabase
      .from('site_visit_events')
      .update(patch as any)
      .eq('project_id', projectUuid)
      .select('id');

    if (!updateRes.error) {
      const rows = Array.isArray(updateRes.data) ? updateRes.data : [];
      if (rows.length) return { id: typeof (rows[0] as any)?.id === 'string' ? (rows[0] as any).id : null, error: null };
      break;
    }

    if (isMissingColumnError(updateRes.error)) {
      const missing = missingColumnFromError(updateRes.error);
      if (missing && missing in patch) {
        delete patch[missing];
        continue;
      }
      delete patch.assigned_sales_owner_id;
      delete patch.assigned_sales_owner;
      delete patch.customer_notified;
      delete patch.last_notified_at;
      delete patch.cancel_reason;
      continue;
    }

    return { id: null, error: updateRes.error };
  }

  // No rows to update, fall back to insert.
  const insertPayload: any = { project_id: projectUuid, ...patch };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const insertRes = await supabase.from('site_visit_events').insert(insertPayload as any).select('id').single();
    if (!insertRes.error) return { id: typeof (insertRes.data as any)?.id === 'string' ? (insertRes.data as any).id : null, error: null };

    if (isMissingColumnError(insertRes.error)) {
      const missing = missingColumnFromError(insertRes.error);
      if (missing && missing in insertPayload) {
        delete insertPayload[missing];
        continue;
      }
      delete insertPayload.assigned_sales_owner_id;
      delete insertPayload.assigned_sales_owner;
      delete insertPayload.customer_notified;
      delete insertPayload.last_notified_at;
      delete insertPayload.cancel_reason;
      continue;
    }

    return { id: null, error: insertRes.error };
  }

  return { id: null, error: { message: 'Insert failed after retries', code: 'CLIENT_RETRY' } };
}

async function upsertSiteVisitEventByProjectWithRetry(projectUuid: string, payloadIn: Record<string, any>): Promise<{ id: string | null; error: any | null }> {
  const payload = { ...payloadIn };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await supabase
      .from('site_visit_events')
      .upsert(payload as any, { onConflict: 'project_id' })
      .select('id')
      .single();

    if (!res.error) return { id: typeof (res.data as any)?.id === 'string' ? (res.data as any).id : null, error: null };

    if (isOnConflictConstraintMissing(res.error)) {
      return manualUpsertByProjectId(projectUuid, payload);
    }

    if (isMissingColumnError(res.error)) {
      const missing = missingColumnFromError(res.error);
      if (missing && missing in payload) {
        delete payload[missing];
        continue;
      }
      // If we can't identify the missing column, strip known optional fields and retry once.
      delete payload.assigned_sales_owner_id;
      delete payload.assigned_sales_owner;
      delete payload.customer_notified;
      delete payload.last_notified_at;
      delete payload.cancel_reason;
      continue;
    }

    return { id: null, error: res.error };
  }

  return { id: null, error: { message: 'Upsert failed after retries', code: 'CLIENT_RETRY' } };
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

  const start = parseIso(body.start);
  const end = parseIso(body.end);
  const salespersonId = typeof body.salespersonId === 'string' ? body.salespersonId.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const tentative = Boolean(body.tentative);

  if (!start) return jsonError('start is required (ISO)', 400);
  if (!end) return jsonError('end is required (ISO)', 400);
  if (!salespersonId) return jsonError('salespersonId is required', 400);
  if (!SALES_PEOPLE.some((p) => p.id === salespersonId)) return jsonError('Invalid salespersonId', 400);

  const prev = await supabase.from('projects').select('id, pipeline_stage').eq('id', projectUuid).single();
  if (prev.error || !prev.data) return jsonError('Project not found', 404);
  const stage = normalizeProjectStatus((prev.data as any).pipeline_stage).status;
  if (stage !== 'SITE_VISIT') return jsonError('Invalid stage transition (expected SITE_VISIT)', 409);

  const status = tentative ? 'TENTATIVE' : 'CONFIRMED';

  if (tentative) {
    const payload: any = {
      project_id: projectUuid,
      status,
      scheduled_start: start,
      scheduled_end: end,
      assigned_sales_owner_id: salespersonId,
      assigned_sales_owner: salespersonId,
      ...(notes ? { notes } : null),
    };

    const upsertRes = await upsertSiteVisitEventByProjectWithRetry(projectUuid, payload);
    if (upsertRes.error) {
      const schemaMsg = salespersonSchemaMismatchMessage(upsertRes.error);
      if (schemaMsg) return jsonError(schemaMsg, 500);
      const msg = typeof upsertRes.error?.message === 'string' ? upsertRes.error.message : 'Failed to save site visit';
      return jsonError(msg, 500);
    }
    return jsonOk({ ok: true, siteVisitEventId: upsertRes.id ? appIdFromUuid('sv', upsertRes.id) : null });
  }

  // Confirmed bookings trigger automation side effects.
  await automationRunner.runEvent({
    type: 'ui.action.book_site_visit',
    projectId: projectUuid,
    stage: 'SITE_VISIT',
    primaryId: `confirmed:${start}`,
    payload: { status: 'CONFIRMED', scheduledStart: start, scheduledEnd: end, salespersonId, notes: notes || null },
  });

  // Ensure assigned salesperson + notes are persisted even if the automation schema is behind.
  await upsertSiteVisitEventByProjectWithRetry(projectUuid, {
    project_id: projectUuid,
    status: 'CONFIRMED',
    scheduled_start: start,
    scheduled_end: end,
    assigned_sales_owner_id: salespersonId,
    assigned_sales_owner: salespersonId,
    ...(notes ? { notes } : null),
    customer_notified: true,
    last_notified_at: new Date().toISOString(),
  }).then(() => null);

  const info = await loadProjectAndContact(projectUuid);
  return jsonOk({ ok: true, projectName: info.projectName || null });
}
