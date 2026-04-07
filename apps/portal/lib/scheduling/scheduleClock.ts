import { isYmd } from '@/lib/scheduling/date';

export const SCHEDULE_TIME_ZONE = 'Pacific/Auckland';

function ymdInTimeZone(timeZone: string, now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  if (!year || !month || !day) return '';
  return `${year}-${month}-${day}`;
}

export function resolveScheduleTodayYmd(now: Date = new Date()): string {
  const scheduledYmd = ymdInTimeZone(SCHEDULE_TIME_ZONE, now);
  if (isYmd(scheduledYmd)) return scheduledYmd;

  const utcYmd = ymdInTimeZone('UTC', now);
  return isYmd(utcYmd) ? utcYmd : '1970-01-01';
}
