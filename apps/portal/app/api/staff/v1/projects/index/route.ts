import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import {
  loadProjectsIndexData,
  ProjectsIndexSchemaError,
} from '@/lib/projects/serverProjectsIndex';
import {
  isProjectsIndexArchiveFilter,
  isProjectsIndexJourneyFilter,
  isProjectsIndexStateFilter,
  isProjectsIndexStatusFilter,
  isProjectsIndexSort,
  parseProjectsIndexPageSize,
} from '@/lib/projects/projectsIndexContract';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/projects/index');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;

  const searchParams = new URL(req.url).searchParams;
  const rawArchive = searchParams.get('archive')?.trim().toLowerCase() || 'active';
  if (!isProjectsIndexArchiveFilter(rawArchive)) {
    return jsonError('archive must be active, archived, or all', 400, diagnostics);
  }
  const search = searchParams.get('q')?.trim() ?? '';
  const rawStatus = (
    searchParams.get('stage')
    ?? searchParams.get('status')
    ?? 'all'
  ).trim().toUpperCase();
  const status = rawStatus === 'ALL' ? 'all' : rawStatus;
  const rawJourney = (searchParams.get('journey')?.trim() || 'all').toUpperCase();
  const journey = rawJourney === 'ALL' ? 'all' : rawJourney;
  const explicitState = searchParams.has('state');
  const rawState = (searchParams.get('state')?.trim() || 'all').toUpperCase();
  const requestedState = rawState === 'ALL' ? 'all' : rawState;
  const state = explicitState
    ? requestedState
    : rawArchive === 'archived'
      ? 'ARCHIVED'
      : 'all';
  const archive = explicitState
    ? state === 'all'
      ? rawArchive
      : state === 'ARCHIVED'
      ? 'archived'
      : 'active'
    : rawArchive;
  const page = Number(searchParams.get('page') ?? 1);
  const pageSize = parseProjectsIndexPageSize(searchParams.get('pageSize')) ?? 50;
  const sort = searchParams.get('sort')?.trim() || 'newest';
  if (search.length > 80) return jsonError('q must be 80 characters or fewer', 400, diagnostics);
  if (!isProjectsIndexStatusFilter(status)) return jsonError('Invalid project stage', 400, diagnostics);
  if (!isProjectsIndexJourneyFilter(journey)) return jsonError('Invalid project journey', 400, diagnostics);
  if (!isProjectsIndexStateFilter(state)) return jsonError('Invalid project state', 400, diagnostics);
  if (!Number.isInteger(page) || page < 1) return jsonError('page must be a positive integer', 400, diagnostics);
  if (!isProjectsIndexSort(sort)) return jsonError('Invalid projects sort', 400, diagnostics);

  try {
    const params = {
      archive,
      search,
      status,
      journey,
      state,
      page,
      pageSize,
      sort,
    } as const;
    const { projects, contacts } = await loadProjectsIndexData(params, auth.supabase);
    const response = jsonOk(
      {
        archive,
        projects,
        contacts,
        query: { search, status, journey, state, sort },
        generatedAt: new Date().toISOString(),
      },
      200,
      diagnostics,
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof ProjectsIndexSchemaError) {
      return jsonError(error.message, 503, diagnostics, {
        code: 'PROJECTS_INDEX_SCHEMA_NOT_READY',
      });
    }
    logPortalServerError(diagnostics, {
      event: 'projects.index.load_failed',
      status: 500,
      message: 'Failed to load projects',
      error,
    });
    return jsonError('Failed to load projects', 500, diagnostics);
  }
}
