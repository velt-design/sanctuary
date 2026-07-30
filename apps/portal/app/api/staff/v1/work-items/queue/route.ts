import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
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
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  try {
    const queue = await getProjectWorkQueue(auth.supabase);
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
