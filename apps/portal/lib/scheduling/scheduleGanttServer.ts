import 'server-only';

import type { ScheduleGanttResponse } from '@/lib/repo/scheduleV2Repo';
import { isYmd } from '@/lib/scheduling/date';
import { ScheduleSchemaNotReadyError } from '@/lib/scheduling/scheduleBoardServer';
import {
  applyDriftStatusPatches,
  computeRangeHolidays,
  computeRangeIntersection,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  listProjectsAndEstimates,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

function schemaNotReadyMessage(detail?: string): string {
  const suffix = process.env.NODE_ENV !== 'production' && detail ? ` (${detail})` : '';
  return `Schedule schema is not upgraded yet. Run latest schedule migrations then refresh.${suffix}`;
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

    const prevStatus = typeof prev?.status === 'string' ? prev.status.trim().toLowerCase() : '';
    const nextStatus = typeof row?.status === 'string' ? row.status.trim().toLowerCase() : '';
    const prevArchived = prevStatus === 'archived';
    const nextArchived = nextStatus === 'archived';

    if (prevArchived && !nextArchived) {
      bestByProjectId.set(projectId, row);
      continue;
    }

    const prevVersion = typeof prev?.version === 'number' && Number.isFinite(prev.version) ? prev.version : -1;
    const nextVersion = typeof row?.version === 'number' && Number.isFinite(row.version) ? row.version : -1;
    const prevCreatedAt = typeof prev?.created_at === 'string' ? prev.created_at : '';
    const nextCreatedAt = typeof row?.created_at === 'string' ? row.created_at : '';

    if (prevArchived === nextArchived && (nextVersion > prevVersion || (nextVersion === prevVersion && nextCreatedAt > prevCreatedAt))) {
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

export async function loadScheduleGanttResponse(input: {
  rangeStart: string;
  rangeEnd: string;
  today?: string;
}): Promise<ScheduleGanttResponse> {
  if (!isYmd(input.rangeStart) || !isYmd(input.rangeEnd)) {
    throw new Error('rangeStart and rangeEnd are required YYYY-MM-DD values.');
  }

  let ctx;
  try {
    ctx = await loadScheduleContext({ today: input.today && isYmd(input.today) ? input.today : undefined });
  } catch (error) {
    if (isMissingSchemaError(error)) {
      throw new ScheduleSchemaNotReadyError(schemaNotReadyMessage((error as any)?.message ?? 'missing schema'));
    }
    throw error;
  }

  const items: ScheduleGanttResponse['items'] = [];
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
    } catch (error) {
      if (isMissingSchemaError(error)) {
        throw new ScheduleSchemaNotReadyError(schemaNotReadyMessage());
      }
      throw error;
    }

    const jobsById = new Map(jobsWithDrift.map((job) => [job.id, job]));
    const downtimesById = new Map(crewDowntimes.map((dt) => [dt.id, dt]));
    const formatted = formatCrewScheduleBlocks({ crewRow, recompute, jobsById, downtimesById });

    for (const block of formatted.items) {
      if (computeRangeIntersection(block.start, block.end_exclusive, input.rangeStart, input.rangeEnd)) {
        items.push({ ...block, crew_id: crewRow.id });
      }
    }

    conflicts.push(
      ...formatted.conflicts.filter((conflict) => isYmd(conflict.pinned_start) && conflict.pinned_start >= input.rangeStart && conflict.pinned_start <= input.rangeEnd),
    );
  }

  let projectIndex: NonNullable<ScheduleGanttResponse['project_index']> = [];
  let scheduledEstimateIds: NonNullable<ScheduleGanttResponse['scheduled_estimate_ids']> = {};
  try {
    const { projects, estimates } = await listProjectsAndEstimates();
    const scheduledProjectIds = new Set(ctx.jobs.map((job) => job.jobId));
    scheduledEstimateIds = computeScheduledEstimateIds(estimates, scheduledProjectIds);
    projectIndex = projects
      .filter((project) => scheduledProjectIds.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        pipeline_stage: project.pipeline_stage,
        follow_up_date: project.follow_up_date,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (isMissingSchemaError(error)) {
      throw new ScheduleSchemaNotReadyError(schemaNotReadyMessage((error as any)?.message ?? 'missing schema'));
    }
    throw error;
  }

  const holidays = computeRangeHolidays({
    holidays: ctx.holidays,
    closures: ctx.closures,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
  });

  return {
    generated_at: new Date().toISOString(),
    range_start: input.rangeStart,
    range_end: input.rangeEnd,
    crews: ctx.crews.map((crew) => ({
      id: crew.id,
      name: crew.name,
      color: crew.color,
      is_active: typeof crew.is_active === 'boolean' ? crew.is_active : true,
      sort_order: crew.sort_order,
      calendar_region: crew.calendar_region,
      base_available_date: crew.base_available_date,
    })),
    items,
    project_index: projectIndex,
    scheduled_estimate_ids: scheduledEstimateIds,
    holidays: holidays.holidays,
    closures: holidays.closures,
    conflicts,
  };
}
