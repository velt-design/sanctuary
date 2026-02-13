import { jsonError, jsonOk, requireStaffSession } from '@/lib/api/staffApi';
import { isYmd } from '@/lib/scheduling/date';
import {
  applyDriftStatusPatches,
  buildUnscheduledJobs,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  listProjectsAndEstimates,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

export const runtime = 'nodejs';

function isArchivedEstimateStatus(status: unknown): boolean {
  const s = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return s === 'archived';
}

function estimateVersion(row: any): number {
  return typeof row?.version === 'number' && Number.isFinite(row.version) ? row.version : -1;
}

function estimateCreatedAt(row: any): string {
  return typeof row?.created_at === 'string' ? row.created_at : '';
}

function isNewerEstimateRow(a: any, b: any): boolean {
  const av = estimateVersion(a);
  const bv = estimateVersion(b);
  if (av !== bv) return av > bv;
  return estimateCreatedAt(a) > estimateCreatedAt(b);
}

function computeScheduledEstimateIds(estimates: any[], scheduledProjectIds: Set<string>): Record<string, string> {
  const bestByProjectId = new Map<string, any>();
  for (const row of Array.isArray(estimates) ? estimates : []) {
    const projectId = typeof row?.project_id === 'string' ? row.project_id : '';
    if (!projectId || !scheduledProjectIds.has(projectId)) continue;

    const prev = bestByProjectId.get(projectId);
    if (!prev) {
      bestByProjectId.set(projectId, row);
      continue;
    }

    const prevArchived = isArchivedEstimateStatus(prev?.status);
    const nextArchived = isArchivedEstimateStatus(row?.status);

    // Prefer non-archived estimates; otherwise pick the newest row.
    if (prevArchived && !nextArchived) {
      bestByProjectId.set(projectId, row);
      continue;
    }
    if (prevArchived === nextArchived && isNewerEstimateRow(row, prev)) {
      bestByProjectId.set(projectId, row);
    }
  }

  const out: Record<string, string> = {};
  for (const [projectId, row] of bestByProjectId.entries()) {
    const estimateId = typeof row?.id === 'string' ? row.id : '';
    if (estimateId) out[projectId] = estimateId;
  }
  return out;
}

export async function GET(req: Request) {
  const session = await requireStaffSession();
  if (!session) return jsonError('Unauthorized', 401);

  const url = new URL(req.url);
  const today = url.searchParams.get('today');

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

  const schedules: any[] = [];
  const conflicts: any[] = [];
  const nextAvailableByCrew = new Map<string, string>();

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
    schedules.push(formatted);
    nextAvailableByCrew.set(crewRow.id, formatted.next_available_date);
    conflicts.push(...formatted.conflicts.map((c: any) => ({ ...c, crew_id: crewRow.id })));
  }

  let unscheduledJobs: any[] = [];
  let scheduledEstimateIds: Record<string, string> = {};
  try {
    const { projects, estimates } = await listProjectsAndEstimates();
    const scheduledProjectIds = new Set(ctx.jobs.map((job) => job.jobId));
    unscheduledJobs = buildUnscheduledJobs({ projects, estimates, scheduledProjectIds });
    scheduledEstimateIds = computeScheduledEstimateIds(estimates, scheduledProjectIds);
  } catch (err) {
    if (isMissingSchemaError(err)) {
      const detail = process.env.NODE_ENV !== 'production' ? ` (${(err as any)?.message ?? 'missing schema'})` : '';
      return jsonError(`Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.${detail}`, 501);
    }
  }

  const crews = ctx.crews.map((crew) => ({
    id: crew.id,
    name: crew.name,
    color: crew.color,
    is_active: typeof crew.is_active === 'boolean' ? crew.is_active : true,
    sort_order: crew.sort_order,
    calendar_region: crew.calendar_region,
    base_available_date: crew.base_available_date,
    next_available_date: nextAvailableByCrew.get(crew.id) ?? null,
  }));

  return jsonOk({
    generated_at: new Date().toISOString(),
    crews,
    schedule: schedules,
    unscheduled_jobs: unscheduledJobs,
    conflicts,
    scheduled_estimate_ids: scheduledEstimateIds,
  });
}
