import { diffDaysYmd, isYmd } from './date';
import { addWorkingDays, nextWorkingDay, snapToWorkingDay, workingDaysBetween, type WorkingDayIndex } from './workingDays';

type JobMode = 'floating' | 'pinned';
type JobStatus = 'not_started' | 'in_progress' | 'paused' | 'done';
type PlannedCommitmentType = 'week_of' | 'fixed_date';
type ClientUpdateStatus = 'none' | 'needed' | 'acknowledged';

export type ScheduleCrew = {
  id: string;
  region: string;
  baseAvailableDate?: string | null;
};

export type ScheduledJob = {
  id: string;
  jobId: string;
  crewId: string;
  mode: JobMode;
  plannedCommitmentType?: PlannedCommitmentType | null;
  plannedWeekStart?: string | null;
  plannedStart?: string | null;
  plannedDurationDays?: number | null;
  plannedFlexDays?: number | null;
  plannedLockedAt?: string | null;
  plannedLockedBy?: string | null;
  forecastStart?: string | null;
  forecastDurationDays: number;
  forecastEndExclusive?: string | null;
  actualStart?: string | null;
  actualFinish?: string | null;
  status?: JobStatus | null;
  daysRemaining?: number | null;
  driftDays?: number | null;
  clientUpdateStatus?: ClientUpdateStatus | null;
  clientUpdateNeededAt?: string | null;
  clientUpdateAckAt?: string | null;
  clientUpdateAckBy?: string | null;
};

export type CrewDowntime = {
  id: string;
  crewId: string;
  durationDays: number;
  reason?: string;
  note?: string | null;
};

export type CrewScheduleItem = {
  id: string;
  crewId: string;
  itemType: 'job' | 'downtime';
  jobId?: string | null;
  downtimeId?: string | null;
  position: number;
};

export type PinnedConflict = {
  job_id: string;
  type: 'pinned_collision';
  expected_cursor_start: string;
  pinned_start: string;
  overlap_days: number;
};

type ComputedScheduleBlock = {
  item_id: string;
  item_type: 'job' | 'downtime';
  crew_id: string;
  position: number;
  start: string;
  end_exclusive: string;
  duration_days: number;
  job_id?: string;
  downtime_id?: string;
  job_mode?: JobMode;
  job_status?: JobStatus | null;
};

type JobForecastUpdate = {
  id: string;
  forecast_start: string | null;
  forecast_end_exclusive: string | null;
  forecast_duration_days: number;
};

export type RecomputeResult = {
  blocks: ComputedScheduleBlock[];
  job_updates: JobForecastUpdate[];
  conflicts: PinnedConflict[];
  next_available_date: string;
  issues: string[];
};

function normalizeDurationDays(value: unknown, fallback = 1): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.trunc(value));
}

function normalizeNonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function maxDate(a: string, b: string): string {
  if (!isYmd(a)) return b;
  if (!isYmd(b)) return a;
  return diffDaysYmd(a, b) > 0 ? b : a;
}

function isBefore(a: string, b: string): boolean {
  if (!isYmd(a) || !isYmd(b)) return false;
  return diffDaysYmd(a, b) > 0;
}

function advanceCursor(current: string, endExclusive: string, region: string, calendar: WorkingDayIndex): string {
  const candidate = nextWorkingDay(endExclusive, region, calendar);
  if (!isYmd(current) || !isYmd(candidate)) return current;
  return isBefore(current, candidate) ? candidate : current;
}

function buildBlockDuration(start: string, endExclusive: string, region: string, calendar: WorkingDayIndex): number {
  const duration = workingDaysBetween(start, endExclusive, region, calendar);
  return Math.max(1, duration);
}

export function recomputeCrewSchedule(input: {
  crew: ScheduleCrew;
  items: CrewScheduleItem[];
  jobsById: Map<string, ScheduledJob>;
  downtimesById: Map<string, CrewDowntime>;
  today: string;
  calendar: WorkingDayIndex;
}): RecomputeResult {
  const { crew, jobsById, downtimesById, today, calendar } = input;
  const items = input.items.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const region = crew.region;

  const base = maxDate(today, crew.baseAvailableDate ?? today);
  let cursor = nextWorkingDay(base, region, calendar);

  const blocks: ComputedScheduleBlock[] = [];
  const jobUpdates: JobForecastUpdate[] = [];
  const conflicts: PinnedConflict[] = [];
  const issues: string[] = [];

  for (const item of items) {
    if (item.itemType === 'downtime') {
      const downtimeId = item.downtimeId ?? '';
      const downtime = downtimesById.get(downtimeId);
      if (!downtime) {
        issues.push(`Missing downtime ${downtimeId || 'unknown'} for schedule item ${item.id}.`);
        continue;
      }
      const durationDays = normalizeDurationDays(downtime.durationDays, 1);
      const start = cursor;
      const endExclusive = addWorkingDays(start, durationDays, region, calendar);
      blocks.push({
        item_id: item.id,
        item_type: 'downtime',
        crew_id: item.crewId,
        position: item.position,
        start,
        end_exclusive: endExclusive,
        duration_days: durationDays,
        downtime_id: downtime.id,
      });
      cursor = advanceCursor(cursor, endExclusive, region, calendar);
      continue;
    }

    const jobId = item.jobId ?? '';
    const job = jobsById.get(jobId);
    if (!job) {
      issues.push(`Missing job ${jobId || 'unknown'} for schedule item ${item.id}.`);
      continue;
    }

    const status: JobStatus | null = job.status ?? null;
    const isDone = status === 'done';
    const isInProgress = status === 'in_progress';
    const isPinned = job.mode === 'pinned';

    let start: string | null = null;
    let durationDays = normalizeDurationDays(job.forecastDurationDays, 1);

    if (isDone) {
      if (job.actualStart && job.actualFinish && isYmd(job.actualStart) && isYmd(job.actualFinish)) {
        const actualStart = snapToWorkingDay(job.actualStart, region, calendar);
        const actualFinish = snapToWorkingDay(job.actualFinish, region, calendar);
        start = actualStart;
        const endExclusive = addWorkingDays(actualFinish, 1, region, calendar);
        durationDays = buildBlockDuration(actualStart, endExclusive, region, calendar);
        blocks.push({
          item_id: item.id,
          item_type: 'job',
          crew_id: item.crewId,
          position: item.position,
          start: actualStart,
          end_exclusive: endExclusive,
          duration_days: durationDays,
          job_id: job.id,
          job_mode: job.mode,
          job_status: status,
        });
        jobUpdates.push({
          id: job.id,
          forecast_start: actualStart,
          forecast_end_exclusive: endExclusive,
          forecast_duration_days: durationDays,
        });
        cursor = advanceCursor(cursor, endExclusive, region, calendar);
        continue;
      }
    }

    if (isInProgress && job.actualStart && isYmd(job.actualStart)) {
      start = snapToWorkingDay(job.actualStart, region, calendar);
      const remaining = normalizeNonNegativeInt(job.daysRemaining);
      if (remaining !== null) {
        const elapsed = workingDaysBetween(start, today, region, calendar);
        durationDays = Math.max(1, elapsed + remaining);
      }
    } else if (isPinned) {
      if (job.forecastStart && isYmd(job.forecastStart)) {
        start = snapToWorkingDay(job.forecastStart, region, calendar);
      } else {
        start = cursor;
      }
    } else {
      start = cursor;
    }

    if (!start) {
      issues.push(`Unable to compute start for job ${job.id}.`);
      continue;
    }

    const endExclusive = addWorkingDays(start, durationDays, region, calendar);

    if (isPinned && isBefore(start, cursor)) {
      const overlapDays = workingDaysBetween(start, cursor, region, calendar);
      conflicts.push({
        job_id: job.id,
        type: 'pinned_collision',
        expected_cursor_start: cursor,
        pinned_start: start,
        overlap_days: overlapDays,
      });
    }

    blocks.push({
      item_id: item.id,
      item_type: 'job',
      crew_id: item.crewId,
      position: item.position,
      start,
      end_exclusive: endExclusive,
      duration_days: buildBlockDuration(start, endExclusive, region, calendar),
      job_id: job.id,
      job_mode: job.mode,
      job_status: status,
    });

    jobUpdates.push({
      id: job.id,
      forecast_start: start,
      forecast_end_exclusive: endExclusive,
      forecast_duration_days: durationDays,
    });

    cursor = advanceCursor(cursor, endExclusive, region, calendar);
  }

  return {
    blocks,
    job_updates: jobUpdates,
    conflicts,
    next_available_date: cursor,
    issues,
  };
}
