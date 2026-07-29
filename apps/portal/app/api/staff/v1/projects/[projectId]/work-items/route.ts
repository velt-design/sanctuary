import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getAuthoritativeProjectWorkProjection } from '@/lib/projects/workItems/getAuthoritativeProjectWorkProjection';
import {
  privateNoStore,
  workDatabaseError,
  workJsonError,
  workJsonOk,
} from '@/lib/projects/workItems/routeSupport';
import { uuidFromAppId } from '@/lib/supabase/mappers';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const diagnostics = createRouteDiagnostics(
    req,
    '/api/staff/v1/projects/[projectId]/work-items',
  );
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  const { projectId } = await context.params;
  try {
    uuidFromAppId(projectId, 'proj');
  } catch {
    return workJsonError('Invalid projectId', 400, diagnostics, 'INVALID_PROJECT');
  }

  try {
    const projectWork = await getAuthoritativeProjectWorkProjection(projectId, auth.supabase);
    if (!projectWork) {
      return workJsonError('V2 project not found', 404, diagnostics, 'NOT_FOUND');
    }
    return workJsonOk({ projectWork }, diagnostics);
  } catch (error) {
    const mapped = workDatabaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: 'Failed to load project work',
        error,
      });
    }
    return workJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
