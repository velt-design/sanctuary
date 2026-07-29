import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { commitScheduleJobPatch } from '@/lib/scheduling/scheduleCommands';
import {
  isCalendarYmd,
  isCanonicalScheduleUuid,
  MAX_SCHEDULE_DURATION_DAYS,
  parseScheduleForce,
} from '@/lib/scheduling/scheduleMutationRequest';
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

const SCHEMA_NOT_READY_MESSAGE = 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/adjust');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id : '';
  const requestedStart = typeof body.requested_start_date === 'string' ? body.requested_start_date : '';
  const durationDays = body.forecast_duration_days;

  if (!isCanonicalScheduleUuid(jobId)) return jsonError('job_id must be a UUID', 400, diagnostics);
  if (!isCalendarYmd(requestedStart)) {
    return jsonError('requested_start_date must be a valid YYYY-MM-DD date', 400, diagnostics);
  }
  if (
    !Number.isSafeInteger(durationDays) ||
    durationDays < 1 ||
    durationDays > MAX_SCHEDULE_DURATION_DAYS
  ) {
    return jsonError(
      `forecast_duration_days must be an integer between 1 and ${MAX_SCHEDULE_DURATION_DAYS}`,
      400,
      diagnostics,
    );
  }
  const parsedForce = parseScheduleForce(body.force);
  if (!parsedForce.ok) return jsonError(parsedForce.error, 400, diagnostics);
  if (body.today !== undefined && !isCalendarYmd(body.today)) {
    return jsonError('today must be a valid YYYY-MM-DD date', 400, diagnostics);
  }

  const force = parsedForce.value;
  const today = typeof body.today === 'string' ? body.today : undefined;

  const byProjectRes = await supabase.from('scheduled_jobs').select('*').eq('job_id', jobId).maybeSingle();
  if (byProjectRes.error) {
    if (isMissingSchemaError(byProjectRes.error)) {
      logPortalServerWarn(diagnostics, { status: 501, message: SCHEMA_NOT_READY_MESSAGE, error: byProjectRes.error });
      return jsonError(SCHEMA_NOT_READY_MESSAGE, 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load scheduled job', error: byProjectRes.error });
    return jsonError('Failed to load scheduled job', 500, diagnostics);
  }

  let jobRow = byProjectRes.data;
  if (!jobRow) {
    const byIdRes = await supabase.from('scheduled_jobs').select('*').eq('id', jobId).maybeSingle();
    if (byIdRes.error) {
      if (isMissingSchemaError(byIdRes.error)) {
        logPortalServerWarn(diagnostics, { status: 501, message: SCHEMA_NOT_READY_MESSAGE, error: byIdRes.error });
        return jsonError(SCHEMA_NOT_READY_MESSAGE, 501, diagnostics);
      }
      logPortalServerError(diagnostics, { status: 500, message: 'Failed to load scheduled job', error: byIdRes.error });
      return jsonError('Failed to load scheduled job', 500, diagnostics);
    }
    jobRow = byIdRes.data;
  }

  if (!jobRow) return jsonError('Scheduled job not found', 404, diagnostics);
  const currentStatus = typeof jobRow.status === 'string' ? jobRow.status.trim().toLowerCase() : '';
  if (currentStatus === 'in_progress' || currentStatus === 'paused' || currentStatus === 'done') {
    return jsonError('Only not-started jobs can be moved or resized.', 409, diagnostics);
  }

  const scheduledJobId = String(jobRow.id);
  const crewId = String(jobRow.crew_id);

  let context;
  try {
    context = await loadScheduleContext({ crewId, today });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      logPortalServerWarn(diagnostics, { status: 501, message: SCHEMA_NOT_READY_MESSAGE, error });
      return jsonError(SCHEMA_NOT_READY_MESSAGE, 501, diagnostics);
    }
    logPortalServerError(diagnostics, { status: 500, message: 'Failed to load schedule data', error });
    return jsonError('Failed to load schedule data', 500, diagnostics);
  }

  const crewContext = buildCrewContext(context, crewId);
  if (!crewContext) return jsonError('Crew not found', 404, diagnostics);

  const adjustedJobs = crewContext.jobs.map((job) =>
    job.id === scheduledJobId
      ? {
          ...job,
          mode: 'pinned' as const,
          forecastStart: requestedStart,
          forecastDurationDays: durationDays,
        }
      : job,
  );

  const afterRecompute = recomputeForCrew({
    crewRow: crewContext.crewRow,
    items: crewContext.items,
    jobs: adjustedJobs,
    downtimes: crewContext.downtimes,
    calendar: context.calendar,
    today: context.today,
  });

  const impacts = computeCommitImpacts({
    before: crewContext.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(adjustedJobs),
    today: context.today,
    horizonDays: 10,
    region: crewContext.crewRow.calendar_region || 'Auckland',
    calendar: context.calendar,
  }).filter((impact) => String(impact.scheduled_job_id) !== scheduledJobId);

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const pinnedStart = snapToday(requestedStart, crewContext.crewRow.calendar_region || 'Auckland', context.calendar);
  const commitResult = await commitScheduleJobPatch({
    diagnostics,
    scheduledJobId,
    jobPatch: {
      mode: 'pinned',
      forecast_start: pinnedStart,
      forecast_duration_days: durationDays,
    },
    forecastUpdates: afterRecompute.job_updates,
    failureMessage: 'Failed to adjust scheduled job',
  });
  if (!commitResult.ok) return jsonError(commitResult.responseMessage, commitResult.status, diagnostics);

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewContext.crewRow,
    recompute: afterRecompute,
    jobsById: new Map(adjustedJobs.map((job) => [job.id, job])),
    downtimesById: crewContext.downtimesById,
  });

  return jsonOk(
    {
      ok: true,
      crew_id: crewId,
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    },
    200,
    diagnostics,
  );
}
