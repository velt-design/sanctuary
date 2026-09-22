import { requireAdminContext } from '@/lib/api/adminApi';
import { parsePortalActionGrant, PortalActionInputError } from '@/lib/integrations/portalActions/contract';
import { actionBody, actionDatabaseError, actionEnvironment, actionJson, actionSameOrigin } from '@/lib/integrations/portalActions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!actionSameOrigin(request)) return actionJson({ error: 'Forbidden' }, 403);
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  try {
    const grant = parsePortalActionGrant(await actionBody(request, 256 * 1024), Date.now());
    const { data, error } = await auth.supabase.rpc('portal_action_grant_preview', { p_grant: grant });
    if (error) return actionDatabaseError(error);
    const environment = actionEnvironment();
    return actionJson({ ...data, enabled: data.enabled === true && environment === data.environment && environment === grant.environment });
  } catch (error) {
    return error instanceof PortalActionInputError
      ? actionJson({ error: 'Invalid Portal action grant' }, 400) : actionDatabaseError(null);
  }
}
