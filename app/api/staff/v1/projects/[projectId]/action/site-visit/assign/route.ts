import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingColumnError, missingColumnFromError, salespersonSchemaMismatchMessage } from '@/lib/api/siteVisitsServer';
import { supabaseServer } from '@/lib/supabaseClient';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { SALES_PEOPLE } from '@/src/config/salesPeople';

export const runtime = 'nodejs';

async function safeUpdate(
  projectUuid: string,
  eventUuid: string,
  patchIn: Record<string, any>,
): Promise<{ ok: boolean; found: boolean; error?: any }> {
  const patch = { ...patchIn };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const res = await supabaseServer
      .from('site_visit_events')
      .update(patch as any)
      .eq('project_id', projectUuid)
      .eq('id', eventUuid)
      .select('id');

    if (!res.error) {
      const rows = Array.isArray(res.data) ? res.data : [];
      return { ok: true, found: rows.length > 0 };
    }

    if (isMissingColumnError(res.error)) {
      const missing = missingColumnFromError(res.error);
      if (missing && missing in patch) {
        delete patch[missing];
        continue;
      }
      delete patch.assigned_sales_owner_id;
      delete patch.assigned_sales_owner;
      continue;
    }

    return { ok: false, found: false, error: res.error };
  }

  return { ok: false, found: false, error: { message: 'Update failed after retries', code: 'CLIENT_RETRY' } };
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

  const salespersonId = typeof body.salespersonId === 'string' ? body.salespersonId.trim() : '';
  if (!salespersonId) return jsonError('salespersonId is required', 400);
  if (!SALES_PEOPLE.some((p) => p.id === salespersonId)) return jsonError('Invalid salespersonId', 400);

  const rawId = typeof body.siteVisitEventId === 'string' ? body.siteVisitEventId.trim() : '';
  if (!rawId) return jsonError('siteVisitEventId is required', 400);

  let eventUuid: string;
  try {
    eventUuid = uuidFromAppId(rawId, 'sv');
  } catch {
    return jsonError('Invalid siteVisitEventId', 400);
  }

  const updateRes = await safeUpdate(projectUuid, eventUuid, { assigned_sales_owner_id: salespersonId, assigned_sales_owner: salespersonId });
  if (!updateRes.ok) {
    const schemaMsg = salespersonSchemaMismatchMessage(updateRes.error);
    return jsonError(schemaMsg ?? 'Failed to assign salesperson', 500);
  }
  if (!updateRes.found) return jsonError('Site visit not found', 404);

  return jsonOk({ ok: true });
}
