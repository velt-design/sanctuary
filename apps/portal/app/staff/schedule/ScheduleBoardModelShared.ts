import type { ScheduleProjectSummary, ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { isSchedulingReadyProjectStatus } from '@/lib/scheduling/readiness';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { addDaysYmd, isYmd } from '@/lib/scheduling/date';
import { normalizeProjectStatus } from '@/lib/types/project';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import { buildScheduleJobIdentity } from './ScheduleJobPresentation';

export const EMPTY_SCHEDULE_BOARD_MODEL: ScheduleBoardModel = {
  schedulable: {
    jobsById: new Map(),
    unscheduledJobs: [],
    debug: {},
    blockingProjectIds: new Set(),
  },
  unscheduledJobsAll: [],
  unscheduledJobs: [],
  laneItems: new Map(),
};

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  const days = hours / WORK_HOURS_PER_DAY;
  const daysLabel = Number.isFinite(days) ? days.toFixed(days % 1 === 0 ? 0 : 1) : '—';
  return `${daysLabel}d`;
}

export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  const h = hours.toFixed(hours % 1 === 0 ? 0 : 1);
  return `${h}h`;
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
}

export function makeJobId(projectId: string, estimateId: string): string {
  return `job_${projectId}_${estimateId}`;
}

function safeProjectName(project: ScheduleProjectSummary | null | undefined): string {
  return project?.projectName ?? project?.name ?? 'Untitled project';
}

function safeProjectStatus(project: ScheduleProjectSummary | null | undefined): string {
  return project?.status ?? 'NEW';
}

export function isCompletedScheduleItem(item: ScheduleItem, today: string): boolean {
  if (item.itemType === 'downtime') return false;
  if (item.jobStatus === 'done') return true;
  const rawStatus = typeof item.scheduleStatus === 'string' ? item.scheduleStatus.trim().toUpperCase() : '';
  if (rawStatus === 'COMPLETED') return true;
  const actualEnd = typeof item.actualEndDate === 'string' ? item.actualEndDate : '';
  if (actualEnd && actualEnd <= today) return true;
  return false;
}

function endInclusiveFromExclusive(endExclusive: string, fallback: string): string {
  if (!isYmd(endExclusive)) return fallback;
  return addDaysYmd(endExclusive, -1);
}

export function buildScheduleBarsFromForecast(input: {
  scheduleItems: ScheduleItem[];
  projectsById: Map<string, ScheduleProjectSummary>;
}): { bars: Array<{ scheduleItemId: string; installerId: string; projectId: string; estimateId: string; projectName: string; status: string; startDate: string; endDate: string; durationHours: number }>; issues: SchedulingIssue[] } {
  const bars: Array<{ scheduleItemId: string; installerId: string; projectId: string; estimateId: string; projectName: string; status: string; startDate: string; endDate: string; durationHours: number }> = [];
  const issues: SchedulingIssue[] = [];

  for (const item of input.scheduleItems) {
    const start = item.forecastStart ?? item.startDateOverride ?? '';
    if (!start || !isYmd(start)) continue;
    const durationDays =
      typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? item.forecastDurationDays
        : typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? item.durationHoursOverride / WORK_HOURS_PER_DAY
          : 1;
    const endExclusive = item.forecastEndExclusive ?? (start ? addDaysYmd(start, Math.max(1, Math.ceil(durationDays))) : start);
    const endDate = endInclusiveFromExclusive(endExclusive, start);

    const project = item.projectId ? input.projectsById.get(item.projectId) ?? null : null;
    const projectName =
      item.itemType === 'downtime'
        ? `Downtime${item.downtimeReason ? ` · ${titleCase(item.downtimeReason)}` : ''}`
        : safeProjectName(project);
    const status = item.itemType === 'downtime' ? 'DOWNTIME' : safeProjectStatus(project);

    bars.push({
      scheduleItemId: item.id,
      installerId: item.installerId,
      projectId: item.projectId,
      estimateId: item.estimateId,
      projectName,
      status,
      startDate: start,
      endDate,
      durationHours: Math.max(0.5, durationDays * WORK_HOURS_PER_DAY),
    });
  }

  return { bars, issues };
}

export function mapV2UnscheduledJobs(list: ScheduleV2Snapshot['unscheduledJobs'] | null | undefined): SchedulableJob[] {
  if (!Array.isArray(list)) return [];
  const out: SchedulableJob[] = [];
  for (const job of list) {
    const projectId = typeof job?.projectId === 'string' ? job.projectId : '';
    const estimateId = typeof job?.estimateId === 'string' ? job.estimateId : '';
    if (!projectId || !estimateId) continue;
    const status = normalizeProjectStatus(job?.status ?? 'NEW').status;
    if (!isSchedulingReadyProjectStatus(status)) continue;

    const durationDays =
      typeof job?.durationDays === 'number' && Number.isFinite(job.durationDays) && job.durationDays > 0 ? job.durationDays : 1;
    const durationHours = Math.max(0.5, durationDays * WORK_HOURS_PER_DAY);

    out.push({
      ...buildScheduleJobIdentity({
        id: projectId,
        projectName: job.projectName,
        name: job.projectName,
        customerName: job.customerName,
        siteAddress: job.siteAddress,
        status,
        nextActionDate: null,
        followUpDate: null,
      }),
      id: makeJobId(projectId, estimateId),
      projectId,
      estimateId,
      descriptor: '',
      status,
      durationHours,
      durationLabel: formatDuration(durationHours),
      durationTitle: formatHours(durationHours),
      warnings: [],
    });
  }
  out.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return out;
}

export function buildLaneItems(input: { installers: Installer[]; visibleScheduleItems: ScheduleItem[] }): Map<string, ScheduleItem[]> {
  const laneItems = new Map<string, ScheduleItem[]>();
  for (const installer of input.installers) laneItems.set(installer.id, []);
  for (const item of input.visibleScheduleItems) {
    const list = laneItems.get(item.installerId);
    if (list) list.push(item);
    else laneItems.set(item.installerId, [item]);
  }
  for (const list of laneItems.values()) {
    list.sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));
  }
  return laneItems;
}
