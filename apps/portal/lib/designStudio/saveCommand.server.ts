import 'server-only';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getSupabaseServiceRole } from '@/lib/supabaseClient';
import { isUuid } from '@/lib/supabase/mappers';
import { studioIdentifier } from './identifiers';
import { isStudioObject, STUDIO_OUTPUT_KEY, STUDIO_SPATIAL_OUTPUT_KEY } from './contracts';
import { mergeStudioAuthoringEdit, parseStudioAuthoringEdit } from './authoringView';
import { readStudioAuthoredOutputs } from './persistence';

import { readStudioRequestBody } from './readRequestBody.server';

const commandErrors: Record<string, { status: number; code: string; message: string }> = {
  studio_stale: { status: 409, code: 'STUDIO_STALE', message: 'A newer version was saved. Reload it before saving these changes.' },
  studio_request_conflict: { status: 409, code: 'STUDIO_REQUEST_CONFLICT', message: 'This save identifier was already used for different changes.' },
  studio_estimate_referenced: { status: 409, code: 'ESTIMATE_LOCKED', message: 'A quote uses this estimate. Create a new revision to change the design.' },
  studio_identity_changed: { status: 409, code: 'STUDIO_IDENTITY_CHANGED', message: 'The original design identity cannot be changed.' },
  studio_estimate_unavailable: { status: 404, code: 'ESTIMATE_UNAVAILABLE', message: 'This estimate is no longer available for editing.' },
  studio_schema_unsupported: { status: 409, code: 'UNSUPPORTED_STUDIO_SCHEMA', message: 'This saved studio version cannot be edited by this client.' },
  studio_staff_required: { status: 403, code: 'FORBIDDEN', message: 'Staff access is required.' },
};

/** Server owns validation and the privileged, atomic command. Never accepts client prices. */
export async function saveStudioAuthoredRequest(request: Request, estimateId: string) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (auth.session.role !== 'admin' && auth.session.role !== 'staff') return jsonError('Staff access is required', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonError('Request origin is not allowed', 403);
  let estimateUuid: string;
  try { estimateUuid = studioIdentifier(estimateId, 'est').uuid; } catch { return jsonError('Invalid estimate identifier', 400); }
  let body: unknown;
  try { body = await readStudioRequestBody(request, 2 * 1024 * 1024); } catch { return jsonError('Invalid or oversized save request', 400); }
  const keys = ['requestId', 'expectedUpdatedAt', 'expectedRevision', 'edit'];
  if (!isStudioObject(body) || Object.keys(body).length !== keys.length || keys.some(key => !Object.hasOwn(body, key))
    || typeof body.requestId !== 'string' || !isUuid(body.requestId)
    || !Number.isSafeInteger(body.expectedRevision) || Number(body.expectedRevision) < 0
    || !(body.expectedUpdatedAt === null || (typeof body.expectedUpdatedAt === 'string'
      && /^\d{4}-\d{2}-\d{2}T/.test(body.expectedUpdatedAt) && Number.isFinite(Date.parse(body.expectedUpdatedAt))))) {
    return jsonError('Invalid save identity or revision', 400);
  }
  const edit = parseStudioAuthoringEdit(body.edit);
  if (!edit.ok) return jsonError(edit.message, 400, null, { code: edit.code });
  if (edit.value.revision !== body.expectedRevision) return jsonError('The edit does not match its base revision', 400);
  try {
    const source = await auth.supabase.from('estimates').select('id,project_id,outputs').eq('id', estimateUuid).maybeSingle();
    if (source.error) return jsonError('Could not verify estimate access', 503);
    if (!source.data) return jsonError('Estimate not found', 404);
    const existing = readStudioAuthoredOutputs(source.data.outputs ?? {});
    const outputs = isStudioObject(source.data.outputs) ? source.data.outputs : {};
    const merged = mergeStudioAuthoringEdit({ storedAuthored: outputs[STUDIO_OUTPUT_KEY], storedSpatial: outputs[STUDIO_SPATIAL_OUTPUT_KEY], edit: edit.value });
    // Check access with the caller first; the service client can invoke only this
    // fixed command here. Actor and project identity never come from the body.
    const result = await getSupabaseServiceRole().rpc('studio_authored_save', {
      p_project_id: source.data.project_id, p_estimate_id: estimateUuid,
      p_actor_user_id: auth.session.user.id, p_request_id: body.requestId,
      p_expected_updated_at: body.expectedUpdatedAt, p_expected_revision: body.expectedRevision,
      // A failed reconstruction may be an old exact retry after later edits.
      // SQL checks the receipt first; null cannot create a new authored revision.
      p_authored: merged.ok ? merged.value.authored : null, p_spatial: edit.value.spatial,
      // SQL compares this server-validated envelope after the receipt-replay branch.
      // Null with a present unsupported envelope cannot match, and must not overwrite it.
      p_validated_stored_authored: existing.ok && existing.state === 'authored' ? existing.authored : null,
      p_client_request: body,
    });
    if (result.error) {
      const failure = commandErrors[result.error.message];
      if (!failure && !merged.ok && result.error.message === 'studio_invalid_payload') {
        return jsonError(merged.message, 409, null, { code: merged.code });
      }
      return failure ? jsonError(failure.message, failure.status, null, { code: failure.code })
        : jsonError('Could not save this design. Keep your changes and retry the same save.', 503, null, { code: 'STUDIO_SAVE_UNAVAILABLE' });
    }
    const receipt = Array.isArray(result.data) ? result.data[0] : null;
    if (!receipt || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1
      || typeof receipt.saved_at !== 'string' || typeof receipt.already_existed !== 'boolean'
      || (!merged.ok && !receipt.already_existed)) {
      return jsonError('The save response could not be verified. Retry the same save.', 503, null, { code: 'STUDIO_SAVE_UNCERTAIN' });
    }
    return jsonOk({ receipt: { revision: receipt.revision, savedAt: receipt.saved_at, alreadyExisted: receipt.already_existed }, pricing: 'unpriced' });
  } catch {
    // A transport failure may happen after commit. Keep the same request id so
    // the database can return the original receipt rather than saving twice.
    return jsonError('Could not confirm this save. Keep your changes and retry the same save.', 503, null, { code: 'STUDIO_SAVE_UNCERTAIN' });
  }
}
