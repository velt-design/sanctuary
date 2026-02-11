import { addDaysYmd, diffDaysYmd, isWorkday, isYmd } from './date';

export type NzHoliday = {
  date: string;
  name?: string;
  scope: 'national' | 'regional';
  region?: string | null;
};

export type CompanyClosure = {
  date: string;
  name?: string;
  region?: string | null;
};

export type WorkingDayIndex = {
  national: Set<string>;
  regional: Map<string, Set<string>>;
  closuresGlobal: Set<string>;
  closuresRegional: Map<string, Set<string>>;
};

function normalizeRegion(region: string | null | undefined): string {
  return (region ?? '').trim().toLowerCase();
}

export function buildWorkingDayIndex(holidays: NzHoliday[] = [], closures: CompanyClosure[] = []): WorkingDayIndex {
  const index: WorkingDayIndex = {
    national: new Set<string>(),
    regional: new Map<string, Set<string>>(),
    closuresGlobal: new Set<string>(),
    closuresRegional: new Map<string, Set<string>>(),
  };

  for (const holiday of holidays ?? []) {
    if (!holiday || !isYmd(holiday.date)) continue;
    if (holiday.scope === 'national') {
      index.national.add(holiday.date);
      continue;
    }
    if (holiday.scope === 'regional') {
      const key = normalizeRegion(holiday.region);
      if (!key) continue;
      const bucket = index.regional.get(key) ?? new Set<string>();
      bucket.add(holiday.date);
      index.regional.set(key, bucket);
    }
  }

  for (const closure of closures ?? []) {
    if (!closure || !isYmd(closure.date)) continue;
    const key = normalizeRegion(closure.region);
    if (key) {
      const bucket = index.closuresRegional.get(key) ?? new Set<string>();
      bucket.add(closure.date);
      index.closuresRegional.set(key, bucket);
    } else {
      index.closuresGlobal.add(closure.date);
    }
  }

  return index;
}

export function isWorkingDay(date: string, region: string, index: WorkingDayIndex): boolean {
  if (!isYmd(date)) return false;
  if (!isWorkday(date)) return false;
  if (index.national.has(date)) return false;

  const key = normalizeRegion(region);
  const regional = index.regional.get(key);
  if (regional?.has(date)) return false;

  if (index.closuresGlobal.has(date)) return false;

  const regionalClosures = index.closuresRegional.get(key);
  if (regionalClosures?.has(date)) return false;

  return true;
}

export function nextWorkingDay(date: string, region: string, index: WorkingDayIndex): string {
  if (!isYmd(date)) return date;
  let cursor = date;
  let guard = 0;
  while (!isWorkingDay(cursor, region, index)) {
    cursor = addDaysYmd(cursor, 1);
    guard += 1;
    if (guard > 400) break;
  }
  return cursor;
}

export function snapToWorkingDay(date: string, region: string, index: WorkingDayIndex): string {
  if (!isYmd(date)) return date;
  return isWorkingDay(date, region, index) ? date : nextWorkingDay(date, region, index);
}

function normalizeNonNegativeInt(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function addWorkingDays(date: string, days: number, region: string, index: WorkingDayIndex): string {
  const total = normalizeNonNegativeInt(days);
  let cursor = nextWorkingDay(date, region, index);
  for (let i = 0; i < total; i += 1) {
    cursor = nextWorkingDay(addDaysYmd(cursor, 1), region, index);
  }
  return cursor;
}

export function workingDaysBetween(start: string, end: string, region: string, index: WorkingDayIndex): number {
  if (!isYmd(start) || !isYmd(end)) return 0;
  if (diffDaysYmd(start, end) <= 0) return 0;
  let cursor = start;
  let count = 0;
  let guard = 0;
  while (diffDaysYmd(cursor, end) > 0) {
    if (isWorkingDay(cursor, region, index)) count += 1;
    cursor = addDaysYmd(cursor, 1);
    guard += 1;
    if (guard > 10_000) break;
  }
  return count;
}
