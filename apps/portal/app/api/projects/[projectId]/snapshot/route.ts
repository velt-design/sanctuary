import { NextResponse } from 'next/server';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { jsonError, requireStaffContext } from '@/lib/api/staffApi';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';

export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const diagnostics = createRouteDiagnostics(req, '/api/projects/[projectId]/snapshot');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const { projectId } = await ctx.params;
  const id = typeof projectId === 'string' ? projectId.trim() : '';
  if (!id) return jsonError('Invalid projectId', 400, diagnostics);

  try {
    const snapshot = await getProjectPageSnapshot(id, diagnostics, auth.supabase);
    if (!snapshot) return jsonError('Project not found', 404, diagnostics);

    return NextResponse.json({
      snapshot,
      generatedAt: new Date().toISOString(),
    }, {
      headers: {
        'x-portal-request-id': diagnostics.requestId,
        'server-timing': `total;dur=${(performance.now() - diagnostics.startedAt).toFixed(1)}`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load project snapshot';
    logPortalServerError(diagnostics, {
      status: 500,
      message: msg,
      error: err,
    });
    return jsonError(msg, 500, diagnostics);
  }
}
