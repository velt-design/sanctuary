import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { isSchedulingReadyProjectStatus } from '@/lib/scheduling/readiness';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import { nextActionTypeLabel, normalizeProjectStatus } from '@/lib/types/project';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import { buildLaneItems, formatDuration, formatHours, makeJobId, titleCase } from './ScheduleBoardModelShared';

export function toScheduleProjectSummary(project: Project): ScheduleProjectSummary {
  const name = project.projectName ?? project.name ?? 'Untitled project';
  const nextActionDate =
    typeof project.nextActionDate === 'string'
      ? project.nextActionDate
      : typeof project.followUpDate === 'string'
        ? project.followUpDate
        : null;

  return {
    id: project.id,
    projectName: name,
    name,
    status: project.status ?? 'NEW',
    nextActionDate,
    followUpDate: nextActionDate,
  };
}

function normaliseEnumValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isSchedulableEstimate(estimate: Estimate): boolean {
  return normaliseEnumValue((estimate as any).status) !== 'archived';
}

function getLatestSchedulableEstimate(estimates: Estimate[]): Estimate | null {
  const schedulable = estimates.filter((e) => isSchedulableEstimate(e));
  if (!schedulable.length) return null;
  schedulable.sort((a, b) => ((b as any).version ?? 0) - ((a as any).version ?? 0) || b.createdAt.localeCompare(a.createdAt));
  return schedulable[0] ?? null;
}

function getJobDescriptorFromEstimate(estimate: Estimate): string {
  const inputs: unknown = (estimate as any).inputs;
  if (isCalculatorInputsV2(inputs)) {
    const m = inputs.modules?.[0];
    if (!m) return '—';
    const base = `${titleCase(m.pergolaStyle)} · ${titleCase(m.roofMaterial)}`;
    const length = Number.parseFloat(m.lengthM);
    const projection = Number.parseFloat(m.projectionM);
    const pitch = Number.parseFloat(m.roofPitchDeg);
    const dims =
      Number.isFinite(length) && Number.isFinite(projection) ? ` · ${length.toFixed(0)}×${projection.toFixed(0)}m` : '';
    const pitchLabel = Number.isFinite(pitch) && pitch > 0 ? ` · ${pitch.toFixed(0)}°` : '';
    return `${base}${dims}${pitchLabel}`;
  }
  if (isLegacyCalculatorInputsV1(inputs)) {
    const base = `${titleCase(inputs.pergolaStyle)} · ${titleCase(inputs.roofMaterial)}`;
    const length = Number.parseFloat(inputs.lengthM);
    const projection = Number.parseFloat(inputs.projectionM);
    const pitch = Number.parseFloat(inputs.roofPitchDeg);
    const dims =
      Number.isFinite(length) && Number.isFinite(projection) ? ` · ${length.toFixed(0)}×${projection.toFixed(0)}m` : '';
    const pitchLabel = Number.isFinite(pitch) && pitch > 0 ? ` · ${pitch.toFixed(0)}°` : '';
    return `${base}${dims}${pitchLabel}`;
  }
  return '—';
}

export function buildScheduleBoardModelLegacy(input: {
  estimatesById: Map<string, Estimate>;
  installers: Installer[];
  projects: ScheduleProjectSummary[];
  projectsById: Map<string, ScheduleProjectSummary>;
  query: string;
  scheduleItems: ScheduleItem[];
  visibleScheduleItems: ScheduleItem[];
}): ScheduleBoardModel {
  const jobsById = new Map<string, SchedulableJob>();
  const unscheduledJobs: SchedulableJob[] = [];

  const debug = {
    totalProjects: input.projects.length,
    schedulableProjects: 0,
    unscheduledJobs: 0,
    excluded: {
      noEstimates: 0,
      noSchedulableEstimate: 0,
      notReadyStage: 0,
      alreadyScheduled: 0,
    },
    scheduleItems: {
      total: input.scheduleItems.length,
      blocking: 0,
      missingProject: 0,
      missingEstimate: 0,
      estimateNotSchedulable: 0,
    },
  };

  const blockingProjectIds = new Set<string>();
  for (const item of input.scheduleItems) {
    if (item.itemType === 'downtime') continue;
    const project = input.projectsById.get(item.projectId) ?? null;
    if (!project) {
      debug.scheduleItems.missingProject += 1;
      continue;
    }

    const estimate = input.estimatesById.get(item.estimateId) ?? null;
    if (!estimate) {
      debug.scheduleItems.missingEstimate += 1;
      continue;
    }

    if (!isSchedulableEstimate(estimate)) {
      debug.scheduleItems.estimateNotSchedulable += 1;
      continue;
    }

    blockingProjectIds.add(item.projectId);
    debug.scheduleItems.blocking += 1;
  }

  const estimatesByProjectId = new Map<string, Estimate[]>();
  for (const estimate of input.estimatesById.values()) {
    const list = estimatesByProjectId.get(estimate.projectId) ?? [];
    list.push(estimate);
    estimatesByProjectId.set(estimate.projectId, list);
  }

  for (const project of input.projects) {
    const estimates = (estimatesByProjectId.get(project.id) ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!estimates.length) {
      debug.excluded.noEstimates += 1;
      continue;
    }

    const latestEstimate = getLatestSchedulableEstimate(estimates);
    if (!latestEstimate) {
      debug.excluded.noSchedulableEstimate += 1;
      continue;
    }

    debug.schedulableProjects += 1;

    if (blockingProjectIds.has(project.id)) {
      debug.excluded.alreadyScheduled += 1;
      continue;
    }

    const derived = deriveDurationHoursFromEstimate(latestEstimate);
    const durationHours = derived.durationHours;
    const warnings = derived.issues.map((issue) => issue.message);

    const projectName = project.projectName ?? project.name ?? 'Untitled project';
    const status = normalizeProjectStatus(project.status).status;
    if (!isSchedulingReadyProjectStatus(status)) {
      debug.excluded.notReadyStage += 1;
      continue;
    }
    const nextActionDate = (project as any).nextActionDate ?? (project as any).followUpDate ?? null;
    const nextActionType = (project as any).nextActionType ?? null;
    const nextActionSuffix =
      typeof nextActionDate === 'string' && nextActionDate
        ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
        : '';

    const id = makeJobId(project.id, latestEstimate.id);
    const job: SchedulableJob = {
      id,
      projectId: project.id,
      estimateId: latestEstimate.id,
      projectName,
      descriptor: `${getJobDescriptorFromEstimate(latestEstimate)}${nextActionSuffix}`,
      status,
      durationHours,
      durationLabel: formatDuration(durationHours),
      durationTitle: formatHours(durationHours),
      warnings,
    };
    jobsById.set(id, job);
    unscheduledJobs.push(job);
    debug.unscheduledJobs += 1;
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
    const estimate = input.estimatesById.get(item.estimateId) ?? null;

    const projectName = project?.projectName ?? project?.name ?? 'Untitled project';
    const status = project ? normalizeProjectStatus(project.status).status : '—';
    const nextActionDate = project ? ((project as any).nextActionDate ?? (project as any).followUpDate ?? null) : null;
    const nextActionType = project ? ((project as any).nextActionType ?? null) : null;
    const nextActionSuffix =
      typeof nextActionDate === 'string' && nextActionDate
        ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
        : '';

    let durationHours = WORK_HOURS_PER_DAY;
    const warnings: string[] = [];
    if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
      durationHours = item.durationHoursOverride;
    } else if (estimate) {
      const derived = deriveDurationHoursFromEstimate(estimate);
      durationHours = derived.durationHours;
      warnings.push(...derived.issues.map((issue) => issue.message));
    } else {
      warnings.push('Estimate missing; defaulted duration to 1 day.');
    }

    jobsById.set(id, {
      id,
      projectId: item.projectId,
      estimateId: item.estimateId,
      projectName,
      descriptor: `${estimate ? getJobDescriptorFromEstimate(estimate) : '—'}${nextActionSuffix}`,
      status,
      durationHours,
      durationLabel: formatDuration(durationHours),
      durationTitle: formatHours(durationHours),
      warnings,
    });
  }

  unscheduledJobs.sort((a, b) => a.projectName.localeCompare(b.projectName));

  const unscheduledJobsAll = unscheduledJobs;
  const q = input.query.trim().toLowerCase();
  const filteredUnscheduledJobs = unscheduledJobsAll.filter((job) => (!q ? true : job.projectName.toLowerCase().includes(q)));

  return {
    schedulable: {
      jobsById,
      unscheduledJobs,
      debug,
      blockingProjectIds,
    },
    unscheduledJobsAll,
    unscheduledJobs: filteredUnscheduledJobs,
    laneItems: buildLaneItems({ installers: input.installers, visibleScheduleItems: input.visibleScheduleItems }),
  };
}
