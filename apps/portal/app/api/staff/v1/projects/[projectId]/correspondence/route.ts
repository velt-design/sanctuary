import { createRouteDiagnostics } from '@/lib/api/routeDiagnostics';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { readProjectCorrespondenceIdentity } from '@/lib/projects/correspondence/projectCorrespondenceIdentity';
import { correspondenceGatewayConfig, readStaffCorrespondence } from '@/lib/projects/correspondence/gateway';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { resolvePortalAccessState, type PortalAccessLookup } from '@/lib/portalAccess';
import { readProjectSendAnchors } from '@/lib/projects/correspondence/projectSendAnchors';
import { associateCorrespondenceContext } from '@/lib/projects/correspondence/associateContext';
import { createHash } from 'node:crypto';

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
  const timings: string[] = [];
  async function measure<T>(phase: string, operation: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try { return await operation(); }
    finally { timings.push(`${phase};dur=${(performance.now() - started).toFixed(1)}`); }
  }
  const respond = (response: Response) => {
    // Fixed phase names and durations only: no email, provider IDs or cache keys.
    response.headers.set('server-timing', timings.join(', '));
    return privateResponse(response);
  };
  const fail = (message: string, status: number) => respond(jsonError(message, status, diagnostics));
  try {
    const auth = await measure('auth', () => requireStaffContext(diagnostics));
    if (!auth.ok) return respond(auth.response);
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
    const summary = await measure('identity', () => readProjectCorrespondenceIdentity(projectId, auth.supabase));
    if (!summary) return fail('Project not found', 404);
    const config = correspondenceGatewayConfig();
    const customerEmail = summary.project.contactEmail?.trim().toLowerCase();
    if (!config || (!check && (!config.snapshotsEnabled || !customerEmail))) return respond(jsonOk({ state: config ? 'available' : 'not_connected' }, 200, diagnostics));
    const identityHash = createHash('sha256').update(JSON.stringify([summary.project.contactId ?? null,
      summary.project.contactEmail?.trim().toLowerCase() ?? null])).digest('hex');
    const result = await measure('mail', () => readStaffCorrespondence(config, { actorId: auth.session.user.id, projectId: projectUuid, ...(analyze ? { analyze: true } : {}),
      ...(config.snapshotsEnabled && customerEmail && !analyze ? { snapshot: { identityHash, customerEmail, refresh: check } } : {}) }, request.signal));
    if (!result) return respond(jsonOk({ state: 'available' }, 200, diagnostics));
    if ('state' in result) return respond(jsonOk({ state: 'refreshing' }, 200, diagnostics));
    // Old receivers lack lineage. Avoid provider reads until there is evidence to join.
    const anchors = result.messages?.some(message => message.lineage)
      ? await measure('matching', () => readProjectSendAnchors(auth.supabase, projectUuid, request.signal))
      : { anchors: [], incomplete: true };
    const associated = associateCorrespondenceContext(result, projectUuid, anchors);
    const currentAccess = await measure('access_recheck', () => resolvePortalAccessState(auth.supabase as unknown as PortalAccessLookup));
    if (currentAccess.kind !== 'authenticated' || currentAccess.session.user.id !== auth.session.user.id) return fail('Project access changed', 403);
    const currentSummary = await measure('identity_recheck', () => readProjectCorrespondenceIdentity(projectId, auth.supabase));
    if (!currentSummary) return fail('Project not found', 404);
    const currentIdentity = createHash('sha256').update(JSON.stringify([currentSummary.project.contactId ?? null,
      currentSummary.project.contactEmail?.trim().toLowerCase() ?? null])).digest('hex');
    if (currentIdentity !== identityHash) return fail('Project customer changed; check conversations again', 409);
    return respond(jsonOk({ state: 'ready', context: associated }, 200, diagnostics));
  } catch {
    return fail('Customer conversations could not be checked', 503);
  }
}
export const GET = (request: Request, context: Context) => handle(request, context, false);
export const POST = (request: Request, context: Context) => handle(request, context, true);
