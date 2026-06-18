import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';

const GANTT_WEEKDAY_WEIGHT = 1;
export const GANTT_WEEKEND_WEIGHT = 0;

type AxisMonthKey = `${number}-${string}`;

type GanttAxisDay = {
  index: number;
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  weight: number;
  widthPx: number;
  startPx: number;
  endPx: number;
};

type GanttAxisWeek = {
  index: number;
  startIndex: number;
  endIndexExclusive: number;
  startDate: string;
  endDate: string;
  startPx: number;
  endPx: number;
  widthPx: number;
  label: string;
  monthKey: AxisMonthKey;
  monthLabel: string;
};

type GanttAxisMonth = {
  key: AxisMonthKey;
  label: string;
  startWeekIndex: number;
  endWeekIndexExclusive: number;
  startPx: number;
  endPx: number;
  widthPx: number;
};

type GanttAxis = {
  rangeStart: string;
  rangeDays: number;
  baseDayPx: number;
  weekendWeight: number;
  totalWidth: number;
  boundaryPx: number[];
  days: GanttAxisDay[];
  weeks: GanttAxisWeek[];
  months: GanttAxisMonth[];
  dayIndexByDate: Map<string, number>;
};

type BuildGanttAxisInput = {
  rangeStart: string;
  rangeDays: number;
  baseDayPx: number;
  weekendWeight?: number;
};

const MONTH_SHORT_FMT = new Intl.DateTimeFormat('en-NZ', { month: 'short', timeZone: 'UTC' });
const MONTH_YEAR_FMT = new Intl.DateTimeFormat('en-NZ', { month: 'short', year: 'numeric', timeZone: 'UTC' });

function parseYmdUtc(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10);
  const d = Number.parseInt(m[3], 10);
  return new Date(Date.UTC(y, mo - 1, d));
}

function monthKey(ymd: string): AxisMonthKey {
  const dt = parseYmdUtc(ymd);
  if (!dt) return `0-00`;
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatDay2(date: Date): string {
  return String(date.getUTCDate()).padStart(2, '0');
}

function clampIndex(index: number, maxExclusive: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(maxExclusive, Math.trunc(index)));
}

function isWeekendYmd(ymd: string): boolean {
  const dt = parseYmdUtc(ymd);
  if (!dt) return false;
  const day = dt.getUTCDay();
  return day === 0 || day === 6;
}

function dayWeightForDate(ymd: string, weekendWeight = GANTT_WEEKEND_WEIGHT): number {
  return isWeekendYmd(ymd) ? weekendWeight : GANTT_WEEKDAY_WEIGHT;
}

function dayWidthPxForDate(ymd: string, baseDayPx: number, weekendWeight = GANTT_WEEKEND_WEIGHT): number {
  return baseDayPx * dayWeightForDate(ymd, weekendWeight);
}

function formatGanttMonthLabel(ymd: string): string {
  const dt = parseYmdUtc(ymd);
  if (!dt) return ymd;
  return MONTH_YEAR_FMT.format(dt);
}

export function formatGanttWeekRangeLabel(weekStartYmd: string): string {
  const start = parseYmdUtc(weekStartYmd);
  if (!start) return weekStartYmd;

  const weekEndYmd = addDaysYmd(weekStartYmd, 6);
  const end = parseYmdUtc(weekEndYmd);
  if (!end) return weekStartYmd;

  const startMonth = MONTH_SHORT_FMT.format(start);
  const endMonth = MONTH_SHORT_FMT.format(end);
  const startDay = formatDay2(start);
  const endDay = formatDay2(end);

  if (startMonth === endMonth && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${startDay}–${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth}–${endDay} ${endMonth}`;
}

export function buildGanttAxis(input: BuildGanttAxisInput): GanttAxis {
  const weekendWeight = typeof input.weekendWeight === 'number' && Number.isFinite(input.weekendWeight) ? input.weekendWeight : GANTT_WEEKEND_WEIGHT;
  const rangeDays = Math.max(0, Math.trunc(input.rangeDays));
  const baseDayPx = Number.isFinite(input.baseDayPx) ? input.baseDayPx : 0;

  const days: GanttAxisDay[] = [];
  const boundaryPx: number[] = new Array(rangeDays + 1).fill(0);
  const dayIndexByDate = new Map<string, number>();

  let x = 0;
  boundaryPx[0] = 0;
  for (let index = 0; index < rangeDays; index += 1) {
    const date = addDaysYmd(input.rangeStart, index);
    const dt = parseYmdUtc(date);
    const dayOfWeek = dt ? dt.getUTCDay() : -1;
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weight = isWeekend ? weekendWeight : GANTT_WEEKDAY_WEIGHT;
    const widthPx = baseDayPx * weight;
    const startPx = x;
    const endPx = startPx + widthPx;

    days.push({
      index,
      date,
      dayOfWeek,
      isWeekend,
      weight,
      widthPx,
      startPx,
      endPx,
    });
    dayIndexByDate.set(date, index);

    x = endPx;
    boundaryPx[index + 1] = x;
  }

  const weeks: GanttAxisWeek[] = [];
  for (let startIndex = 0; startIndex < rangeDays; startIndex += 7) {
    const endIndexExclusive = Math.min(startIndex + 7, rangeDays);
    if (endIndexExclusive <= startIndex) continue;
    const startDate = addDaysYmd(input.rangeStart, startIndex);
    const endDate = addDaysYmd(startDate, 6);
    weeks.push({
      index: weeks.length,
      startIndex,
      endIndexExclusive,
      startDate,
      endDate,
      startPx: boundaryPx[startIndex],
      endPx: boundaryPx[endIndexExclusive],
      widthPx: boundaryPx[endIndexExclusive] - boundaryPx[startIndex],
      label: formatGanttWeekRangeLabel(startDate),
      monthKey: monthKey(startDate),
      monthLabel: formatGanttMonthLabel(startDate),
    });
  }

  const months: GanttAxisMonth[] = [];
  for (const week of weeks) {
    const prev = months.length ? months[months.length - 1] : null;
    if (!prev || prev.key !== week.monthKey) {
      months.push({
        key: week.monthKey,
        label: week.monthLabel,
        startWeekIndex: week.index,
        endWeekIndexExclusive: week.index + 1,
        startPx: week.startPx,
        endPx: week.endPx,
        widthPx: week.widthPx,
      });
      continue;
    }
    prev.endWeekIndexExclusive = week.index + 1;
    prev.endPx = week.endPx;
    prev.widthPx = prev.endPx - prev.startPx;
  }

  return {
    rangeStart: input.rangeStart,
    rangeDays,
    baseDayPx,
    weekendWeight,
    totalWidth: boundaryPx[rangeDays] ?? 0,
    boundaryPx,
    days,
    weeks,
    months,
    dayIndexByDate,
  };
}

export function axisXForDayIndex(axis: GanttAxis, dayIndex: number): number {
  const idx = clampIndex(dayIndex, axis.rangeDays);
  return axis.boundaryPx[idx] ?? 0;
}

export function axisSpanPx(
  axis: GanttAxis,
  startDate: string,
  endDateInclusive: string,
): {
  leftPx: number;
  widthPx: number;
  startIndex: number;
  endIndexExclusive: number;
  clampedStartIndex: number;
  clampedEndIndexExclusive: number;
} {
  const startIndex = diffDaysYmd(axis.rangeStart, startDate);
  const endIndexExclusive = diffDaysYmd(axis.rangeStart, endDateInclusive) + 1;
  const clampedStartIndex = clampIndex(startIndex, axis.rangeDays);
  const clampedEndIndexExclusive = clampIndex(Math.max(clampedStartIndex, endIndexExclusive), axis.rangeDays);
  const leftPx = axisXForDayIndex(axis, clampedStartIndex);
  const rightPx = axisXForDayIndex(axis, clampedEndIndexExclusive);
  return {
    leftPx,
    widthPx: Math.max(0, rightPx - leftPx),
    startIndex,
    endIndexExclusive,
    clampedStartIndex,
    clampedEndIndexExclusive,
  };
}

export function snapAxisDayDeltaForPixelDelta(input: {
  startDate: string;
  deltaPx: number;
  baseDayPx: number;
  weekendWeight?: number;
  maxSteps?: number;
}): number {
  if (!isYmd(input.startDate)) return 0;
  const deltaPx = Number.isFinite(input.deltaPx) ? input.deltaPx : 0;
  if (deltaPx === 0) return 0;

  const direction = deltaPx >= 0 ? 1 : -1;
  const target = Math.abs(deltaPx);
  const weekendWeight = typeof input.weekendWeight === 'number' && Number.isFinite(input.weekendWeight) ? input.weekendWeight : GANTT_WEEKEND_WEIGHT;
  const maxSteps = Math.max(1, Math.trunc(input.maxSteps ?? 730));

  let bestDays = 0;
  let bestDiff = target;
  let acc = 0;

  for (let step = 1; step <= maxSteps; step += 1) {
    const date = direction > 0 ? addDaysYmd(input.startDate, step - 1) : addDaysYmd(input.startDate, -step);
    acc += dayWidthPxForDate(date, input.baseDayPx, weekendWeight);
    const diff = Math.abs(acc - target);
    if (diff <= bestDiff) {
      bestDiff = diff;
      bestDays = step;
    } else if (acc > target) {
      break;
    }
  }

  return direction * bestDays;
}

export function todayYmdInTimeZone(timeZone: string, now: Date = new Date()): string {
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
