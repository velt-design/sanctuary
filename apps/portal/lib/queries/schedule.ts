import { queryOptions } from '@tanstack/react-query';
import { fetchScheduleBoard } from '@/lib/repo/scheduleV2Repo';
import { listProjects } from '@/lib/repo/projectsRepo';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { nowIso } from '@/lib/utils/time';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { Project } from '@/lib/types/project';
import type { Installer, ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import { qk } from './keys';

export type ScheduleV2UnscheduledJob = {
  projectId: string;
  estimateId: string;
  projectName: string;
  status: string;
  durationDays: number;
};

export type ScheduleV2Snapshot = {
  generatedAt: string;
  installers: Installer[];
  projects: Project[];
  scheduleItems: ScheduleItem[];
  conflicts: any[];
  nextAvailableByInstallerId: Record<string, string>;
  unscheduledJobs: ScheduleV2UnscheduledJob[];
};

function scheduleStatusFromJobStatus(value: unknown): ScheduleItemStatus {
  const s = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (s === 'done') return 'COMPLETED';
  if (s === 'in_progress' || s === 'paused') return 'IN_PROGRESS';
  return 'TENTATIVE';
}

function safeDurationDays(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

async function fetchScheduleV2Snapshot(today: string): Promise<ScheduleV2Snapshot> {
  const [board, projects] = await Promise.all([fetchScheduleBoard({ today }), listProjects()]);

  const nextAvailableByInstallerId: Record<string, string> = {};
  const installers: Installer[] = board.crews.map((crew) => {
    const installerId = appIdFromUuid('crew', crew.id);
    if (crew.next_available_date) nextAvailableByInstallerId[installerId] = crew.next_available_date;
    return {
      id: installerId,
      name: crew.name,
      color: crew.color ?? '#7A3B3B',
      active: typeof crew.is_active === 'boolean' ? crew.is_active : true,
      sortOrder: Number.isFinite(crew.sort_order) ? crew.sort_order : 0,
    };
  });

  const generatedAt = typeof board.generated_at === 'string' && board.generated_at ? board.generated_at : nowIso();
  const scheduledEstimateIds = board.scheduled_estimate_ids ?? {};

  const scheduleItems: ScheduleItem[] = [];
  for (const lane of board.schedule) {
    const installerId = appIdFromUuid('crew', lane.crew_id);
    if (lane.next_available_date) nextAvailableByInstallerId[installerId] = lane.next_available_date;

    for (const item of lane.items) {
      if (item.item_type === 'job' && item.job) {
        const projectUuid = item.job.job_id;
        const projectId = appIdFromUuid('proj', projectUuid);
        const estimateUuid = typeof scheduledEstimateIds[projectUuid] === 'string' ? scheduledEstimateIds[projectUuid] : '';
        const estimateId = estimateUuid ? appIdFromUuid('est', estimateUuid) : '';
        scheduleItems.push({
          id: appIdFromUuid('sch', item.id),
          installerId,
          projectId,
          estimateId,
          sortIndex: item.position,
          scheduleStatus: scheduleStatusFromJobStatus(item.job.status),
          locked: false,
          actualStartDate: item.job.actual_start ?? null,
          actualEndDate: item.job.actual_finish ?? null,
          startDateOverride: item.job.forecast_start ?? undefined,
          durationHoursOverride: item.job.forecast_duration_days * WORK_HOURS_PER_DAY,
          updatedAt: generatedAt,
          itemType: 'job',
          scheduledJobId: item.job.id,
          forecastStart: item.job.forecast_start,
          forecastEndExclusive: item.job.forecast_end_exclusive,
          forecastDurationDays: item.job.forecast_duration_days,
          plannedCommitmentType: item.job.planned_commitment_type,
          plannedWeekStart: item.job.planned_week_start,
          plannedStart: item.job.planned_start,
          plannedDurationDays: item.job.planned_duration_days,
          plannedFlexDays: item.job.planned_flex_days,
          plannedLockedAt: item.job.planned_locked_at ?? null,
          plannedLockedBy: item.job.planned_locked_by ?? null,
          driftDays: typeof item.job.drift_days === 'number' ? item.job.drift_days : null,
          clientUpdateStatus: item.job.client_update_status ?? null,
          clientUpdateNeededAt: item.job.client_update_needed_at ?? null,
          clientUpdateAckAt: item.job.client_update_ack_at ?? null,
          clientUpdateAckBy: item.job.client_update_ack_by ?? null,
          mode: item.job.mode,
          jobStatus: item.job.status,
          daysRemaining: item.job.days_remaining,
        });
        continue;
      }

      if (item.item_type === 'downtime') {
        scheduleItems.push({
          id: appIdFromUuid('sch', item.id),
          installerId,
          projectId: '',
          estimateId: '',
          sortIndex: item.position,
          scheduleStatus: 'TENTATIVE',
          locked: false,
          startDateOverride: item.start,
          durationHoursOverride: item.duration_days * WORK_HOURS_PER_DAY,
          updatedAt: generatedAt,
          itemType: 'downtime',
          downtimeId: item.downtime?.id ?? null,
          downtimeReason: item.downtime?.reason ?? null,
          downtimeNote: item.downtime?.note ?? null,
          forecastStart: item.start,
          forecastEndExclusive: item.end_exclusive,
          forecastDurationDays: item.duration_days,
        });
      }
    }
  }

  scheduleItems.sort((a, b) => a.installerId.localeCompare(b.installerId) || a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));

  const unscheduledJobs: ScheduleV2UnscheduledJob[] = (Array.isArray(board.unscheduled_jobs) ? board.unscheduled_jobs : [])
    .map((job: any) => {
      const projectUuid = typeof job?.job_id === 'string' ? job.job_id : '';
      const estimateUuid = typeof job?.estimate_id === 'string' ? job.estimate_id : '';
      if (!projectUuid || !estimateUuid) return null;
      return {
        projectId: appIdFromUuid('proj', projectUuid),
        estimateId: appIdFromUuid('est', estimateUuid),
        projectName: typeof job?.project_name === 'string' ? job.project_name : '',
        status: typeof job?.status === 'string' ? job.status : 'NEW',
        durationDays: safeDurationDays(job?.duration_days),
      };
    })
    .filter(Boolean) as ScheduleV2UnscheduledJob[];

  return {
    generatedAt,
    installers,
    projects,
    scheduleItems,
    conflicts: board.conflicts ?? [],
    nextAvailableByInstallerId,
    unscheduledJobs,
  };
}

export const scheduleV2SnapshotQueryOptions = (host: string, today: string) =>
  queryOptions({
    queryKey: qk.schedule.board(host, today),
    queryFn: () => fetchScheduleV2Snapshot(today),
  });
