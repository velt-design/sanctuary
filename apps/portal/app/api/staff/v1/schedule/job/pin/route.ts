import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { isYmd } from '@/lib/scheduling/date';
import { commitScheduleJobPatch } from '@/lib/scheduling/scheduleCommands';
import { excludeTargetCommitImpacts, parseScheduleForce } from '@/lib/scheduling/scheduleMutationRequest';
import {
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
  snapToday,
} from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/pin');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const requestedStart = typeof body.requested_start_date === 'string' ? body.requested_start_date.trim() : '';
  const parsedForce = parseScheduleForce(body.force);
  if (!parsedForce.ok) return jsonError(parsedForce.error, 400, diagnostics);
  const force = parsedForce.value;

  if (!jobId || !isYmd(requestedStart)) return jsonError('job_id and requested_start_date are required', 400, diagnostics);

  const byProjectRes = await supabase.from('scheduled_jobs').select('*').eq('job_id', jobId).maybeSingle();
  if (byProjectRes.error) {
    if (isMissingSchemaError(byProjectRes.error)) {
      logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: byProjectRes.error });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load scheduled job', error: byProjectRes.error });
    return jsonError('Failed to load scheduled job', 500, diagnostics);
  }
  let jobRow = byProjectRes.data;
  if (!jobRow) {
    const byIdRes = await supabase.from('scheduled_jobs').select('*').eq('id', jobId).maybeSingle();
    if (byIdRes.error) {
      if (isMissingSchemaError(byIdRes.error)) {
        logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: byIdRes.error });
        return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
      }
      logPortalServerError(diagnostics, { status: 500, message: 'Failed to load scheduled job', error: byIdRes.error });
      return jsonError('Failed to load scheduled job', 500, diagnostics);
    }
    jobRow = byIdRes.data;
  }
  if (!jobRow) return jsonError('Scheduled job not found', 404, diagnostics);

  const crewId = String(jobRow.crew_id);

  let ctx;
  try {
    ctx = await loadScheduleContext({ crewId, today: typeof body.today === 'string' && isYmd(body.today) ? body.today : undefined });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      logPortalServerWarn(diagnostics, { status: 501, message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', error: err });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load schedule data', error: err });
    return jsonError('Failed to load schedule data', 500, diagnostics);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) return jsonError('Crew not found', 404, diagnostics);

  const jobs = crewCtx.jobs.map((job) =>
    job.id === jobRow.id
      ? {
          ...job,
          mode: 'pinned' as const,
          forecastStart: requestedStart,
        }
      : job,
  );

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: crewCtx.items,
    jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const impacts = excludeTargetCommitImpacts(
    computeCommitImpacts({
      before: crewCtx.recompute,
      after: afterRecompute,
      jobMetaById: buildJobMetaMap(jobs),
      today: ctx.today,
      horizonDays: 10,
      region: crewCtx.crewRow.calendar_region || 'Auckland',
      calendar: ctx.calendar,
    }),
    { jobId, scheduledJobId: String(jobRow.id) },
  );

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const pinnedStart = snapToday(requestedStart, crewCtx.crewRow.calendar_region || 'Auckland', ctx.calendar);
  const commitRes = await commitScheduleJobPatch({
    diagnostics,
    scheduledJobId: String(jobRow.id),
    jobPatch: { mode: 'pinned', forecast_start: pinnedStart },
    forecastUpdates: afterRecompute.job_updates,
    failureMessage: 'Failed to pin scheduled job',
  });
  if (!commitRes.ok) return jsonError(commitRes.responseMessage, commitRes.status, diagnostics);

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: afterRecompute,
    jobsById: new Map(jobs.map((job) => [job.id, job])),
    downtimesById: crewCtx.downtimesById,
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
  }, 200, diagnostics);
}
