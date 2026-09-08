import { addDaysYmd, diffDaysYmd, isYmd } from './date';
import { addWorkingDays, isWorkingDay, nextWorkingDay, snapToWorkingDay, workingDaysBetween, type WorkingDayIndex } from './workingDays';

type JobMode = 'floating' | 'pinned';
type JobStatus = 'not_started' | 'in_progress' | 'paused' | 'done';
type PlannedCommitmentType = 'week_of' | 'fixed_date';
type ClientUpdateStatus = 'none' | 'needed' | 'acknowledged';

export type ScheduleCrew = {
  id: string;
  region: string;
  baseAvailableDate?: string | null;
  anchorDate?: string | null;
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
  acceptedOverlaps?: string[];
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
  createdAt?: string | null;
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
  conflicting_job_id?: string;
  overlap_key?: string;
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
  anchor_date?: string;
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

type ReservedInterval = { jobId: string; start: string; end: string };

function reservedJobInterval(job: ScheduledJob, region: string, calendar: WorkingDayIndex, preserveSaved: boolean): ReservedInterval | null {
  if (job.status === 'done' && isYmd(job.actualStart ?? '') && isYmd(job.actualFinish ?? '')) {
    return { jobId: job.id, start: job.actualStart!, end: addDaysYmd(job.actualFinish!, 1) };
  }
  const started = (job.status === 'in_progress' || job.status === 'paused') && isYmd(job.actualStart ?? '');
  if (!started && job.mode !== 'pinned' && !preserveSaved) return null;
  const start = started ? job.actualStart! : isYmd(job.forecastStart ?? '') ? snapToWorkingDay(job.forecastStart!, region, calendar) : null;
  if (!start) return null;
  const end = preserveSaved && isYmd(job.forecastEndExclusive ?? '') && job.forecastEndExclusive! > start
    ? job.forecastEndExclusive!
    : addWorkingDays(start, normalizeDurationDays(job.forecastDurationDays, 1), region, calendar);
  return { jobId: job.id, start, end };
}

function placeAroundReserved(start: string, duration: number, reserved: ReservedInterval[], region: string, calendar: WorkingDayIndex): string {
  let candidate = start;
  for (const interval of reserved) {
    if (candidate < interval.end && addWorkingDays(candidate, duration, region, calendar) > interval.start) {
      candidate = nextWorkingDay(interval.end, region, calendar);
    }
  }
  return candidate;
}

// Remaining days are measured once by an explicit progress command. Reads must
// not add another elapsed day to the same retained "two days remaining" fact.
export function durationAfterProgressUpdate(job: ScheduledJob, today: string, remaining: number, region: string, calendar: WorkingDayIndex): number {
  const elapsed = isYmd(job.actualStart ?? '') ? workingDaysBetween(job.actualStart!, today, region, calendar) : 0;
  return Math.max(1, elapsed + Math.max(0, Math.trunc(remaining)));
}

export function recomputeCrewSchedule(input: {
  crew: ScheduleCrew;
  items: CrewScheduleItem[];
  jobsById: Map<string, ScheduledJob>;
  downtimesById: Map<string, CrewDowntime>;
  today: string;
  calendar: WorkingDayIndex;
  preserveSaved?: boolean;
}): RecomputeResult {
  const { crew, jobsById, downtimesById, today, calendar } = input;
  const items = input.items.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const region = crew.region;

  const scheduledJobs = items.flatMap((item) => item.itemType === 'job' && item.jobId && jobsById.has(item.jobId) ? [jobsById.get(item.jobId)!] : []);
  const savedStarts = scheduledJobs.map((job) => job.forecastStart).filter((date): date is string => typeof date === 'string' && isYmd(date)).sort();
  let inferredAnchor = savedStarts[0];
  // Old queues have no authored anchor. Recover leading downtime before the
  // first saved work without shifting it again on every read.
  if (inferredAnchor && !crew.anchorDate) {
    let leadingDays = 0;
    for (const item of items) {
      if (item.itemType === 'job') break;
      leadingDays += normalizeDurationDays(downtimesById.get(item.downtimeId ?? '')?.durationDays, 0);
    }
    while (leadingDays > 0) {
      inferredAnchor = addDaysYmd(inferredAnchor, -1);
      if (isWorkingDay(inferredAnchor, region, calendar)) leadingDays -= 1;
    }
  }
  const downtimeCreated = [...downtimesById.values()].map((row) => row.createdAt?.slice(0, 10)).filter((date): date is string => typeof date === 'string' && isYmd(date)).sort()[0];
  const anchor = items.length ? crew.anchorDate ?? inferredAnchor ?? downtimeCreated ?? today : today;
  const base = maxDate(anchor, crew.baseAvailableDate ?? anchor);
  let cursor = nextWorkingDay(base, region, calendar);
  const reservedByJobId = new Map(scheduledJobs.map((job) => reservedJobInterval(job, region, calendar, input.preserveSaved === true)).filter((interval): interval is ReservedInterval => interval !== null).map((interval) => [interval.jobId, interval]));
  const reserved = [...reservedByJobId.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));

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
      const start = placeAroundReserved(downtime.createdAt ? cursor : maxDate(cursor, today), durationDays, reserved, region, calendar);
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
    const fixed = reservedByJobId.get(job.id);

    let start: string | null = null;
    let durationDays = normalizeDurationDays(job.forecastDurationDays, 1);

    if (isDone) {
      if (job.actualStart && job.actualFinish && isYmd(job.actualStart ?? '') && isYmd(job.actualFinish ?? '')) {
        const actualStart = job.actualStart;
        const actualFinish = job.actualFinish;
        start = actualStart;
        const endExclusive = addDaysYmd(actualFinish, 1);
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

    if (fixed) {
      start = fixed.start;
    } else {
      start = placeAroundReserved(job.forecastStart ? cursor : maxDate(cursor, today), durationDays, reserved, region, calendar);
    }

    if (!start) {
      issues.push(`Unable to compute start for job ${job.id}.`);
      continue;
    }

    const endExclusive = fixed?.end ?? addWorkingDays(start, durationDays, region, calendar);

    for (const previous of blocks) {
      if (!fixed || !previous.job_id || start >= previous.end_exclusive || endExclusive <= previous.start) continue;
      const overlapDays = workingDaysBetween(start > previous.start ? start : previous.start, endExclusive < previous.end_exclusive ? endExclusive : previous.end_exclusive, region, calendar);
      const overlapKey = `${crew.id}|${[`${job.id}:${start}:${endExclusive}`, `${previous.job_id}:${previous.start}:${previous.end_exclusive}`].sort().join('|')}`;
      if (job.acceptedOverlaps?.includes(overlapKey) || jobsById.get(previous.job_id)?.acceptedOverlaps?.includes(overlapKey)) continue;
      if (overlapDays > 0) conflicts.push({
        overlap_key: overlapKey,
        job_id: job.id, conflicting_job_id: previous.job_id, type: 'pinned_collision',
        expected_cursor_start: previous.end_exclusive, pinned_start: start, overlap_days: overlapDays,
      });
    }

    blocks.push({
      item_id: item.id,
      item_type: 'job',
      crew_id: item.crewId,
      position: item.position,
      start,
      end_exclusive: endExclusive,
      duration_days: durationDays,
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
    anchor_date: base,
    blocks,
    job_updates: jobUpdates,
    conflicts,
    next_available_date: cursor,
    issues,
  };
}
