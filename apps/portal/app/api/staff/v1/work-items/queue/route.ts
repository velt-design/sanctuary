import { createRouteDiagnostics, logPortalServerError, measureRouteStep } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getProjectWorkQueue } from '@/lib/projects/workItems/repository';
import {
  privateNoStore,
  workDatabaseError,
  workJsonError,
  workJsonOk,
} from '@/lib/projects/workItems/routeSupport';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/work-items/queue');
  const auth = await measureRouteStep(diagnostics, 'auth', () => requireStaffContext(diagnostics));
  if (!auth.ok) return privateNoStore(auth.response);
  const rawLimit = new URL(req.url).searchParams.get('limit');
  const limit = rawLimit === null ? null : Number(rawLimit);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
    return workJsonError('limit must be an integer between 1 and 50', 400, diagnostics, 'INVALID_LIMIT');
  }
  try {
    const queue = await measureRouteStep(diagnostics, 'work_queue', () =>
      limit === null
        ? getProjectWorkQueue(auth.supabase, { diagnostics })
        : getProjectWorkQueue(auth.supabase, { limit, diagnostics }));
    return workJsonOk(queue, diagnostics);
  } catch (error) {
    const mapped = workDatabaseError(error);
    if (mapped.status === 500) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: 'Failed to load project work queue',
        error,
      });
    }
    return workJsonError(mapped.message, mapped.status, diagnostics, mapped.code);
  }
}
