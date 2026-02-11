import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyJobForecastUpdates,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  durationDaysFromEstimate,
  ensureForecastDurationDays,
  formatCrewScheduleBlocks,
  getLatestApprovedEstimate,
  insertItemAtPosition,
  isMissingSchemaError,
  loadScheduleContext,
  removeItem,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function tempId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const crewId = typeof body.crew_id === 'string' ? body.crew_id.trim() : '';
  const positionRaw = body.position;
  const force = Boolean(body.force);

  if (!jobId || !crewId) return jsonError('job_id and crew_id are required', 400);

  let existingJob: any = null;
  const existingRes = await supabaseServer.from('scheduled_jobs').select('id, crew_id, forecast_duration_days, planned_start, planned_duration_days').eq('job_id', jobId).maybeSingle();
  if (existingRes.error) {
    if (isMissingSchemaError(existingRes.error)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load scheduled job', 500);
  }
  existingJob = existingRes.data ?? null;

  const isMove = Boolean(existingJob && existingJob.crew_id && existingJob.crew_id !== crewId);

  let durationDays = ensureForecastDurationDays(existingJob?.forecast_duration_days ?? null, 1);
  if (!existingJob) {
    const estimatesRes = await supabaseServer
      .from('estimates')
      .select('id, project_id, status, created_at, version, inputs, outputs')
      .eq('project_id', jobId);
    if (estimatesRes.error) {
      if (isMissingSchemaError(estimatesRes.error)) {
        return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
      }
      return jsonError('Failed to load estimates', 500);
    }
    const estimates = Array.isArray(estimatesRes.data) ? estimatesRes.data : [];
    const latestApproved = getLatestApprovedEstimate(estimates as any);
    durationDays = durationDaysFromEstimate(latestApproved as any);
  }

  let ctx;
  try {
    ctx = await loadScheduleContext({ today: typeof body.today === 'string' && isYmd(body.today) ? body.today : undefined });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
    }
    return jsonError('Failed to load schedule data', 500);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) return jsonError('Crew not found', 404);

  const existingItem = existingJob ? crewCtx.items.find((item) => item.itemType === 'job' && item.jobId === existingJob?.id) : null;
  if (existingItem && !isMove) return jsonError('Job is already scheduled in this crew', 409);

  const jobRecordId = existingJob?.id ?? tempId('temp_job');
  const newJob = existingJob
    ? crewCtx.jobs.find((job) => job.id === existingJob.id) ?? null
    : {
        id: jobRecordId,
        jobId,
        crewId,
        mode: 'floating' as const,
        plannedStart: null,
        plannedDurationDays: null,
        forecastStart: null,
        forecastDurationDays: durationDays,
        forecastEndExclusive: null,
        actualStart: null,
        actualFinish: null,
        status: 'not_started' as const,
        daysRemaining: null,
      };

  const jobs = newJob && !existingJob ? [...crewCtx.jobs, newJob] : crewCtx.jobs.map((job) => (job.id === newJob?.id ? (newJob as any) : job));
  const position = typeof positionRaw === 'number' && Number.isFinite(positionRaw) ? Math.trunc(positionRaw) : crewCtx.items.length;
  const newItem = {
    id: tempId('temp_item'),
    crewId,
    itemType: 'job' as const,
    jobId: jobRecordId,
    downtimeId: null,
    position,
  };
  const items = insertItemAtPosition(crewCtx.items, newItem, position);

  let impacts: any[] = [];
  let afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items,
    jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });
  impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(jobs),
    today: ctx.today,
    horizonDays: 10,
    region: crewCtx.crewRow.calendar_region || 'Auckland',
    calendar: ctx.calendar,
  });

  if (isMove && existingJob?.crew_id) {
    const oldCrewId = String(existingJob.crew_id);
    const oldCrewCtx = buildCrewContext(ctx, oldCrewId);
    if (!oldCrewCtx) return jsonError('Source crew not found', 404);
    const oldItems = removeItem(oldCrewCtx.items, (item) => item.itemType === 'job' && item.jobId === existingJob.id);
    const oldJobs = oldCrewCtx.jobs.filter((job) => job.id !== existingJob.id);
    const oldAfter = recomputeForCrew({
      crewRow: oldCrewCtx.crewRow,
      items: oldItems,
      jobs: oldJobs,
      downtimes: oldCrewCtx.downtimes,
      calendar: ctx.calendar,
      today: ctx.today,
    });
    const oldImpacts = computeCommitImpacts({
      before: oldCrewCtx.recompute,
      after: oldAfter,
      jobMetaById: buildJobMetaMap(oldCrewCtx.jobs),
      today: ctx.today,
      horizonDays: 10,
      region: oldCrewCtx.crewRow.calendar_region || 'Auckland',
      calendar: ctx.calendar,
    });
    impacts = [...impacts, ...oldImpacts];
  }

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts });
  }

  let scheduledJobId = existingJob?.id ?? null;
  if (!existingJob) {
    const insertRes = await supabaseServer
      .from('scheduled_jobs')
      .insert({
        job_id: jobId,
        crew_id: crewId,
        mode: 'floating',
        forecast_duration_days: durationDays,
        status: 'not_started',
      } as any)
      .select('id')
      .single();
    if (insertRes.error) return jsonError('Failed to create scheduled job', 500);
    scheduledJobId = insertRes.data?.id ?? null;
  }

  if (!scheduledJobId) return jsonError('Failed to resolve scheduled job id', 500);

  let newScheduleItemId: string | null = null;
  const finalizedItems = items.map((item) => (item.id === newItem.id ? { ...item, jobId: scheduledJobId } : item));

  for (const item of finalizedItems) {
    if (item.id === newItem.id) {
      const insertItemRes = await supabaseServer
        .from('crew_schedule_items')
        .insert({
          crew_id: crewId,
          item_type: 'job',
          job_id: scheduledJobId,
          position: item.position,
        } as any)
        .select('id')
        .single();
      if (insertItemRes.error) return jsonError('Failed to insert schedule item', 500);
      newScheduleItemId = insertItemRes.data?.id ?? null;
    } else {
      await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
    }
  }

  const updatedJobs = jobs.map((job) => (job.id === jobRecordId ? { ...job, id: scheduledJobId! } : job));
  const updatedItems = finalizedItems.map((item) => {
    if (item.id === newItem.id && newScheduleItemId) {
      return { ...item, id: newScheduleItemId, jobId: scheduledJobId! };
    }
    return item.jobId === jobRecordId ? { ...item, jobId: scheduledJobId! } : item;
  });
  let finalRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: updatedItems,
    jobs: updatedJobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  await applyJobForecastUpdates(finalRecompute.job_updates);

  if (isMove && existingJob?.crew_id) {
    const oldCrewId = String(existingJob.crew_id);
    await supabaseServer.from('scheduled_jobs').update({ crew_id: crewId } as any).eq('id', scheduledJobId);
    await supabaseServer.from('crew_schedule_items').delete().eq('job_id', scheduledJobId).eq('crew_id', oldCrewId);

    const oldCrewCtx = buildCrewContext(ctx, oldCrewId);
    if (oldCrewCtx) {
      const oldItems = removeItem(oldCrewCtx.items, (item) => item.itemType === 'job' && item.jobId === scheduledJobId);
      for (const item of oldItems) {
        await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
      }
      const oldAfter = recomputeForCrew({
        crewRow: oldCrewCtx.crewRow,
        items: oldItems,
        jobs: oldCrewCtx.jobs.filter((job) => job.id !== scheduledJobId),
        downtimes: oldCrewCtx.downtimes,
        calendar: ctx.calendar,
        today: ctx.today,
      });
      await applyJobForecastUpdates(oldAfter.job_updates);
    }
    finalRecompute = recomputeForCrew({
      crewRow: crewCtx.crewRow,
      items: updatedItems,
      jobs: updatedJobs.map((job) => (job.id === scheduledJobId ? { ...job, crewId } : job)),
      downtimes: crewCtx.downtimes,
      calendar: ctx.calendar,
      today: ctx.today,
    });
  }

  const scheduledJob = updatedJobs.find((job) => job.id === scheduledJobId);
  if (scheduledJob && !scheduledJob.plannedStart) {
    const update = finalRecompute.job_updates.find((u) => u.id === scheduledJobId);
    if (update?.forecast_start) {
      await supabaseServer
        .from('scheduled_jobs')
        .update({ planned_start: update.forecast_start, planned_duration_days: update.forecast_duration_days } as any)
        .eq('id', scheduledJobId)
        .is('planned_start', null);
    }
  }

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: finalRecompute,
    jobsById: new Map(updatedJobs.map((job) => [job.id, job])),
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
