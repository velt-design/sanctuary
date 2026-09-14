import { jsonError, jsonOk, parseJsonBody, requireAdminContext } from '@/lib/api/adminApi';
import { invoiceDraftCreationEnabled, listInvoiceDrafts, runInvoiceDraftCommand } from '@/lib/invoices/drafts';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';

type Context = { params: Promise<{ projectId: string }> };
function failure(error: unknown) {
  const detail = typeof (error as { message?: unknown })?.message === 'string' ? String((error as { message: string }).message) : 'Invoice draft request failed';
  const code = (error as { code?: string })?.code;
  return jsonError(detail, code === '40001' ? 409 : code === '42501' ? 403 : code === 'P0002' || /not found/i.test(detail) ? 404
    : code?.startsWith('22') ? 400
    : /required|invalid|not enabled|fixed|cannot|must|exceeds|only|changed|reopen|restore|reconcile/i.test(detail) ? 400 : 500);
}
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  try {
    const { projectId } = await context.params;
    uuidFromAppId(projectId, 'proj');
    // Readers can deploy before the expansion migration. Off means no new schema queries.
    return jsonOk({ enabled: invoiceDraftCreationEnabled(), drafts: invoiceDraftCreationEnabled() ? await listInvoiceDrafts(projectId) : [] });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(request);
  if (!parsed.ok) return parsed.response;
  if (!parsed.body || typeof parsed.body !== 'object' || Array.isArray(parsed.body)) return jsonError('Invalid draft command', 400);
  if (parsed.body.action === 'issue' && (typeof parsed.body.commandId !== 'string' || !isUuid(parsed.body.commandId))) return jsonError('Issue command identifier is required', 400);
  try {
    return jsonOk(await runInvoiceDraftCommand(auth.supabase, (await context.params).projectId, parsed.body, auth.session.user.id));
  } catch (error) { return failure(error); }
}
