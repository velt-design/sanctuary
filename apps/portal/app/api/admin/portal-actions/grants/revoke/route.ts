import { requireAdminContext } from '@/lib/api/adminApi';
import { parsePortalActionExecution } from '@/lib/integrations/portalActions/contract';
import { actionBody, actionDatabaseError, actionJson, actionSameOrigin } from '@/lib/integrations/portalActions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!actionSameOrigin(request)) return actionJson({ error: 'Forbidden' }, 403);
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  // Revocation remains available even when the application kill switch is off.
  let grantId: string;
  try {
    const body = await actionBody(request, 1024) as Record<string, unknown>;
    if (!body || Object.keys(body).length !== 1 || !('grantId' in body)) throw new Error();
    grantId = parsePortalActionExecution({ commandId: body.grantId }).commandId;
  } catch { return actionJson({ error: 'Invalid grant ID' }, 400); }
  try {
    const { data, error } = await auth.supabase.rpc('portal_action_grant_revoke', { p_grant_id: grantId });
    return error ? actionDatabaseError(error) : actionJson(data);
  } catch { return actionDatabaseError(null); }
}
