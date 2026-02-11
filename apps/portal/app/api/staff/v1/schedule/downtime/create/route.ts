import { jsonError, jsonOk, parseJsonBody, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyJobForecastUpdates,
  buildCrewContext,
  buildJobMetaMap,
  computeCommitImpacts,
  formatCrewScheduleBlocks,
  insertItemAtPosition,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';
import { supabaseServer } from '@/lib/supabaseClient';

export const runtime = 'nodejs';

function tempId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeReason(value: unknown): string {
  const allowed = new Set(['weather', 'materials', 'site', 'staff', 'travel', 'other']);
  const v = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return allowed.has(v) ? v : 'other';
}

export async function POST(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const parsed = await parseJsonBody(req);
  if (!parsed.ok) return jsonError(parsed.error, 400);
  const body = parsed.body ?? {};

  const crewId = typeof body.crew_id === 'string' ? body.crew_id.trim() : '';
  const positionRaw = body.position;
  const durationRaw = body.duration_days;
  const reason = normalizeReason(body.reason);
  const note = typeof body.note === 'string' ? body.note.trim() : null;
  const force = Boolean(body.force);

  if (!crewId) return jsonError('crew_id is required', 400);

  const durationDays = typeof durationRaw === 'number' && Number.isFinite(durationRaw) ? Math.max(1, Math.trunc(durationRaw)) : 1;

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

  const downtimeId = tempId('temp_dt');
  const downtimes = [...crewCtx.downtimes, { id: downtimeId, crewId, durationDays, reason, note }];
  const position = typeof positionRaw === 'number' && Number.isFinite(positionRaw) ? Math.trunc(positionRaw) : crewCtx.items.length;
  const newItem = {
    id: tempId('temp_item'),
    crewId,
    itemType: 'downtime' as const,
    jobId: null,
    downtimeId,
    position,
  };
  const items = insertItemAtPosition(crewCtx.items, newItem, position);

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
    return jsonOk({ requires_confirmation: true, impacts });
  }

  const insertDowntimeRes = await supabaseServer
    .from('crew_downtimes')
    .insert({
      crew_id: crewId,
      duration_days: durationDays,
      reason,
      note,
    } as any)
    .select('id')
    .single();
  if (insertDowntimeRes.error) return jsonError('Failed to create downtime', 500);
  const actualDowntimeId = insertDowntimeRes.data?.id ?? null;
  if (!actualDowntimeId) return jsonError('Failed to resolve downtime id', 500);

  let newScheduleItemId: string | null = null;
  for (const item of items) {
    if (item.id === newItem.id) {
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
      if (insertItemRes.error) return jsonError('Failed to insert schedule item', 500);
      newScheduleItemId = insertItemRes.data?.id ?? null;
    } else {
      await supabaseServer.from('crew_schedule_items').update({ position: item.position } as any).eq('id', item.id);
    }
  }

  const updatedItems = items.map((item) => {
    if (item.id === newItem.id && newScheduleItemId) {
      return { ...item, id: newScheduleItemId, downtimeId: actualDowntimeId };
    }
    return item.downtimeId === downtimeId ? { ...item, downtimeId: actualDowntimeId } : item;
  });
  const updatedDowntimes = downtimes.map((dt) => (dt.id === downtimeId ? { ...dt, id: actualDowntimeId } : dt));

  const finalRecompute = recomputeForCrew({
    crewRow: crewCtx.crewRow,
    items: updatedItems,
    jobs: crewCtx.jobs,
    downtimes: updatedDowntimes,
    calendar: ctx.calendar,
    today: ctx.today,
  });

  await applyJobForecastUpdates(finalRecompute.job_updates);

  const formatted = formatCrewScheduleBlocks({
    crewRow: crewCtx.crewRow,
    recompute: finalRecompute,
    jobsById: crewCtx.jobsById,
    downtimesById: new Map(updatedDowntimes.map((dt) => [dt.id, dt])),
  });

  return jsonOk({
    ok: true,
    crew_id: crewId,
    schedule: formatted,
    conflicts: formatted.conflicts,
    next_available_date: formatted.next_available_date,
  });
}
