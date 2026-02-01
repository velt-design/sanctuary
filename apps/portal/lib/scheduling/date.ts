const WORK_HOURS_PER_DAY = 9;

export type WorkCursor = { date: string; hour: number };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = pad2(now.getMonth() + 1);
  const d = pad2(now.getDate());
  return `${y}-${m}-${d}`;
}

function ymdToUtcDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((v) => Number.parseInt(v, 10));
  return new Date(Date.UTC(y, m - 1, d));
}

function utcDateToYmd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = pad2(date.getUTCMonth() + 1);
  const d = pad2(date.getUTCDate());
  return `${y}-${m}-${d}`;
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = ymdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + (Number.isFinite(days) ? days : 0));
  return utcDateToYmd(d);
}

export function diffDaysYmd(a: string, b: string): number {
  const da = ymdToUtcDate(a);
  const db = ymdToUtcDate(b);
  return Math.floor((db.getTime() - da.getTime()) / 86_400_000);
}

export function isWorkday(ymd: string): boolean {
  const day = ymdToUtcDate(ymd).getUTCDay();
  return day !== 0 && day !== 6;
}

export function nextDayYmd(ymd: string): string {
  const d = ymdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + 1);
  return utcDateToYmd(d);
}

export function nextWorkdayYmd(ymd: string): string {
  let d = ymd;
  while (!isWorkday(d)) d = nextDayYmd(d);
  return d;
}

export function addWorkHours(startDate: string, startHour: number, hours: number): { endCursor: WorkCursor; endDateInclusive: string } {
  let cursor: WorkCursor = { date: nextWorkdayYmd(startDate), hour: Number.isFinite(startHour) ? startHour : 0 };
  let remaining = Number.isFinite(hours) ? hours : 0;

  if (cursor.hour >= WORK_HOURS_PER_DAY) {
    cursor = { date: nextWorkdayYmd(nextDayYmd(cursor.date)), hour: 0 };
  }
  if (cursor.hour < 0) cursor.hour = 0;
  if (remaining < 0) remaining = 0;

  let endDateInclusive = cursor.date;

  while (remaining > 0) {
    cursor.date = nextWorkdayYmd(cursor.date);
    const available = WORK_HOURS_PER_DAY - cursor.hour;
    const take = Math.min(available, remaining);
    cursor.hour += take;
    remaining -= take;
    endDateInclusive = cursor.date;

    const atDayEnd = Math.abs(cursor.hour - WORK_HOURS_PER_DAY) < 1e-9;
    if (remaining > 0 || atDayEnd) {
      cursor = { date: nextWorkdayYmd(nextDayYmd(cursor.date)), hour: 0 };
    }
  }

  return { endCursor: cursor, endDateInclusive };
}

export function addWorkDays(startDate: string, days: number): { endCursor: WorkCursor; endDateInclusive: string } {
  const hours = (Number.isFinite(days) ? days : 0) * WORK_HOURS_PER_DAY;
  return addWorkHours(startDate, 0, hours);
}
