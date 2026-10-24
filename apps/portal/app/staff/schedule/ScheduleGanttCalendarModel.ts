import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';
import { SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import { resolveDefaultScheduleGanttRange, SCHEDULE_GANTT_RANGE_DAYS } from '@/lib/scheduling/scheduleGanttRange';
import { axisSpanPx, axisXForDayIndex, buildGanttAxis, GANTT_WEEKEND_WEIGHT } from './ganttAxis';

export type GanttDensity = 'compact' | 'comfortable';
export type GanttZoomWeeks = 4 | 8 | 12;
export type GanttLabelWidthBounds = { min: number; max: number; narrow: boolean };

export type GanttCalendar = {
  rangeStart: string;
  rangeEnd: string;
  rangeDays: number;
  axis: ReturnType<typeof buildGanttAxis>;
  totalWidth: number;
  displayToday: string;
  todayLinePx: number;
  todayColumnLeftPx: number | null;
  todayColumnWidthPx: number;
  currentWeekLeftPx: number;
  currentWeekWidthPx: number;
  weekendBlocks: Array<{ leftPx: number; widthPx: number; date: string }>;
  holidayBlocks: Array<{ leftPx: number; widthPx: number; date: string; label: string }>;
  dayBoundaryLines: number[];
  weekBoundaryLines: number[];
};

const GANTT_DAY_PX = 18;
const GANTT_TIMELINE_WEEKS = 12;
export const GANTT_TIMELINE_DAYS = SCHEDULE_GANTT_RANGE_DAYS;
export const GANTT_ZOOM_WEEK_OPTIONS = [4, 8, 12] as const;
export const GANTT_DEFAULT_ZOOM_WEEKS: GanttZoomWeeks = 8;
const GANTT_LABEL_MIN_PX = 220;
export const GANTT_LABEL_DEFAULT_PX = 260;
const GANTT_LABEL_MAX_PX = 420;
const GANTT_LABEL_NARROW_MIN_PX = 120;
const GANTT_TIMELINE_MIN_VIEWPORT_PX = 160;
export const GANTT_LABEL_RESIZER_WIDTH_PX = 16;
export const GANTT_LABEL_KEYBOARD_STEP_PX = 10;
export const GANTT_BAR_LABEL_MIN_PX = 78;
const GANTT_DENSITY_STORAGE_KEY = 'sp.schedule.ganttDensity';
const GANTT_LABEL_WIDTH_STORAGE_KEY = 'sp.schedule.ganttLabelWidth';

const GANTT_TZ = SCHEDULE_TIME_ZONE;

export function parseYmd(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d));
}

function startOfWeekMonday(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  const day = dt.getUTCDay();
  return addDaysYmd(ymd, -((day + 6) % 7));
}

export function formatShortDate(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', timeZone: GANTT_TZ }).format(dt);
}

export function normalizeGanttZoomWeeks(value: number): GanttZoomWeeks {
  if (value === 4 || value === 8 || value === 12) return value;
  return GANTT_DEFAULT_ZOOM_WEEKS;
}

export function ganttBaseDayPxForZoomWeeks(zoomWeeks: GanttZoomWeeks): number {
  return Math.max(1, Math.round((GANTT_DAY_PX * GANTT_TIMELINE_WEEKS) / zoomWeeks));
}

function clampGanttLabelWidth(value: number): number {
  if (!Number.isFinite(value)) return GANTT_LABEL_DEFAULT_PX;
  return Math.max(GANTT_LABEL_MIN_PX, Math.min(GANTT_LABEL_MAX_PX, Math.round(value)));
}



export function ganttLabelWidthBoundsForViewport(viewportWidthPx: number): GanttLabelWidthBounds {
  if (!Number.isFinite(viewportWidthPx) || viewportWidthPx <= 0) {
    return { min: GANTT_LABEL_MIN_PX, max: GANTT_LABEL_MAX_PX, narrow: false };
  }
  const responsiveMax = Math.max(
    GANTT_LABEL_NARROW_MIN_PX,
    Math.min(GANTT_LABEL_MAX_PX, Math.floor(viewportWidthPx - GANTT_TIMELINE_MIN_VIEWPORT_PX)),
  );
  if (responsiveMax < GANTT_LABEL_MIN_PX) {
    return {
      min: Math.min(GANTT_LABEL_NARROW_MIN_PX, responsiveMax),
      max: responsiveMax,
      narrow: true,
    };
  }
  return { min: GANTT_LABEL_MIN_PX, max: responsiveMax, narrow: false };
}

export function clampGanttLabelWidthToBounds(value: number, bounds: GanttLabelWidthBounds): number {
  if (!Number.isFinite(value)) return bounds.max;
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(value)));
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function readGanttDensityPreference(): GanttDensity {
  if (typeof window === 'undefined') return 'compact';
  try {
    const value = window.localStorage.getItem(GANTT_DENSITY_STORAGE_KEY);
    if (value === 'compact' || value === 'comfortable') return value;
  } catch {
    // ignore read errors
  }
  return 'compact';
}

export function writeGanttDensityPreference(value: GanttDensity): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GANTT_DENSITY_STORAGE_KEY, value);
  } catch {
    // ignore write errors
  }
}

export function readGanttLabelWidthPreference(): number {
  if (typeof window === 'undefined') return GANTT_LABEL_DEFAULT_PX;
  try {
    const raw = window.localStorage.getItem(GANTT_LABEL_WIDTH_STORAGE_KEY);
    if (!raw) return GANTT_LABEL_DEFAULT_PX;
    return clampGanttLabelWidth(Number.parseFloat(raw));
  } catch {
    // ignore read errors
  }
  return GANTT_LABEL_DEFAULT_PX;
}

export function writeGanttLabelWidthPreference(value: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GANTT_LABEL_WIDTH_STORAGE_KEY, String(clampGanttLabelWidth(value)));
  } catch {
    // ignore write errors
  }
}

/** Calendar geometry is date/viewport evidence, independent of work or crew records. */
export function buildScheduleGanttCalendar({ today, zoomWeeks, holidays = [] }: {
  today: string; zoomWeeks: GanttZoomWeeks; holidays?: Array<{ date: string; name?: string; kind: 'holiday' }>;
}): GanttCalendar {
  const { rangeStart } = resolveDefaultScheduleGanttRange(today);
  const rangeDays = GANTT_TIMELINE_DAYS;
  const rangeEnd = addDaysYmd(rangeStart, rangeDays - 1);
  const baseDayPx = ganttBaseDayPxForZoomWeeks(zoomWeeks);
  const axis = buildGanttAxis({ rangeStart, rangeDays, baseDayPx, weekendWeight: GANTT_WEEKEND_WEIGHT });
  const totalWidth = axis.totalWidth;
  const displayToday = today;
  const todayIndex = diffDaysYmd(rangeStart, displayToday);
  const todayLinePx = axisXForDayIndex(axis, todayIndex);
  const todayColumn = todayIndex >= 0 && todayIndex < axis.days.length ? axis.days[todayIndex] : null;
  const currentWeekStart = startOfWeekMonday(today);
  const currentWeekSpan = axisSpanPx(axis, currentWeekStart, addDaysYmd(currentWeekStart, 6));

  const holidayNamesByDate = new Map<string, string[]>();
  for (const holiday of holidays) {
    if (!holiday?.date || !isYmd(holiday.date)) continue;
    const idx = diffDaysYmd(rangeStart, holiday.date);
    if (idx < 0 || idx >= rangeDays) continue;
    const names = holidayNamesByDate.get(holiday.date) ?? [];
    if (holiday.name?.trim()) names.push(holiday.name.trim());
    holidayNamesByDate.set(holiday.date, names);
  }

  const weekendBlocks: GanttCalendar['weekendBlocks'] = [];
  const holidayBlocks: GanttCalendar['holidayBlocks'] = [];
  for (const day of axis.days) {
    if (day.widthPx <= 0) continue;
    const holidayNames = holidayNamesByDate.get(day.date);
    if (holidayNames) {
      const uniqueHolidayNames = Array.from(new Set(holidayNames));
      const dateLabel = formatShortDate(day.date);
      holidayBlocks.push({
        leftPx: day.startPx,
        widthPx: day.widthPx,
        date: day.date,
        label: uniqueHolidayNames.length ? `${uniqueHolidayNames.join(', ')} (${dateLabel})` : `Public holiday (${dateLabel})`,
      });
      continue;
    }
    if (day.isWeekend) weekendBlocks.push({ leftPx: day.startPx, widthPx: day.widthPx, date: day.date });
  }

  const weekBoundaryLines = Array.from(new Set(axis.weeks.map((week) => week.startPx).filter((px) => px > 0 && px < totalWidth))).sort(
    (a, b) => a - b,
  );
  const weekBoundarySet = new Set(weekBoundaryLines);
  const dayBoundaryLines = axis.days
    .filter((day) => !day.isWeekend && day.startPx > 0 && day.startPx < totalWidth && !weekBoundarySet.has(day.startPx))
    .map((day) => day.startPx)
    .sort((a, b) => a - b);

  return {
    rangeStart,
    rangeEnd,
    rangeDays,
    axis,
    totalWidth,
    displayToday,
    todayLinePx,
    todayColumnLeftPx: todayColumn?.startPx ?? null,
    todayColumnWidthPx: todayColumn?.widthPx ?? 0,
    currentWeekLeftPx: currentWeekSpan.leftPx,
    currentWeekWidthPx: currentWeekSpan.widthPx,
    weekendBlocks,
    holidayBlocks,
    dayBoundaryLines,
    weekBoundaryLines,
  };
}
