import type { Estimate } from '@/lib/types/estimate';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import { axisSpanPx, axisXForDayIndex, buildGanttAxis, GANTT_WEEKEND_WEIGHT } from './ganttAxis';
import { buildScheduleJobIdentity } from './ScheduleJobPresentation';
import {
  buildScheduleAttentionPresentation,
  formatScheduleCommitmentLabel,
  formatScheduleCrewLoad,
  resolveScheduleFlexDays,
  scheduleForecastDays,
} from './ScheduleOperationalPresentation';

export { hasScheduleCommitment as hasPlannedCommitment } from './ScheduleOperationalPresentation';

export type GanttDensity = 'compact' | 'comfortable';
export type GanttZoomWeeks = 4 | 8 | 12;
type GanttSummarySpan = { leftPx: number; widthPx: number };
type GanttAttentionReason = 'schedule_issue' | 'client_update' | 'drift';

export type ScheduleGanttBar = {
  scheduleItemId: string;
  installerId: string;
  projectId: string;
  estimateId: string;
  projectName: string;
  status: string;
  startDate: string;
  endDate: string;
  durationHours: number;
};

export type GanttRow =
  | {
      kind: 'group';
      id: string;
      installerId: string;
      label: string;
      color: string;
      itemCount: number;
      loadLabel: string;
      attentionCount: number;
      collapsed: boolean;
      summarySpans: GanttSummarySpan[];
    }
  | {
      kind: 'item';
      id: string;
      installerId: string;
      scheduleItemId: string;
      projectId: string;
      estimateId: string;
      crewName: string;
      projectName: string;
      customerName: string | null;
      siteAddress: string | null;
      identityDetail: string | null;
      status: string;
      durationLabel: string;
      durationDays: number;
      startDate: string;
      endDate: string;
      barLeftPx: number;
      barWidthPx: number;
      ghostLeftPx?: number;
      ghostWidthPx?: number;
      barColor: string;
      isDowntime?: boolean;
      isPinned?: boolean;
      issueLevel?: 'warning' | 'error';
      plannedLeftPx?: number;
      plannedWidthPx?: number;
      plannedStart?: string;
      plannedEnd?: string;
      plannedCommitmentLabel?: string | null;
      plannedFlexDays?: number | null;
      plannedDurationDays?: number | null;
      driftDays?: number | null;
      clientUpdateStatus?: 'none' | 'needed' | 'acknowledged' | null;
      timingAdjustable: boolean;
      needsAttention: boolean;
      attentionReasons: GanttAttentionReason[];
      attentionBadgeLabel: string | null;
      attentionLabel: string | null;
      conflictMessage: string | null;
    };

export type GanttModel = {
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
  rows: GanttRow[];
};

export type GanttDragPreview = {
  id: string;
  itemUpdatedAt: string;
  mode: 'move' | 'resize';
  originX: number;
  startDate: string;
  endDate: string;
  durationDays: number;
};

const GANTT_DAY_PX = 18;
const GANTT_TIMELINE_WEEKS = 12;
export const GANTT_TIMELINE_DAYS = GANTT_TIMELINE_WEEKS * 7;
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

function parseYmd(ymd: string): Date | null {
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

export function formatStatusLabel(status: string): string {
  if (!status) return '-';
  if (status.toUpperCase() === 'DOWNTIME') return 'Downtime';
  const normalized = normalizeProjectStatus(status);
  return projectStatusLabel(normalized.status);
}

function isWeekendDate(ymd: string): boolean {
  const dt = parseYmd(ymd);
  if (!dt) return false;
  const day = dt.getUTCDay();
  return day === 0 || day === 6;
}

export function snapToWeekdayYmd(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  const day = dt.getUTCDay();
  if (day !== 0 && day !== 6) return ymd;

  let d = ymd;
  for (let i = 0; i < 3; i += 1) {
    d = addDaysYmd(d, 1);
    const nd = parseYmd(d);
    if (!nd) return d;
    const dow = nd.getUTCDay();
    if (dow !== 0 && dow !== 6) return d;
  }
  return d;
}

export function workingDaysInclusive(startYmd: string, endYmd: string): number {
  if (!isYmd(startYmd) || !isYmd(endYmd)) return 1;
  if (diffDaysYmd(startYmd, endYmd) < 0) return 1;
  let count = 0;
  let d = startYmd;
  for (let i = 0; i < 8000; i += 1) {
    if (!isWeekendDate(d)) count += 1;
    if (d === endYmd) break;
    d = addDaysYmd(d, 1);
  }
  return Math.max(1, count);
}

export function addWorkingDaysInclusive(startYmd: string, durationDays: number): string {
  const dur = Number.isFinite(durationDays) ? Math.max(1, Math.trunc(durationDays)) : 1;
  let remaining = dur - 1;
  let d = startYmd;
  for (let i = 0; i < 8000 && remaining > 0; i += 1) {
    d = addDaysYmd(d, 1);
    if (isWeekendDate(d)) continue;
    remaining -= 1;
  }
  return d;
}

export function snapToWeekdayYmdDirectional(ymd: string, direction: number): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  const day = dt.getUTCDay();
  if (day !== 0 && day !== 6) return ymd;

  const step = direction < 0 ? -1 : 1;
  let d = ymd;
  for (let i = 0; i < 3; i += 1) {
    d = addDaysYmd(d, step);
    const nd = parseYmd(d);
    if (!nd) return d;
    const dow = nd.getUTCDay();
    if (dow !== 0 && dow !== 6) return d;
  }
  return d;
}

function endInclusiveFromExclusive(endExclusive: string, fallback: string): string {
  if (!isYmd(endExclusive)) return fallback;
  return addDaysYmd(endExclusive, -1);
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

export type GanttLabelWidthBounds = {
  min: number;
  max: number;
  narrow: boolean;
};

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

function parseHexColour(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace(/^#/, '');
  if (!raw) return null;
  const hex = raw.length === 3 ? raw.split('').map((c) => `${c}${c}`).join('') : raw;
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const num = Number.parseInt(hex, 16);
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff };
}

function toHexByte(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

export function darkenHex(hex: string, amount: number): string {
  const rgb = parseHexColour(hex);
  if (!rgb) return hex;
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return `#${toHexByte(rgb.r * factor)}${toHexByte(rgb.g * factor)}${toHexByte(rgb.b * factor)}`;
}

export function getReadableTextColor(bgHex: string): '#000000' | '#ffffff' {
  const rgb = parseHexColour(bgHex);
  if (!rgb) return '#000000';
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#000000';
}

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '-';
  const days = hours / WORK_HOURS_PER_DAY;
  return `${days.toFixed(days % 1 === 0 ? 0 : 1)}d`;
}

function addAttentionReason(
  reasonsByScheduleId: Map<string, GanttAttentionReason[]>,
  scheduleItemId: string,
  reason: GanttAttentionReason,
): void {
  const reasons = reasonsByScheduleId.get(scheduleItemId) ?? [];
  if (!reasons.includes(reason)) reasons.push(reason);
  reasonsByScheduleId.set(scheduleItemId, reasons);
}

export function buildGanttAttentionReasons(
  scheduleItems: readonly ScheduleItem[],
  scheduleIssues: readonly SchedulingIssue[],
): Map<string, GanttAttentionReason[]> {
  const reasonsByScheduleId = new Map<string, GanttAttentionReason[]>();

  for (const issue of scheduleIssues) {
    if (issue.scheduleItemId) addAttentionReason(reasonsByScheduleId, issue.scheduleItemId, 'schedule_issue');
  }

  for (const item of scheduleItems) {
    if (item.clientUpdateStatus === 'needed') addAttentionReason(reasonsByScheduleId, item.id, 'client_update');
    const driftDays =
      typeof item.driftDays === 'number' && Number.isFinite(item.driftDays)
        ? Math.max(0, Math.trunc(item.driftDays))
        : null;
    const flexDays = resolveScheduleFlexDays(item);
    if (driftDays !== null && flexDays !== null && driftDays > flexDays) {
      addAttentionReason(reasonsByScheduleId, item.id, 'drift');
    }
  }

  return reasonsByScheduleId;
}

function formatGanttAttentionLabel(reasons: readonly GanttAttentionReason[]): string | null {
  if (reasons.length === 0) return null;
  return reasons
    .map((reason) => {
      if (reason === 'schedule_issue') return 'Schedule issue';
      if (reason === 'client_update') return 'Client update needed';
      return 'Drift exceeds flex';
    })
    .join('; ');
}

export function canAdjustGanttTiming(item: ScheduleItem | null): boolean {
  if (!item || item.itemType === 'downtime') return false;
  if (['in_progress', 'paused', 'done'].includes(item.jobStatus ?? '')) return false;
  if (item.scheduleStatus === 'IN_PROGRESS' || item.scheduleStatus === 'COMPLETED') return false;
  if (item.actualStartDate || item.actualEndDate) return false;
  return true;
}

export function canEditGanttCommitment(scheduleMode: 'v2' | 'legacy', item: ScheduleItem | null): boolean {
  if (scheduleMode !== 'v2' || !item || item.itemType === 'downtime') return false;
  if (item.jobStatus === 'done' || item.scheduleStatus === 'COMPLETED' || item.actualEndDate) return false;
  return true;
}

function mergeSummarySpans(spans: GanttSummarySpan[]): GanttSummarySpan[] {
  const sorted = spans
    .filter((span) => Number.isFinite(span.leftPx) && Number.isFinite(span.widthPx) && span.widthPx > 0)
    .sort((a, b) => a.leftPx - b.leftPx);
  const merged: GanttSummarySpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push({ leftPx: span.leftPx, widthPx: span.widthPx });
      continue;
    }
    const lastRight = last.leftPx + last.widthPx;
    const spanRight = span.leftPx + span.widthPx;
    if (span.leftPx <= lastRight + 1) {
      last.widthPx = Math.max(lastRight, spanRight) - last.leftPx;
      continue;
    }
    merged.push({ leftPx: span.leftPx, widthPx: span.widthPx });
  }
  return merged;
}

type BuildScheduleGanttModelParams = {
  today: string;
  scheduleMode: 'v2' | 'legacy';
  installers: Installer[];
  laneItems: Map<string, ScheduleItem[]>;
  visibleScheduleItems: ScheduleItem[];
  projectsById: Map<string, ScheduleProjectSummary>;
  estimatesById: Map<string, Estimate>;
  scheduleBars: ScheduleGanttBar[];
  scheduleIssues: SchedulingIssue[];
  holidays: Array<{ date: string; name?: string; kind: 'holiday' }>;
  collapsedCrews: Record<string, boolean>;
  showPlanned: boolean;
  zoomWeeks: GanttZoomWeeks;
  ganttDrag: GanttDragPreview | null;
  ganttDragDelta: number;
  scheduleItemById: Map<string, ScheduleItem>;
  attentionReasonsByScheduleId: ReadonlyMap<string, readonly GanttAttentionReason[]>;
};

export function buildScheduleGanttModel({
  today,
  scheduleMode,
  installers,
  laneItems,
  visibleScheduleItems,
  projectsById,
  estimatesById,
  scheduleBars,
  scheduleIssues,
  holidays,
  collapsedCrews,
  showPlanned,
  zoomWeeks,
  ganttDrag,
  ganttDragDelta,
  scheduleItemById,
  attentionReasonsByScheduleId,
}: BuildScheduleGanttModelParams): GanttModel {
  const issueLevelByScheduleId = new Map<string, 'warning' | 'error'>();
  const conflictMessageByScheduleId = new Map<string, string>();
  for (const issue of scheduleIssues) {
    const id = issue.scheduleItemId;
    if (!id) continue;
    if (issue.level === 'error') {
      issueLevelByScheduleId.set(id, 'error');
      conflictMessageByScheduleId.set(id, issue.message);
    } else if (!issueLevelByScheduleId.has(id)) {
      issueLevelByScheduleId.set(id, 'warning');
    }
  }

  const ganttJobsById = new Map<string, {
    projectName: string;
    customerName: string | null;
    siteAddress: string | null;
    identityDetail: string | null;
    durationLabel: string;
  }>();
  for (const item of visibleScheduleItems) {
    if (item.itemType === 'downtime') {
      const durationHours =
        typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? item.durationHoursOverride
          : WORK_HOURS_PER_DAY;
      ganttJobsById.set(item.id, {
        projectName: item.downtimeReason ?? 'Downtime',
        customerName: null,
        siteAddress: null,
        identityDetail: null,
        durationLabel: formatDuration(durationHours),
      });
      continue;
    }

    const project = projectsById.get(item.projectId) ?? null;
    const identity = buildScheduleJobIdentity(project);
    const estimate = estimatesById.get(item.estimateId) ?? null;
    let durationHours = WORK_HOURS_PER_DAY;
    if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
      durationHours = item.durationHoursOverride;
    } else if (typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0) {
      durationHours = item.forecastDurationDays * WORK_HOURS_PER_DAY;
    } else if (estimate) {
      durationHours = deriveDurationHoursFromEstimate(estimate).durationHours;
    }
    ganttJobsById.set(item.id, {
      ...identity,
      durationLabel: formatDuration(durationHours),
    });
  }

  const rangeStart = startOfWeekMonday(today);
  const rangeDays = GANTT_TIMELINE_DAYS;
  const rangeEnd = addDaysYmd(rangeStart, rangeDays - 1);
  const baseDayPx = ganttBaseDayPxForZoomWeeks(zoomWeeks);
  const axis = buildGanttAxis({ rangeStart, rangeDays, baseDayPx, weekendWeight: GANTT_WEEKEND_WEIGHT });
  const totalWidth = axis.totalWidth;
  const displayToday = today;
  const todayIndex = diffDaysYmd(rangeStart, displayToday);
  const todayLinePx = axisXForDayIndex(axis, todayIndex);
  const todayColumn = todayIndex >= 0 && todayIndex < axis.days.length ? axis.days[todayIndex] : null;
  const currentWeekSpan = axisSpanPx(axis, rangeStart, addDaysYmd(rangeStart, 6));

  const holidayNamesByDate = new Map<string, string[]>();
  for (const holiday of holidays) {
    if (!holiday?.date || !isYmd(holiday.date)) continue;
    const idx = diffDaysYmd(rangeStart, holiday.date);
    if (idx < 0 || idx >= rangeDays) continue;
    const names = holidayNamesByDate.get(holiday.date) ?? [];
    if (holiday.name?.trim()) names.push(holiday.name.trim());
    holidayNamesByDate.set(holiday.date, names);
  }

  const weekendBlocks: GanttModel['weekendBlocks'] = [];
  const holidayBlocks: GanttModel['holidayBlocks'] = [];
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

  const barsById = new Map(scheduleBars.map((bar) => [bar.scheduleItemId, bar]));
  const plannedBarsById = new Map<string, { leftPx: number; widthPx: number; startDate: string; endDate: string }>();
  if (showPlanned && scheduleMode === 'v2') {
    for (const item of visibleScheduleItems) {
      if (item.itemType === 'downtime' || !item.plannedStart || !isYmd(item.plannedStart)) continue;
      const plannedDays =
        typeof item.plannedDurationDays === 'number' && Number.isFinite(item.plannedDurationDays) && item.plannedDurationDays > 0
          ? item.plannedDurationDays
          : null;
      if (!plannedDays) continue;
      const plannedEndExcl = addDaysYmd(item.plannedStart, plannedDays);
      const plannedEnd = endInclusiveFromExclusive(plannedEndExcl, item.plannedStart);
      const plannedSpan = axisSpanPx(axis, item.plannedStart, plannedEnd);
      if (plannedSpan.widthPx > 0) {
        plannedBarsById.set(item.id, {
          leftPx: plannedSpan.leftPx,
          widthPx: Math.max(plannedSpan.widthPx, 6),
          startDate: item.plannedStart,
          endDate: plannedEnd,
        });
      }
    }
  }

  const rows: GanttRow[] = [];
  for (const installer of installers.filter((candidate) => candidate.active)) {
    const items = laneItems.get(installer.id) ?? [];
    const collapsed = Boolean(collapsedCrews[installer.id]);
    const attentionCount = items.reduce(
      (count, item) => count + (attentionReasonsByScheduleId.has(item.id) ? 1 : 0),
      0,
    );
    const summarySpans = collapsed
      ? mergeSummarySpans(
          items
            .map((item) => {
              const bar = barsById.get(item.id);
              if (!bar) return null;
              const span = axisSpanPx(axis, bar.startDate, bar.endDate);
              return span.widthPx > 0 ? { leftPx: span.leftPx, widthPx: Math.max(span.widthPx, 8) } : null;
            })
            .filter((span): span is GanttSummarySpan => Boolean(span)),
        )
      : [];
    rows.push({
      kind: 'group',
      id: `group:${installer.id}`,
      installerId: installer.id,
      label: installer.name,
      color: installer.color,
      itemCount: items.length,
      loadLabel: formatScheduleCrewLoad(items.length, scheduleForecastDays(items)),
      attentionCount,
      collapsed,
      summarySpans,
    });
    if (!items.length) continue;
    if (collapsed) continue;

    for (const item of items) {
      const bar = barsById.get(item.id);
      if (!bar) continue;
      const scheduleItem = scheduleItemById.get(item.id) ?? null;
      const isDowntime = scheduleItem?.itemType === 'downtime';
      const jobPresentation = ganttJobsById.get(item.id);
      const attentionReasons = [...(attentionReasonsByScheduleId.get(item.id) ?? [])];
      const attentionPresentation = scheduleItem
        ? buildScheduleAttentionPresentation({
            item: scheduleItem,
            issueLevel: issueLevelByScheduleId.get(item.id),
          })
        : null;
      const planned = plannedBarsById.get(item.id);
      const baseSpan = axisSpanPx(axis, bar.startDate, bar.endDate);
      const baseBarLeftPx = baseSpan.leftPx;
      const baseBarWidthPx = baseSpan.widthPx > 0 ? Math.max(baseSpan.widthPx, 8) : 0;
      let displayStart = bar.startDate;
      let displayEnd = bar.endDate;
      let displayLeftPx = baseBarLeftPx;
      let displayWidthPx = baseBarWidthPx;

      if (ganttDrag && ganttDrag.id === item.id) {
        if (ganttDrag.mode === 'move') {
          const requestedStart = addDaysYmd(bar.startDate, ganttDragDelta);
          displayStart = snapToWeekdayYmdDirectional(requestedStart, ganttDragDelta);
          displayEnd = addWorkingDaysInclusive(displayStart, Math.max(1, ganttDrag.durationDays));
        } else {
          const requestedEnd = addDaysYmd(bar.endDate, ganttDragDelta);
          const snappedEnd = snapToWeekdayYmdDirectional(requestedEnd, ganttDragDelta);
          const nextDuration = Math.max(1, workingDaysInclusive(bar.startDate, snappedEnd));
          displayEnd = addWorkingDaysInclusive(bar.startDate, nextDuration);
        }
        const displaySpan = axisSpanPx(axis, displayStart, displayEnd);
        displayLeftPx = displaySpan.leftPx;
        displayWidthPx = displaySpan.widthPx > 0 ? Math.max(displaySpan.widthPx, 8) : 0;
      }

      rows.push({
        kind: 'item',
        id: item.id,
        installerId: installer.id,
        scheduleItemId: item.id,
        projectId: isDowntime ? '' : bar.projectId,
        estimateId: isDowntime ? '' : bar.estimateId,
        crewName: installer.name,
        projectName: isDowntime ? jobPresentation?.projectName ?? bar.projectName : bar.projectName,
        customerName: jobPresentation?.customerName ?? null,
        siteAddress: jobPresentation?.siteAddress ?? null,
        identityDetail: jobPresentation?.identityDetail ?? null,
        status: bar.status,
        durationLabel: jobPresentation?.durationLabel ?? formatDuration(bar.durationHours),
        durationDays: Math.max(1, workingDaysInclusive(displayStart, displayEnd)),
        startDate: displayStart,
        endDate: displayEnd,
        barLeftPx: displayLeftPx,
        barWidthPx: displayWidthPx,
        barColor: isDowntime ? '#6b7280' : installer.color,
        ghostLeftPx: ganttDrag && ganttDrag.id === item.id ? baseBarLeftPx : undefined,
        ghostWidthPx: ganttDrag && ganttDrag.id === item.id ? baseBarWidthPx : undefined,
        isDowntime,
        isPinned: scheduleItem?.mode === 'pinned',
        issueLevel: issueLevelByScheduleId.get(item.id),
        plannedLeftPx: planned?.leftPx,
        plannedWidthPx: planned?.widthPx,
        plannedStart: planned?.startDate,
        plannedEnd: planned?.endDate,
        plannedCommitmentLabel: scheduleItem ? formatScheduleCommitmentLabel(scheduleItem, formatShortDate) : null,
        plannedFlexDays: scheduleItem ? resolveScheduleFlexDays(scheduleItem) : null,
        plannedDurationDays:
          scheduleItem && typeof scheduleItem.plannedDurationDays === 'number' && Number.isFinite(scheduleItem.plannedDurationDays)
            ? Math.max(1, Math.trunc(scheduleItem.plannedDurationDays))
            : null,
        driftDays:
          scheduleItem && typeof scheduleItem.driftDays === 'number' && Number.isFinite(scheduleItem.driftDays)
            ? Math.max(0, Math.trunc(scheduleItem.driftDays))
            : null,
        clientUpdateStatus: scheduleItem?.clientUpdateStatus ?? null,
        timingAdjustable: scheduleMode === 'v2' && canAdjustGanttTiming(scheduleItem),
        needsAttention: attentionReasons.length > 0,
        attentionReasons,
        attentionBadgeLabel: attentionPresentation?.badgeLabel ?? null,
        attentionLabel: attentionPresentation?.detailLabel ?? formatGanttAttentionLabel(attentionReasons),
        conflictMessage: issueLevelByScheduleId.get(item.id) === 'error'
          ? conflictMessageByScheduleId.get(item.id) ?? null
          : null,
      });
    }
  }

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
    rows,
  };
}
