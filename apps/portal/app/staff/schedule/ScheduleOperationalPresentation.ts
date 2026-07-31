import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { ScheduleItem } from '@/lib/types/scheduling';

type ScheduleAttentionTone = 'warning' | 'danger';

type ScheduleAttentionSignal = {
  key: 'schedule_issue' | 'client_update' | 'drift';
  label: string;
  detail: string;
  tone: ScheduleAttentionTone;
};

export type ScheduleAttentionPresentation = {
  signals: ScheduleAttentionSignal[];
  badgeLabel: string | null;
  detailLabel: string | null;
};

type SchedulePlanPresentation = {
  committed: boolean;
  label: string;
};

function parseYmd(ymd: string): Date | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function startOfWeekMonday(ymd: string): string {
  const date = parseYmd(ymd);
  if (!date) return ymd;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function hasScheduleCommitment(item: ScheduleItem): boolean {
  return Boolean(item.plannedCommitmentType || item.plannedStart || item.plannedWeekStart);
}

export function resolveScheduleCommitmentType(item: ScheduleItem): 'week_of' | 'fixed_date' | null {
  if (item.plannedCommitmentType === 'week_of' || item.plannedCommitmentType === 'fixed_date') {
    return item.plannedCommitmentType;
  }
  return item.plannedStart ? 'fixed_date' : null;
}

export function resolveScheduleFlexDays(item: ScheduleItem): number | null {
  if (typeof item.plannedFlexDays === 'number' && Number.isFinite(item.plannedFlexDays)) {
    return Math.max(0, Math.trunc(item.plannedFlexDays));
  }
  const commitmentType = resolveScheduleCommitmentType(item);
  if (!commitmentType) return null;
  return commitmentType === 'week_of' ? 4 : 1;
}

export function formatScheduleCommitmentLabel(
  item: ScheduleItem,
  formatDate: (ymd: string) => string,
): string | null {
  const commitmentType = resolveScheduleCommitmentType(item);
  if (!commitmentType) return null;
  if (commitmentType === 'week_of') {
    const weekStart = item.plannedWeekStart ?? (item.plannedStart ? startOfWeekMonday(item.plannedStart) : null);
    return weekStart ? `Week of ${formatDate(weekStart)}` : 'Week not set';
  }
  return item.plannedStart ? `Starts ${formatDate(item.plannedStart)}` : 'Start not set';
}

export function buildSchedulePlanPresentation(
  item: ScheduleItem,
  formatDate: (ymd: string) => string,
): SchedulePlanPresentation {
  const label = formatScheduleCommitmentLabel(item, formatDate);
  return label
    ? { committed: true, label }
    : { committed: false, label: 'Draft plan' };
}

export function buildScheduleAttentionPresentation(input: {
  item: ScheduleItem;
  issueLevel?: 'warning' | 'error';
}): ScheduleAttentionPresentation {
  const signals: ScheduleAttentionSignal[] = [];
  if (input.issueLevel) {
    signals.push({
      key: 'schedule_issue',
      label: input.issueLevel === 'error' ? 'Conflict' : 'Sequence warning',
      detail: input.issueLevel === 'error' ? 'Schedule conflict' : 'Schedule sequence needs review',
      tone: input.issueLevel === 'error' ? 'danger' : 'warning',
    });
  }
  if (input.item.clientUpdateStatus === 'needed') {
    signals.push({
      key: 'client_update',
      label: 'Client update',
      detail: 'Client update needed',
      tone: 'warning',
    });
  }
  const driftDays =
    typeof input.item.driftDays === 'number' && Number.isFinite(input.item.driftDays)
      ? Math.max(0, Math.trunc(input.item.driftDays))
      : null;
  const flexDays = resolveScheduleFlexDays(input.item);
  if (driftDays !== null && flexDays !== null && driftDays > flexDays) {
    signals.push({
      key: 'drift',
      label: `Drift +${driftDays}d`,
      detail: `Forecast drift exceeds flex by ${driftDays - flexDays} working day${driftDays - flexDays === 1 ? '' : 's'}`,
      tone: 'warning',
    });
  }
  return {
    signals,
    badgeLabel: signals.length === 0 ? null : signals.length === 1 ? signals[0].label : `${signals.length} issues`,
    detailLabel: signals.length ? signals.map((signal) => signal.detail).join('; ') : null,
  };
}

export function scheduleForecastDays(items: readonly ScheduleItem[]): number {
  return items.reduce((total, item) => {
    if (typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays)) {
      return total + Math.max(1, Math.trunc(item.forecastDurationDays));
    }
    if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride)) {
      return total + Math.max(1, Math.ceil(item.durationHoursOverride / WORK_HOURS_PER_DAY));
    }
    return total + 1;
  }, 0);
}

export function formatScheduleCrewLoad(itemCount: number, forecastDays: number): string {
  const jobLabel = `${itemCount} ${itemCount === 1 ? 'job' : 'jobs'}`;
  if (itemCount === 0) return jobLabel;
  return `${jobLabel} · ${forecastDays}d forecast`;
}
