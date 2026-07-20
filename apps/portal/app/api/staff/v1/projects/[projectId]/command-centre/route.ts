import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getProjectCommandCentre } from '@/lib/projects/commandCentre/getProjectCommandCentre';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/projects/[projectId]/command-centre');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const { projectId } = await ctx.params;
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!id) return jsonError('Invalid projectId', 400, diagnostics);

  try {
    const commandCentre = await getProjectCommandCentre(id, auth.supabase);
    if (!commandCentre) return jsonError('Project not found', 404, diagnostics);

    const response = jsonOk(commandCentre, 200, diagnostics);
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load project command centre',
      error,
    });
    return jsonError('Failed to load project command centre', 500, diagnostics);
  }
}
