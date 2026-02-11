import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyJobForecastUpdates,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  reorderItems,
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

  const crewId = typeof body.crew_id === 'string' ? body.crew_id.trim() : '';
  const orderedIds = Array.isArray(body.ordered_item_ids) ? body.ordered_item_ids.filter((id: any) => typeof id === 'string') : null;
  const moveItemId = typeof body.item_id === 'string' ? body.item_id.trim() : '';
  const newPositionRaw = body.new_position;
  const force = Boolean(body.force);

  if (!crewId) return jsonError('crew_id is required', 400);

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

  let nextItems = crewCtx.items.slice();
  if (orderedIds && orderedIds.length) {
    nextItems = reorderItems(nextItems, orderedIds);
  } else if (moveItemId) {
    const sorted = nextItems.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
    const idx = sorted.findIndex((item) => item.id === moveItemId);
    if (idx === -1) return jsonError('item_id not found in crew schedule', 404);
    const [moving] = sorted.splice(idx, 1);
    const newPosition = typeof newPositionRaw === 'number' && Number.isFinite(newPositionRaw) ? Math.trunc(newPositionRaw) : sorted.length;
    const insertAt = Math.max(0, Math.min(newPosition, sorted.length));
    sorted.splice(insertAt, 0, moving);
    nextItems = sorted.map((item, index) => ({ ...item, position: index }));
  } else {
    return jsonError('ordered_item_ids or item_id is required', 400);
  }

  const afterRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: nextItems,
    jobs: crewCtx.jobs,
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
    return jsonOk({ requires_confirmation: true, impacts });
  }

  for (const item of nextItems) {
    await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
  }

  await applyJobForecastUpdates(afterRecompute.job_updates);

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: afterRecompute,
    jobsById: crewCtx.jobsById,
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
