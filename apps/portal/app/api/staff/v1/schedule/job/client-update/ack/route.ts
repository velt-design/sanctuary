import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { commitClientUpdateAck } from '@/lib/scheduling/scheduleCommands';
import { isMissingSchemaError, loadScheduledJobRow, normalizeClientUpdateStatus } from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/client-update/ack');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  if (!jobId) return jsonError('job_id is required', 400, diagnostics);

  let jobRow: any = null;
  try {
    jobRow = await loadScheduledJobRow(jobId);
  } catch (err) {
    if (isMissingSchemaError(err)) {
      logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: err });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load scheduled job', error: err });
    return jsonError('Failed to load scheduled job', 500, diagnostics);
  }

  if (!jobRow) return jsonError('Scheduled job not found', 404, diagnostics);

  const nowIso = new Date().toISOString();
  const actor = (session.user?.email || '').trim() || null;

  const currentStatus = normalizeClientUpdateStatus(jobRow.client_update_status);
  if (currentStatus === 'acknowledged') {
    return jsonOk({ ok: true, status: 'acknowledged', client_update_ack_at: jobRow.client_update_ack_at ?? nowIso, client_update_ack_by: jobRow.client_update_ack_by ?? actor }, 200, diagnostics);
  }

  const commitRes = await commitClientUpdateAck({
    diagnostics,
    scheduledJobId: String(jobRow.id),
    ackAt: nowIso,
    ackBy: actor,
  });
  if (!commitRes.ok) return jsonError(commitRes.responseMessage, commitRes.status, diagnostics);

  return jsonOk({
    ok: true,
    status: 'acknowledged',
    client_update_ack_at: nowIso,
    client_update_ack_by: actor,
  }, 200, diagnostics);
}
