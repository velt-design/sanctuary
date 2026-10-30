import 'server-only';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { parseSiteAddressRequest } from './siteAddressContract';
import { projectSiteAddress, readProjectSiteAddress, selectProjectSiteAddress } from './siteAddress.server';
import { googleSiteAddressProvider, SiteAddressError } from './siteAddressProvider.server';
import { signStudioSelectedAddress } from '@/lib/designStudio/studioTravelReceipt.server';

async function bodyText(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      request.signal.throwIfAborted();
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 2048) {
        await reader.cancel();
        throw new SiteAddressError('Address request is too large', 413, 'ADDRESS_REQUEST_TOO_LARGE');
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

async function handle(request: Request, projectId: string) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (!['staff', 'admin'].includes(auth.session.role)) return jsonError('Staff access is required', 403);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)return jsonError('Request origin is not allowed',403);
  let projectUuid: string;
  try { projectUuid = uuidFromAppId(projectId, 'proj'); if (!isUuid(projectUuid)) throw Error('Invalid project'); }
  catch { return jsonError('Invalid project id', 400); }
  if (request.method !== 'GET' && request.method !== 'POST') return jsonError('Method not allowed', 405);
  let command: ReturnType<typeof parseSiteAddressRequest> = null;
  if (request.method === 'POST') {
    const raw = await bodyText(request);
    try { command = parseSiteAddressRequest(JSON.parse(raw)); } catch { /* Invalid JSON is a safe bounded validation error. */ }
    if (!command) return jsonError('Invalid address request. Search and select a New Zealand street address.', 400);
  }
  const current = await readProjectSiteAddress(auth.supabase, projectUuid, request.signal);
  if (!command) return jsonOk({ siteAddress: projectSiteAddress(current) });
  const provider = googleSiteAddressProvider();
  if (command.action === 'search') return jsonOk({ suggestions: await provider.search(command, request.signal) });
  const siteAddress = await selectProjectSiteAddress(auth.supabase, current, command, provider, request.signal);
  // Address persistence remains successful even when optional travel signing is unavailable.
  let selectedAddressProof = null;
  try { selectedAddressProof = signStudioSelectedAddress({projectId:siteAddress.projectId,destinationCanonical:siteAddress.address,placeId:command.placeId}); } catch { /* Travel reports its own unavailable state. */ }
  return jsonOk({ siteAddress, selectedAddressProof });
}

/** All results/errors remain private; provider response text and credentials never escape or enter logs. */
export async function projectSiteAddressRequest(request: Request, projectId: string) {
  let response: Response;
  try { response = await handle(request, projectId); }
  catch (error) {
    response = error instanceof SiteAddressError ? jsonError(error.message, error.status, null, { code: error.code })
      : jsonError('The project address is temporarily unavailable. Retry the same request.', 503, null, { code: 'ADDRESS_UNAVAILABLE' });
  }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
