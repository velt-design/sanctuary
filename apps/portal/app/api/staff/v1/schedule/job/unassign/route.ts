import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { getSupabaseMutationFailure } from '@/lib/api/supabaseMutation';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyJobForecastUpdates,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  removeItem,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/job/unassign');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const force = Boolean(body.force);

  if (!jobId) return jsonError('job_id is required', 400, diagnostics);

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
  if (!jobRow) return jsonOk({ ok: true }, 200, diagnostics);

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

  const items = removeItem(crewCtx.items, (item) => item.itemType === 'job' && item.jobId === jobRow.id);
  const jobs = crewCtx.jobs.filter((job) => job.id !== jobRow.id);

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items,
    jobs,
    downtimes: crewCtx.downtimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  const impacts = computeCommitImpacts({
    before: crewCtx.recompute,
    after: afterRecompute,
    jobMetaById: buildJobMetaMap(crewCtx.jobs),
    today: ctx.today,
    horizonDays: 10,
    region: crewCtx.crewRow.calendar_region || 'Auckland',
    calendar: ctx.calendar,
  });

  if (impacts.length && !force) {
    return jsonOk({ requires_confirmation: true, impacts }, 200, diagnostics);
  }

  const deleteItemsRes = await supabaseServer.from('crew_schedule_items').delete().eq('job_id', jobRow.id);
  const deleteItemsFailure = getSupabaseMutationFailure(deleteItemsRes, {
    diagnostics,
    table: 'crew_schedule_items',
    operation: 'delete',
    message: 'Failed to unassign scheduled job',
    extra: { jobId: jobRow.id },
  });
  if (deleteItemsFailure) return jsonError(deleteItemsFailure.responseMessage, 500, diagnostics);

  const deleteJobRes = await supabaseServer.from('scheduled_jobs').delete().eq('id', jobRow.id);
  const deleteJobFailure = getSupabaseMutationFailure(deleteJobRes, {
    diagnostics,
    table: 'scheduled_jobs',
    operation: 'delete',
    message: 'Failed to unassign scheduled job',
    extra: { jobId: jobRow.id },
  });
  if (deleteJobFailure) return jsonError(deleteJobFailure.responseMessage, 500, diagnostics);

  for (const item of items) {
    const updateRes = await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
    const updateFailure = getSupabaseMutationFailure(updateRes, {
      diagnostics,
      table: 'crew_schedule_items',
      operation: 'update',
      message: 'Failed to unassign scheduled job',
      extra: { itemId: item.id },
    });
    if (updateFailure) return jsonError(updateFailure.responseMessage, 500, diagnostics);
  }

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
