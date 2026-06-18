import type { ScheduleBoardResponse, ScheduleGanttResponse } from '@/lib/repo/scheduleV2Repo';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import { nowIso } from '@/lib/utils/time';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { isYmd } from '@/lib/scheduling/date';
import type { CompanyClosure, NzHoliday } from '@/lib/scheduling/workingDays';
import type { Installer, ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';

export type ScheduleProjectSummary = {
  id: string;
  projectName: string;
  name: string;
  status: string;
  nextActionDate: string | null;
  followUpDate: string | null;
};

type ScheduleV2UnscheduledJob = {
  projectId: string;
  estimateId: string;
  projectName: string;
  status: string;
  durationDays: number;
};

export type ScheduleV2Snapshot = {
  generatedAt: string;
  installers: Installer[];
  projects: ScheduleProjectSummary[];
  scheduleItems: ScheduleItem[];
  conflicts: any[];
  nextAvailableByInstallerId: Record<string, string>;
  unscheduledJobs: ScheduleV2UnscheduledJob[];
  holidays: NzHoliday[];
  closures: CompanyClosure[];
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

export function mapScheduleBoardResponseToV2Snapshot(board: ScheduleBoardResponse): ScheduleV2Snapshot {
  const nextAvailableByInstallerId: Record<string, string> = {};
  const installers: Installer[] = board.crews.map((crew) => {
    const installerId = appIdFromUuid('crew', crew.id);
    if (crew.next_available_date) nextAvailableByInstallerId[installerId] = crew.next_available_date;
    return {
      id: installerId,
      name: crew.name,
      color: crew.color ?? PORTAL_DEFAULT_ACCENT_HEX,
      active: typeof crew.is_active === 'boolean' ? crew.is_active : true,
      sortOrder: Number.isFinite(crew.sort_order) ? crew.sort_order : 0,
      calendarRegion: typeof crew.calendar_region === 'string' ? crew.calendar_region : null,
      baseAvailableDate: typeof crew.base_available_date === 'string' ? crew.base_available_date : null,
    };
  });

  const generatedAt = typeof board.generated_at === 'string' && board.generated_at ? board.generated_at : nowIso();
  const scheduledEstimateIds = board.scheduled_estimate_ids ?? {};
  const projects: ScheduleProjectSummary[] = (Array.isArray(board.project_index) ? board.project_index : []).map((row: any) => ({
    id: appIdFromUuid('proj', typeof row?.id === 'string' ? row.id : ''),
    projectName: typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : 'Untitled project',
    name: typeof row?.name === 'string' && row.name.trim() ? row.name.trim() : 'Untitled project',
    status: typeof row?.pipeline_stage === 'string' && row.pipeline_stage.trim() ? row.pipeline_stage.trim() : 'NEW',
    nextActionDate: typeof row?.follow_up_date === 'string' ? row.follow_up_date : null,
    followUpDate: typeof row?.follow_up_date === 'string' ? row.follow_up_date : null,
  }));

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

  const holidays: NzHoliday[] = (Array.isArray(board.holidays) ? board.holidays : [])
    .map((holiday: any): NzHoliday | null => {
      const date = typeof holiday?.date === 'string' ? holiday.date : '';
      if (!isYmd(date)) return null;
      return {
        date,
        name: typeof holiday?.name === 'string' ? holiday.name : undefined,
        scope: holiday?.scope === 'regional' ? 'regional' : 'national',
        region: typeof holiday?.region === 'string' ? holiday.region : null,
      };
    })
    .filter(Boolean) as NzHoliday[];

  const closures: CompanyClosure[] = (Array.isArray(board.closures) ? board.closures : [])
    .map((closure: any): CompanyClosure | null => {
      const date = typeof closure?.date === 'string' ? closure.date : '';
      if (!isYmd(date)) return null;
      return {
        date,
        name: typeof closure?.name === 'string' ? closure.name : undefined,
        region: typeof closure?.region === 'string' ? closure.region : null,
      };
    })
    .filter(Boolean) as CompanyClosure[];

  return {
    generatedAt,
    installers,
    projects,
    scheduleItems,
    conflicts: board.conflicts ?? [],
    nextAvailableByInstallerId,
    unscheduledJobs,
    holidays,
    closures,
  };
}

export function mapScheduleGanttResponseToV2Snapshot(gantt: ScheduleGanttResponse): ScheduleV2Snapshot {
  const scheduleByCrew = new Map<string, ScheduleBoardResponse['schedule'][number]>();

  for (const crew of gantt.crews) {
    scheduleByCrew.set(crew.id, {
      crew_id: crew.id,
      items: [],
      conflicts: [],
      next_available_date: '',
    });
  }

  for (const item of gantt.items) {
    const lane = scheduleByCrew.get(item.crew_id) ?? {
      crew_id: item.crew_id,
      items: [],
      conflicts: [],
      next_available_date: '',
    };
    lane.items.push(item);
    scheduleByCrew.set(item.crew_id, lane);
  }

  for (const lane of scheduleByCrew.values()) {
    lane.items.sort((a, b) => a.position - b.position);
  }

  return mapScheduleBoardResponseToV2Snapshot({
    generated_at: gantt.generated_at,
    crews: gantt.crews,
    schedule: Array.from(scheduleByCrew.values()),
    project_index: gantt.project_index ?? [],
    unscheduled_jobs: [],
    conflicts: gantt.conflicts ?? [],
    scheduled_estimate_ids: gantt.scheduled_estimate_ids ?? {},
    holidays: gantt.holidays ?? [],
    closures: gantt.closures ?? [],
  });
}
