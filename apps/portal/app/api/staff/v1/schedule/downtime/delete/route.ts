import { jsonError, jsonOk, parseJsonBody, requireStaffContext } from '@/lib/api/staffApi';
import { createRouteDiagnostics, logPortalServerError, logPortalServerWarn } from '@/lib/api/routeDiagnostics';
import { isYmd } from '@/lib/scheduling/date';
import { commitDeleteDowntime } from '@/lib/scheduling/scheduleCommands';
import {
  applyScheduleItemPositions,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  removeItem,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const diagnostics = createRouteDiagnostics(req, '/api/staff/v1/schedule/downtime/delete');
  const auth = await requireStaffContext(diagnostics);
  if (!auth.ok) return auth.response;
  const supabase = auth.supabase;

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400, diagnostics);
  const body = parsed.body ?? {};

  const downtimeId = typeof body.downtime_id === 'string' ? body.downtime_id.trim() : '';
  const force = Boolean(body.force);

  if (!downtimeId) return jsonError('downtime_id is required', 400, diagnostics);

  const downtimeRes = await supabase.from('crew_downtimes').select('*').eq('id', downtimeId).maybeSingle();
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

  const removedItem = crewCtx.items.find((item) => item.itemType === 'downtime' && item.downtimeId === downtimeId) ?? null;
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

  if (!removedItem) {
    logPortalServerError(diagnostics, {
      status: 500,
      message: 'Failed to delete downtime',
      extra: { downtimeId, reason: 'missing_queue_item' },
    });
    return jsonError('Failed to delete downtime', 500, diagnostics);
  }

  const commitRes = await commitDeleteDowntime({
    diagnostics,
    downtimeId,
    downtimeItemId: removedItem.id,
    positions: applyScheduleItemPositions(items),
    forecastUpdates: afterRecompute.job_updates,
  });
  if (!commitRes.ok) return jsonError(commitRes.responseMessage, commitRes.status, diagnostics);

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
