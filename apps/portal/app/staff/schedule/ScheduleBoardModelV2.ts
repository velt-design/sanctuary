import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { nextActionTypeLabel, normalizeProjectStatus } from '@/lib/types/project';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import { buildLaneItems, formatDuration, formatHours, titleCase } from './ScheduleBoardModelShared';

export function buildScheduleBoardModelV2(input: {
  installers: Installer[];
  orphanedScheduleItems: ScheduleItem[];
  projects: ScheduleProjectSummary[];
  projectsById: Map<string, ScheduleProjectSummary>;
  query: string;
  scheduleItems: ScheduleItem[];
  scheduleItemsRenderable: ScheduleItem[];
  unscheduledJobsSeed: SchedulableJob[];
  visibleScheduleItems: ScheduleItem[];
}): ScheduleBoardModel {
  const jobsById = new Map<string, SchedulableJob>();
  const unscheduledJobs = input.unscheduledJobsSeed;
  for (const job of unscheduledJobs) jobsById.set(job.id, job);

  const blockingProjectIds = new Set<string>();
  for (const item of input.scheduleItemsRenderable) {
    if (item.itemType === 'downtime') continue;
    if (item.projectId) blockingProjectIds.add(item.projectId);
  }

  for (const item of input.visibleScheduleItems) {
    const id = item.id;
    if (jobsById.has(id)) continue;

    if (item.itemType === 'downtime') {
      const durationHours =
        typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? item.durationHoursOverride
          : WORK_HOURS_PER_DAY;
      const reason = item.downtimeReason ? titleCase(item.downtimeReason) : 'Downtime';
      jobsById.set(id, {
        id,
        projectId: '',
        estimateId: '',
        projectName: reason,
        descriptor: item.downtimeNote ?? 'Crew unavailable',
        status: 'DOWNTIME',
        durationHours,
        durationLabel: formatDuration(durationHours),
        durationTitle: formatHours(durationHours),
        warnings: [],
      });
      continue;
    }

    const project = input.projectsById.get(item.projectId) ?? null;
    const projectName = project?.projectName ?? project?.name ?? 'Untitled project';
    const status = project ? normalizeProjectStatus(project.status).status : '—';
    const nextActionDate = project ? ((project as any).nextActionDate ?? (project as any).followUpDate ?? null) : null;
    const nextActionType = project ? ((project as any).nextActionType ?? null) : null;
    const nextActionSuffix =
      typeof nextActionDate === 'string' && nextActionDate
        ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
        : '';
    const nextActionLine = nextActionSuffix ? nextActionSuffix.replace(/^ · /, '') : '';

    let durationHours = WORK_HOURS_PER_DAY;
    if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
      durationHours = item.durationHoursOverride;
    } else if (
      typeof item.forecastDurationDays === 'number' &&
      Number.isFinite(item.forecastDurationDays) &&
      item.forecastDurationDays > 0
    ) {
      durationHours = item.forecastDurationDays * WORK_HOURS_PER_DAY;
    }

    jobsById.set(id, {
      id,
      projectId: item.projectId,
      estimateId: item.estimateId,
      projectName,
      descriptor: nextActionLine,
      status,
      durationHours,
      durationLabel: formatDuration(durationHours),
      durationTitle: formatHours(durationHours),
      warnings: [],
    });
  }

  const unscheduledJobsAll = unscheduledJobs;
  const q = input.query.trim().toLowerCase();
  const filteredUnscheduledJobs = unscheduledJobsAll.filter((job) => (!q ? true : job.projectName.toLowerCase().includes(q)));

  return {
    schedulable: {
      jobsById,
      unscheduledJobs,
      debug: {
        totalProjects: input.projects.length,
        schedulableProjects: unscheduledJobs.length + blockingProjectIds.size,
        unscheduledJobs: unscheduledJobs.length,
        excluded: {
          noEstimates: 0,
          noSchedulableEstimate: 0,
          alreadyScheduled: 0,
        },
        scheduleItems: {
          total: input.scheduleItems.length,
          blocking: input.scheduleItemsRenderable.filter((item) => item.itemType !== 'downtime').length,
          missingProject: input.orphanedScheduleItems.length,
          missingEstimate: 0,
          estimateNotSchedulable: 0,
        },
      },
      blockingProjectIds,
    },
    unscheduledJobsAll,
    unscheduledJobs: filteredUnscheduledJobs,
    laneItems: buildLaneItems({ installers: input.installers, visibleScheduleItems: input.visibleScheduleItems }),
  };
}
