import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getPortalStaffDirectory } from '@/lib/projects/commandCentre/staffDirectory';
import { commandJsonError, commandJsonOk, privateNoStore } from '@/lib/projects/commandCentre/routeSupport';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/staff-directory');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  try {
    return commandJsonOk({ staff: await getPortalStaffDirectory(auth.supabase) }, diagnostics);
  } catch (error) {
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load staff directory', error });
    return commandJsonError('Failed to load staff directory', 500, diagnostics, 'DIRECTORY_FAILED');
  }
}
