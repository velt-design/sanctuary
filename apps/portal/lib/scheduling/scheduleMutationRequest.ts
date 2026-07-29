type ParsedScheduleForce =
  | { ok: true; value: boolean }
  | { ok: false; error: 'force must be a boolean' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAX_SCHEDULE_DURATION_DAYS = 365;

export type ScheduleCommitImpact = {
  job_id: string;
  scheduled_job_id: string;
  before_start: string | null;
  after_start: string | null;
};

export function parseScheduleForce(value: unknown): ParsedScheduleForce {
  if (value === undefined) {
    return { ok: true, value: false };
  }

  if (typeof value !== 'boolean') {
    return { ok: false, error: 'force must be a boolean' };
  }

  return { ok: true, value };
}

export function isCanonicalScheduleUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    UUID_PATTERN.test(value)
  );
}

export function isCalendarYmd(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function excludeTargetCommitImpacts(
  impacts: ScheduleCommitImpact[],
  target: { jobId?: string | null; scheduledJobId?: string | null },
): ScheduleCommitImpact[] {
  return impacts.filter(
    (impact) =>
      (!target.jobId || impact.job_id !== target.jobId) &&
      (!target.scheduledJobId || impact.scheduled_job_id !== target.scheduledJobId),
  );
}
