import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import {
  isMissingColumnError,
  isUniqueViolation,
  loadEmailTemplateSubject,
  loadProjectAndContact,
  makeIdempotencyKey,
  missingColumnFromError,
  parseIso,
  salespersonSchemaMismatchMessage,
} from '@/lib/api/siteVisitsServer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { SALES_PEOPLE } from '@/src/config/salesPeople';

export const runtime = 'nodejs';

async function loadEventRow(supabase: SupabaseClient, projectUuid: string, eventUuid: string): Promise<{ data: any | null; error: any | null }> {
  const selects = ['id, status, scheduled_start, notes, updated_at', 'id, status, scheduled_start, updated_at', 'id, status, scheduled_start'] as const;

  let lastErr: any | null = null;
  for (const select of selects) {
    for (const orderByUpdatedAt of [true, false] as const) {
      const q = supabase.from('site_visit_events').select(select).eq('project_id', projectUuid).eq('id', eventUuid);
      const res = orderByUpdatedAt ? await (q as any).order('updated_at', { ascending: false }).limit(1) : await (q as any).limit(1);
      if (!res.error) {
        const rows = Array.isArray(res.data) ? res.data : [];
        return { data: rows.length ? rows[0] : null, error: null };
      }
      lastErr = res.error;
      if (!isMissingColumnError(res.error)) break;
      const missing = missingColumnFromError(res.error);
      if (orderByUpdatedAt && missing === 'updated_at') continue;
      break;
    }
    if (lastErr && !isMissingColumnError(lastErr)) break;
  }
  return { data: null, error: lastErr };
}

async function safeUpdate(
  supabase: SupabaseClient,
  eventUuid: string,
  projectUuid: string,
  patchIn: Record<string, any>,
): Promise<{ ok: boolean; error?: any }> {
  const patch = { ...patchIn };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await supabase.from('site_visit_events').update(patch as any).eq('project_id', projectUuid).eq('id', eventUuid);
    if (!res.error) return { ok: true };
    if (isMissingColumnError(res.error)) {
      const missing = missingColumnFromError(res.error);
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
    return { ok: false, error: res.error };
  }
  return { ok: false, error: { message: 'Update failed after retries', code: 'CLIENT_RETRY' } };
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
  if (!start) return jsonError('start is required (ISO)', 400);
  if (!end) return jsonError('end is required (ISO)', 400);

  const salespersonId = typeof body.salespersonId === 'string' ? body.salespersonId.trim() : '';
  if (salespersonId && !SALES_PEOPLE.some((p) => p.id === salespersonId)) return jsonError('Invalid salespersonId', 400);

  const rawId = typeof body.siteVisitEventId === 'string' ? body.siteVisitEventId.trim() : '';
  if (!rawId) return jsonError('siteVisitEventId is required', 400);

  let eventUuid: string;
  try {
    eventUuid = uuidFromAppId(rawId, 'sv');
  } catch {
    return jsonError('Invalid siteVisitEventId', 400);
  }

  const notifyCustomer = Boolean(body.notifyCustomer);

  const prevRes = await loadEventRow(supabase, projectUuid, eventUuid);
  if (prevRes.error || !prevRes.data) return jsonError('Site visit not found', 404);

  const prevStatus = String((prevRes.data as any).status ?? '').toUpperCase();

  const updateRes = await safeUpdate(supabase, eventUuid, projectUuid, {
    scheduled_start: start,
    scheduled_end: end,
    status: prevStatus === 'CONFIRMED' ? 'RESCHEDULED' : prevStatus,
    ...(salespersonId ? { assigned_sales_owner_id: salespersonId, assigned_sales_owner: salespersonId } : null),
  });
  if (!updateRes.ok) {
    const schemaMsg = salespersonSchemaMismatchMessage(updateRes.error);
    return jsonError(schemaMsg ?? 'Failed to reschedule site visit', 500);
  }

  if (notifyCustomer && (prevStatus === 'CONFIRMED' || prevStatus === 'RESCHEDULED')) {
    const info = await loadProjectAndContact(projectUuid);
    if (info.contactEmail) {
      const templateId = 'EMAIL_SITE_VISIT_RESCHEDULED';
      const subject = (await loadEmailTemplateSubject(templateId)) ?? 'Site visit rescheduled';
      const idempotencyKey = makeIdempotencyKey([projectUuid, 'email', templateId, eventUuid, start]);

      const insertRes = await supabase.from('email_outbox').insert({
        project_id: projectUuid,
        contact_id: info.contactId,
        email_type: templateId,
        to_email: info.contactEmail,
        subject,
        template_id: templateId,
        variables: { contactName: info.contactName, projectName: info.projectName, scheduledStart: start },
        status: 'QUEUED',
        idempotency_key: idempotencyKey,
      } as any);

      if (insertRes.error && !isUniqueViolation(insertRes.error)) {
        return jsonError('Failed to queue reschedule email', 500);
      }

      await supabase
        .from('site_visit_events')
        .update({ customer_notified: true, last_notified_at: new Date().toISOString() } as any)
        .eq('project_id', projectUuid)
        .eq('id', eventUuid)
        .then(async (r) => {
          if (!r.error) return;
          if (!isMissingColumnError(r.error)) return;
          await safeUpdate(supabase, eventUuid, projectUuid, { customer_notified: true, last_notified_at: new Date().toISOString() });
        });
    }
  }

  return jsonOk({ ok: true, scheduledStart: start, scheduledEnd: end });
}
