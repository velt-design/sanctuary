import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { isMissingColumnError, missingColumnFromError, salespersonSchemaMismatchMessage } from '@/lib/api/siteVisitsServer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

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

  const rawId = typeof body.siteVisitEventId === 'string' ? body.siteVisitEventId.trim() : '';
  if (!rawId) return jsonError('siteVisitEventId is required', 400);

  let eventUuid: string;
  try {
    eventUuid = uuidFromAppId(rawId, 'sv');
  } catch {
    return jsonError('Invalid siteVisitEventId', 400);
  }

  const prev = await supabase.from('site_visit_events').select('id').eq('project_id', projectUuid).eq('id', eventUuid).limit(1);
  if (prev.error) return jsonError('Failed to load site visit', 500);
  const rows = Array.isArray(prev.data) ? prev.data : [];
  if (!rows.length) return jsonError('Site visit not found', 404);

  const updateRes = await safeUpdate(supabase, eventUuid, projectUuid, {
    status: 'UNSCHEDULED',
    scheduled_start: null,
    scheduled_end: null,
    cancel_reason: null,
    customer_notified: false,
    last_notified_at: null,
    assigned_sales_owner_id: null,
    assigned_sales_owner: null,
  });

  if (!updateRes.ok) {
    const schemaMsg = salespersonSchemaMismatchMessage(updateRes.error);
    return jsonError(schemaMsg ?? 'Failed to unschedule site visit', 500);
  }

  return jsonOk({ ok: true });
}
