import { addDaysYmd } from '@/lib/scheduling/date';

export const SCHEDULE_GANTT_TIMELINE_WEEKS = 12;
export const SCHEDULE_GANTT_TIMELINE_DAYS = SCHEDULE_GANTT_TIMELINE_WEEKS * 7;

function parseYmd(ymd: string): Date | null {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function startOfWeekMonday(ymd: string): string {
  const date = parseYmd(ymd);
  if (!date) return ymd;
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addDaysYmd(ymd, -daysSinceMonday);
}

export function resolveDefaultScheduleGanttRange(today: string): { rangeStart: string; rangeEnd: string } {
  const rangeStart = startOfWeekMonday(today);
  return {
    rangeStart,
    rangeEnd: addDaysYmd(rangeStart, SCHEDULE_GANTT_TIMELINE_DAYS - 1),
  };
}
