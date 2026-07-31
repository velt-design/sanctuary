import 'server-only';

import type { PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import type { ScheduleBoardResponse } from '@/lib/repo/scheduleV2Repo';
import { isYmd } from '@/lib/scheduling/date';
import {
  buildUnscheduledJobs,
  computeJobsWithDriftStatus,
  formatCrewScheduleBlocks,
  isMissingSchemaError,
  listBoardProjectsAndEstimates,
  loadScheduleContext,
  recomputeForCrew,
} from '@/lib/scheduling/scheduleV2Server';

export class ScheduleSchemaNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScheduleSchemaNotReadyError';
  }
}

class ScheduleBoardBuildError extends Error {
  phase: 'load' | 'drift';

  constructor(message: string, phase: 'load' | 'drift') {
    super(message);
    this.name = 'ScheduleBoardBuildError';
    this.phase = phase;
  }
}

export function isScheduleSchemaNotReadyError(error: unknown): error is ScheduleSchemaNotReadyError {
  return error instanceof ScheduleSchemaNotReadyError;
}

export function isScheduleBoardBuildError(error: unknown): error is ScheduleBoardBuildError {
  return error instanceof ScheduleBoardBuildError;
}

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

function elapsedMs(startedAt: number): number {
  return Number((performance.now() - startedAt).toFixed(1));
}

function logDevelopmentBoardDiagnostics(input: {
  diagnostics?: PortalServerLogContext | null;
  contextMs: number;
  recomputeMs: number;
  driftMs: number;
  formattingMs: number;
  projectEstimateMs: number;
  responseMappingMs: number;
  totalMs: number;
  counts: Record<string, unknown>;
}) {
  if (process.env.NODE_ENV !== 'development') return;
  console.debug('[schedule]', {
    event: 'schedule.board.load',
    requestId: input.diagnostics?.requestId ?? null,
    route: input.diagnostics?.route ?? '/api/staff/v1/schedule/board',
    method: input.diagnostics?.method ?? 'GET',
    contextMs: input.contextMs,
    recomputeMs: input.recomputeMs,
    driftMs: input.driftMs,
    formattingMs: input.formattingMs,
    projectEstimateMs: input.projectEstimateMs,
    responseMappingMs: input.responseMappingMs,
    totalMs: input.totalMs,
    ...input.counts,
  });
}

export async function loadScheduleBoardResponse(options?: { today?: string; diagnostics?: PortalServerLogContext | null }): Promise<ScheduleBoardResponse> {
  const startedAt = performance.now();
  const requestNowIso = new Date().toISOString();
  let ctx;
  let contextMs = 0;
  let recomputeMs = 0;
  let driftMs = 0;
  let formattingMs = 0;
  let projectEstimateMs = 0;
  let responseMappingMs = 0;
  let boardDataCounts: Record<string, unknown> = {};
  try {
    const contextStartedAt = performance.now();
    ctx = await loadScheduleContext({ today: options?.today && isYmd(options.today) ? options.today : undefined });
    contextMs = elapsedMs(contextStartedAt);
  } catch (error) {
    if (isMissingSchemaError(error)) {
      throw new ScheduleSchemaNotReadyError(schemaNotReadyMessage((error as any)?.message ?? 'missing schema'));
    }
    throw new ScheduleBoardBuildError('Failed to load schedule data', 'load');
  }

  const schedule: ScheduleBoardResponse['schedule'] = [];
  const conflicts: any[] = [];
  const nextAvailableByCrew = new Map<string, string>();

  for (const crewRow of ctx.crews) {
    const crewItems = ctx.items.filter((item) => item.crewId === crewRow.id);
    const crewJobs = ctx.jobs.filter((job) => job.crewId === crewRow.id);
    const crewDowntimes = ctx.downtimes.filter((dt) => dt.crewId === crewRow.id);
    const recomputeStartedAt = performance.now();
    const recompute = recomputeForCrew({
      crewRow,
      items: crewItems,
      jobs: crewJobs,
      downtimes: crewDowntimes,
      calendar: ctx.calendar,
      today: ctx.today,
    });
    recomputeMs += elapsedMs(recomputeStartedAt);

    let jobsWithDrift;
    try {
      const driftStartedAt = performance.now();
      jobsWithDrift = computeJobsWithDriftStatus({
        jobs: crewJobs,
        recompute,
        region: crewRow.calendar_region || 'Auckland',
        calendar: ctx.calendar,
        nowIso: requestNowIso,
      });
      driftMs += elapsedMs(driftStartedAt);
    } catch (error) {
      if (isMissingSchemaError(error)) {
        throw new ScheduleSchemaNotReadyError(schemaNotReadyMessage());
      }
      throw new ScheduleBoardBuildError('Failed to evaluate schedule drift', 'drift');
    }

    const jobsById = new Map(jobsWithDrift.map((job) => [job.id, job]));
    const downtimesById = new Map(crewDowntimes.map((dt) => [dt.id, dt]));
    const formattingStartedAt = performance.now();
    const formatted = formatCrewScheduleBlocks({ crewRow, recompute, jobsById, downtimesById });
    formattingMs += elapsedMs(formattingStartedAt);
    schedule.push(formatted);
    nextAvailableByCrew.set(crewRow.id, formatted.next_available_date);
    conflicts.push(...formatted.conflicts.map((conflict: any) => ({ ...conflict, crew_id: crewRow.id })));
  }

  let unscheduledJobs: ScheduleBoardResponse['unscheduled_jobs'] = [];
  let projectIndex: NonNullable<ScheduleBoardResponse['project_index']> = [];
  let scheduledEstimateIds: NonNullable<ScheduleBoardResponse['scheduled_estimate_ids']> = {};
  try {
    const scheduledProjectIds = new Set(ctx.jobs.map((job) => job.jobId));
    const projectEstimateStartedAt = performance.now();
    const { projects, estimates, diagnostics } = await listBoardProjectsAndEstimates({
      scheduledProjectIds,
      diagnostics: options?.diagnostics ?? null,
    });
    projectEstimateMs = elapsedMs(projectEstimateStartedAt);
    boardDataCounts = diagnostics;
    unscheduledJobs = buildUnscheduledJobs({ projects, estimates, scheduledProjectIds });
    scheduledEstimateIds = computeScheduledEstimateIds(estimates, scheduledProjectIds);
    const relevantProjectIds = new Set<string>(scheduledProjectIds);
    for (const job of unscheduledJobs) {
      const jobId = typeof job?.job_id === 'string' ? job.job_id : '';
      if (jobId) relevantProjectIds.add(jobId);
    }
    projectIndex = projects
      .filter((project) => relevantProjectIds.has(project.id))
      .map((project) => ({
        id: project.id,
        name: project.name,
        customer_name: project.customer_name,
        site_address: project.site_address,
        pipeline_stage: project.pipeline_stage,
        follow_up_date: project.follow_up_date,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    if (isMissingSchemaError(error)) {
      throw new ScheduleSchemaNotReadyError(schemaNotReadyMessage((error as any)?.message ?? 'missing schema'));
    }
  }

  const responseMappingStartedAt = performance.now();
  const board: ScheduleBoardResponse = {
    generated_at: new Date().toISOString(),
    crews: ctx.crews.map((crew) => ({
      id: crew.id,
      name: crew.name,
      color: crew.color,
      is_active: typeof crew.is_active === 'boolean' ? crew.is_active : true,
      sort_order: crew.sort_order,
      calendar_region: crew.calendar_region,
      base_available_date: crew.base_available_date,
      next_available_date: nextAvailableByCrew.get(crew.id) ?? null,
    })),
    schedule,
    project_index: projectIndex,
    unscheduled_jobs: unscheduledJobs,
    conflicts,
    scheduled_estimate_ids: scheduledEstimateIds,
    holidays: ctx.holidays,
    closures: ctx.closures,
  };
  responseMappingMs = elapsedMs(responseMappingStartedAt);

  logDevelopmentBoardDiagnostics({
    diagnostics: options?.diagnostics ?? null,
    contextMs,
    recomputeMs,
    driftMs,
    formattingMs,
    projectEstimateMs,
    responseMappingMs,
    totalMs: elapsedMs(startedAt),
    counts: {
      crewCount: ctx.crews.length,
      scheduleItemCount: ctx.items.length,
      scheduledJobCount: ctx.jobs.length,
      downtimeCount: ctx.downtimes.length,
      unscheduledJobCount: unscheduledJobs.length,
      projectIndexCount: projectIndex.length,
      scheduledEstimateIdCount: Object.keys(scheduledEstimateIds).length,
      ...boardDataCounts,
    },
  });

  return board;
}
