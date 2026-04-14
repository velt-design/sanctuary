'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Estimate } from '@/lib/types/estimate';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import {
  axisSpanPx,
  axisXForDayIndex,
  buildGanttAxis,
  GANTT_WEEKEND_WEIGHT,
  snapAxisDayDeltaForPixelDelta,
} from './ganttAxis';
import styles from './schedule.module.css';

type GanttDensity = 'compact' | 'comfortable';
type GanttZoomWeeks = 4 | 8 | 12;
type GanttSummarySpan = { leftPx: number; widthPx: number };

type ScheduleBar = {
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

type GanttPopoverAnchor = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type GanttPopoverAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
  shortcut?: string;
};

type GanttRow =
  | {
      kind: 'group';
      id: string;
      installerId: string;
      label: string;
      color: string;
      jobCount: number;
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
      projectName: string;
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
    }
  | {
      kind: 'empty';
      id: string;
      installerId: string;
      label: string;
    };

type GanttModel = {
  rangeStart: string;
  rangeEnd: string;
  rangeDays: number;
  axis: ReturnType<typeof buildGanttAxis>;
  totalWidth: number;
  displayToday: string;
  todayLinePx: number;
  todayColumnLeftPx: number | null;
  todayColumnWidthPx: number;
  weekendBlocks: Array<{ leftPx: number; widthPx: number; date: string }>;
  holidayBlocks: Array<{ leftPx: number; widthPx: number; date: string; label: string }>;
  dayBoundaryLines: number[];
  weekBoundaryLines: number[];
  rows: GanttRow[];
};

export type ScheduleGanttViewProps = {
  today: string;
  scheduleMode: 'v2' | 'legacy';
  installers: Installer[];
  laneItems: Map<string, ScheduleItem[]>;
  visibleScheduleItems: ScheduleItem[];
  projectsById: Map<string, ScheduleProjectSummary>;
  estimatesById: Map<string, Estimate>;
  scheduleBars: ScheduleBar[];
  scheduleIssues: SchedulingIssue[];
  holidays: Array<{ date: string; name?: string; kind: 'holiday' }>;
  showCompleted: boolean;
  onShowCompletedChange: (next: boolean) => void;
  onOpenProject: (projectId: string) => void;
  onOpenProjectPack: (projectId: string, estimateId: string) => void;
  onOpenCommitmentEdit: (scheduleItemId: string, mode: 'lock' | 'reschedule') => void;
  onOpenPinEdit: (scheduleItemId: string, requestedStart: string) => void;
  onUnpinScheduleItem: (scheduleItemId: string) => void;
  onAckClientUpdate: (scheduleItemId: string) => void;
  onMovePin: (scheduleItemId: string, requestedStart: string, durationDays: number) => void;
  onResizePin: (scheduleItemId: string, requestedStart: string, durationDays: number) => void;
};

const GANTT_DAY_PX = 18;
const GANTT_TIMELINE_WEEKS = 12;
const GANTT_TIMELINE_DAYS = GANTT_TIMELINE_WEEKS * 7;
const GANTT_ZOOM_WEEK_OPTIONS = [4, 8, 12] as const;
const GANTT_DEFAULT_ZOOM_WEEKS: GanttZoomWeeks = 12;
const GANTT_LABEL_MIN_PX = 220;
const GANTT_LABEL_DEFAULT_PX = 260;
const GANTT_LABEL_MAX_PX = 420;
const GANTT_BAR_LABEL_MIN_PX = 120;
const GANTT_TZ = SCHEDULE_TIME_ZONE;
const GANTT_DENSITY_STORAGE_KEY = 'sp.schedule.ganttDensity';
const GANTT_LABEL_WIDTH_STORAGE_KEY = 'sp.schedule.ganttLabelWidth';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

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

function formatShortDate(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', timeZone: GANTT_TZ }).format(dt);
}

function formatStatusLabel(status: string): string {
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

function snapToWeekdayYmd(ymd: string): string {
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

function workingDaysInclusive(startYmd: string, endYmd: string): number {
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

function addWorkingDaysInclusive(startYmd: string, durationDays: number): string {
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

function snapToWeekdayYmdDirectional(ymd: string, direction: number): string {
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

function normalizeGanttZoomWeeks(value: number): GanttZoomWeeks {
  if (value === 4 || value === 8 || value === 12) return value;
  return GANTT_DEFAULT_ZOOM_WEEKS;
}

function ganttBaseDayPxForZoomWeeks(zoomWeeks: GanttZoomWeeks): number {
  return Math.max(1, Math.round((GANTT_DAY_PX * GANTT_TIMELINE_WEEKS) / zoomWeeks));
}

function clampGanttLabelWidth(value: number): number {
  if (!Number.isFinite(value)) return GANTT_LABEL_DEFAULT_PX;
  return Math.max(GANTT_LABEL_MIN_PX, Math.min(GANTT_LABEL_MAX_PX, Math.round(value)));
}

function readGanttDensityPreference(): GanttDensity {
  if (typeof window === 'undefined') return 'compact';
  try {
    const value = window.localStorage.getItem(GANTT_DENSITY_STORAGE_KEY);
    if (value === 'compact' || value === 'comfortable') return value;
  } catch {
    // ignore read errors
  }
  return 'compact';
}

function writeGanttDensityPreference(value: GanttDensity): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(GANTT_DENSITY_STORAGE_KEY, value);
  } catch {
    // ignore write errors
  }
}

function readGanttLabelWidthPreference(): number {
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

function writeGanttLabelWidthPreference(value: number): void {
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

function darkenHex(hex: string, amount: number): string {
  const rgb = parseHexColour(hex);
  if (!rgb) return hex;
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return `#${toHexByte(rgb.r * factor)}${toHexByte(rgb.g * factor)}${toHexByte(rgb.b * factor)}`;
}

function getReadableTextColor(bgHex: string): '#000000' | '#ffffff' {
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

function hasPlannedCommitment(item: ScheduleItem): boolean {
  return Boolean(item.plannedCommitmentType || item.plannedStart || item.plannedWeekStart);
}

function resolveCommitmentType(item: ScheduleItem): 'week_of' | 'fixed_date' | null {
  if (item.plannedCommitmentType === 'week_of' || item.plannedCommitmentType === 'fixed_date') return item.plannedCommitmentType;
  if (item.plannedStart) return 'fixed_date';
  return null;
}

function resolvePlannedFlexDays(item: ScheduleItem): number | null {
  if (typeof item.plannedFlexDays === 'number' && Number.isFinite(item.plannedFlexDays)) return Math.max(0, Math.trunc(item.plannedFlexDays));
  const commitmentType = resolveCommitmentType(item);
  if (!commitmentType) return null;
  return commitmentType === 'week_of' ? 4 : 1;
}

function formatCommitmentLabel(item: ScheduleItem): string | null {
  const commitmentType = resolveCommitmentType(item);
  if (!commitmentType) return null;
  if (commitmentType === 'week_of') {
    const weekStart = item.plannedWeekStart ?? (item.plannedStart ? startOfWeekMonday(item.plannedStart) : null);
    return weekStart ? `Week of ${formatShortDate(weekStart)}` : 'Week of -';
  }
  return item.plannedStart ? `Starts ${formatShortDate(item.plannedStart)}` : 'Starts -';
}

function isTextInputLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
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

function computeGanttPopoverPosition(anchor: GanttPopoverAnchor): { top: number; left: number } {
  const width = 300;
  const margin = 12;
  const gap = 10;
  if (typeof window === 'undefined') return { top: anchor.bottom + gap, left: anchor.left };
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const preferredTop = anchor.bottom + gap;
  const estimatedHeight = 340;
  const canOpenBelow = preferredTop + estimatedHeight <= window.innerHeight - margin;
  const top = canOpenBelow ? preferredTop : Math.max(margin, anchor.top - estimatedHeight - gap);
  return { top, left };
}

function GanttBarPopover({
  anchor,
  actions,
  details,
  onClose,
  onKeyDown,
  focusRef,
}: {
  anchor: GanttPopoverAnchor;
  actions: GanttPopoverAction[];
  details?: React.ReactNode;
  onClose: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  focusRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pos = computeGanttPopoverPosition(anchor);
  return (
    <>
      <div className={styles.ganttPopoverBackdrop} onPointerDown={onClose} onMouseDown={onClose} />
      <div
        ref={focusRef}
        tabIndex={-1}
        className={styles.ganttPopover}
        style={{ top: pos.top, left: pos.left }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        aria-label="Gantt quick actions"
      >
        {details ? <div className={styles.ganttPopoverDetails}>{details}</div> : null}
        <div className={styles.ganttPopoverActionList}>
          {actions.map((action, actionIndex) => (
            <button
              key={`${action.label}-${actionIndex}`}
              type="button"
              className={cx(styles.ganttPopoverAction, action.tone === 'danger' && styles.ganttPopoverActionDanger)}
              disabled={Boolean(action.disabled)}
              onClick={() => action.onClick()}
            >
              <span>{action.label}</span>
              {action.shortcut ? <span className={styles.ganttPopoverShortcut}>{action.shortcut}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function ScheduleGanttView({
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
  showCompleted,
  onShowCompletedChange,
  onOpenProject,
  onOpenProjectPack,
  onOpenCommitmentEdit,
  onOpenPinEdit,
  onUnpinScheduleItem,
  onAckClientUpdate,
  onMovePin,
  onResizePin,
}: ScheduleGanttViewProps) {
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const ganttPopoverRef = useRef<HTMLDivElement | null>(null);
  const labelWidthPxRef = useRef(GANTT_LABEL_DEFAULT_PX);
  const pendingZoomAnchorRef = useRef<{ date: string; viewportOffsetPx: number } | null>(null);
  const ganttDragDeltaRef = useRef(0);
  const ganttDragMovedRef = useRef(false);
  const ganttClickBlockUntilRef = useRef(0);
  const scheduleItemById = useMemo(() => new Map(visibleScheduleItems.map((item) => [item.id, item] as const)), [visibleScheduleItems]);
  const scheduleItemByIdRef = useRef(scheduleItemById);

  const [zoomWeeks, setZoomWeeks] = useState<GanttZoomWeeks>(GANTT_DEFAULT_ZOOM_WEEKS);
  const [ganttDensity, setGanttDensity] = useState<GanttDensity>(() => readGanttDensityPreference());
  const [labelWidthPx, setLabelWidthPx] = useState<number>(() => readGanttLabelWidthPreference());
  const [collapsedCrews, setCollapsedCrews] = useState<Record<string, boolean>>({});
  const [showPlanned, setShowPlanned] = useState(false);
  const [hoveredGanttRowId, setHoveredGanttRowId] = useState<string | null>(null);
  const [ganttLabelResize, setGanttLabelResize] = useState<{ startX: number; startWidth: number } | null>(null);
  const [ganttPopover, setGanttPopover] = useState<{ scheduleItemId: string; anchor: GanttPopoverAnchor } | null>(null);
  const [ganttDrag, setGanttDrag] = useState<{
    id: string;
    mode: 'move' | 'resize';
    originX: number;
    startDate: string;
    endDate: string;
    durationDays: number;
  } | null>(null);
  const [ganttDragDelta, setGanttDragDelta] = useState(0);
  const [ganttDragPointer, setGanttDragPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    scheduleItemByIdRef.current = scheduleItemById;
  }, [scheduleItemById]);

  useEffect(() => {
    writeGanttDensityPreference(ganttDensity);
  }, [ganttDensity]);

  useEffect(() => {
    labelWidthPxRef.current = labelWidthPx;
  }, [labelWidthPx]);

  const issueLevelByScheduleId = useMemo(() => {
    const map = new Map<string, 'warning' | 'error'>();
    for (const issue of scheduleIssues) {
      const id = issue.scheduleItemId;
      if (!id) continue;
      if (issue.level === 'error') map.set(id, 'error');
      else if (!map.has(id)) map.set(id, 'warning');
    }
    return map;
  }, [scheduleIssues]);

  const conflictMessageByScheduleId = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of scheduleIssues) {
      if (issue.level !== 'error' || !issue.scheduleItemId) continue;
      map.set(issue.scheduleItemId, issue.message);
    }
    return map;
  }, [scheduleIssues]);

  const ganttJobsById = useMemo(() => {
    const jobsById = new Map<string, { projectName: string; durationLabel: string }>();
    for (const item of visibleScheduleItems) {
      if (item.itemType === 'downtime') {
        const durationHours =
          typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
            ? item.durationHoursOverride
            : WORK_HOURS_PER_DAY;
        jobsById.set(item.id, { projectName: item.downtimeReason ?? 'Downtime', durationLabel: formatDuration(durationHours) });
        continue;
      }

      const project = projectsById.get(item.projectId) ?? null;
      const estimate = estimatesById.get(item.estimateId) ?? null;
      let durationHours = WORK_HOURS_PER_DAY;
      if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
        durationHours = item.durationHoursOverride;
      } else if (typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0) {
        durationHours = item.forecastDurationDays * WORK_HOURS_PER_DAY;
      } else if (estimate) {
        durationHours = deriveDurationHoursFromEstimate(estimate).durationHours;
      }
      jobsById.set(item.id, {
        projectName: project?.projectName ?? project?.name ?? 'Untitled project',
        durationLabel: formatDuration(durationHours),
      });
    }
    return jobsById;
  }, [estimatesById, projectsById, visibleScheduleItems]);

  const gantt = useMemo<GanttModel>(() => {
    const rangeStart = startOfWeekMonday(today);
    const rangeDays = GANTT_TIMELINE_DAYS;
    const rangeEnd = addDaysYmd(rangeStart, rangeDays - 1);
    const baseDayPx = ganttBaseDayPxForZoomWeeks(zoomWeeks);
    const axis = buildGanttAxis({ rangeStart, rangeDays, baseDayPx, weekendWeight: GANTT_WEEKEND_WEIGHT });
    const totalWidth = axis.totalWidth;
    const displayToday = isWeekendDate(today) ? snapToWeekdayYmd(today) : today;
    const todayIndex = diffDaysYmd(rangeStart, displayToday);
    const todayLinePx = axisXForDayIndex(axis, todayIndex);
    const todayColumn = todayIndex >= 0 && todayIndex < axis.days.length ? axis.days[todayIndex] : null;

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
    for (const installer of installers.filter((i) => i.active)) {
      const items = laneItems.get(installer.id) ?? [];
      const collapsed = Boolean(collapsedCrews[installer.id]);
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
        jobCount: items.length,
        collapsed,
        summarySpans,
      });
      if (!items.length) {
        rows.push({ kind: 'empty', id: `empty:${installer.id}`, installerId: installer.id, label: '(empty)' });
        continue;
      }
      if (collapsed) continue;

      for (const item of items) {
        const bar = barsById.get(item.id);
        if (!bar) continue;
        const scheduleItem = scheduleItemById.get(item.id) ?? null;
        const isDowntime = scheduleItem?.itemType === 'downtime';
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
          projectName: bar.projectName,
          status: bar.status,
          durationLabel: ganttJobsById.get(item.id)?.durationLabel ?? formatDuration(bar.durationHours),
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
          plannedCommitmentLabel: scheduleItem ? formatCommitmentLabel(scheduleItem) : null,
          plannedFlexDays: scheduleItem ? resolvePlannedFlexDays(scheduleItem) : null,
          plannedDurationDays:
            scheduleItem && typeof scheduleItem.plannedDurationDays === 'number' && Number.isFinite(scheduleItem.plannedDurationDays)
              ? Math.max(1, Math.trunc(scheduleItem.plannedDurationDays))
              : null,
          driftDays:
            scheduleItem && typeof scheduleItem.driftDays === 'number' && Number.isFinite(scheduleItem.driftDays)
              ? Math.max(0, Math.trunc(scheduleItem.driftDays))
              : null,
          clientUpdateStatus: scheduleItem?.clientUpdateStatus ?? null,
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
      weekendBlocks,
      holidayBlocks,
      dayBoundaryLines,
      weekBoundaryLines,
      rows,
    };
  }, [
    collapsedCrews,
    ganttDrag,
    ganttDragDelta,
    ganttJobsById,
    holidays,
    installers,
    issueLevelByScheduleId,
    laneItems,
    scheduleBars,
    scheduleItemById,
    scheduleMode,
    showPlanned,
    today,
    visibleScheduleItems,
    zoomWeeks,
  ]);

  const activeGanttPopoverRow = useMemo(() => {
    if (!ganttPopover) return null;
    return gantt.rows.find((row): row is Extract<GanttRow, { kind: 'item' }> => row.kind === 'item' && row.scheduleItemId === ganttPopover.scheduleItemId) ?? null;
  }, [gantt.rows, ganttPopover]);

  const activeGanttDragRow = useMemo(() => {
    if (!ganttDrag) return null;
    return gantt.rows.find((row): row is Extract<GanttRow, { kind: 'item' }> => row.kind === 'item' && row.scheduleItemId === ganttDrag.id) ?? null;
  }, [gantt.rows, ganttDrag]);

  const ganttDragFeedback = useMemo(() => {
    if (!ganttDrag || !activeGanttDragRow) return null;
    return {
      mode: ganttDrag.mode,
      startDate: activeGanttDragRow.startDate,
      endDate: activeGanttDragRow.endDate,
      durationDays: Math.max(1, activeGanttDragRow.durationDays),
      snapLinePx: ganttDrag.mode === 'resize' ? activeGanttDragRow.barLeftPx + activeGanttDragRow.barWidthPx : activeGanttDragRow.barLeftPx,
    };
  }, [activeGanttDragRow, ganttDrag]);

  const ganttPopoverDetails = useMemo(() => {
    if (!ganttPopover || !activeGanttPopoverRow) return null;
    const row = activeGanttPopoverRow;
    if (row.isDowntime) return null;
    const scheduleItem = scheduleItemById.get(row.scheduleItemId) ?? null;
    if (!scheduleItem || scheduleItem.itemType === 'downtime') return null;
    const isPinned = scheduleItem.mode === 'pinned';
    const hasCommitment = hasPlannedCommitment(scheduleItem);
    const clientUpdateStatus = scheduleItem.clientUpdateStatus ?? 'none';
    const closeAndRun = (action: () => void) => {
      setGanttPopover(null);
      action();
    };
    const details = (
      <>
        <div className={styles.ganttPopoverTitle}>{row.projectName}</div>
        <div className={styles.ganttPopoverMeta}>
          Planned: {hasCommitment ? row.plannedCommitmentLabel ?? 'Committed' : 'Draft'}
          {hasCommitment && row.plannedDurationDays ? ` - ~${row.plannedDurationDays}d` : ''}
          {hasCommitment && typeof row.plannedFlexDays === 'number' ? ` - flex ${row.plannedFlexDays}wd` : ''}
        </div>
        <div className={styles.ganttPopoverMeta}>
          Forecast: {formatShortDate(row.startDate)} - {formatShortDate(row.endDate)} - {row.durationLabel}
        </div>
        {hasCommitment && typeof row.driftDays === 'number' ? (
          <div className={styles.ganttPopoverMeta}>Drift: +{row.driftDays} working day{row.driftDays === 1 ? '' : 's'}</div>
        ) : null}
        {clientUpdateStatus === 'needed' ? <div className={styles.clientUpdatePill}>Client update needed</div> : null}
        {clientUpdateStatus === 'acknowledged' ? <div className={styles.clientAckPill}>Client contacted</div> : null}
      </>
    );
    const openProjectAction = () => closeAndRun(() => onOpenProject(row.projectId));
    const pinAction = () =>
      closeAndRun(() => {
        if (isPinned) onUnpinScheduleItem(row.scheduleItemId);
        else onOpenPinEdit(row.scheduleItemId, isYmd(scheduleItem.forecastStart ?? '') ? scheduleItem.forecastStart ?? '' : row.startDate);
      });

    return {
      details,
      actions: [
        { label: 'Open project', shortcut: 'Enter', onClick: openProjectAction },
        { label: 'Open project pack', onClick: () => closeAndRun(() => onOpenProjectPack(row.projectId, row.estimateId)) },
        { label: hasCommitment ? 'Reschedule...' : 'Lock schedule...', onClick: () => closeAndRun(() => onOpenCommitmentEdit(row.scheduleItemId, hasCommitment ? 'reschedule' : 'lock')) },
        ...(clientUpdateStatus === 'needed'
          ? [{ label: 'Mark client contacted', onClick: () => closeAndRun(() => onAckClientUpdate(row.scheduleItemId)) }]
          : clientUpdateStatus === 'acknowledged'
            ? [{ label: 'Client contacted', onClick: () => {}, disabled: true }]
            : []),
        { label: isPinned ? 'Unpin' : 'Pin...', shortcut: 'P', onClick: pinAction },
      ] satisfies GanttPopoverAction[],
      openProjectAction,
      pinAction,
    };
  }, [
    activeGanttPopoverRow,
    ganttPopover,
    onAckClientUpdate,
    onOpenCommitmentEdit,
    onOpenPinEdit,
    onOpenProject,
    onOpenProjectPack,
    onUnpinScheduleItem,
    scheduleItemById,
  ]);

  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    if (!anchor) return;
    const scroller = ganttScrollRef.current;
    if (!scroller || gantt.axis.rangeDays <= 0) {
      pendingZoomAnchorRef.current = null;
      return;
    }
    const rawIndex = diffDaysYmd(gantt.rangeStart, anchor.date);
    const dayIndex = Math.max(0, Math.min(gantt.axis.rangeDays - 1, rawIndex));
    const nextTodayAbsolutePx = labelWidthPx + axisXForDayIndex(gantt.axis, dayIndex);
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.max(0, Math.min(maxLeft, nextTodayAbsolutePx - anchor.viewportOffsetPx));
    pendingZoomAnchorRef.current = null;
  }, [gantt.axis.boundaryPx, gantt.axis.rangeDays, gantt.rangeStart, gantt.totalWidth, labelWidthPx, zoomWeeks]);

  useEffect(() => {
    if (!ganttPopover) return;
    if (!activeGanttPopoverRow) {
      setGanttPopover(null);
      return;
    }
    const timer = window.setTimeout(() => ganttPopoverRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [activeGanttPopoverRow, ganttPopover]);

  useEffect(() => {
    if (!ganttDrag) return;

    const onMove = (e: PointerEvent) => {
      const deltaPx = e.clientX - ganttDrag.originX;
      setGanttDragPointer({ x: e.clientX, y: e.clientY });
      if (Math.abs(deltaPx) > 3) ganttDragMovedRef.current = true;
      const anchorDate = ganttDrag.mode === 'resize' ? ganttDrag.endDate : ganttDrag.startDate;
      const rawDelta = snapAxisDayDeltaForPixelDelta({
        startDate: anchorDate,
        deltaPx,
        baseDayPx: gantt.axis.baseDayPx,
        weekendWeight: GANTT_WEEKEND_WEIGHT,
        maxSteps: gantt.rangeDays + 21,
      });
      const requested = addDaysYmd(anchorDate, rawDelta);
      const snapped = snapToWeekdayYmdDirectional(requested, rawDelta);
      const nextDelta = diffDaysYmd(anchorDate, snapped);
      if (nextDelta !== ganttDragDeltaRef.current) {
        ganttDragDeltaRef.current = nextDelta;
        setGanttDragDelta(nextDelta);
      }
    };

    const onUp = () => {
      const deltaDays = ganttDragDeltaRef.current;
      const moved = ganttDragMovedRef.current;
      ganttDragDeltaRef.current = 0;
      ganttDragMovedRef.current = false;
      setGanttDrag(null);
      setGanttDragDelta(0);
      setGanttDragPointer(null);
      if (moved) ganttClickBlockUntilRef.current = Date.now() + 250;
      if (!moved || deltaDays === 0) return;

      const item = scheduleItemByIdRef.current.get(ganttDrag.id) ?? null;
      if (!item || item.itemType === 'downtime') return;
      if (ganttDrag.mode === 'move') {
        const requested = addDaysYmd(ganttDrag.startDate, deltaDays);
        const snapped = snapToWeekdayYmdDirectional(requested, deltaDays);
        onMovePin(ganttDrag.id, snapped, Math.max(1, ganttDrag.durationDays));
        return;
      }
      const baseStart = item.forecastStart ?? ganttDrag.startDate;
      const snappedStart = snapToWeekdayYmd(baseStart);
      const requestedEnd = addDaysYmd(ganttDrag.endDate, deltaDays);
      const snappedEnd = snapToWeekdayYmdDirectional(requestedEnd, deltaDays);
      const nextDuration = Math.max(1, workingDaysInclusive(snappedStart, snappedEnd));
      onResizePin(ganttDrag.id, snappedStart, nextDuration);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gantt.axis.baseDayPx, gantt.rangeDays, ganttDrag, onMovePin, onResizePin]);

  useEffect(() => {
    if (!ganttLabelResize) return;
    const onMove = (event: PointerEvent) => {
      setLabelWidthPx(clampGanttLabelWidth(ganttLabelResize.startWidth + event.clientX - ganttLabelResize.startX));
    };
    const onUp = () => {
      writeGanttLabelWidthPreference(labelWidthPxRef.current);
      setGanttLabelResize(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [ganttLabelResize]);

  const handleGanttZoomWeeksChange = (next: GanttZoomWeeks) => {
    if (next === zoomWeeks) return;
    const scroller = ganttScrollRef.current;
    if (scroller && gantt.axis.rangeDays > 0) {
      const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
      const todayViewportOffsetPx = labelWidthPx + gantt.todayLinePx - scroller.scrollLeft;
      const minVisiblePx = labelWidthPx + 8;
      const maxVisiblePx = Math.max(minVisiblePx, scroller.clientWidth - 8);
      const fallbackVisiblePx = labelWidthPx + timelineViewportWidth * 0.3;
      pendingZoomAnchorRef.current = {
        date: gantt.displayToday,
        viewportOffsetPx: todayViewportOffsetPx >= minVisiblePx && todayViewportOffsetPx <= maxVisiblePx ? todayViewportOffsetPx : fallbackVisiblePx,
      };
    }
    setZoomWeeks(next);
  };

  const jumpGanttToToday = () => {
    const scroller = ganttScrollRef.current;
    if (!scroller) return;
    const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
    const todayAbsolutePx = labelWidthPx + gantt.todayLinePx;
    const targetLeft = Math.max(0, todayAbsolutePx - (labelWidthPx + timelineViewportWidth * 0.3));
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollTo({ left: Math.min(maxLeft, targetLeft), behavior: 'smooth' });
  };

  const beginGanttLabelResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setGanttLabelResize({ startX: event.clientX, startWidth: labelWidthPx });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  };

  const openGanttPopover = (row: Extract<GanttRow, { kind: 'item' }>, target: HTMLElement) => {
    if (row.isDowntime) {
      setGanttPopover(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setGanttPopover({
      scheduleItemId: row.scheduleItemId,
      anchor: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
    });
  };

  const beginGanttDrag = (
    row: { scheduleItemId: string; startDate: string; endDate: string; durationDays: number; isDowntime?: boolean },
    mode: 'move' | 'resize',
    e: React.PointerEvent,
  ) => {
    if (scheduleMode !== 'v2' || row.isDowntime || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setGanttPopover(null);
    ganttDragDeltaRef.current = 0;
    ganttDragMovedRef.current = false;
    setGanttDragDelta(0);
    setGanttDragPointer({ x: e.clientX, y: e.clientY });
    setGanttDrag({
      id: row.scheduleItemId,
      mode,
      originX: e.clientX,
      startDate: row.startDate,
      endDate: row.endDate,
      durationDays: Math.max(1, Math.trunc(row.durationDays)),
    });
    try {
      (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  };

  const shouldBlockGanttClick = () => typeof window !== 'undefined' && Date.now() < ganttClickBlockUntilRef.current;
  const toggleCrewCollapsed = (installerId: string) => setCollapsedCrews((prev) => ({ ...prev, [installerId]: !prev[installerId] }));

  const handleGanttPopoverKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTextInputLikeTarget(event.target)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setGanttPopover(null);
      return;
    }
    if (!ganttPopoverDetails) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      ganttPopoverDetails.openProjectAction?.();
      return;
    }
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      ganttPopoverDetails.pinAction?.();
    }
  };

  return (
    <div className={styles.gantt}>
      <div className={styles.ganttControls}>
        <div className={styles.ganttControlsLeft}>
          <div className={styles.ganttMeta}>
            Range: <strong>{formatShortDate(gantt.rangeStart)}</strong>{' -> '}<strong>{formatShortDate(gantt.rangeEnd)}</strong>
          </div>
          <select
            className={cx(styles.input, styles.ganttControlSelect)}
            value={zoomWeeks}
            onChange={(e) => handleGanttZoomWeeksChange(normalizeGanttZoomWeeks(Number(e.target.value)))}
            aria-label="Zoom"
          >
            {GANTT_ZOOM_WEEK_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} weeks
              </option>
            ))}
          </select>
          <label className={styles.ganttDensityControl}>
            <span className={styles.ganttDensityLabel}>Density</span>
            <select
              className={styles.ganttDensitySelect}
              value={ganttDensity}
              onChange={(e) => setGanttDensity(e.target.value === 'comfortable' ? 'comfortable' : 'compact')}
              aria-label="Density"
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </select>
          </label>
          {scheduleMode === 'v2' ? (
            <div className={styles.ganttLegendInline} aria-label="Gantt legend">
              <span className={styles.legendItem}><span className={styles.legendSwatch} />Forecast</span>
              {showPlanned ? <span className={styles.legendItem}><span className={cx(styles.legendSwatch, styles.legendSwatchPlanned)} />Planned</span> : null}
              <span className={styles.legendItem}><span className={styles.legendDot} aria-hidden="true" />Pinned</span>
              <span className={styles.legendItem}><span className={cx(styles.legendSwatch, styles.legendSwatchConflict)} />Conflict</span>
            </div>
          ) : null}
        </div>
        <div className={styles.ganttControlsRight}>
          <label className={styles.toggleControl}>
            <input type="checkbox" className={styles.toggleCheckbox} checked={showCompleted} onChange={(e) => onShowCompletedChange(e.target.checked)} />
            Show completed jobs
          </label>
          <button type="button" className={cx(styles.buttonSecondary, styles.ganttControlButton, styles.ganttJumpButton)} onClick={jumpGanttToToday}>
            Jump to today
          </button>
          {scheduleMode === 'v2' ? (
            <button type="button" className={cx(styles.buttonSecondary, styles.ganttControlButton)} aria-pressed={showPlanned} onClick={() => setShowPlanned((v) => !v)}>
              {showPlanned ? 'Hide planned' : 'Show planned'}
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.ganttScroll} aria-label="Gantt timeline" ref={ganttScrollRef}>
        <div
          className={styles.ganttTable}
          data-density={ganttDensity}
          style={
            {
              gridTemplateColumns: `${labelWidthPx}px ${gantt.totalWidth}px`,
              ['--ganttLabelW' as any]: `${labelWidthPx}px`,
              ['--ganttDayW' as any]: `${gantt.axis.baseDayPx}px`,
            } as React.CSSProperties
          }
        >
          {gantt.todayColumnLeftPx != null ? (
            <div className={styles.todayColumnWash} style={{ left: labelWidthPx + gantt.todayColumnLeftPx, width: gantt.todayColumnWidthPx }} aria-hidden="true" />
          ) : null}
          {gantt.weekendBlocks.map((b) => <div key={`weekend-${b.date}`} className={styles.weekendShade} style={{ left: labelWidthPx + b.leftPx, width: b.widthPx }} aria-hidden="true" />)}
          {gantt.holidayBlocks.map((b) => <div key={`holiday-${b.date}`} className={styles.holidayShade} style={{ left: labelWidthPx + b.leftPx, width: b.widthPx }} aria-hidden="true" />)}
          <div className={styles.ganttGridLines} aria-hidden="true">
            {gantt.dayBoundaryLines.map((leftPx, idx) => <div key={`day-line-${idx}-${leftPx}`} className={styles.ganttDayBoundary} style={{ left: labelWidthPx + leftPx }} />)}
            {gantt.weekBoundaryLines.map((leftPx, idx) => <div key={`week-line-${idx}-${leftPx}`} className={styles.ganttWeekBoundary} style={{ left: labelWidthPx + leftPx }} />)}
          </div>
          <div
            className={styles.ganttLabelResizer}
            data-active={ganttLabelResize ? 'true' : 'false'}
            style={{ left: labelWidthPx - 4 }}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize crew label column"
            onPointerDown={beginGanttLabelResize}
          />
          <div className={styles.ganttCorner}><div className={styles.ganttLeftHeaderGrid}><div className={styles.ganttColProject}>Crew / Project</div></div></div>
          <div className={styles.ganttHeader} style={{ width: gantt.totalWidth }}>
            <div className={styles.ganttTodayPillTrack}>
              {gantt.todayColumnLeftPx != null ? <span className={styles.ganttTodayPill} style={{ left: gantt.todayColumnLeftPx + gantt.todayColumnWidthPx / 2 }}>Today - {formatShortDate(gantt.displayToday)}</span> : null}
            </div>
            <div className={styles.ganttMonthBand}>
              {gantt.axis.months.map((month) => <div key={`month-${month.key}-${month.startWeekIndex}`} className={styles.ganttMonthLabel} style={{ left: month.startPx, width: month.widthPx }}>{month.label}</div>)}
            </div>
            <div className={styles.ganttWeekBand}>
              {gantt.axis.weeks.map((week) => <div key={`week-${week.index}-${week.startDate}`} className={styles.ganttWeekLabel} style={{ left: week.startPx, width: week.widthPx }}>{week.label}</div>)}
            </div>
            {gantt.holidayBlocks.map((b) => <div key={`holiday-hover-${b.date}`} className={styles.ganttHolidayHoverZone} style={{ left: b.leftPx, width: b.widthPx }} title={b.label} aria-label={b.label} />)}
          </div>
          <div className={styles.todayLine} style={{ left: labelWidthPx + gantt.todayLinePx }} aria-hidden="true" />
          {ganttDragFeedback ? <div className={styles.ganttSnapGuide} style={{ left: labelWidthPx + ganttDragFeedback.snapLinePx }} aria-hidden="true" /> : null}
          {gantt.rows.map((row) => (
            <div
              key={row.id}
              className={styles.ganttRowWrap}
              data-kind={row.kind}
              data-hovered={hoveredGanttRowId === row.id ? 'true' : 'false'}
              onMouseEnter={() => setHoveredGanttRowId(row.id)}
              onMouseLeave={() => setHoveredGanttRowId((prev) => (prev === row.id ? null : prev))}
            >
              <div className={cx(styles.ganttLeftCell, row.kind === 'group' && styles.ganttLeftCellGroup)}>
                <div className={styles.ganttLeftGrid}>
                  <div className={styles.ganttColProject}>
                    {row.kind === 'group' ? (
                      <span className={styles.ganttGroupLabel}>
                        <button
                          type="button"
                          className={styles.ganttCollapseBtn}
                          aria-label={row.collapsed ? `Expand ${row.label}` : `Collapse ${row.label}`}
                          aria-expanded={!row.collapsed}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCrewCollapsed(row.installerId);
                          }}
                        >
                          {row.collapsed ? '>' : 'v'}
                        </button>
                        <span className={styles.colorDot} style={{ background: row.color }} />
                        <span className={styles.ganttProjectText}>{row.label}</span>
                        <span className={styles.ganttGroupCount}>{row.jobCount}</span>
                      </span>
                    ) : row.kind === 'empty' ? (
                      <span className={styles.ganttEmptyLabel}>{row.label}</span>
                    ) : row.isDowntime ? (
                      <span className={styles.ganttProjectText}>{row.projectName}</span>
                    ) : (
                      <span className={styles.ganttProjectText} title={row.projectName}>{row.projectName}</span>
                    )}
                  </div>
                </div>
              </div>
              <div
                className={cx(styles.ganttTimelineRow, row.kind === 'group' && styles.ganttTimelineRowGroup)}
                style={{ width: gantt.totalWidth, cursor: row.kind === 'group' ? 'pointer' : undefined }}
                role={row.kind === 'group' ? 'button' : undefined}
                tabIndex={row.kind === 'group' ? 0 : undefined}
                onClick={row.kind === 'group' ? () => toggleCrewCollapsed(row.installerId) : undefined}
                onKeyDown={
                  row.kind === 'group'
                    ? (event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        toggleCrewCollapsed(row.installerId);
                      }
                    : undefined
                }
              >
                {row.kind === 'group' && row.collapsed
                  ? row.summarySpans.map((span, idx) => <div key={`crew-summary-${row.installerId}-${idx}`} className={styles.ganttCrewSummaryBar} style={{ left: span.leftPx, width: span.widthPx, backgroundColor: row.color }} aria-hidden="true" />)
                  : null}
                {row.kind === 'item' && row.plannedWidthPx && row.plannedWidthPx > 0 ? (
                  <div className={styles.ganttPlannedBar} style={{ left: row.plannedLeftPx, width: row.plannedWidthPx }} title={row.plannedStart && row.plannedEnd ? `Planned: ${formatShortDate(row.plannedStart)} -> ${formatShortDate(row.plannedEnd)}` : 'Planned dates'} />
                ) : null}
                {row.kind === 'item' && row.ghostWidthPx && row.ghostWidthPx > 0 ? <div className={styles.ganttGhostBar} style={{ left: row.ghostLeftPx, width: row.ghostWidthPx }} aria-hidden="true" /> : null}
                {row.kind === 'item' && row.barWidthPx > 0 ? (
                  <div
                    className={styles.ganttBar}
                    data-conflict={row.issueLevel === 'error' ? 'true' : undefined}
                    data-pinned={row.isPinned ? 'true' : undefined}
                    data-dragging={ganttDrag?.id === row.scheduleItemId ? 'true' : undefined}
                    style={{
                      left: row.barLeftPx,
                      width: row.barWidthPx,
                      backgroundColor: row.barColor,
                      borderColor: darkenHex(row.barColor, 0.12),
                      color: getReadableTextColor(row.barColor),
                    }}
                    title={(() => {
                      const crewName = installers.find((installer) => installer.id === row.installerId)?.name ?? null;
                      const conflict = row.issueLevel === 'error' ? conflictMessageByScheduleId.get(row.scheduleItemId) : null;
                      return [
                        row.projectName,
                        crewName ? `Crew: ${crewName}` : null,
                        row.isPinned ? 'Pinned' : null,
                        row.plannedCommitmentLabel ? `Planned: ${row.plannedCommitmentLabel}` : 'Planned: Draft',
                        typeof row.driftDays === 'number' ? `Drift: +${row.driftDays} working day${row.driftDays === 1 ? '' : 's'}` : null,
                        row.clientUpdateStatus === 'needed' ? 'Client update needed' : row.clientUpdateStatus === 'acknowledged' ? 'Client contacted' : null,
                        conflict ? `Conflict: ${conflict}` : null,
                        `Status: ${formatStatusLabel(row.status)}`,
                        `Duration: ${row.durationLabel}`,
                        `Start: ${formatShortDate(row.startDate)}`,
                        `End: ${formatShortDate(row.endDate)}`,
                      ].filter((line): line is string => Boolean(line)).join('\n');
                    })()}
                    onPointerDown={(e) => beginGanttDrag(row, 'move', e)}
                    onClick={(e) => {
                      if (shouldBlockGanttClick()) return;
                      e.stopPropagation();
                      openGanttPopover(row, e.currentTarget);
                    }}
                  >
                    {row.isPinned ? <span className={styles.ganttPin} aria-hidden="true" /> : null}
                    {row.barWidthPx >= GANTT_BAR_LABEL_MIN_PX ? <span className={styles.ganttBarTextFade}><span className={styles.ganttBarText}>{row.projectName}</span></span> : null}
                    {scheduleMode === 'v2' && !row.isDowntime ? (
                      <span className={styles.ganttResizeHandle} role="presentation" onPointerDown={(e) => beginGanttDrag(row, 'resize', e)} onClick={(e) => e.stopPropagation()} />
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
      {ganttDragFeedback && ganttDragPointer ? (
        <div className={styles.ganttDragTooltip} style={{ left: ganttDragPointer.x + 14, top: ganttDragPointer.y + 14 }}>
          {ganttDragFeedback.mode === 'move' ? <div>Start: {formatShortDate(ganttDragFeedback.startDate)}</div> : null}
          <div>End: {formatShortDate(ganttDragFeedback.endDate)}</div>
          <div>Duration: {ganttDragFeedback.durationDays}d</div>
        </div>
      ) : null}
      {ganttPopover && ganttPopoverDetails ? (
        <GanttBarPopover
          anchor={ganttPopover.anchor}
          actions={ganttPopoverDetails.actions}
          details={ganttPopoverDetails.details}
          onClose={() => setGanttPopover(null)}
          onKeyDown={handleGanttPopoverKeyDown}
          focusRef={ganttPopoverRef}
        />
      ) : null}
    </div>
  );
}
