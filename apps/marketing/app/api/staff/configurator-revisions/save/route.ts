import { prepareStaffConfiguratorRevision } from '../../../../../lib/staffConfiguratorRevisionPreparation.server';
import { readBoundedJson } from '../../../../../lib/marketingPublicRequest';
import { getServiceSupabase } from '../../../../../lib/supabaseService';

export const runtime = 'nodejs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const json = (body: Record<string, unknown>, status: number) => Response.json(body, {status,
    headers: {'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer'}});
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) return json({error: 'Staff sign-in required.'}, 401);
  const body = await readBoundedJson(request.clone(), 20000).catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error: 'Invalid revision save.'}, 422);
  const input = body as Record<string, unknown>;
  if (typeof input.requestId !== 'string' || !uuid.test(input.requestId)
    || typeof input.preparationHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.preparationHash)) {
    return json({error: 'Prepare and review the revision before saving.'}, 422);
  }
  // Reverify staff membership, source/project ownership and the current complete price.
  const preparedResponse = await prepareStaffConfiguratorRevision(request);
  if (!preparedResponse.ok) return preparedResponse;
  const prepared = await preparedResponse.json();
  if (prepared.preparationHash !== input.preparationHash) return json({error: 'The design or price changed. Review the new price before saving.', code: 'REVISION_CHANGED'}, 409);
  try {
    const saved = await getServiceSupabase().rpc('configurator_estimate_revision_create', {
      p_project_id: prepared.projectId, p_source_estimate_id: prepared.sourceEstimateId,
      p_request_id: input.requestId, p_actor_user_id: prepared.actorId, p_estimate: prepared.estimate,
    });
    if (saved.error) return json({error: saved.error.code === '23505'
      ? 'This save request was already used for a different revision.' : 'The revision could not be saved. Please retry.'}, saved.error.code === '23505' ? 409 : 503);
    const row = Array.isArray(saved.data) ? saved.data[0] : null;
    if (!row || !uuid.test(row.revision_id) || !uuid.test(row.estimate_id)) return json({error: 'The save result could not be confirmed. Retry this same request.'}, 503);
    return json({status: 'saved', projectId: prepared.projectId, revisionId: row.revision_id,
      estimateId: row.estimate_id, alreadyExisted: row.already_existed === true}, 200);
  } catch {
    return json({error: 'The revision could not be saved. Retry this same request.'}, 503);
  }
}
