import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyDriftStatusPatches,
  computeRangeHolidays,
  computeRangeIntersection,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  const rangeStart = url.searchParams.get('rangeStart') ?? '';
  const rangeEnd = url.searchParams.get('rangeEnd') ?? '';
  const today = url.searchParams.get('today');

  if (!isYmd(rangeStart) || !isYmd(rangeEnd)) {
    return jsonError('rangeStart and rangeEnd are required YYYY-MM-DD values.', 400);
  }

  let ctx;
  try {
    ctx = await loadScheduleContext({ today: today && isYmd(today) ? today : undefined });
  } catch (err) {
    if (isMissingSchemaError(err)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(err as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.${detail}`, 501);
    }
    return jsonError('Failed to load schedule data', 500);
  }

  const items: any[] = [];
  const conflicts: any[] = [];

  for (const crewRow of ctx.crews) {
    const crewItems = ctx.items.filter((item) => item.crewId === crewRow.id);
    const crewJobs = ctx.jobs.filter((job) => job.crewId === crewRow.id);
    const crewDowntimes = ctx.downtimes.filter((dt) => dt.crewId === crewRow.id);
    const recompute = recomputeForCrew({
      crewRow,
      items: crewItems,
      jobs: crewJobs,
      downtimes: crewDowntimes,
      calendar: ctx.calendar,
      today: ctx.today,
    });

    let jobsWithDrift;
    try {
      jobsWithDrift = await applyDriftStatusPatches({
        jobs: crewJobs,
        recompute,
        region: crewRow.calendar_region || 'Auckland',
        calendar: ctx.calendar,
      });
    } catch (err) {
      if (isMissingSchemaError(err)) {
        return jsonError('Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.', 501);
      }
      return jsonError('Failed to evaluate schedule drift', 500);
    }

    const jobsById = new Map(jobsWithDrift.map((job) => [job.id, job]));
    const downtimesById = new Map(crewDowntimes.map((dt) => [dt.id, dt]));
    const formatted = formatCrewScheduleBlocks({ crewRow, recompute, jobsById, downtimesById });

    for (const block of formatted.items) {
      if (computeRangeIntersection(block.start, block.end_exclusive, rangeStart, rangeEnd)) {
        items.push({ ...block, crew_id: crewRow.id });
      }
    }

    conflicts.push(...formatted.conflicts.filter((c) => isYmd(c.pinned_start) && c.pinned_start >= rangeStart && c.pinned_start <= rangeEnd));
  }

  const holidays = computeRangeHolidays({ holidays: ctx.holidays, closures: ctx.closures, rangeStart, rangeEnd });

  const crews = ctx.crews.map((crew) => ({
    id: crew.id,
    name: crew.name,
    color: crew.color,
    is_active: typeof crew.is_active === 'boolean' ? crew.is_active : true,
    sort_order: crew.sort_order,
    calendar_region: crew.calendar_region,
    base_available_date: crew.base_available_date,
  }));

  return jsonOk({
    generated_at: new Date().toISOString(),
    range_start: rangeStart,
    range_end: rangeEnd,
    crews,
    items,
    holidays: holidays.holidays,
    closures: holidays.closures,
    conflicts,
  });
}
