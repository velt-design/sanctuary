import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { studioIdentifier } from '@/lib/designStudio/identifiers';
import { loadStudioProject } from '@/lib/queries/studioProject.server';

/** Caller-RLS read only. GET never creates a design. */
async function read(request: Request, context: { params: Promise<{ projectId: string }> }) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (!['staff', 'admin'].includes(auth.session.role)) return jsonError('Staff access required', 403);
  try {
    const project = studioIdentifier((await context.params).projectId, 'proj');
    const saved = await loadStudioProject(auth.supabase, project.uuid);
    request.signal.throwIfAborted();
    if (!saved) return jsonError('Project not found', 404);
    if (saved.loadError) return jsonError('Design history could not be checked. Try again.', 503);
    return jsonOk({ projectId: project.appId, ...saved });
  } catch { return jsonError('Designs could not be loaded. Try again.', 503); }
}
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const response = await read(request, context);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
