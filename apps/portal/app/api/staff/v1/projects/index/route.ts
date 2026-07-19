import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { loadProjectsIndexData } from '@/lib/projects/serverProjectsIndex';
import { isProjectsIndexArchiveFilter } from '@/lib/projects/projectsIndexContract';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/projects/index');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const rawArchive = new URL(req.url).searchParams.get('archive')?.trim().toLowerCase() || 'active';
  if (!isProjectsIndexArchiveFilter(rawArchive)) {
    return jsonError('archive must be active, archived, or all', 400, diagnostics);
  }

  try {
    const { projects, contacts } = await loadProjectsIndexData(auth.supabase, {
      archiveFilter: rawArchive,
    });
    const response = jsonOk(
      {
        archive: rawArchive,
        projects,
        contacts,
        generatedAt: new Date().toISOString(),
      },
      200,
      diagnostics,
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    logPortalServerError(diagnostics, {
      event: 'projects.index.load_failed',
      status: 500,
      message: 'Failed to load projects',
      error,
    });
    return jsonError('Failed to load projects', 500, diagnostics);
  }
}
