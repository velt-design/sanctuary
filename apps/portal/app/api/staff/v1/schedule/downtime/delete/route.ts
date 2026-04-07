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
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/downtime/delete');
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401, diagnostics);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const downtimeId = typeof body.downtime_id === 'string' ? body.downtime_id.trim() : '';
  const force = Boolean(body.force);

  if (!downtimeId) return jsonError('downtime_id is required', 400, diagnostics);

  const downtimeRes = await supabaseServer.from('crew_downtimes').select('*').eq('id', downtimeId).maybeSingle();
  if (downtimeRes.error) {
    if (isMissingSchemaError(downtimeRes.error)) {
      logPortalServerWarn(diagnostics, {
        status: 501,
        message: 'Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.',
        error: downtimeRes.error,
      });
      return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501, diagnostics);
    }
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to load downtime',
      error: downtimeRes.error,
    });
    return jsonError('Failed to load downtime', 500, diagnostics);
  }
  const downtimeRow = downtimeRes.data;
  if (!downtimeRow) return jsonError('Downtime not found', 404, diagnostics);

  const crewId = String(downtimeRow.crew_id);

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

  const items = removeItem(crewCtx.items, (item) => item.itemType === 'downtime' && item.downtimeId === downtimeId);
  const downtimes = crewCtx.downtimes.filter((dt) => dt.id !== downtimeId);

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items,
    jobs: crewCtx.jobs,
    downtimes,
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

  const deleteItemsRes = await supabaseServer.from('crew_schedule_items').delete().eq('downtime_id', downtimeId);
  const deleteItemsFailure = getSupabaseMutationFailure(deleteItemsRes, {
    diagnostics,
    table: 'crew_schedule_items',
    operation: 'delete',
    message: 'Failed to delete downtime',
    extra: { downtimeId },
  });
  if (deleteItemsFailure) return jsonError(deleteItemsFailure.responseMessage, 500, diagnostics);

  const deleteDowntimeRes = await supabaseServer.from('crew_downtimes').delete().eq('id', downtimeId);
  const deleteDowntimeFailure = getSupabaseMutationFailure(deleteDowntimeRes, {
    diagnostics,
    table: 'crew_downtimes',
    operation: 'delete',
    message: 'Failed to delete downtime',
    extra: { downtimeId },
  });
  if (deleteDowntimeFailure) return jsonError(deleteDowntimeFailure.responseMessage, 500, diagnostics);

  for (const item of items) {
    const updateRes = await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
    const updateFailure = getSupabaseMutationFailure(updateRes, {
      diagnostics,
      table: 'crew_schedule_items',
      operation: 'update',
      message: 'Failed to delete downtime',
      extra: { itemId: item.id },
    });
    if (updateFailure) return jsonError(updateFailure.responseMessage, 500, diagnostics);
  }

  await applyJobForecastUpdates(afterRecompute.job_updates);

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: afterRecompute,
    jobsById: crewCtx.jobsById,
    downtimesById: new Map(downtimes.map((dt) => [dt.id, dt])),
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
  }, 200, diagnostics);
}
