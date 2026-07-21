import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { requireStaffContext } from '@/lib/api/staffApi';
import { getProjectCommandExceptions } from '@/lib/projects/commandCentre/getProjectCommandExceptions';
import { commandJsonError, commandJsonOk, privateNoStore } from '@/lib/projects/commandCentre/routeSupport';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/dashboard/project-exceptions');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return privateNoStore(auth.response);
  try {
    return commandJsonOk(await getProjectCommandExceptions(auth.supabase, {
      userId: auth.session.user.id,
      isAdmin: auth.session.role === 'admin',
    }), diagnostics);
  } catch (error) {
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load project exceptions', error });
    return commandJsonError('Failed to load project exceptions', 500, diagnostics, 'EXCEPTIONS_FAILED');
  }
}
