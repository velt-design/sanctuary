import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { addDaysYmd, isYmd } from '@/lib/scheduling/date';
import {
  applyJobForecastUpdates,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  ensureActualStart,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  insertItemAtPosition,
  loadScheduleContext,
  recomputeForCrew,
  snapToday,
} from '@/lib/scheduling/scheduleV2Server';
import { addWorkingDays, workingDaysBetween } from '@/lib/scheduling/workingDays';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/mark-done');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const force = Boolean(body.force);
  const finishEarlyAction = typeof body.finish_early_action === 'string' ? body.finish_early_action.trim().toLowerCase() : '';

  if (!jobId) return jsonError('job_id is required', 400, diagnostics);
  if (finishEarlyAction && finishEarlyAction !== 'pull_forward' && finishEarlyAction !== 'keep_schedule') {
    return jsonError('finish_early_action must be pull_forward or keep_schedule', 400, diagnostics);
  }

  const byProjectRes = await supabaseServer.from('scheduled_jobs').select('*').eq('job_id', jobId).maybeSingle();
  if (byProjectRes.error) {
    if (isMissingSchemaError(byProjectRes.error)) {
      logPortalServerWarn(diagnostics, {
        status: 501,
        message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
        error: byProjectRes.error,
      });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load scheduled job',
      error: byProjectRes.error,
    });
    return jsonError('Failed to load scheduled job', 500, diagnostics);
  }
  let jobRow = byProjectRes.data;
  if (!jobRow) {
    const byIdRes = await supabaseServer.from('scheduled_jobs').select('*').eq('id', jobId).maybeSingle();
    if (byIdRes.error) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: 'Failed to load scheduled job',
        error: byIdRes.error,
      });
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
      logPortalServerWarn(diagnostics, {
        status: 501,
        message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
        error: err,
      });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load schedule data',
      error: err,
    });
    return jsonError('Failed to load schedule data', 500, diagnostics);
  }

  const crewCtx = buildCrewContext(ctx, crewId);
  if (!crewCtx) return jsonError('Crew not found', 404, diagnostics);

  const region = crewCtx.crewRow.calendar_region || 'Auckland';
  const finish = snapToday(ctx.today, region, ctx.calendar);

  const forecastStart = typeof jobRow.forecast_start === 'string' && isYmd(jobRow.forecast_start) ? jobRow.forecast_start : null;
  const forecastDuration = typeof jobRow.forecast_duration_days === 'number' && Number.isFinite(jobRow.forecast_duration_days) ? Math.max(1, Math.trunc(jobRow.forecast_duration_days)) : 1;
  const forecastEndExclusive =
    typeof jobRow.forecast_end_exclusive === 'string' && isYmd(jobRow.forecast_end_exclusive)
      ? jobRow.forecast_end_exclusive
      : forecastStart
        ? addWorkingDays(forecastStart, forecastDuration, region, ctx.calendar)
        : null;

  const freedDays =
    forecastEndExclusive && isYmd(forecastEndExclusive)
      ? workingDaysBetween(addDaysYmd(finish, 1), forecastEndExclusive, region, ctx.calendar)
      : 0;

  const jobs = crewCtx.jobs.map((job) =>
    job.id === jobRow.id
      ? {
          ...job,
          status: 'done' as const,
          actualStart: ensureActualStart(job, finish),
          actualFinish: finish,
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

  const impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(jobs),
    today: ctx.today,
    horizonDays: 10,
    region,
    calendar: ctx.calendar,
  });

  if (freedDays > 0 && !finishEarlyAction) {
    return jsonOk({
      requires_finish_early: true,
      freed_days: freedDays,
      actual_finish: finish,
      forecast_end_exclusive: forecastEndExclusive,
      impacts,
    }, 200, diagnostics);
  }

  if (finishEarlyAction === 'keep_schedule' && freedDays > 0) {
    const jobItem = crewCtx.items.find((item) => item.jobId === jobRow.id) ?? null;
    if (!jobItem) return jsonError('Scheduled job item not found', 404, diagnostics);

    const tempDowntimeId = `temp_dt_${Math.random().toString(36).slice(2, 10)}`;
    const tempItemId = `temp_item_${Math.random().toString(36).slice(2, 10)}`;
    const bufferNote = `Finish early buffer (${freedDays} working day${freedDays === 1 ? '' : 's'}).`;
    const downtimes = [...crewCtx.downtimes, { id: tempDowntimeId, crewId, durationDays: freedDays, reason: 'other', note: bufferNote }];
    const items = insertItemAtPosition(
      crewCtx.items,
      {
        id: tempItemId,
        crewId,
        itemType: 'downtime',
        jobId: null,
        downtimeId: tempDowntimeId,
        position: jobItem.position + 1,
      },
      jobItem.position + 1,
    );

    const bufferRecompute = recomputeForCrew({
      crewRow: crewCtx.crewRow,
      items,
      jobs,
      downtimes,
      calendar: ctx.calendar,
      today: ctx.today,
    });

    const bufferImpacts = computeCommitImpacts({
      before: crewCtx.recompute,
      after: bufferRecompute,
      jobMetaById: buildJobMetaMap(jobs),
      today: ctx.today,
      horizonDays: 10,
      region,
      calendar: ctx.calendar,
    });

    if (bufferImpacts.length && !force) {
      return jsonOk({ requires_confirmation: true, impacts: bufferImpacts }, 200, diagnostics);
    }

    const existingActualStart = typeof jobRow.actual_start === 'string' && jobRow.actual_start ? jobRow.actual_start : null;
    await supabaseServer
      .from('scheduled_jobs')
      .update({
        status: 'done',
        actual_finish: finish,
        actual_start: existingActualStart ?? jobRow.forecast_start ?? finish,
      } as any)
      .eq('id', jobRow.id);

    const insertDowntimeRes = await supabaseServer
      .from('crew_downtimes')
      .insert({
        crew_id: crewId,
        duration_days: freedDays,
        reason: 'other',
        note: bufferNote,
      } as any)
      .select('id')
      .single();
    if (insertDowntimeRes.error) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: 'Failed to create downtime buffer',
        error: insertDowntimeRes.error,
      });
      return jsonError('Failed to create downtime buffer', 500, diagnostics);
    }
    const actualDowntimeId = insertDowntimeRes.data?.id ?? null;
    if (!actualDowntimeId) {
      logPortalServerError(diagnostics, {
        status: 500,
        message: 'Failed to resolve downtime id',
      });
      return jsonError('Failed to resolve downtime id', 500, diagnostics);
    }

    let newScheduleItemId: string | null = null;
    for (const item of items) {
      if (item.id === tempItemId) {
        const insertItemRes = await supabaseServer
          .from('crew_schedule_items')
          .insert({
            crew_id: crewId,
            item_type: 'downtime',
            downtime_id: actualDowntimeId,
            position: item.position,
          } as any)
          .select('id')
          .single();
        if (insertItemRes.error) {
          logPortalServerError(diagnostics, {
            status: 500,
            message: 'Failed to insert downtime schedule item',
            error: insertItemRes.error,
          });
          return jsonError('Failed to insert downtime schedule item', 500, diagnostics);
        }
        newScheduleItemId = insertItemRes.data?.id ?? null;
      } else {
        await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
      }
    }

    const updatedItems = items.map((item) => {
      if (item.id === tempItemId && newScheduleItemId) {
        return { ...item, id: newScheduleItemId, downtimeId: actualDowntimeId };
      }
      return item.downtimeId === tempDowntimeId ? { ...item, downtimeId: actualDowntimeId } : item;
    });
    const updatedDowntimes = downtimes.map((dt) => (dt.id === tempDowntimeId ? { ...dt, id: actualDowntimeId } : dt));

    const finalRecompute = recomputeForCrew({
      crewRow: crewCtx.crewRow,
      items: updatedItems,
      jobs,
      downtimes: updatedDowntimes,
      calendar: ctx.calendar,
      today: ctx.today,
    });

    await applyJobForecastUpdates(finalRecompute.job_updates);

    const formatted = formatCrewScheduleBlocks({
      crewRow: crewCtx.crewRow,
      recompute: finalRecompute,
      jobsById: new Map(jobs.map((job) => [job.id, job])),
      downtimesById: new Map(updatedDowntimes.map((dt) => [dt.id, dt])),
    });

    return jsonOk({
      ok: true,
      crew_id: crewId,
      schedule: formatted,
      conflicts: formatted.conflicts,
      next_available_date: formatted.next_available_date,
    }, 200, diagnostics);
  }

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const existingActualStart = typeof jobRow.actual_start === 'string' && jobRow.actual_start ? jobRow.actual_start : null;
  await supabaseServer
    .from('scheduled_jobs')
    .update({
      status: 'done',
      actual_finish: finish,
      actual_start: existingActualStart ?? jobRow.forecast_start ?? finish,
    } as any)
    .eq('id', jobRow.id);

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
  }, 200, diagnostics);
}
