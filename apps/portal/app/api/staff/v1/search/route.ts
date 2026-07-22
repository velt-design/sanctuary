import { jsonError, jsonOk } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import {
  PORTAL_SEARCH_MAX_LENGTH,
  PORTAL_SEARCH_MIN_LENGTH,
} from '@/lib/search/portalSearchContract';
import {
  PortalSearchAccessError,
  searchPortalForRequest,
} from '@/lib/search/serverPortalSearch';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/search');
  const query = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (query.length < PORTAL_SEARCH_MIN_LENGTH) {
    return jsonError(`q must be at least ${PORTAL_SEARCH_MIN_LENGTH} characters`, 400, diagnostics);
  }
  if (query.length > PORTAL_SEARCH_MAX_LENGTH) {
    return jsonError(`q must be at most ${PORTAL_SEARCH_MAX_LENGTH} characters`, 400, diagnostics);
  }

  try {
    const results = await searchPortalForRequest(query);
    const response = jsonOk(
      { query, ...results, generatedAt: new Date().toISOString() },
      200,
      diagnostics,
    );
    response.headers.set('cache-control', 'private, no-store');
    return response;
  } catch (error) {
    if (error instanceof PortalSearchAccessError) {
      return jsonError(error.message, error.status, diagnostics);
    }
    logPortalServerError(diagnostics, {
      event: 'portal.search.load_failed',
      status: 500,
      message: 'Failed to search the portal',
      error,
    });
    return jsonError('Failed to search the portal', 500, diagnostics);
  }
}
