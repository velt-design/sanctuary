import { requireAdminContext } from '@/lib/api/adminApi';
import { parsePortalActionGrant, PortalActionInputError } from '@/lib/integrations/portalActions/contract';
import { actionBody, actionDatabaseError, actionEnvironment, actionJson, actionSameOrigin } from '@/lib/integrations/portalActions/server';
import { issuePortalActionToken } from '@/lib/integrations/portalActions/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  try {
    const { data, error } = await auth.supabase.rpc('portal_action_grants_list');
    return error ? actionDatabaseError(error) : actionJson(data);
  } catch { return actionDatabaseError(null); }
}

export async function POST(request: Request) {
  // Browser-authenticated credential issuance always requires a same-origin POST.
  if (!actionSameOrigin(request)) return actionJson({ error: 'Forbidden' }, 403);
  const auth = await requireAdminContext();
  if (!auth.ok) return auth.response;
  const environment = actionEnvironment();
  if (!environment) return actionJson({ error: 'Portal actions disabled' }, 503);
  try {
    const grant = parsePortalActionGrant(await actionBody(request, 256 * 1024), Date.now());
    if (grant.environment !== environment) throw new PortalActionInputError();
    const { token, tokenHash } = issuePortalActionToken();
    const { data, error } = await auth.supabase.rpc('portal_action_grant_issue', { p_token_hash: tokenHash, p_grant: grant });
    if (error) return actionDatabaseError(error);
    return actionJson({ ...data, version: grant.version, token }, 201);
  } catch (error) {
    return error instanceof PortalActionInputError
      ? actionJson({ error: 'Invalid Portal action grant' }, 400) : actionDatabaseError(null);
  }
}
