import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { getProjectCommandCentre } from '@/lib/projects/commandCentre/getProjectCommandCentre';
import {
  commandDatabaseError,
  commandJsonError,
  commandJsonOk,
  privateNoStore,
} from '@/lib/projects/commandCentre/routeSupport';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { isProjectOwnerKey } from '@/lib/projects/commandCentre/projectOwners';

export const runtime = 'nodejs';

export async function PATCH(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/projects/[projectId]/command-centre/owners');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return commandJsonError(parsed.error, 400, diagnostics, 'INVALID_JSON');
  const { projectId } = await ctx.params;
  let projectUuid: string;
  try { projectUuid = uuidFromAppId(projectId, 'proj'); } catch { return commandJsonError('Invalid projectId', 400, diagnostics, 'INVALID_PROJECT'); }
  const ownerKey = parsed.body?.ownerKey === null
    ? null
    : typeof parsed.body?.ownerKey === 'string'
      ? parsed.body.ownerKey.trim().toLowerCase()
      : '';
  const commandId = typeof parsed.body?.commandId === 'string' ? parsed.body.commandId.trim() : '';
  const expectedVersion = typeof parsed.body?.expectedVersion === 'string' ? parsed.body.expectedVersion : null;
  if ((ownerKey !== null && !isProjectOwnerKey(ownerKey)) || !isUuid(commandId)) {
    return commandJsonError('Invalid owner command', 400, diagnostics, 'INVALID_COMMAND');
  }
  try {
    const result = await auth.supabase.rpc('project_command_set_owner', {
      p_project_id: projectUuid,
      p_owner_key: ownerKey || null,
      p_command_id: commandId,
      p_expected_updated_at: expectedVersion,
    });
    if (result.error) throw result.error;
    try {
      const commandCentre = await getProjectCommandCentre(projectId, auth.supabase, {
        userId: auth.session.user.id,
        isAdmin: auth.session.role === 'admin',
      });
      if (!commandCentre) return commandJsonError('Project not found', 404, diagnostics, 'NOT_FOUND');
      return commandJsonOk({ command: { id: commandId, committed: true, replayed: Boolean((result.data as any)?.[0]?.replayed) }, commandCentre }, diagnostics);
    } catch (refreshError) {
      logPortalServerError(diagnostics, { status: 200, message: 'Owner changed but refresh failed', error: refreshError });
      return commandJsonOk({ command: { id: commandId, committed: true }, refreshRequired: true }, diagnostics);
    }
  } catch (error) {
    const mapped = commandDatabaseError(error);
    if (mapped.status === 500) logPortalServerError(diagnostics, { status: 500, message: 'Owner command failed', error });
    return commandJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
