import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError } from '@/lib/api/routeDiagnostics';
import { commitKeepOverlap } from '@/lib/scheduling/scheduleCommands';
import { isCanonicalScheduleUuid } from '@/lib/scheduling/scheduleMutationRequest';
import { buildCrewContext, formatCrewScheduleBlocks, isMissingSchemaError, loadScheduleContext } from '@/lib/scheduling/scheduleV2Server';
import { scheduleWriteGuard } from '@/lib/scheduling/scheduleWriteGuard';

export const runtime = 'nodejs';
export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/overlap/keep');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const { crew_id: crewId, overlap_key: overlapKey } = parsed.body ?? {};
  if (!isCanonicalScheduleUuid(crewId) || typeof overlapKey !== 'string' || !overlapKey || overlapKey.length > 300) return jsonError('A crew and exact overlap are required', 400, diagnostics);
  try {
    const context = await loadScheduleContext({ crewId });
    const crew = buildCrewContext(context, crewId);
    if (!crew) return jsonError('Crew not found', 404, diagnostics);
    const conflict = crew.recompute.conflicts.find((item) => item.overlap_key === overlapKey);
    if (!conflict && !crew.jobs.some((job) => job.acceptedOverlaps?.includes(overlapKey))) return jsonError('These dates have changed. Refresh and review the overlap again.', 409, diagnostics);
    if (conflict) {
      const result = await commitKeepOverlap({ diagnostics, writeGuard: scheduleWriteGuard(context, [crewId]), scheduledJobId: conflict.job_id, overlapKey });
      if (!result.ok) return jsonError(result.responseMessage, result.status, diagnostics);
    }
    const schedule = formatCrewScheduleBlocks({ crewRow: crew.crewRow, recompute: { ...crew.recompute, conflicts: crew.recompute.conflicts.filter((item) => item.overlap_key !== overlapKey) }, jobsById: crew.jobsById, downtimesById: crew.downtimesById });
    return jsonOk({ ok: true, crew_id: crewId, schedule, conflicts: schedule.conflicts, next_available_date: schedule.next_available_date }, 200, diagnostics);
  } catch (error) {
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to keep overlap', error });
    return jsonError(isMissingSchemaError(error) ? 'Schedule schema needs upgrading.' : 'Failed to keep overlap', isMissingSchemaError(error) ? 501 : 500, diagnostics);
  }
}
