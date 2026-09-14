import { addDaysYmd } from '@/lib/scheduling/date';

const SCHEDULE_GANTT_HISTORY_WEEKS = 4;
const SCHEDULE_GANTT_FORWARD_WEEKS = 12;
export const SCHEDULE_GANTT_RANGE_DAYS = (SCHEDULE_GANTT_HISTORY_WEEKS + SCHEDULE_GANTT_FORWARD_WEEKS) * 7;

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
  const rangeStart = addDaysYmd(startOfWeekMonday(today), -SCHEDULE_GANTT_HISTORY_WEEKS * 7);
  return {
    rangeStart,
    rangeEnd: addDaysYmd(rangeStart, SCHEDULE_GANTT_RANGE_DAYS - 1),
  };
}
