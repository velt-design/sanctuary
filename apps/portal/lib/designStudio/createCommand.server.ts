import 'server-only';
import { randomUUID } from 'node:crypto';
import { jsonError, jsonOk, requireStaffContext } from '@/lib/api/staffApi';
import { getSupabaseServiceRole } from '@/lib/supabaseClient';
import { studioIdentifier } from './identifiers';
import { parseStudioCreateCommand, type StudioCreateReceipt } from './createCommand';
import { prepareStudioCreation } from './createPreparation';
import { readStudioRequestBody } from './readRequestBody.server';

const errors: Record<string, { status: number; message: string }> = {
  studio_staff_required: { status: 403, message: 'Staff access is required.' },
  studio_project_unavailable: { status: 404, message: 'This project is unavailable for new designs.' },
  studio_source_unavailable: { status: 404, message: 'The source design is unavailable.' },
  studio_stale: { status: 409, message: 'The source design changed. Reopen it before creating a revision.' },
  studio_request_conflict: { status: 409, message: 'This request identifier belongs to another creation request.' },
  studio_invalid_payload: { status: 409, message: 'This source needs a supported import before a new revision can be created.' },
  studio_invalid_creation: { status: 409, message: 'This source needs a supported import before a new revision can be created.' },
  studio_scope_conflict: { status: 409, message: 'The new scope could not be created. Start a fresh creation request.' },
};

async function create(request: Request, rawProjectId: string) {
  if (process.env.ENABLE_PORTAL_DESIGN_STUDIO !== '1') return jsonError('Not found', 404);
  if (request.method !== 'POST') return jsonError('Method not allowed', 405);
  const auth = await requireStaffContext();
  if (!auth.ok) return auth.response;
  if (auth.session.role !== 'staff' && auth.session.role !== 'admin') return jsonError('Staff access is required', 403);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return jsonError('Request origin is not allowed', 403);
  let project: ReturnType<typeof studioIdentifier>;
  try { project = studioIdentifier(rawProjectId, 'proj'); } catch { return jsonError('Invalid project identifier', 400); }
  let raw: unknown;
  try { raw = await readStudioRequestBody(request, 8192); } catch { return jsonError('Invalid or oversized creation request', 400); }
  const command = parseStudioCreateCommand(raw);
  if (!command) return jsonError('Invalid creation request', 400);
  if(command.mode!=='blank'&&command.mode!=='clone')return jsonError('Historical estimates are review-only in this Studio. Open their established calculator for specialist changes.',422);

  const visible = await auth.supabase.from('projects').select('id').eq('id', project.uuid).maybeSingle();
  if (visible.error) return jsonError('Could not verify project access', 503);
  if (visible.data?.id !== project.uuid) return jsonError('Project not found', 404);
  let source: unknown = null;
  const sourceId = command.mode !== 'blank' ? studioIdentifier(command.sourceEstimateId, 'est').uuid : null;
  if (sourceId) {
    // Only a caller-visible source can prepare a new clone. No privileged source read.
    const result = await auth.supabase.from('estimates').select('*').eq('id', sourceId).eq('project_id', project.uuid).maybeSingle();
    if (result.error) return jsonError('Could not verify source access', 503);
    source = result.data;
  }
  const prepared = prepareStudioCreation(command.mode === 'blank'
    ? { mode: 'blank', projectId: project.appId, designId: randomUUID(), commercialScopeId: command.scope === 'base' ? null : randomUUID(), ...(Object.hasOwn(command, 'internalName') ? { internalName: command.internalName } : {}) }
    : { mode: 'clone', projectId: project.appId, designId: randomUUID(), source, ...(Object.hasOwn(command, 'internalName') ? { internalName: command.internalName } : {}) });
  const result = await getSupabaseServiceRole().rpc('studio_authored_create', {
    p_project_id: project.uuid, p_actor_user_id: auth.session.user.id, p_request_id: command.requestId,
    p_source_estimate_id: sourceId, p_client_request: command,
    // Exact previous receipts can still replay after a source changes or becomes unsupported.
    // Null preparation cannot create a new row.
    p_prepared: prepared.ok ? prepared.prepared.row : null,
    p_source_proof: prepared.ok ? prepared.prepared.sourceSnapshot : null,
  });
  if (result.error) {
    const known = errors[result.error.message];
    return known ? jsonError(known.message, known.status)
      : jsonError('Creation could not be confirmed. Retry this same request.', 503);
  }
  const row = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : null;
  let estimateId: string;
  try { estimateId = studioIdentifier(row?.estimate_id, 'est').appId; } catch { return jsonError('Creation could not be confirmed. Retry this same request.', 503); }
  if (!row || row.revision !== 1 || typeof row.design_id !== 'string' || !row.design_id.trim() || row.design_id.length > 200 ||
    typeof row.saved_at !== 'string' || !Number.isFinite(Date.parse(row.saved_at)) || typeof row.already_existed !== 'boolean' ||
    (!prepared.ok && !row.already_existed)) return jsonError('Creation could not be confirmed. Retry this same request.', 503);
  if (command.mode !== 'blank' && estimateId === command.sourceEstimateId) return jsonError('Creation could not be confirmed. Retry this same request.', 503);
  if (!row.already_existed && prepared.ok &&
    (prepared.prepared.row.outputs.studio_authored as { designId: string }).designId !== row.design_id) {
    return jsonError('Creation could not be confirmed. Retry this same request.', 503);
  }
  const receipt: StudioCreateReceipt = { estimateId, designId: row.design_id, revision: 1, savedAt: row.saved_at, alreadyExisted: row.already_existed };
  return jsonOk({ receipt, pricing: 'unpriced' });
}

export async function createStudioAuthoredRequest(request: Request, projectId: string) {
  let response: Response;
  try { response = await create(request, projectId); }
  catch { response = jsonError('Creation could not be confirmed. Retry this same request.', 503); }
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
