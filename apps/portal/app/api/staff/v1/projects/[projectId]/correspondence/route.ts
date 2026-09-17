import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getProjectPageSummary } from '@/lib/projects/getProjectPageSnapshot';
import { correspondenceGatewayConfig, readStaffCorrespondence } from '@/lib/projects/correspondence/gateway';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { resolvePortalAccessState, type PortalAccessLookup } from '@/lib/portalAccess';
import { readProjectSendAnchors } from '@/lib/projects/correspondence/projectSendAnchors';
import { associateCorrespondenceContext } from '@/lib/projects/correspondence/associateContext';

export const runtime = 'nodejs';
type Context = { params: Promise<{ projectId: string }> };
function privateResponse(response: Response) {
  response.headers.set('cache-control', 'private, no-store, max-age=0');
  response.headers.set('vary', 'Cookie, Origin');
  response.headers.set('referrer-policy', 'no-referrer');
  return response;
}

async function hasBodyBytes(request: Request): Promise<boolean> {
  // Hosted Request adapters may expose a stream even for an empty POST.
  // Reject actual bytes immediately rather than trusting Content-Length.
  if (!request.body) return false;
  const reader = request.body.getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) return false;
      if (chunk.value.byteLength > 0) return true;
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
}

async function handle(request: Request, context: Context, check: boolean) {
  const diagnostics = createRouteDiagnostics(request, '/api/staff/v1/projects/[projectId]/correspondence');
  const fail = (message: string, status: number) => privateResponse(jsonError(message, status, diagnostics));
  try {
    const auth = await requireStaffContext(diagnostics);
    if (!auth.ok) return privateResponse(auth.response);
    const { projectId } = await context.params;
    if (!isUuid(projectId) && !(projectId.startsWith('proj_') && isUuid(projectId.slice(5)))) return fail('Invalid projectId', 400);
    const projectUuid = uuidFromAppId(projectId, 'proj');
    const url = new URL(request.url);
    const analyze = url.search === '?analyze=true';
    if (url.search && (!check || !analyze)) return fail('Unexpected correspondence parameters', 400);
    if (check) {
      // No supplied email, actor, summary or provider input.
      if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return fail('Forbidden', 403);
      if (await hasBodyBytes(request)) return fail('Unexpected correspondence body', 400);
    }
    const summary = await getProjectPageSummary(projectId, diagnostics, auth.supabase);
    if (!summary) return fail('Project not found', 404);
    const config = correspondenceGatewayConfig();
    if (!check || !config) return privateResponse(jsonOk({ state: config ? 'available' : 'not_connected' }, 200, diagnostics));
    const result = await readStaffCorrespondence(config, { actorId: auth.session.user.id, projectId: projectUuid, ...(analyze ? { analyze: true } : {}) }, request.signal);
    // Old receivers lack lineage. Avoid provider reads until there is evidence to join.
    const anchors = result.messages?.some(message => message.lineage)
      ? await readProjectSendAnchors(auth.supabase, projectUuid, request.signal)
      : { anchors: [], incomplete: true };
    const associated = associateCorrespondenceContext(result, projectUuid, anchors);
    const currentAccess = await resolvePortalAccessState(auth.supabase as unknown as PortalAccessLookup);
    if (currentAccess.kind !== 'authenticated' || currentAccess.session.user.id !== auth.session.user.id) return fail('Project access changed', 403);
    if (!await getProjectPageSummary(projectId, diagnostics, auth.supabase)) return fail('Project not found', 404);
    return privateResponse(jsonOk({ state: 'ready', context: associated }, 200, diagnostics));
  } catch {
    return fail('Customer conversations could not be checked', 503);
  }
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
