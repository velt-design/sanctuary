import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isMissingSchemaError, loadScheduledJobRow, normalizeClientUpdateStatus } from '@/lib/scheduling/scheduleV2Server';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  if (!jobId) return jsonError('job_id is required', 400);

  let jobRow: any = null;
  try {
    jobRow = await loadScheduledJobRow(jobId);
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load scheduled job', 500);
  }

  if (!jobRow) return jsonError('Scheduled job not found', 404);

  const nowIso = new Date().toISOString();
  const actor = (session.user?.email || '').trim() || null;

  const currentStatus = normalizeClientUpdateStatus(jobRow.client_update_status);
  if (currentStatus === 'acknowledged') {
    return jsonOk({ ok: true, status: 'acknowledged', client_update_ack_at: jobRow.client_update_ack_at ?? nowIso, client_update_ack_by: jobRow.client_update_ack_by ?? actor });
  }

  const updateRes = await supabaseServer
    .from('scheduled_jobs')
    .update({
      client_update_status: 'acknowledged',
      client_update_ack_at: nowIso,
      client_update_ack_by: actor,
    } as any)
    .eq('id', jobRow.id);

  if (updateRes.error) {
    if (isMissingSchemaError(updateRes.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to acknowledge client update', 500);
  }

  return jsonOk({
    ok: true,
    status: 'acknowledged',
    client_update_ack_at: nowIso,
    client_update_ack_by: actor,
  });
}
