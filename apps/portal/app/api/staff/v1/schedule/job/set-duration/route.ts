import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { isYmd } from '@/lib/scheduling/date';
import { commitScheduleJobPatch } from '@/lib/scheduling/scheduleCommands';
import {
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  ensureForecastDurationDays,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/set-duration');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const durationRaw = body.forecast_duration_days;
  const force = Boolean(body.force);

  if (!jobId) return jsonError('job_id is required', 400, diagnostics);

  const durationDays = ensureForecastDurationDays(durationRaw, 1);

  const byProjectRes = await supabaseServer.from('scheduled_jobs').select('*').eq('job_id', jobId).maybeSingle();
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
    const byIdRes = await supabaseServer.from('scheduled_jobs').select('*').eq('id', jobId).maybeSingle();
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

  const jobs = crewCtx.jobs.map((job) => (job.id === jobRow.id ? { ...job, forecastDurationDays: durationDays } : job));

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: crewCtx.items,
    jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(jobs),
    today: ctx.today,
    horizonDays: 10,
    region: crewCtx.crewRow.calendar_region || 'Auckland',
    calendar: ctx.calendar,
  });

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const commitRes = await commitScheduleJobPatch({
    diagnostics,
    scheduledJobId: String(jobRow.id),
    jobPatch: { forecast_duration_days: durationDays },
    forecastUpdates: afterRecompute.job_updates,
    failureMessage: 'Failed to update scheduled job duration',
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
