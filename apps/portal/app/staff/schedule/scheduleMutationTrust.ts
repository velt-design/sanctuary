import { ApiError } from '@/lib/repo/apiClient';
import type { ScheduleCrewSchedule, ScheduleMutationResult } from '@/lib/repo/scheduleV2Repo';
import {
  isCalendarYmd,
  isCanonicalScheduleUuid,
} from '@/lib/scheduling/scheduleMutationRequest';

type ScheduleCommitImpact = {
  job_id: string;
  scheduled_job_id: string;
  before_start: string | null;
  after_start: string | null;
};

type ScheduleFinishEarlyPreview = {
  freedDays: number;
  actualFinish: string;
  forecastEndExclusive: string | null;
  impacts: ScheduleCommitImpact[];
};

type ScheduleMutationEnvelopeOptions = {
  allowMissingSchedule?: boolean;
  requireSourceSchedule?: boolean;
  expectedCrewId?: string;
  expectedSourceCrewId?: string;
};

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isUuid(value: unknown): value is string {
  return isCanonicalScheduleUuid(value);
}

function isNullableYmd(value: unknown): value is string | null {
  return value === null || isCalendarYmd(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function isDefinitiveScheduleMutationFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 408) return false;
  return error.status < 500 || error.status === 501;
}

export function scheduleMutationNeedsReconciliation(error: unknown): boolean {
  if (!isDefinitiveScheduleMutationFailure(error)) return true;
  return error instanceof ApiError && (error.status === 404 || error.status === 409);
}

export function parseScheduleCommitImpacts(value: unknown): ScheduleCommitImpact[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const jobIds = new Set<string>();
  const scheduledJobIds = new Set<string>();
  const impacts: ScheduleCommitImpact[] = [];

  for (const rawImpact of value) {
    if (!rawImpact || typeof rawImpact !== 'object') return null;
    const impact = rawImpact as Record<string, unknown>;
    const jobId = typeof impact.job_id === 'string' ? impact.job_id.trim() : '';
    const scheduledJobId =
      typeof impact.scheduled_job_id === 'string' ? impact.scheduled_job_id.trim() : '';
    const beforeStart = impact.before_start;
    const afterStart = impact.after_start;
    const beforeValid = isNullableYmd(beforeStart);
    const afterValid = isNullableYmd(afterStart);

    if (
      !isUuid(jobId) ||
      !isUuid(scheduledJobId) ||
      !beforeValid ||
      !afterValid ||
      beforeStart === afterStart ||
      jobIds.has(jobId) ||
      scheduledJobIds.has(scheduledJobId)
    ) {
      return null;
    }

    jobIds.add(jobId);
    scheduledJobIds.add(scheduledJobId);
    impacts.push({
      job_id: jobId,
      scheduled_job_id: scheduledJobId,
      before_start: beforeStart as string | null,
      after_start: afterStart as string | null,
    });
  }

  return impacts;
}

export function parseScheduleFinishEarlyPreview(value: unknown): ScheduleFinishEarlyPreview | null {
  if (!value || typeof value !== 'object') return null;
  const preview = value as Record<string, unknown>;
  if (
    preview.requires_finish_early !== true ||
    hasOwn(preview, 'ok') ||
    hasOwn(preview, 'requires_confirmation') ||
    !isPositiveInteger(preview.freed_days) ||
    !isCalendarYmd(preview.actual_finish) ||
    !isCalendarYmd(preview.forecast_end_exclusive) ||
    preview.forecast_end_exclusive <= preview.actual_finish ||
    !Array.isArray(preview.impacts)
  ) {
    return null;
  }

  const impacts = preview.impacts.length === 0 ? [] : parseScheduleCommitImpacts(preview.impacts);
  if (!impacts) return null;

  return {
    freedDays: preview.freed_days,
    actualFinish: preview.actual_finish,
    forecastEndExclusive: preview.forecast_end_exclusive,
    impacts,
  };
}

export function parseScheduleConfirmationEnvelope(value: unknown): ScheduleCommitImpact[] | null {
  if (!value || typeof value !== 'object') return null;
  const response = value as Record<string, unknown>;
  if (
    response.requires_confirmation !== true ||
    hasOwn(response, 'ok') ||
    hasOwn(response, 'requires_finish_early')
  ) {
    return null;
  }
  return parseScheduleCommitImpacts(response.impacts);
}

export function isValidScheduleCrewSchedule(value: unknown): value is ScheduleCrewSchedule {
  if (!value || typeof value !== 'object') return false;
  const schedule = value as Record<string, unknown>;
  if (
    !isUuid(schedule.crew_id) ||
    !Array.isArray(schedule.items) ||
    !Array.isArray(schedule.conflicts) ||
    !isCalendarYmd(schedule.next_available_date)
  ) {
    return false;
  }

  const itemIds = new Set<string>();
  const positions = new Set<number>();
  const scheduledJobIds = new Set<string>();
  const projectJobIds = new Set<string>();
  const downtimeIds = new Set<string>();
  for (const rawItem of schedule.items) {
    if (!rawItem || typeof rawItem !== 'object') return false;
    const item = rawItem as Record<string, unknown>;
    if (
      !isUuid(item.id) ||
      itemIds.has(item.id) ||
      !isNonNegativeInteger(item.position) ||
      positions.has(item.position) ||
      !isCalendarYmd(item.start) ||
      !isCalendarYmd(item.end_exclusive) ||
      item.end_exclusive <= item.start ||
      !isPositiveInteger(item.duration_days)
    ) {
      return false;
    }
    itemIds.add(item.id);
    positions.add(item.position);

    if (item.item_type === 'job') {
      if (
        !item.job ||
        typeof item.job !== 'object' ||
        ('downtime' in item && item.downtime !== null)
      ) {
        return false;
      }
      const job = item.job as Record<string, unknown>;
      if (
        !isUuid(job.id) ||
        !isUuid(job.job_id) ||
        scheduledJobIds.has(job.id) ||
        projectJobIds.has(job.job_id) ||
        job.crew_id !== schedule.crew_id ||
        (job.mode !== 'floating' && job.mode !== 'pinned') ||
        ![null, 'week_of', 'fixed_date'].includes(job.planned_commitment_type as null | string) ||
        !isNullableYmd(job.planned_week_start) ||
        !isNullableYmd(job.planned_start) ||
        !(job.planned_duration_days === null || isPositiveInteger(job.planned_duration_days)) ||
        !(job.planned_flex_days === null || isNonNegativeInteger(job.planned_flex_days)) ||
        job.forecast_start !== item.start ||
        job.forecast_end_exclusive !== item.end_exclusive ||
        job.forecast_duration_days !== item.duration_days ||
        !isNullableYmd(job.actual_start) ||
        !isNullableYmd(job.actual_finish) ||
        ![null, 'not_started', 'in_progress', 'paused', 'done'].includes(job.status as null | string) ||
        !(job.days_remaining === null || isNonNegativeInteger(job.days_remaining))
      ) {
        return false;
      }
      scheduledJobIds.add(job.id);
      projectJobIds.add(job.job_id);
      if (
        ('planned_locked_at' in job && !isNullableString(job.planned_locked_at)) ||
        ('planned_locked_by' in job && !isNullableString(job.planned_locked_by)) ||
        ('drift_days' in job && !(job.drift_days === null || isNonNegativeInteger(job.drift_days))) ||
        ('client_update_status' in job &&
          ![null, 'none', 'needed', 'acknowledged'].includes(job.client_update_status as null | string)) ||
        ('client_update_needed_at' in job && !isNullableString(job.client_update_needed_at)) ||
        ('client_update_ack_at' in job && !isNullableString(job.client_update_ack_at)) ||
        ('client_update_ack_by' in job && !isNullableString(job.client_update_ack_by))
      ) {
        return false;
      }
      continue;
    }

    if (item.item_type === 'downtime') {
      if (
        ('job' in item && item.job !== null) ||
        !item.downtime ||
        typeof item.downtime !== 'object'
      ) {
        return false;
      }
      const downtime = item.downtime as Record<string, unknown>;
      if (
        !isUuid(downtime.id) ||
        downtimeIds.has(downtime.id) ||
        downtime.crew_id !== schedule.crew_id ||
        downtime.duration_days !== item.duration_days ||
        ('reason' in downtime && typeof downtime.reason !== 'string') ||
        ('note' in downtime && !isNullableString(downtime.note))
      ) {
        return false;
      }
      downtimeIds.add(downtime.id);
      continue;
    }

    return false;
  }

  const conflictJobIds = new Set<string>();
  for (const rawConflict of schedule.conflicts) {
    if (!rawConflict || typeof rawConflict !== 'object') return false;
    const conflict = rawConflict as Record<string, unknown>;
    if (
      !isUuid(conflict.job_id) ||
      !scheduledJobIds.has(conflict.job_id) ||
      conflictJobIds.has(conflict.job_id) ||
      conflict.type !== 'pinned_collision' ||
      !isCalendarYmd(conflict.expected_cursor_start) ||
      !isCalendarYmd(conflict.pinned_start) ||
      !isPositiveInteger(conflict.overlap_days)
    ) {
      return false;
    }
    conflictJobIds.add(conflict.job_id);
  }

  return true;
}

export function isValidScheduleMutationEnvelope(
  value: unknown,
  options: ScheduleMutationEnvelopeOptions = {},
): value is ScheduleMutationResult {
  if (!value || typeof value !== 'object') return false;
  const response = value as Record<string, unknown>;
  if (
    response.ok !== true ||
    hasOwn(response, 'requires_confirmation') ||
    hasOwn(response, 'requires_finish_early')
  ) {
    return false;
  }

  const hasSchedule = hasOwn(response, 'schedule');
  if (!hasSchedule && !options.allowMissingSchedule) return false;

  if (hasSchedule) {
    if (!isValidScheduleCrewSchedule(response.schedule)) return false;
    if (!isUuid(response.crew_id) || response.crew_id !== response.schedule.crew_id) return false;
    if (options.expectedCrewId && response.crew_id !== options.expectedCrewId) return false;
  } else if (
    hasOwn(response, 'crew_id') ||
    hasOwn(response, 'source_crew_id') ||
    hasOwn(response, 'source_schedule')
  ) {
    return false;
  }

  const hasSourceCrewId = hasOwn(response, 'source_crew_id');
  const hasSourceSchedule = hasOwn(response, 'source_schedule');
  if (hasSourceCrewId !== hasSourceSchedule) return false;
  if ((hasSourceCrewId || hasSourceSchedule) && !options.requireSourceSchedule) return false;
  if (options.requireSourceSchedule && (!hasSourceCrewId || !hasSourceSchedule)) return false;

  if (hasSourceSchedule) {
    if (!isValidScheduleCrewSchedule(response.source_schedule)) return false;
    if (!isUuid(response.source_crew_id) || response.source_crew_id !== response.source_schedule.crew_id) {
      return false;
    }
    if (response.source_crew_id === response.crew_id) return false;
    if (options.expectedSourceCrewId && response.source_crew_id !== options.expectedSourceCrewId) {
      return false;
    }
    const targetSchedule = response.schedule as ScheduleCrewSchedule;
    const sourceSchedule = response.source_schedule as ScheduleCrewSchedule;
    const targetItemIds = new Set(targetSchedule.items.map((item) => item.id));
    const targetScheduledJobIds = new Set(
      targetSchedule.items.flatMap((item) => (item.item_type === 'job' && item.job ? [item.job.id] : [])),
    );
    const targetProjectJobIds = new Set(
      targetSchedule.items.flatMap((item) => (item.item_type === 'job' && item.job ? [item.job.job_id] : [])),
    );
    const targetDowntimeIds = new Set(
      targetSchedule.items.flatMap((item) =>
        item.item_type === 'downtime' && item.downtime ? [item.downtime.id] : [],
      ),
    );
    for (const item of sourceSchedule.items) {
      if (targetItemIds.has(item.id)) return false;
      if (
        item.item_type === 'job' &&
        item.job &&
        (targetScheduledJobIds.has(item.job.id) || targetProjectJobIds.has(item.job.job_id))
      ) {
        return false;
      }
      if (
        item.item_type === 'downtime' &&
        item.downtime &&
        targetDowntimeIds.has(item.downtime.id)
      ) {
        return false;
      }
    }
  }

  return true;
}

export function scheduleCommitImpactFingerprint(impacts: ScheduleCommitImpact[]): string {
  return JSON.stringify(
    impacts
      .map((value) => {
        const impact = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
        return {
          jobId: typeof impact.job_id === 'string' ? impact.job_id : '',
          scheduledJobId: typeof impact.scheduled_job_id === 'string' ? impact.scheduled_job_id : '',
          beforeStart: typeof impact.before_start === 'string' ? impact.before_start : null,
          afterStart: typeof impact.after_start === 'string' ? impact.after_start : null,
        };
      })
      .sort(
        (left, right) =>
          left.scheduledJobId.localeCompare(right.scheduledJobId) ||
          left.jobId.localeCompare(right.jobId) ||
          String(left.beforeStart).localeCompare(String(right.beforeStart)) ||
          String(left.afterStart).localeCompare(String(right.afterStart)),
      ),
  );
}
