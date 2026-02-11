import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyJobForecastUpdates,
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
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const durationRaw = body.forecast_duration_days;
  const force = Boolean(body.force);

  if (!jobId) return jsonError('job_id is required', 400);

  const durationDays = ensureForecastDurationDays(durationRaw, 1);

  const byProjectRes = await supabaseServer.from('scheduled_jobs').select('*').eq('job_id', jobId).maybeSingle();
  if (byProjectRes.error) {
    if (isMissingSchemaError(byProjectRes.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load scheduled job', 500);
  }
  let jobRow = byProjectRes.data;
  if (!jobRow) {
    const byIdRes = await supabaseServer.from('scheduled_jobs').select('*').eq('id', jobId).maybeSingle();
    if (byIdRes.error) return jsonError('Failed to load scheduled job', 500);
    jobRow = byIdRes.data;
  }

  if (!jobRow) return jsonError('Scheduled job not found', 404);

  const crewId = String(jobRow.crew_id);

  let ctx;
  try {
    ctx = await loadScheduleContext({ crewId, today: typeof body.today === 'string' && isYmd(body.today) ? body.today : undefined });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load schedule data', 500);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) return jsonError('Crew not found', 404);

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
    return jsonOk({ requires_confirmation: true, impacts });
  }

  await supabaseServer.from('scheduled_jobs').update({ forecast_duration_days: durationDays } as any).eq('id', jobRow.id);

  await applyJobForecastUpdates(afterRecompute.job_updates);

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
  });
}
