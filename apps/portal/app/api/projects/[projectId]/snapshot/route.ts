import { NextResponse } from 'next/server';
import {
  applyRouteDiagnostics,
  createRouteDiagnostics,
  logPortalServerError,
  measureRouteStep,
} from '@/lib/api/routeDiagnostics';
import { jsonError, requireStaffContext } from '@/lib/api/staffApi';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';
import { getProjectCommandCentre } from '@/lib/projects/commandCentre/getProjectCommandCentre';

export const runtime = 'nodejs';

function privateNoStore(response: Response): Response {
  response.headers.set('cache-control', 'private, no-store');
  return response;
}

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/projects/[projectId]/snapshot');
  const auth = await measureRouteStep(diagnostics, 'auth', () => requireStaffContext(diagnostics));
  if (!auth.ok) return privateNoStore(auth.response);

  const { projectId } = await ctx.params;
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!id) return privateNoStore(jsonError('Invalid projectId', 400, diagnostics));

  try {
    const commandCentreRead = getProjectCommandCentre(id, auth.supabase, {
      userId: auth.session.user.id,
      isAdmin: auth.session.role === 'admin',
    }, diagnostics);
    const snapshot = await getProjectPageSnapshot(
      id,
      diagnostics,
      auth.supabase,
      auth.session.user.id,
      commandCentreRead,
    );
    if (!snapshot) return privateNoStore(jsonError('Project not found', 404, diagnostics));

    return privateNoStore(
      applyRouteDiagnostics(NextResponse.json({
        snapshot,
        generatedAt: new Date().toISOString(),
      }), diagnostics),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load project snapshot';
    logPortalServerError(diagnostics, {
      status: 500,
      message: msg,
      error: err,
    });
    return privateNoStore(jsonError(msg, 500, diagnostics));
  }
}
