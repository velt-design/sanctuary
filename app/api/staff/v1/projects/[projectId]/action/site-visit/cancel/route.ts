import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingColumnError, isUniqueViolation, loadEmailTemplateSubject, loadProjectAndContact, makeIdempotencyKey, missingColumnFromError } from '@/lib/api/siteVisitsServer';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

async function safeUpdate(eventUuid: string, projectUuid: string, patchIn: Record<string, any>): Promise<{ ok: boolean; error?: any }> {
  const patch = { ...patchIn };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await supabaseServer.from('site_visit_events').update(patch as any).eq('project_id', projectUuid).eq('id', eventUuid);
    if (!res.error) return { ok: true };
    if (isMissingColumnError(res.error)) {
      const missing = missingColumnFromError(res.error);
      if (missing && missing in patch) {
        delete patch[missing];
        continue;
      }
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

  const rawId = typeof body.siteVisitEventId === 'string' ? body.siteVisitEventId.trim() : '';
  if (!rawId) return jsonError('siteVisitEventId is required', 400);

  let eventUuid: string;
  try {
    eventUuid = uuidFromAppId(rawId, 'sv');
  } catch {
    return jsonError('Invalid siteVisitEventId', 400);
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const notifyCustomer = Boolean(body.notifyCustomer);

  const updateRes = await safeUpdate(eventUuid, projectUuid, { status: 'CANCELLED', cancel_reason: reason || null });
  if (!updateRes.ok) return jsonError('Failed to cancel site visit', 500);

  if (notifyCustomer) {
    const info = await loadProjectAndContact(projectUuid);
    if (info.contactEmail) {
      const templateId = 'EMAIL_SITE_VISIT_CANCELLED';
      const subject = (await loadEmailTemplateSubject(templateId)) ?? 'Site visit cancelled';
      const idempotencyKey = makeIdempotencyKey([projectUuid, 'email', templateId, eventUuid]);

      const insertRes = await supabaseServer.from('email_outbox').insert({
        project_id: projectUuid,
        contact_id: info.contactId,
        email_type: templateId,
        to_email: info.contactEmail,
        subject,
        template_id: templateId,
        variables: { contactName: info.contactName, projectName: info.projectName },
        status: 'QUEUED',
        idempotency_key: idempotencyKey,
      } as any);
      if (insertRes.error && !isUniqueViolation(insertRes.error)) {
        return jsonError('Failed to queue cancellation email', 500);
      }

      await supabaseServer
        .from('site_visit_events')
        .update({ customer_notified: true, last_notified_at: new Date().toISOString() } as any)
        .eq('project_id', projectUuid)
        .eq('id', eventUuid)
        .then(async (r) => {
          if (!r.error) return;
          if (!isMissingColumnError(r.error)) return;
          await safeUpdate(eventUuid, projectUuid, { customer_notified: true, last_notified_at: new Date().toISOString() });
        });
    }
  }

  return jsonOk({ ok: true });
}
