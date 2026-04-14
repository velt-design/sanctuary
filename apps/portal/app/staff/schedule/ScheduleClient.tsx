'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import styles from './schedule.module.css';
import { listInstallers } from '@/lib/repo/installersRepo';
import { getProject, listProjects } from '@/lib/repo/projectsRepo';
import { listAllEstimates } from '@/lib/repo/estimatesRepo';
import { confirmScheduleItem, deleteScheduleItem, listScheduleItems, normalizeScheduleItemsStarted, replaceScheduleItems, unlockScheduleItem } from '@/lib/repo/scheduleRepo';
import {
  ackClientUpdate,
  assignJob,
  createDowntime,
  deleteDowntime,
  lockJobSchedule,
  markJobDone,
  markJobInProgress,
  pinJob,
  reorderItems as reorderScheduleItemsV2,
  rescheduleJob,
  type ScheduleCrewSchedule,
  type ScheduleMutationResult,
  setDaysRemaining,
  setJobDuration,
  unassignJob,
  unpinJob,
  updateDowntime,
} from '@/lib/repo/scheduleV2Repo';
import { qk } from '@/lib/queries/keys';
import { scheduleV2SnapshotQueryOptions, type ScheduleProjectSummary, type ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { isSchedulingReadyProjectStatus } from '@/lib/scheduling/readiness';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import { nextActionTypeLabel, normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { Installer, ScheduleItem, ScheduleItemStatus, SchedulingIssue } from '@/lib/types/scheduling';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import { buildScheduleBars } from '@/lib/scheduling/engine';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';
import { recomputeCrewSchedule, type CrewDowntime, type CrewScheduleItem, type ScheduledJob as RecomputeScheduledJob } from '@/lib/scheduling/recompute';
import { resolveScheduleTodayYmd, SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import { buildWorkingDayIndex, type CompanyClosure, type NzHoliday } from '@/lib/scheduling/workingDays';
import { useToast } from '@/components/ui/toast/ToastProvider';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { SupabaseRepoError } from '@/lib/supabase/repoError';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { ApiError } from '@/lib/repo/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';
import { runScheduleDiagnostics } from '@/lib/queries/scheduleDiagnostics';
import {
  closestCenter,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragMoveEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  axisSpanPx,
  axisXForDayIndex,
  buildGanttAxis,
  GANTT_WEEKEND_WEIGHT,
  snapAxisDayDeltaForPixelDelta,
} from './ganttAxis';
import type { ScheduleActionModalsProps, ScheduleModalState } from './ScheduleActionModals';
import type { ScheduleDiagnosticsResult } from './ScheduleDiagnosticsPanel';
import { resolveBoardDropTarget, type BoardDropTarget, type BoardDragLane, type BoardDragPoint, type BoardDragRect } from './boardDrag';

const LazySiteVisitsView = dynamic(() => import('./SiteVisitsView'), {
  ssr: false,
  loading: () => <p className={styles.note}>Loading site visits…</p>,
});

const LazyScheduleActionModals = dynamic<ScheduleActionModalsProps>(
  () => import('./ScheduleActionModals'),
  {
    ssr: false,
  },
);

const LazyScheduleDiagnosticsPanel = dynamic(() => import('./ScheduleDiagnosticsPanel'), {
  ssr: false,
});

export type SchedulableJob = {
  id: string;
  projectId: string;
  estimateId: string;
  projectName: string;
  descriptor: string;
  status: string;
  durationHours: number;
  durationLabel: string;
  durationTitle: string;
  warnings: string[];
};

export type ScheduleBoardModel = {
  schedulable: {
    jobsById: Map<string, SchedulableJob>;
    unscheduledJobs: SchedulableJob[];
    debug: Record<string, any>;
    blockingProjectIds: Set<string>;
  };
  unscheduledJobsAll: SchedulableJob[];
  unscheduledJobs: SchedulableJob[];
  laneItems: Map<string, ScheduleItem[]>;
};

export type ScheduleGanttModel = {
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

type ScheduleRuntimeState = {
  hydrated: boolean;
  loadError: { message: string; table?: string; code?: string } | null;
  syncing: boolean;
  scheduleMode: 'v2' | 'legacy';
  view: 'board' | 'gantt' | 'site_visits';
};

type GanttDensity = 'compact' | 'comfortable';

type GanttSummarySpan = {
  leftPx: number;
  widthPx: number;
};

const GANTT_DAY_PX = 18;
const GANTT_TIMELINE_WEEKS = 12;
const GANTT_TIMELINE_DAYS = GANTT_TIMELINE_WEEKS * 7;
const GANTT_ZOOM_WEEK_OPTIONS = [4, 8, 12] as const;
type GanttZoomWeeks = (typeof GANTT_ZOOM_WEEK_OPTIONS)[number];
const GANTT_DEFAULT_ZOOM_WEEKS: GanttZoomWeeks = 12;
const GANTT_LABEL_MIN_PX = 220;
const GANTT_LABEL_DEFAULT_PX = 260;
const GANTT_LABEL_MAX_PX = 420;
const GANTT_BAR_LABEL_MIN_PX = 120;
const GANTT_TZ = SCHEDULE_TIME_ZONE;
const GANTT_DENSITY_STORAGE_KEY = 'sp.schedule.ganttDensity';
const GANTT_LABEL_WIDTH_STORAGE_KEY = 'sp.schedule.ganttLabelWidth';
const USE_SCHEDULE_V2 = true;
const V2_MUTATION_DEBOUNCE_MS = 180;

const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
};

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
    const parsed = Number.parseFloat(raw);
    return clampGanttLabelWidth(parsed);
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
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff,
  };
}

function toHexByte(n: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(n)));
  return clamped.toString(16).padStart(2, '0');
}

function darkenHex(hex: string, amount: number): string {
  const rgb = parseHexColour(hex);
  if (!rgb) return hex;
  const factor = 1 - Math.max(0, Math.min(1, amount));
  return `#${toHexByte(rgb.r * factor)}${toHexByte(rgb.g * factor)}${toHexByte(rgb.b * factor)}`;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const toLinear = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function getReadableTextColor(bgHex: string): '#000000' | '#ffffff' {
  const rgb = parseHexColour(bgHex);
  if (!rgb) return '#000000';
  const L = relativeLuminance(rgb);
  const contrastWithBlack = (L + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (L + 0.05);
  return contrastWithWhite >= contrastWithBlack ? '#ffffff' : '#000000';
}

function mergeSummarySpans(spans: GanttSummarySpan[]): GanttSummarySpan[] {
  const sorted = spans
    .filter((span) => Number.isFinite(span.leftPx) && Number.isFinite(span.widthPx) && span.widthPx > 0)
    .sort((a, b) => a.leftPx - b.leftPx);
  if (!sorted.length) return [];

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

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  const days = hours / WORK_HOURS_PER_DAY;
  const daysLabel = Number.isFinite(days) ? days.toFixed(days % 1 === 0 ? 0 : 1) : '—';
  return `${daysLabel}d`;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  const h = hours.toFixed(hours % 1 === 0 ? 0 : 1);
  return `${h}h`;
}

function formatStatusLabel(status: string): string {
  if (!status) return '—';
  if (status.toUpperCase() === 'DOWNTIME') return 'Downtime';
  const normalized = normalizeProjectStatus(status);
  return projectStatusLabel(normalized.status);
}

function normalizeScheduleStatus(value: unknown): ScheduleItemStatus {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (s === 'CONFIRMED' || s === 'IN_PROGRESS' || s === 'COMPLETED') return s as ScheduleItemStatus;
  return 'TENTATIVE';
}

function scheduleStatusLabel(status: ScheduleItemStatus): string {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'COMPLETED') return 'Completed';
  return 'Tentative';
}

function deriveScheduleStatus(item: ScheduleItem, today: string): ScheduleItemStatus {
  const raw = normalizeScheduleStatus(item.scheduleStatus);
  if (raw === 'COMPLETED') return 'COMPLETED';
  const planned = typeof item.startDateOverride === 'string' ? item.startDateOverride : '';
  const started = Boolean(item.actualStartDate) || (planned && planned <= today);
  if (started) return 'IN_PROGRESS';
  if (raw === 'CONFIRMED' || item.locked) return 'CONFIRMED';
  return 'TENTATIVE';
}

function safeProjectName(project: ScheduleProjectSummary | null | undefined): string {
  return project?.projectName ?? project?.name ?? 'Untitled project';
}

function safeProjectStatus(project: ScheduleProjectSummary | null | undefined): string {
  return project?.status ?? 'NEW';
}

function toScheduleProjectSummary(project: Project): ScheduleProjectSummary {
  const name = project.projectName ?? project.name ?? 'Untitled project';
  const nextActionDate =
    typeof project.nextActionDate === 'string'
      ? project.nextActionDate
      : typeof project.followUpDate === 'string'
        ? project.followUpDate
        : null;

  return {
    id: project.id,
    projectName: name,
    name,
    status: project.status ?? 'NEW',
    nextActionDate,
    followUpDate: nextActionDate,
  };
}

function endInclusiveFromExclusive(endExclusive: string, fallback: string): string {
  if (!isYmd(endExclusive)) return fallback;
  return addDaysYmd(endExclusive, -1);
}

function buildScheduleBarsFromForecast(input: {
  scheduleItems: ScheduleItem[];
  projectsById: Map<string, ScheduleProjectSummary>;
  estimatesById: Map<string, Estimate>;
}): { bars: Array<{ scheduleItemId: string; installerId: string; projectId: string; estimateId: string; projectName: string; status: string; startDate: string; endDate: string; durationHours: number }>; issues: SchedulingIssue[] } {
  const bars: Array<{ scheduleItemId: string; installerId: string; projectId: string; estimateId: string; projectName: string; status: string; startDate: string; endDate: string; durationHours: number }> = [];
  const issues: SchedulingIssue[] = [];

  for (const item of input.scheduleItems) {
    const start = item.forecastStart ?? item.startDateOverride ?? '';
    if (!start || !isYmd(start)) continue;
    const durationDays =
      typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? item.forecastDurationDays
        : typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? item.durationHoursOverride / WORK_HOURS_PER_DAY
          : 1;
    const endExclusive = item.forecastEndExclusive ?? (start ? addDaysYmd(start, Math.max(1, Math.ceil(durationDays))) : start);
    const endDate = endInclusiveFromExclusive(endExclusive, start);

    const project = item.projectId ? input.projectsById.get(item.projectId) ?? null : null;
    const projectName =
      item.itemType === 'downtime'
        ? `Downtime${item.downtimeReason ? ` · ${titleCase(item.downtimeReason)}` : ''}`
        : safeProjectName(project);
    const status = item.itemType === 'downtime' ? 'DOWNTIME' : safeProjectStatus(project);

    bars.push({
      scheduleItemId: item.id,
      installerId: item.installerId,
      projectId: item.projectId,
      estimateId: item.estimateId,
      projectName,
      status,
      startDate: start,
      endDate,
      durationHours: Math.max(0.5, durationDays * WORK_HOURS_PER_DAY),
    });
  }

  return { bars, issues };
}

function isLockedScheduleStatus(status: ScheduleItemStatus): boolean {
  return status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED';
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
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
  const day = dt.getUTCDay(); // 0=Sun ... 6=Sat
  const daysSinceMonday = (day + 6) % 7;
  return addDaysYmd(ymd, -daysSinceMonday);
}

function nextWorkdayAfter(ymd: string): string {
  let d = addDaysYmd(ymd, 1);
  // Skip Sat/Sun.
  for (let i = 0; i < 8; i += 1) {
    const dt = parseYmd(d);
    if (!dt) return d;
    const day = dt.getUTCDay();
    if (day !== 0 && day !== 6) return d;
    d = addDaysYmd(d, 1);
  }
  return d;
}

function snapToWeekdayYmd(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  const day = dt.getUTCDay(); // 0 Sun, 6 Sat
  if (day !== 0 && day !== 6) return ymd;

  // snap forward to Monday
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

function formatShortDate(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', timeZone: GANTT_TZ }).format(dt);
}

function formatDateRange(startYmd: string, endYmd: string): string {
  return `${formatShortDate(startYmd)} → ${formatShortDate(endYmd)}`;
}

function isWeekendDate(ymd: string): boolean {
  const dt = parseYmd(ymd);
  if (!dt) return false;
  const day = dt.getUTCDay();
  return day === 0 || day === 6;
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

function hasPlannedCommitment(item: ScheduleItem): boolean {
  return Boolean(item.plannedCommitmentType || item.plannedStart || item.plannedWeekStart);
}

function resolveCommitmentType(item: ScheduleItem): 'week_of' | 'fixed_date' | null {
  if (item.plannedCommitmentType === 'week_of' || item.plannedCommitmentType === 'fixed_date') return item.plannedCommitmentType;
  if (item.plannedStart) return 'fixed_date';
  return null;
}

function resolvePlannedFlexDays(item: ScheduleItem): number | null {
  if (typeof item.plannedFlexDays === 'number' && Number.isFinite(item.plannedFlexDays)) {
    return Math.max(0, Math.trunc(item.plannedFlexDays));
  }
  const commitmentType = resolveCommitmentType(item);
  if (!commitmentType) return null;
  return commitmentType === 'week_of' ? 4 : 1;
}

function formatCommitmentLabel(item: ScheduleItem): string | null {
  const commitmentType = resolveCommitmentType(item);
  if (!commitmentType) return null;
  if (commitmentType === 'week_of') {
    const weekStart = item.plannedWeekStart ?? (item.plannedStart ? startOfWeekMonday(item.plannedStart) : null);
    if (!weekStart) return 'Week of —';
    return `Week of ${formatShortDate(weekStart)}`;
  }
  if (!item.plannedStart) return 'Starts —';
  return `Starts ${formatShortDate(item.plannedStart)}`;
}

function parsePositiveInt(value: string): number | null {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return null;
  const v = Math.trunc(n);
  if (v <= 0) return null;
  return v;
}

function makeJobId(projectId: string, estimateId: string): string {
  return `job_${projectId}_${estimateId}`;
}

function mapV2UnscheduledJobs(list: ScheduleV2Snapshot['unscheduledJobs'] | null | undefined): SchedulableJob[] {
  if (!Array.isArray(list)) return [];
  const out: SchedulableJob[] = [];
  for (const job of list) {
    const projectId = typeof job?.projectId === 'string' ? job.projectId : '';
    const estimateId = typeof job?.estimateId === 'string' ? job.estimateId : '';
    if (!projectId || !estimateId) continue;
    const status = normalizeProjectStatus(job?.status ?? 'NEW').status;
    if (!isSchedulingReadyProjectStatus(status)) continue;

    const durationDays =
      typeof job?.durationDays === 'number' && Number.isFinite(job.durationDays) && job.durationDays > 0 ? job.durationDays : 1;
    const durationHours = Math.max(0.5, durationDays * WORK_HOURS_PER_DAY);

    out.push({
      id: makeJobId(projectId, estimateId),
      projectId,
      estimateId,
      projectName: (typeof job?.projectName === 'string' ? job.projectName : '').trim() || 'Untitled project',
      descriptor: '',
      status,
      durationHours,
      durationLabel: formatDuration(durationHours),
      durationTitle: formatHours(durationHours),
      warnings: [],
    });
  }
  out.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return out;
}

function mapGanttHolidaysFromSnapshot(holidays: NzHoliday[] | null | undefined): Array<{ date: string; name?: string; kind: 'holiday' }> {
  if (!Array.isArray(holidays)) return [];
  return holidays
    .filter((holiday) => isYmd(holiday?.date ?? ''))
    .filter((holiday) => {
      const scope = typeof holiday.scope === 'string' ? holiday.scope.trim().toLowerCase() : '';
      const region = typeof holiday.region === 'string' ? holiday.region.trim().toLowerCase() : '';
      if (scope === 'national') return true;
      if (!region) return false;
      return region.includes('auckland');
    })
    .map((holiday) => ({ date: holiday.date, name: holiday.name, kind: 'holiday' as const }));
}

function scheduleStatusFromV2JobStatus(value: unknown): ScheduleItemStatus {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (status === 'done') return 'COMPLETED';
  if (status === 'in_progress' || status === 'paused') return 'IN_PROGRESS';
  return 'TENTATIVE';
}

function jobStatusFromScheduleItem(item: ScheduleItem, today: string): 'not_started' | 'in_progress' | 'paused' | 'done' {
  if (item.jobStatus === 'not_started' || item.jobStatus === 'in_progress' || item.jobStatus === 'paused' || item.jobStatus === 'done') {
    return item.jobStatus;
  }
  const status = deriveScheduleStatus(item, today);
  if (status === 'COMPLETED') return 'done';
  if (status === 'IN_PROGRESS') return 'in_progress';
  return 'not_started';
}

function isCompletedScheduleItem(item: ScheduleItem, today: string): boolean {
  if (item.itemType === 'downtime') return false;
  return jobStatusFromScheduleItem(item, today) === 'done';
}

function safeAppIdFromUuid(prefix: 'crew' | 'sch' | 'proj' | 'est', value: string): string {
  try {
    return appIdFromUuid(prefix, value);
  } catch {
    return value;
  }
}

function safeUuidFromAppId(prefix: 'crew' | 'proj', value: string): string | null {
  try {
    return uuidFromAppId(value, prefix);
  } catch {
    return null;
  }
}

function durationDaysFromScheduleItem(item: ScheduleItem): number {
  if (typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0) {
    return Math.max(1, Math.trunc(item.forecastDurationDays));
  }
  if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
    return Math.max(1, Math.ceil(item.durationHoursOverride / WORK_HOURS_PER_DAY));
  }
  return 1;
}

function normaliseEnumValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isSchedulableEstimate(estimate: Estimate): boolean {
  return normaliseEnumValue((estimate as any).status) !== 'archived';
}

function getLatestSchedulableEstimate(estimates: Estimate[]): Estimate | null {
  const schedulable = estimates.filter((e) => isSchedulableEstimate(e));
  if (!schedulable.length) return null;
  schedulable.sort((a, b) => ((b as any).version ?? 0) - ((a as any).version ?? 0) || b.createdAt.localeCompare(a.createdAt));
  return schedulable[0] ?? null;
}

function getJobDescriptorFromEstimate(estimate: Estimate): string {
  const inputs: unknown = (estimate as any).inputs;
  if (isCalculatorInputsV2(inputs)) {
    const m = inputs.modules?.[0];
    if (!m) return '—';
    const base = `${titleCase(m.pergolaStyle)} · ${titleCase(m.roofMaterial)}`;
    const length = Number.parseFloat(m.lengthM);
    const projection = Number.parseFloat(m.projectionM);
    const pitch = Number.parseFloat(m.roofPitchDeg);
    const dims =
      Number.isFinite(length) && Number.isFinite(projection) ? ` · ${length.toFixed(0)}×${projection.toFixed(0)}m` : '';
    const pitchLabel = Number.isFinite(pitch) && pitch > 0 ? ` · ${pitch.toFixed(0)}°` : '';
    return `${base}${dims}${pitchLabel}`;
  }
  if (isLegacyCalculatorInputsV1(inputs)) {
    const base = `${titleCase(inputs.pergolaStyle)} · ${titleCase(inputs.roofMaterial)}`;
    const length = Number.parseFloat(inputs.lengthM);
    const projection = Number.parseFloat(inputs.projectionM);
    const pitch = Number.parseFloat(inputs.roofPitchDeg);
    const dims =
      Number.isFinite(length) && Number.isFinite(projection) ? ` · ${length.toFixed(0)}×${projection.toFixed(0)}m` : '';
    const pitchLabel = Number.isFinite(pitch) && pitch > 0 ? ` · ${pitch.toFixed(0)}°` : '';
    return `${base}${dims}${pitchLabel}`;
  }
  return '—';
}

function renormalizeLane(items: ScheduleItem[], installerId: string): ScheduleItem[] {
  const lane = items
    .filter((i) => i.installerId === installerId)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));

  const laneIds = new Set(lane.map((i) => i.id));
  const others = items.filter((i) => !laneIds.has(i.id));

  const now = new Date().toISOString();
  const normalizedLane = lane.map((it, idx) => (it.sortIndex === idx ? it : { ...it, sortIndex: idx, updatedAt: now }));

  return [...others, ...normalizedLane];
}

function optimisticReorderCrew(items: ScheduleItem[], installerId: string, orderedIds: string[]): ScheduleItem[] {
  const now = new Date().toISOString();

  // keep only ids that exist in this lane
  const laneSet = new Set(items.filter((i) => i.installerId === installerId).map((i) => i.id));
  const nextLane = orderedIds.filter((id) => laneSet.has(id));

  const nextItems = items.map((i) => {
    if (i.installerId !== installerId) return i;
    const pos = nextLane.indexOf(i.id);
    if (pos < 0) return i;
    return i.sortIndex === pos ? i : { ...i, sortIndex: pos, updatedAt: now };
  });

  return renormalizeLane(nextItems, installerId);
}

function optimisticMoveBetweenCrews(
  items: ScheduleItem[],
  activeId: string,
  fromInstallerId: string,
  toInstallerId: string,
  insertAt: number,
): ScheduleItem[] {
  const now = new Date().toISOString();

  const source = items
    .filter((i) => i.installerId === fromInstallerId)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex);

  const dest = items
    .filter((i) => i.installerId === toInstallerId)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex);

  const moving = items.find((i) => i.id === activeId);
  if (!moving) return items;

  const nextSourceIds = source.map((i) => i.id).filter((id) => id !== activeId);
  const nextDestIds = dest.map((i) => i.id);
  nextDestIds.splice(Math.max(0, Math.min(insertAt, nextDestIds.length)), 0, activeId);

  const next = items.map((i) => {
    if (i.id === activeId) {
      return { ...i, installerId: toInstallerId, updatedAt: now };
    }
    return i;
  });

  // assign indices for affected lanes
  const byId = new Map(next.map((i) => [i.id, i] as const));
  for (let idx = 0; idx < nextSourceIds.length; idx += 1) {
    const it = byId.get(nextSourceIds[idx]);
    if (it && it.sortIndex !== idx) byId.set(it.id, { ...it, sortIndex: idx, updatedAt: now });
  }
  for (let idx = 0; idx < nextDestIds.length; idx += 1) {
    const it = byId.get(nextDestIds[idx]);
    if (!it) continue;
    const installerId = it.id === activeId ? toInstallerId : it.installerId;
    const updated = { ...it, installerId, sortIndex: idx, updatedAt: now };
    byId.set(it.id, updated);
  }

  return Array.from(byId.values());
}

function optimisticAssignUnscheduled(
  items: ScheduleItem[],
  job: SchedulableJob,
  installerId: string,
  insertAt: number,
): ScheduleItem[] {
  const now = new Date().toISOString();
  const tmpId = `tmp_${newId('sch')}`;

  const lane = items
    .filter((i) => i.installerId === installerId)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex);

  const nextLaneIds = lane.map((i) => i.id);
  nextLaneIds.splice(Math.max(0, Math.min(insertAt, nextLaneIds.length)), 0, tmpId);

  const tmp: ScheduleItem = {
    id: tmpId,
    installerId,
    projectId: job.projectId,
    estimateId: job.estimateId,
    sortIndex: insertAt,
    scheduleStatus: 'TENTATIVE',
    locked: false,
    updatedAt: now,
    itemType: 'job',
    // keep date fields blank; board move is the priority
    forecastStart: null,
    forecastEndExclusive: null,
    forecastDurationDays: Math.max(1, Math.round(job.durationHours / WORK_HOURS_PER_DAY)),
    durationHoursOverride: job.durationHours,
    mode: 'floating',
    scheduledJobId: `tmp_job_${tmpId}`,
  };

  const next = [...items, tmp];

  // renormalize that lane indices
  const byId = new Map(next.map((i) => [i.id, i] as const));
  for (let idx = 0; idx < nextLaneIds.length; idx += 1) {
    const it = byId.get(nextLaneIds[idx]);
    if (!it) continue;
    byId.set(it.id, { ...it, sortIndex: idx, updatedAt: now });
  }

  return Array.from(byId.values());
}

function optimisticUnassign(
  items: ScheduleItem[],
  unscheduledSeed: SchedulableJob[],
  scheduleItemId: string,
  projectsById: Map<string, ScheduleProjectSummary>,
): { items: ScheduleItem[]; unscheduledSeed: SchedulableJob[] } {
  const it = items.find((i) => i.id === scheduleItemId);
  if (!it || it.itemType === 'downtime') return { items, unscheduledSeed };

  const project = projectsById.get(it.projectId) ?? null;
  const projectName = project?.projectName ?? project?.name ?? 'Untitled project';
  const status = normalizeProjectStatus(project?.status ?? 'NEW').status;

  const durationDays =
    typeof it.forecastDurationDays === 'number' && it.forecastDurationDays > 0
      ? it.forecastDurationDays
      : Math.max(1, Math.ceil((it.durationHoursOverride ?? WORK_HOURS_PER_DAY) / WORK_HOURS_PER_DAY));

  const durationHours = durationDays * WORK_HOURS_PER_DAY;
  const nextItems = items.filter((x) => x.id !== scheduleItemId);

  if (!isSchedulingReadyProjectStatus(status)) {
    return { items: nextItems, unscheduledSeed };
  }

  const back: SchedulableJob = {
    id: makeJobId(it.projectId, it.estimateId),
    projectId: it.projectId,
    estimateId: it.estimateId,
    projectName,
    descriptor: '',
    status,
    durationHours,
    durationLabel: formatDuration(durationHours),
    durationTitle: formatHours(durationHours),
    warnings: [],
  };

  return {
    items: nextItems,
    unscheduledSeed: [...unscheduledSeed, back].sort((a, b) => a.projectName.localeCompare(b.projectName)),
  };
}

function LaneDropZone({
  laneId,
  children,
  onMount,
}: {
  laneId: string;
  children: React.ReactNode;
  onMount?: (node: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${laneId}` });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        onMount?.(node);
      }}
      className={styles.laneBody}
      data-over={isOver ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

function UnscheduledDropZone({
  children,
  onMount,
}: {
  children: React.ReactNode;
  onMount?: (node: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        onMount?.(node);
      }}
      className={styles.unscheduledBody}
      data-over={isOver ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

type MenuAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
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

function isElementOrParentNoDnd(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-no-dnd="true"]'));
}

function isTextInputLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function computeGanttPopoverPosition(anchor: GanttPopoverAnchor): { top: number; left: number } {
  const width = 300;
  const margin = 12;
  const gap = 10;
  if (typeof window === 'undefined') {
    return { top: anchor.bottom + gap, left: anchor.left };
  }

  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const preferredTop = anchor.bottom + gap;
  const estimatedHeight = 340;
  const canOpenBelow = preferredTop + estimatedHeight <= window.innerHeight - margin;
  const top = canOpenBelow ? preferredTop : Math.max(margin, anchor.top - estimatedHeight - gap);
  return { top, left };
}

function JobActionsMenu({
  actions,
  ariaLabel,
}: {
  actions: MenuAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const items = actions.filter((action) => action && typeof action.onClick === 'function');

  if (!items.length) return null;

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!ref.current) return;
      if (!ref.current.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className={styles.menuWrap}
      data-no-dnd="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.kebab}
        data-no-dnd="true"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Job actions'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Job actions"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className={styles.menu}
          data-no-dnd="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              type="button"
              role="menuitem"
              data-no-dnd="true"
              className={cx(styles.menuItem, action.tone === 'danger' && styles.menuItemDanger)}
              disabled={Boolean(action.disabled)}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (action.disabled) return;
                setOpen(false);
                window.setTimeout(() => action.onClick(), 0);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (action.disabled) return;
                setOpen(false);
                window.setTimeout(() => action.onClick(), 0);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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

function JobCardShell({
  dragId,
  title,
  descriptor,
  statusLabel,
  durationLabel,
  durationTitle,
  scheduleStatus,
  pinned,
  onOpen,
  dateLine,
  extraBadges,
  warning,
  issueLevel,
  dragProps,
  draggable,
  dragging,
  menu,
  cardRef,
  style,
  dropTarget,
}: {
  dragId?: string;
  title: string;
  descriptor: string;
  statusLabel: string;
  durationLabel: string;
  durationTitle: string;
  scheduleStatus?: ScheduleItemStatus;
  pinned?: boolean;
  onOpen?: () => void;
  dateLine?: string;
  extraBadges?: React.ReactNode;
  warning?: boolean;
  issueLevel?: 'warning' | 'error';
  dragProps?: Record<string, unknown>;
  draggable?: boolean;
  dragging?: boolean;
  menu?: React.ReactNode;
  cardRef: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dropTarget?: boolean;
}) {
  return (
    <div
      ref={cardRef}
      className={styles.jobCard}
      style={style}
      data-schedule-card-id={dragId}
      data-drop-target={dropTarget ? 'true' : 'false'}
      data-draggable={draggable ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      data-issue-level={issueLevel ?? (warning ? 'warning' : undefined)}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      {...(dragProps as any)}
      onDoubleClick={(e) => {
        if (!onOpen) return;
        if (dragging) return;
        if (isElementOrParentNoDnd(e.target)) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={styles.jobTopRow}>
        <div className={styles.jobMain}>
          <div className={styles.jobTitle} title={title}>
            {title}
          </div>
          <div className={styles.jobDescriptor} title={descriptor}>
            {descriptor}
          </div>
        </div>

        <div className={styles.jobRight}>{menu}</div>
      </div>

      <div className={styles.badgesRow}>
        <span className={styles.statusPill}>{statusLabel}</span>
        <span className={styles.durationPill} title={durationTitle}>
          {durationLabel}
        </span>
        {pinned ? (
          <span className={styles.pinnedPill}>
            <span className={styles.pinnedDot} aria-hidden="true" />
            Pinned
          </span>
        ) : null}
        {scheduleStatus ? <span className={styles.schedulePill}>{scheduleStatusLabel(scheduleStatus)}</span> : null}
        {extraBadges}
        {issueLevel === 'error' ? <span className={styles.warnBadge}>Conflict</span> : warning || issueLevel === 'warning' ? <span className={styles.warnBadge}>Warning</span> : null}
      </div>

      {dateLine ? <div className={styles.dateLine}>{dateLine}</div> : null}
    </div>
  );
}

function UnscheduledJobCard({ job }: { job: SchedulableJob }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { kind: 'job' },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  } as React.CSSProperties;

  return (
    <JobCardShell
      dragId={job.id}
      title={job.projectName}
      descriptor={job.descriptor}
      statusLabel={formatStatusLabel(job.status)}
      durationLabel={job.durationLabel}
      durationTitle={job.durationTitle}
      onOpen={() => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`)}
      warning={job.warnings.length > 0}
      dragProps={{ ...attributes, ...listeners }}
      draggable
      dragging={isDragging}
      cardRef={(node) => setNodeRef(node as any)}
      style={style}
    />
  );
}

function ScheduledJobCard({
  id,
  job,
  scheduleStatus,
  dateLine,
  dropTarget,
  menuActions,
  pinned,
  extraBadges,
  issueLevel,
  onMount,
}: {
  id: string;
  job: SchedulableJob | null;
  scheduleStatus: ScheduleItemStatus;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: MenuAction[];
  pinned?: boolean;
  extraBadges?: React.ReactNode;
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
}) {
  const router = useRouter();
  const locked = isLockedScheduleStatus(scheduleStatus);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as React.CSSProperties;

  return (
    <JobCardShell
      dragId={id}
      title={job?.projectName ?? 'Untitled project'}
      descriptor={job?.descriptor ?? '—'}
      statusLabel={formatStatusLabel(job?.status ?? '')}
      durationLabel={job?.durationLabel ?? '—'}
      durationTitle={job?.durationTitle ?? '—'}
      scheduleStatus={scheduleStatus}
      pinned={pinned}
      extraBadges={extraBadges}
      onOpen={
        job
          ? () => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`)
          : undefined
      }
      dateLine={dateLine}
      warning={Boolean(job?.warnings?.length)}
      issueLevel={issueLevel}
      dragProps={locked ? {} : { ...attributes, ...listeners }}
      draggable={!locked}
      dragging={isDragging}
      menu={<JobActionsMenu actions={menuActions} />}
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      style={style}
      dropTarget={dropTarget}
    />
  );
}

function DowntimeCard({
  id,
  item,
  dateLine,
  dropTarget,
  menuActions,
  issueLevel,
  onMount,
}: {
  id: string;
  item: ScheduleItem;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: MenuAction[];
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as React.CSSProperties;

  const durationHours =
    typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
      ? item.durationHoursOverride
      : typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? item.forecastDurationDays * WORK_HOURS_PER_DAY
        : WORK_HOURS_PER_DAY;

  const reason = item.downtimeReason ? titleCase(item.downtimeReason) : 'Downtime';

  return (
    <JobCardShell
      dragId={id}
      title={reason}
      descriptor={item.downtimeNote ?? 'Crew unavailable'}
      statusLabel="Downtime"
      durationLabel={formatDuration(durationHours)}
      durationTitle={formatHours(durationHours)}
      dateLine={dateLine}
      issueLevel={issueLevel}
      dragProps={{ ...attributes, ...listeners }}
      draggable
      dragging={isDragging}
      menu={<JobActionsMenu actions={menuActions} ariaLabel="Downtime actions" />}
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      style={style}
      dropTarget={dropTarget}
    />
  );
}

const EMPTY_SCHEDULE_BOARD_MODEL: ScheduleBoardModel = {
  schedulable: {
    jobsById: new Map(),
    unscheduledJobs: [],
    debug: {},
    blockingProjectIds: new Set(),
  },
  unscheduledJobsAll: [],
  unscheduledJobs: [],
  laneItems: new Map(),
};

export function buildScheduleBoardModel(input: {
  estimatesById: Map<string, Estimate>;
  installers: Installer[];
  orphanedScheduleItems: ScheduleItem[];
  projects: ScheduleProjectSummary[];
  projectsById: Map<string, ScheduleProjectSummary>;
  query: string;
  scheduleItems: ScheduleItem[];
  scheduleItemsRenderable: ScheduleItem[];
  scheduleMode: 'v2' | 'legacy';
  today: string;
  unscheduledJobsSeed: SchedulableJob[];
  visibleScheduleItems: ScheduleItem[];
}): ScheduleBoardModel {
  const {
    estimatesById,
    installers,
    orphanedScheduleItems,
    projects,
    projectsById,
    query,
    scheduleItems,
    scheduleItemsRenderable,
    scheduleMode,
    today,
    unscheduledJobsSeed,
    visibleScheduleItems,
  } = input;

  const schedulable = (() => {
    if (scheduleMode === 'v2') {
      const jobsById = new Map<string, SchedulableJob>();
      const unscheduledJobs = unscheduledJobsSeed;
      for (const job of unscheduledJobs) jobsById.set(job.id, job);

      const blockingProjectIds = new Set<string>();
      for (const item of scheduleItemsRenderable) {
        if (item.itemType === 'downtime') continue;
        if (item.projectId) blockingProjectIds.add(item.projectId);
      }

      for (const item of visibleScheduleItems) {
        const id = item.id;
        if (jobsById.has(id)) continue;

        if (item.itemType === 'downtime') {
          const durationHours =
            typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
              ? item.durationHoursOverride
              : WORK_HOURS_PER_DAY;
          const reason = item.downtimeReason ? titleCase(item.downtimeReason) : 'Downtime';
          jobsById.set(id, {
            id,
            projectId: '',
            estimateId: '',
            projectName: reason,
            descriptor: item.downtimeNote ?? 'Crew unavailable',
            status: 'DOWNTIME',
            durationHours,
            durationLabel: formatDuration(durationHours),
            durationTitle: formatHours(durationHours),
            warnings: [],
          });
          continue;
        }

        const project = projectsById.get(item.projectId) ?? null;
        const projectName = project?.projectName ?? project?.name ?? 'Untitled project';
        const status = project ? normalizeProjectStatus(project.status).status : '—';
        const nextActionDate = project ? ((project as any).nextActionDate ?? (project as any).followUpDate ?? null) : null;
        const nextActionType = project ? ((project as any).nextActionType ?? null) : null;
        const nextActionSuffix =
          typeof nextActionDate === 'string' && nextActionDate
            ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
            : '';
        const nextActionLine = nextActionSuffix ? nextActionSuffix.replace(/^ · /, '') : '';

        let durationHours = WORK_HOURS_PER_DAY;
        if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
          durationHours = item.durationHoursOverride;
        } else if (
          typeof item.forecastDurationDays === 'number' &&
          Number.isFinite(item.forecastDurationDays) &&
          item.forecastDurationDays > 0
        ) {
          durationHours = item.forecastDurationDays * WORK_HOURS_PER_DAY;
        }

        jobsById.set(id, {
          id,
          projectId: item.projectId,
          estimateId: item.estimateId,
          projectName,
          descriptor: nextActionLine,
          status,
          durationHours,
          durationLabel: formatDuration(durationHours),
          durationTitle: formatHours(durationHours),
          warnings: [],
        });
      }

      return {
        jobsById,
        unscheduledJobs,
        debug: {
          totalProjects: projects.length,
          schedulableProjects: unscheduledJobs.length + blockingProjectIds.size,
          unscheduledJobs: unscheduledJobs.length,
          excluded: {
            noEstimates: 0,
            noSchedulableEstimate: 0,
            alreadyScheduled: 0,
          },
          scheduleItems: {
            total: scheduleItems.length,
            blocking: scheduleItemsRenderable.filter((item) => item.itemType !== 'downtime').length,
            missingProject: orphanedScheduleItems.length,
            missingEstimate: 0,
            estimateNotSchedulable: 0,
          },
        },
        blockingProjectIds,
      };
    }

    const jobsById = new Map<string, SchedulableJob>();
    const unscheduledJobs: SchedulableJob[] = [];

    const debug = {
      totalProjects: projects.length,
      schedulableProjects: 0,
      unscheduledJobs: 0,
      excluded: {
        noEstimates: 0,
        noSchedulableEstimate: 0,
        notReadyStage: 0,
        alreadyScheduled: 0,
      },
      scheduleItems: {
        total: scheduleItems.length,
        blocking: 0,
        missingProject: 0,
        missingEstimate: 0,
        estimateNotSchedulable: 0,
      },
    };

    const blockingProjectIds = new Set<string>();
    for (const item of scheduleItems) {
      if (item.itemType === 'downtime') continue;
      const project = projectsById.get(item.projectId) ?? null;
      if (!project) {
        debug.scheduleItems.missingProject += 1;
        continue;
      }

      const estimate = estimatesById.get(item.estimateId) ?? null;
      if (!estimate) {
        debug.scheduleItems.missingEstimate += 1;
        continue;
      }

      if (!isSchedulableEstimate(estimate)) {
        debug.scheduleItems.estimateNotSchedulable += 1;
        continue;
      }

      blockingProjectIds.add(item.projectId);
      debug.scheduleItems.blocking += 1;
    }

    const estimatesByProjectId = new Map<string, Estimate[]>();
    for (const estimate of estimatesById.values()) {
      const list = estimatesByProjectId.get(estimate.projectId) ?? [];
      list.push(estimate);
      estimatesByProjectId.set(estimate.projectId, list);
    }

    for (const project of projects) {
      const estimates = (estimatesByProjectId.get(project.id) ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (!estimates.length) {
        debug.excluded.noEstimates += 1;
        continue;
      }

      const latestEstimate = getLatestSchedulableEstimate(estimates);
      if (!latestEstimate) {
        debug.excluded.noSchedulableEstimate += 1;
        continue;
      }

      debug.schedulableProjects += 1;

      if (blockingProjectIds.has(project.id)) {
        debug.excluded.alreadyScheduled += 1;
        continue;
      }

      const derived = deriveDurationHoursFromEstimate(latestEstimate);
      const durationHours = derived.durationHours;
      const warnings = derived.issues.map((issue) => issue.message);

      const projectName = project.projectName ?? project.name ?? 'Untitled project';
      const status = normalizeProjectStatus(project.status).status;
      if (!isSchedulingReadyProjectStatus(status)) {
        debug.excluded.notReadyStage += 1;
        continue;
      }
      const nextActionDate = (project as any).nextActionDate ?? (project as any).followUpDate ?? null;
      const nextActionType = (project as any).nextActionType ?? null;
      const nextActionSuffix =
        typeof nextActionDate === 'string' && nextActionDate
          ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
          : '';

      const id = makeJobId(project.id, latestEstimate.id);
      const job: SchedulableJob = {
        id,
        projectId: project.id,
        estimateId: latestEstimate.id,
        projectName,
        descriptor: `${getJobDescriptorFromEstimate(latestEstimate)}${nextActionSuffix}`,
        status,
        durationHours,
        durationLabel: formatDuration(durationHours),
        durationTitle: formatHours(durationHours),
        warnings,
      };
      jobsById.set(id, job);
      unscheduledJobs.push(job);
      debug.unscheduledJobs += 1;
    }

    for (const item of visibleScheduleItems) {
      const id = item.id;
      if (jobsById.has(id)) continue;

      if (item.itemType === 'downtime') {
        const durationHours =
          typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
            ? item.durationHoursOverride
            : WORK_HOURS_PER_DAY;
        const reason = item.downtimeReason ? titleCase(item.downtimeReason) : 'Downtime';
        jobsById.set(id, {
          id,
          projectId: '',
          estimateId: '',
          projectName: reason,
          descriptor: item.downtimeNote ?? 'Crew unavailable',
          status: 'DOWNTIME',
          durationHours,
          durationLabel: formatDuration(durationHours),
          durationTitle: formatHours(durationHours),
          warnings: [],
        });
        continue;
      }

      const project = projectsById.get(item.projectId) ?? null;
      const estimate = estimatesById.get(item.estimateId) ?? null;

      const projectName = project?.projectName ?? project?.name ?? 'Untitled project';
      const status = project ? normalizeProjectStatus(project.status).status : '—';
      const nextActionDate = project ? ((project as any).nextActionDate ?? (project as any).followUpDate ?? null) : null;
      const nextActionType = project ? ((project as any).nextActionType ?? null) : null;
      const nextActionSuffix =
        typeof nextActionDate === 'string' && nextActionDate
          ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
          : '';

      let durationHours = WORK_HOURS_PER_DAY;
      const warnings: string[] = [];
      if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
        durationHours = item.durationHoursOverride;
      } else if (estimate) {
        const derived = deriveDurationHoursFromEstimate(estimate);
        durationHours = derived.durationHours;
        warnings.push(...derived.issues.map((issue) => issue.message));
      } else {
        warnings.push('Estimate missing; defaulted duration to 1 day.');
      }

      jobsById.set(id, {
        id,
        projectId: item.projectId,
        estimateId: item.estimateId,
        projectName,
        descriptor: `${estimate ? getJobDescriptorFromEstimate(estimate) : '—'}${nextActionSuffix}`,
        status,
        durationHours,
        durationLabel: formatDuration(durationHours),
        durationTitle: formatHours(durationHours),
        warnings,
      });
    }

    unscheduledJobs.sort((a, b) => a.projectName.localeCompare(b.projectName));
    return { jobsById, unscheduledJobs, debug, blockingProjectIds };
  })();

  const unscheduledJobsAll = schedulable.unscheduledJobs;
  const q = query.trim().toLowerCase();
  const unscheduledJobs = unscheduledJobsAll.filter((job) => (!q ? true : job.projectName.toLowerCase().includes(q)));

  const laneItems = new Map<string, ScheduleItem[]>();
  for (const installer of installers) laneItems.set(installer.id, []);
  for (const item of visibleScheduleItems) {
    const list = laneItems.get(item.installerId);
    if (list) list.push(item);
    else laneItems.set(item.installerId, [item]);
  }
  for (const list of laneItems.values()) {
    list.sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));
  }

  return {
    schedulable,
    unscheduledJobsAll,
    unscheduledJobs,
    laneItems,
  };
}

export default function ScheduleClient({
  initialScheduleMode = USE_SCHEDULE_V2 ? 'v2' : 'legacy',
  initialV2Snapshot: initialV2SnapshotProp = null,
}: {
  initialScheduleMode?: 'v2' | 'legacy';
  initialV2Snapshot?: ScheduleV2Snapshot | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { beginRouteTransition } = usePortalRouteTransition();
  const queryClient = useQueryClient();
  const [isTransitionPending, startUiTransition] = useTransition();
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const laneBodyRefs = useRef(new Map<string, HTMLDivElement | null>());
  const boardCardRefs = useRef(new Map<string, HTMLElement | null>());
  const unscheduledBodyRef = useRef<HTMLDivElement | null>(null);
  const hydratedFromCacheRef = useRef(false);
  const scheduleItemsRef = useRef<ScheduleItem[]>([]);
  const unscheduledJobsSeedRef = useRef<SchedulableJob[]>([]);
  const scheduleConflictsRef = useRef<any[]>([]);
  const nextAvailRef = useRef<Map<string, string>>(new Map());
  const installersRef = useRef<Installer[]>([]);
  const projectsRef = useRef<ScheduleProjectSummary[]>([]);

  const today = useMemo(() => resolveScheduleTodayYmd(), []);

  const supabaseHost = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()), []);
  const hostKey = supabaseHost || 'unknown';

  const v2SnapshotKey = useMemo(() => qk.schedule.board(hostKey, today), [hostKey, today]);
  const cachedV2Snapshot = USE_SCHEDULE_V2 ? (queryClient.getQueryData<ScheduleV2Snapshot>(v2SnapshotKey) ?? null) : null;
  const initialV2Snapshot = USE_SCHEDULE_V2 ? initialV2SnapshotProp ?? cachedV2Snapshot : null;
  const initialV2SnapshotUpdatedAt = useMemo(() => {
    if (!initialV2Snapshot) return undefined;
    const generatedAtMs = Date.parse(initialV2Snapshot.generatedAt);
    return Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now();
  }, [initialV2Snapshot]);
  if (initialV2Snapshot) hydratedFromCacheRef.current = true;
  const v2GeneratedAtRef = useRef<string>(initialV2Snapshot?.generatedAt ?? '');
  const v2MutationBufferRef = useRef<Array<{ run: () => Promise<any>; resolve: (result: any) => void; reject: (error: unknown) => void }>>([]);
  const v2MutationFlushRef = useRef<Promise<void> | null>(null);
  const v2MutationFlushTimerRef = useRef<number | null>(null);
  const v2PendingMutationsRef = useRef(0);
  const v2HolidaysRef = useRef<NzHoliday[]>(initialV2Snapshot?.holidays ?? []);
  const v2ClosuresRef = useRef<CompanyClosure[]>(initialV2Snapshot?.closures ?? []);

  const [hydrated, setHydrated] = useState(() => Boolean(initialV2Snapshot));
  const [loadError, setLoadError] = useState<{ message: string; table?: string; code?: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [installers, setInstallers] = useState<Installer[]>(() => initialV2Snapshot?.installers ?? []);
  const [projects, setProjects] = useState<ScheduleProjectSummary[]>(() => initialV2Snapshot?.projects ?? []);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => initialV2Snapshot?.scheduleItems ?? []);
  const [estimatesById, setEstimatesById] = useState<Map<string, Estimate>>(() => new Map());
  const [unscheduledJobsSeed, setUnscheduledJobsSeed] = useState<SchedulableJob[]>(() => mapV2UnscheduledJobs(initialV2Snapshot?.unscheduledJobs));
  const [scheduleMode, setScheduleMode] = useState<'v2' | 'legacy'>(initialScheduleMode);
  const [scheduleConflicts, setScheduleConflicts] = useState<any[]>(() => initialV2Snapshot?.conflicts ?? []);
  const [nextAvailableByInstallerId, setNextAvailableByInstallerId] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialV2Snapshot?.nextAvailableByInstallerId ?? {})),
  );
  const [ganttHolidays, setGanttHolidays] = useState<Array<{ date: string; name?: string; kind: 'holiday' }>>(() =>
    mapGanttHolidaysFromSnapshot(initialV2Snapshot?.holidays),
  );
  const [ganttPopover, setGanttPopover] = useState<{ scheduleItemId: string; anchor: GanttPopoverAnchor } | null>(null);
  const [quickEdit, setQuickEdit] = useState<{ id: string; startDateOverride: string; durationDays: string } | null>(null);
  const [durationEdit, setDurationEdit] = useState<{ id: string; durationDays: string } | null>(null);
  const [commitmentEdit, setCommitmentEdit] = useState<{
    id: string;
    mode: 'lock' | 'reschedule';
    commitmentType: 'week_of' | 'fixed_date';
    weekOfDate: string;
    startDate: string;
    durationDays: string;
    flexDays: string;
    hardLock: boolean;
  } | null>(null);
  const [pinEdit, setPinEdit] = useState<{ id: string; requestedStart: string } | null>(null);
  const [daysRemainingEdit, setDaysRemainingEdit] = useState<{ id: string; daysRemaining: string } | null>(null);
  const [finishEarlyPrompt, setFinishEarlyPrompt] = useState<{
    jobId: string;
    scheduleItemId: string;
    freedDays: number;
    actualFinish: string;
    forecastEndExclusive: string | null;
    impacts: any[];
  } | null>(null);
  const [downtimeEdit, setDowntimeEdit] = useState<{
    mode: 'create' | 'edit';
    crewId: string;
    position: number;
    downtimeId?: string | null;
    durationDays: string;
    reason: string;
    note: string;
  } | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const [view, setView] = useState<'board' | 'gantt' | 'site_visits'>(() => {
    const raw = (searchParams.get('view') || '').trim().toLowerCase();
    if (raw === 'site-visits') return 'site_visits';
    if (raw === 'gantt') return 'gantt';
    return 'board';
  });
  const [query, setQuery] = useState('');
  const [zoomWeeks, setZoomWeeks] = useState<GanttZoomWeeks>(GANTT_DEFAULT_ZOOM_WEEKS);
  const [ganttDensity, setGanttDensity] = useState<GanttDensity>(() => readGanttDensityPreference());
  const [labelWidthPx, setLabelWidthPx] = useState<number>(() => readGanttLabelWidthPreference());
  const [showPlanned, setShowPlanned] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [hoveredGanttRowId, setHoveredGanttRowId] = useState<string | null>(null);
  const [collapsedCrews, setCollapsedCrews] = useState<Record<string, boolean>>({});
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState<boolean>(() => !mapV2UnscheduledJobs(initialV2Snapshot?.unscheduledJobs).length);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnosticsResult | null>(null);
  const [syncing, setSyncing] = useState(false);
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
  const [ganttLabelResize, setGanttLabelResize] = useState<{ startX: number; startWidth: number } | null>(null);
  const deferredQuery = useDeferredValue(query);
  const ganttDragDeltaRef = useRef(0);
  const ganttDragMovedRef = useRef(false);
  const ganttClickBlockUntilRef = useRef(0);
  const ganttPopoverRef = useRef<HTMLDivElement | null>(null);
  const labelWidthPxRef = useRef(labelWidthPx);
  const pendingZoomAnchorRef = useRef<{ date: string; viewportOffsetPx: number } | null>(null);

  useEffect(() => {
    scheduleItemsRef.current = scheduleItems;
  }, [scheduleItems]);

  useEffect(() => {
    installersRef.current = installers;
  }, [installers]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  useEffect(() => {
    unscheduledJobsSeedRef.current = unscheduledJobsSeed;
  }, [unscheduledJobsSeed]);

  useEffect(() => {
    scheduleConflictsRef.current = scheduleConflicts;
  }, [scheduleConflicts]);

  useEffect(() => {
    nextAvailRef.current = nextAvailableByInstallerId;
  }, [nextAvailableByInstallerId]);

  useEffect(() => {
    labelWidthPxRef.current = labelWidthPx;
  }, [labelWidthPx]);

  useEffect(() => {
    writeGanttDensityPreference(ganttDensity);
  }, [ganttDensity]);

  useEffect(() => {
    writeGanttLabelWidthPreference(labelWidthPx);
  }, [labelWidthPx]);

  useEffect(() => {
    return () => {
      if (v2MutationFlushTimerRef.current != null) {
        window.clearTimeout(v2MutationFlushTimerRef.current);
        v2MutationFlushTimerRef.current = null;
      }
    };
  }, []);

  type V2LocalState = {
    scheduleItems: ScheduleItem[];
    unscheduledJobsSeed: SchedulableJob[];
    scheduleConflicts: any[];
    nextAvailableByInstallerId: Map<string, string>;
  };

  function nextV2GeneratedAt(): string {
    const now = nowIso();
    const previous = v2GeneratedAtRef.current;
    if (!previous || now > previous) return now;
    const bumped = new Date(previous);
    if (Number.isNaN(bumped.getTime())) return now;
    bumped.setMilliseconds(bumped.getMilliseconds() + 1);
    return bumped.toISOString();
  }

  function writeV2SnapshotToCache(state: V2LocalState, generatedAt: string): void {
    if (scheduleMode !== 'v2') return;
    queryClient.setQueryData<ScheduleV2Snapshot>(v2SnapshotKey, {
      generatedAt,
      installers: installersRef.current,
      projects: projectsRef.current,
      scheduleItems: state.scheduleItems,
      conflicts: state.scheduleConflicts,
      nextAvailableByInstallerId: Object.fromEntries(state.nextAvailableByInstallerId.entries()),
      unscheduledJobs: state.unscheduledJobsSeed.map((job) => ({
        projectId: job.projectId,
        estimateId: job.estimateId,
        projectName: job.projectName,
        status: job.status,
        durationDays: Math.max(1, Math.ceil(job.durationHours / WORK_HOURS_PER_DAY)),
      })),
      holidays: v2HolidaysRef.current,
      closures: v2ClosuresRef.current,
    });
  }

  function setV2LocalState(state: V2LocalState, generatedAt: string): void {
    v2GeneratedAtRef.current = generatedAt;

    scheduleItemsRef.current = state.scheduleItems;
    unscheduledJobsSeedRef.current = state.unscheduledJobsSeed;
    scheduleConflictsRef.current = state.scheduleConflicts;
    nextAvailRef.current = state.nextAvailableByInstallerId;

    setScheduleItems(state.scheduleItems);
    setUnscheduledJobsSeed(state.unscheduledJobsSeed);
    setScheduleConflicts(state.scheduleConflicts);
    setNextAvailableByInstallerId(new Map(state.nextAvailableByInstallerId));
    setHydrated(true);

    writeV2SnapshotToCache(state, generatedAt);
  }

  function recomputeLocalForCrews(items: ScheduleItem[]): {
    scheduleItems: ScheduleItem[];
    scheduleConflicts: any[];
    nextAvailableByInstallerId: Map<string, string>;
  } {
    const calendar = buildWorkingDayIndex(v2HolidaysRef.current, v2ClosuresRef.current);
    const currentById = new Map(items.map((item) => [item.id, item]));
    const grouped = new Map<string, ScheduleItem[]>();
    for (const item of items) {
      const list = grouped.get(item.installerId) ?? [];
      list.push(item);
      grouped.set(item.installerId, list);
    }

    const patchByItemId = new Map<string, Partial<ScheduleItem>>();
    const conflicts: any[] = [];
    const nextAvailable = new Map(nextAvailRef.current);

    for (const installer of installersRef.current) {
      const lane = (grouped.get(installer.id) ?? [])
        .slice()
        .sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));

      const recomputeItems: CrewScheduleItem[] = [];
      const jobsById = new Map<string, RecomputeScheduledJob>();
      const downtimesById = new Map<string, CrewDowntime>();

      for (let position = 0; position < lane.length; position += 1) {
        const item = lane[position];
        if (item.itemType === 'downtime') {
          const downtimeId = item.downtimeId ?? `tmp_downtime_${item.id}`;
          recomputeItems.push({
            id: item.id,
            crewId: installer.id,
            itemType: 'downtime',
            downtimeId,
            position,
          });
          downtimesById.set(downtimeId, {
            id: downtimeId,
            crewId: installer.id,
            durationDays: durationDaysFromScheduleItem(item),
            reason: item.downtimeReason ?? undefined,
            note: item.downtimeNote ?? null,
          });
          continue;
        }

        const scheduledJobId = item.scheduledJobId ?? `tmp_job_${item.id}`;
        recomputeItems.push({
          id: item.id,
          crewId: installer.id,
          itemType: 'job',
          jobId: scheduledJobId,
          position,
        });
        jobsById.set(scheduledJobId, {
          id: scheduledJobId,
          jobId: safeUuidFromAppId('proj', item.projectId) ?? item.projectId,
          crewId: installer.id,
          mode: item.mode === 'pinned' ? 'pinned' : 'floating',
          plannedCommitmentType: item.plannedCommitmentType ?? null,
          plannedWeekStart: item.plannedWeekStart ?? null,
          plannedStart: item.plannedStart ?? null,
          plannedDurationDays:
            typeof item.plannedDurationDays === 'number' && Number.isFinite(item.plannedDurationDays)
              ? Math.max(1, Math.trunc(item.plannedDurationDays))
              : null,
          plannedFlexDays:
            typeof item.plannedFlexDays === 'number' && Number.isFinite(item.plannedFlexDays) ? Math.max(0, Math.trunc(item.plannedFlexDays)) : null,
          plannedLockedAt: item.plannedLockedAt ?? null,
          plannedLockedBy: item.plannedLockedBy ?? null,
          forecastStart: item.forecastStart ?? item.startDateOverride ?? null,
          forecastDurationDays: durationDaysFromScheduleItem(item),
          forecastEndExclusive: item.forecastEndExclusive ?? null,
          actualStart: item.actualStartDate ?? null,
          actualFinish: item.actualEndDate ?? null,
          status: jobStatusFromScheduleItem(item, today),
          daysRemaining:
            typeof item.daysRemaining === 'number' && Number.isFinite(item.daysRemaining) ? Math.max(0, Math.trunc(item.daysRemaining)) : null,
          driftDays: typeof item.driftDays === 'number' && Number.isFinite(item.driftDays) ? Math.max(0, Math.trunc(item.driftDays)) : null,
          clientUpdateStatus: item.clientUpdateStatus ?? null,
          clientUpdateNeededAt: item.clientUpdateNeededAt ?? null,
          clientUpdateAckAt: item.clientUpdateAckAt ?? null,
          clientUpdateAckBy: item.clientUpdateAckBy ?? null,
        });
      }

      const region = (installer.calendarRegion ?? 'Auckland').trim() || 'Auckland';
      const recompute = recomputeCrewSchedule({
        crew: {
          id: installer.id,
          region,
          baseAvailableDate: isYmd(installer.baseAvailableDate ?? '') ? installer.baseAvailableDate : null,
        },
        items: recomputeItems,
        jobsById,
        downtimesById,
        today,
        calendar,
      });

      nextAvailable.set(installer.id, recompute.next_available_date);
      const crewIdForConflict = safeUuidFromAppId('crew', installer.id) ?? installer.id;
      conflicts.push(...recompute.conflicts.map((conflict) => ({ ...conflict, crew_id: crewIdForConflict })));

      for (const block of recompute.blocks) {
        const existing = currentById.get(block.item_id);
        const durationHours = block.duration_days * WORK_HOURS_PER_DAY;
        if (block.item_type === 'job') {
          patchByItemId.set(block.item_id, {
            sortIndex: block.position,
            startDateOverride: block.start,
            durationHoursOverride: durationHours,
            forecastStart: block.start,
            forecastEndExclusive: block.end_exclusive,
            forecastDurationDays: block.duration_days,
            mode: block.job_mode ?? existing?.mode ?? 'floating',
            scheduleStatus: scheduleStatusFromV2JobStatus(block.job_status),
            jobStatus: block.job_status ?? existing?.jobStatus ?? null,
          });
        } else {
          patchByItemId.set(block.item_id, {
            sortIndex: block.position,
            startDateOverride: block.start,
            durationHoursOverride: durationHours,
            forecastStart: block.start,
            forecastEndExclusive: block.end_exclusive,
            forecastDurationDays: block.duration_days,
          });
        }
      }
    }

    const updatedAt = new Date().toISOString();
    const scheduleItems = items.map((item) => {
      const patch = patchByItemId.get(item.id);
      if (!patch) return item;
      return { ...item, ...patch, updatedAt };
    });

    scheduleItems.sort((a, b) => a.installerId.localeCompare(b.installerId) || a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));

    return { scheduleItems, scheduleConflicts: conflicts, nextAvailableByInstallerId: nextAvailable };
  }

  function applyV2OptimisticState(nextItems: ScheduleItem[], nextUnscheduledJobsSeed: SchedulableJob[]): void {
    const recomputed = recomputeLocalForCrews(nextItems);
    setV2LocalState(
      {
        scheduleItems: recomputed.scheduleItems,
        unscheduledJobsSeed: nextUnscheduledJobsSeed,
        scheduleConflicts: recomputed.scheduleConflicts,
        nextAvailableByInstallerId: recomputed.nextAvailableByInstallerId,
      },
      nextV2GeneratedAt(),
    );
  }

  function mapCrewScheduleToItems(
    crewSchedule: ScheduleCrewSchedule,
    generatedAt: string,
    estimateByProjectId: Map<string, string>,
    estimateByScheduledJobId: Map<string, string>,
  ): { crewInstallerId: string; items: ScheduleItem[] } {
    const crewInstallerId = safeAppIdFromUuid('crew', crewSchedule.crew_id);
    const existingLaneItems = scheduleItemsRef.current.filter((item) => item.installerId === crewInstallerId);
    const existingLaneByScheduleItemId = new Map(existingLaneItems.map((item) => [item.id, item]));

    const items: ScheduleItem[] = [];
    for (const item of crewSchedule.items) {
      const scheduleItemId = safeAppIdFromUuid('sch', item.id);
      const existing = existingLaneByScheduleItemId.get(scheduleItemId);
      if (item.item_type === 'job' && item.job) {
        const projectId = safeAppIdFromUuid('proj', item.job.job_id);
        const estimateId =
          estimateByScheduledJobId.get(item.job.id) ?? existing?.estimateId ?? estimateByProjectId.get(projectId) ?? '';
        items.push({
          id: scheduleItemId,
          installerId: crewInstallerId,
          projectId,
          estimateId,
          sortIndex: item.position,
          scheduleStatus: scheduleStatusFromV2JobStatus(item.job.status),
          locked: false,
          actualStartDate: item.job.actual_start ?? null,
          actualEndDate: item.job.actual_finish ?? null,
          startDateOverride: item.job.forecast_start ?? undefined,
          durationHoursOverride: item.job.forecast_duration_days * WORK_HOURS_PER_DAY,
          updatedAt: generatedAt,
          itemType: 'job',
          scheduledJobId: item.job.id,
          forecastStart: item.job.forecast_start,
          forecastEndExclusive: item.job.forecast_end_exclusive,
          forecastDurationDays: item.job.forecast_duration_days,
          plannedCommitmentType: item.job.planned_commitment_type,
          plannedWeekStart: item.job.planned_week_start,
          plannedStart: item.job.planned_start,
          plannedDurationDays: item.job.planned_duration_days,
          plannedFlexDays: item.job.planned_flex_days,
          plannedLockedAt: item.job.planned_locked_at ?? null,
          plannedLockedBy: item.job.planned_locked_by ?? null,
          driftDays: typeof item.job.drift_days === 'number' ? item.job.drift_days : null,
          clientUpdateStatus: item.job.client_update_status ?? null,
          clientUpdateNeededAt: item.job.client_update_needed_at ?? null,
          clientUpdateAckAt: item.job.client_update_ack_at ?? null,
          clientUpdateAckBy: item.job.client_update_ack_by ?? null,
          mode: item.job.mode,
          jobStatus: item.job.status,
          daysRemaining: item.job.days_remaining,
        });
        continue;
      }

      if (item.item_type === 'downtime') {
        items.push({
          id: scheduleItemId,
          installerId: crewInstallerId,
          projectId: '',
          estimateId: '',
          sortIndex: item.position,
          scheduleStatus: 'TENTATIVE',
          locked: false,
          startDateOverride: item.start,
          durationHoursOverride: item.duration_days * WORK_HOURS_PER_DAY,
          updatedAt: generatedAt,
          itemType: 'downtime',
          downtimeId: item.downtime?.id ?? null,
          downtimeReason: item.downtime?.reason ?? null,
          downtimeNote: item.downtime?.note ?? null,
          forecastStart: item.start,
          forecastEndExclusive: item.end_exclusive,
          forecastDurationDays: item.duration_days,
        });
      }
    }
    return { crewInstallerId, items };
  }

  function applyV2MutationResponse(response: ScheduleMutationResult): boolean {
    const schedules: ScheduleCrewSchedule[] = [];
    if (response.schedule && typeof response.schedule.crew_id === 'string') schedules.push(response.schedule);
    if (response.source_schedule && typeof response.source_schedule.crew_id === 'string') schedules.push(response.source_schedule);
    if (!schedules.length) return false;

    const estimateByProjectId = new Map<string, string>();
    const estimateByScheduledJobId = new Map<string, string>();

    for (const item of scheduleItemsRef.current) {
      if (item.itemType === 'downtime') continue;
      if (item.projectId && item.estimateId && !estimateByProjectId.has(item.projectId)) estimateByProjectId.set(item.projectId, item.estimateId);
      if (item.scheduledJobId && item.estimateId && !estimateByScheduledJobId.has(item.scheduledJobId)) {
        estimateByScheduledJobId.set(item.scheduledJobId, item.estimateId);
      }
    }
    for (const job of unscheduledJobsSeedRef.current) {
      if (job.projectId && job.estimateId && !estimateByProjectId.has(job.projectId)) estimateByProjectId.set(job.projectId, job.estimateId);
    }

    const generatedAt = nextV2GeneratedAt();
    let nextItems = scheduleItemsRef.current.slice();
    for (const schedule of schedules) {
      const mapped = mapCrewScheduleToItems(schedule, generatedAt, estimateByProjectId, estimateByScheduledJobId);
      nextItems = nextItems.filter((item) => item.installerId !== mapped.crewInstallerId);
      nextItems.push(...mapped.items);
    }

    const recomputed = recomputeLocalForCrews(nextItems);
    setV2LocalState(
      {
        scheduleItems: recomputed.scheduleItems,
        unscheduledJobsSeed: unscheduledJobsSeedRef.current,
        scheduleConflicts: recomputed.scheduleConflicts,
        nextAvailableByInstallerId: recomputed.nextAvailableByInstallerId,
      },
      generatedAt,
    );
    return true;
  }

  function flushQueuedV2Mutations(): Promise<void> {
    const active = v2MutationFlushRef.current;
    if (active) return active;

    const runner = (async () => {
      while (v2MutationBufferRef.current.length > 0) {
        const next = v2MutationBufferRef.current.shift();
        if (!next) continue;
        try {
          const result = await next.run();
          next.resolve(result);
        } catch (err) {
          next.reject(err);
        }
      }
    })().finally(() => {
      v2MutationFlushRef.current = null;
      if (v2MutationBufferRef.current.length > 0) {
        void flushQueuedV2Mutations();
      }
    });

    v2MutationFlushRef.current = runner;
    return runner;
  }

  function scheduleV2MutationFlush(): void {
    if (v2MutationFlushTimerRef.current != null) return;
    v2MutationFlushTimerRef.current = window.setTimeout(() => {
      v2MutationFlushTimerRef.current = null;
      void flushQueuedV2Mutations();
    }, V2_MUTATION_DEBOUNCE_MS);
  }

  function enqueueV2Mutation<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      v2MutationBufferRef.current.push({ run, resolve, reject });
      scheduleV2MutationFlush();
    });
  }

  const setScheduleView = (next: 'board' | 'gantt' | 'site_visits') => {
    if (next === view) return;
    const qs = new URLSearchParams(searchParams.toString());
    const viewParam = next === 'site_visits' ? 'site-visits' : next;
    qs.set('view', viewParam);
    const href = `/staff/schedule?${qs.toString()}`;
    const label = next === 'site_visits' ? 'Site visits' : next === 'gantt' ? 'Gantt' : 'Board';
    beginRouteTransition({ href, label, source: 'schedule-view', show: 'immediate' });
    startUiTransition(() => {
      router.replace(href);
      setView(next);
    });
  };

  const handleShowCompletedChange = (next: boolean) => {
    startUiTransition(() => {
      setShowCompleted(next);
    });
  };

  const handleToggleUnscheduledCollapsed = () => {
    startUiTransition(() => {
      setUnscheduledCollapsed((prev) => !prev);
    });
  };

  const scheduleTabs = (
    <>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'board'} onClick={() => setScheduleView('board')}>
        Board
      </button>
      <button type="button" className={styles.buttonSecondary} aria-pressed={view === 'gantt'} onClick={() => setScheduleView('gantt')}>
        Gantt
      </button>
      <button
        type="button"
        className={styles.buttonSecondary}
        aria-pressed={view === 'site_visits'}
        onClick={() => setScheduleView('site_visits')}
      >
        Site visits
      </button>
    </>
  );

  type ScheduleSnapshotV1 = {
    generatedAt: string;
    host: string | null;
    crews: Array<{ id: string; name: string; color: string | null; is_active: boolean; sort_order: number }>;
    scheduleItems: Array<{
      id: string;
      crew_id: string;
      project_id: string;
      estimate_id: string | null;
      start_date: string;
      end_date: string;
      duration_days: number | null;
      sort_order: number;
      updated_at: string | null;
      status?: string | null;
      locked?: boolean | null;
      confirmed_at?: string | null;
      confirmed_by?: string | null;
      actual_start_date?: string | null;
      actual_end_date?: string | null;
    }>;
    projectsIndex: Array<{
      id: string;
      name: string;
      pipeline_stage: string;
      follow_up_date?: string | null;
    }>;
  };

  const snapshotKey = useMemo(() => qk.schedule.snapshot(hostKey), [hostKey]);
  const { data: cachedSnapshot } = useQuery<ScheduleSnapshotV1 | null>({
    queryKey: snapshotKey,
    queryFn: async () => null,
    enabled: false,
  });

  const v2SnapshotQuery = useQuery({
    ...scheduleV2SnapshotQueryOptions(hostKey, today),
    enabled: scheduleMode === 'v2' && view !== 'site_visits',
    initialData: scheduleMode === 'v2' ? initialV2Snapshot ?? undefined : undefined,
    initialDataUpdatedAt: scheduleMode === 'v2' ? initialV2SnapshotUpdatedAt : undefined,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 501) && failureCount < 1,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);
  const [boardDropTarget, setBoardDropTarget] = useState<BoardDropTarget | null>(null);
  const v2ErrorNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;
    const snapshot = v2SnapshotQuery.data;
    if (!snapshot) return;

    const incomingGeneratedAt = typeof snapshot.generatedAt === 'string' && snapshot.generatedAt ? snapshot.generatedAt : nowIso();
    const latestGeneratedAt = v2GeneratedAtRef.current;
    if (v2PendingMutationsRef.current > 0 && latestGeneratedAt && incomingGeneratedAt <= latestGeneratedAt) return;
    if (latestGeneratedAt && incomingGeneratedAt < latestGeneratedAt) return;

    v2GeneratedAtRef.current = incomingGeneratedAt;
    hydratedFromCacheRef.current = true;
    v2HolidaysRef.current = Array.isArray(snapshot.holidays) ? snapshot.holidays : [];
    v2ClosuresRef.current = Array.isArray(snapshot.closures) ? snapshot.closures : [];
    setGanttHolidays(mapGanttHolidaysFromSnapshot(v2HolidaysRef.current));

    const nextItems = snapshot.scheduleItems;
    const nextUnscheduled = mapV2UnscheduledJobs(snapshot.unscheduledJobs);
    const nextConflicts = Array.isArray(snapshot.conflicts) ? snapshot.conflicts : [];
    const nextAvail = new Map(Object.entries(snapshot.nextAvailableByInstallerId ?? {}));

    scheduleItemsRef.current = nextItems;
    unscheduledJobsSeedRef.current = nextUnscheduled;
    scheduleConflictsRef.current = nextConflicts;
    nextAvailRef.current = nextAvail;

    setLoadError(null);
        setInstallers(snapshot.installers);
        setProjects(snapshot.projects);
    setScheduleItems(nextItems);
    setEstimatesById(new Map());
    setUnscheduledJobsSeed(nextUnscheduled);
    setScheduleConflicts(nextConflicts);
    setNextAvailableByInstallerId(nextAvail);
    setHydrated(true);
  }, [scheduleMode, view, v2SnapshotQuery.data]);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;
    setSyncing(v2SnapshotQuery.isFetching || v2PendingMutationsRef.current > 0);
  }, [scheduleMode, view, v2SnapshotQuery.isFetching]);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;

    const err = v2SnapshotQuery.error;
    if (!err) {
      v2ErrorNotifiedRef.current = null;
      return;
    }

    const errKey = err instanceof Error ? err.message : String(err);
    if (v2ErrorNotifiedRef.current === errKey) return;
    v2ErrorNotifiedRef.current = errKey;

    if (err instanceof ApiError && err.status === 501) {
      toast.error(err.message || 'Schedule v2 schema not ready yet. Falling back to legacy.');
      hydratedFromCacheRef.current = false;
      v2GeneratedAtRef.current = '';
      v2HolidaysRef.current = [];
      v2ClosuresRef.current = [];
      setGanttHolidays([]);
      setLoadError(null);
      setSyncing(false);
      setHydrated(false);
      setInstallers([]);
      setProjects([]);
      setScheduleItems([]);
      setEstimatesById(new Map());
      setScheduleConflicts([]);
      setNextAvailableByInstallerId(new Map());
      setScheduleMode('legacy');
      return;
    }

    const msg = err instanceof Error ? err.message : 'Failed to load schedule data.';
    const showingCached = hydratedFromCacheRef.current || installers.length > 0 || scheduleItems.length > 0 || projects.length > 0;
    if (showingCached) {
      toast.error("Couldn't refresh schedule (showing last saved).");
      setSyncing(false);
      return;
    }

    setLoadError({ message: msg });
    setSyncing(false);
    setHydrated(true);
  }, [installers.length, projects.length, scheduleItems.length, scheduleMode, toast, v2SnapshotQuery.error, view]);

  function tryWriteScheduleSnapshotToCache(input: {
    installers: Installer[];
    projects: ScheduleProjectSummary[];
    scheduleItems: ScheduleItem[];
    estimatesById: Map<string, Estimate>;
  }): void {
    if (scheduleMode !== 'legacy') return;
    try {
      const projectsById = new Map<string, ScheduleProjectSummary>();
      for (const p of input.projects) projectsById.set(p.id, p);
      const renderable = input.scheduleItems.filter((i) => projectsById.has(i.projectId));
      const build = buildScheduleBars({ today, installers: input.installers, scheduleItems: renderable, projectsById, estimatesById: input.estimatesById });
      const bars = new Map(build.bars.map((b) => [b.scheduleItemId, b]));

      queryClient.setQueryData(snapshotKey, {
        generatedAt: nowIso(),
        host: supabaseHostFromUrl(supabaseRuntimeUrl()),
        crews: input.installers.map((c) => ({
          id: uuidFromAppId(c.id, 'crew'),
          name: c.name,
          color: c.color ?? null,
          is_active: Boolean(c.active),
          sort_order: Number.isFinite(c.sortOrder) ? c.sortOrder : 0,
        })),
        scheduleItems: input.scheduleItems.map((i) => {
          const bar = bars.get(i.id) ?? null;
          const durationDays =
            typeof i.durationHoursOverride === 'number' && Number.isFinite(i.durationHoursOverride) && i.durationHoursOverride > 0
              ? i.durationHoursOverride / WORK_HOURS_PER_DAY
              : bar && Number.isFinite(bar.durationHours) && bar.durationHours > 0
                ? bar.durationHours / WORK_HOURS_PER_DAY
                : null;

          return {
            id: uuidFromAppId(i.id, 'sch'),
            crew_id: uuidFromAppId(i.installerId, 'crew'),
            project_id: uuidFromAppId(i.projectId, 'proj'),
            estimate_id: i.estimateId ? uuidFromAppId(i.estimateId, 'est') : null,
            start_date: bar?.startDate ?? i.startDateOverride ?? '',
            end_date: bar?.endDate ?? bar?.startDate ?? i.startDateOverride ?? '',
            duration_days: typeof durationDays === 'number' && Number.isFinite(durationDays) ? durationDays : null,
            sort_order: i.sortIndex,
            updated_at: i.updatedAt ?? null,
            status: typeof i.scheduleStatus === 'string' ? i.scheduleStatus : null,
            locked: typeof i.locked === 'boolean' ? i.locked : null,
            confirmed_at: typeof i.confirmedAt === 'string' ? i.confirmedAt : null,
            confirmed_by: typeof i.confirmedBy === 'string' ? i.confirmedBy : null,
            actual_start_date: typeof i.actualStartDate === 'string' ? i.actualStartDate : null,
            actual_end_date: typeof i.actualEndDate === 'string' ? i.actualEndDate : null,
          };
        }),
        projectsIndex: input.projects.map((p) => ({
          id: uuidFromAppId(p.id, 'proj'),
          name: p.projectName,
          pipeline_stage: String(p.status ?? 'NEW'),
          follow_up_date: p.followUpDate ?? null,
        })),
      });
    } catch {
      // ignore cache failures
    }
  }

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    if (hydrated) return;
    if (scheduleMode !== 'legacy') return;
    if (!cachedSnapshot) return;

    try {
      const cachedInstallers: Installer[] = cachedSnapshot.crews.map((c) => ({
        id: appIdFromUuid('crew', c.id),
        name: c.name,
        color: c.color ?? PORTAL_DEFAULT_ACCENT_HEX,
        active: c.is_active,
        sortOrder: c.sort_order,
      }));

      const cachedProjects: ScheduleProjectSummary[] = cachedSnapshot.projectsIndex.map((p) => ({
        id: appIdFromUuid('proj', p.id),
        projectName: p.name,
        name: p.name,
        status: p.pipeline_stage as any,
        nextActionDate: p.follow_up_date ?? null,
        followUpDate: p.follow_up_date ?? null,
      }));

      const cachedItems: ScheduleItem[] = cachedSnapshot.scheduleItems.map((i) => ({
        id: appIdFromUuid('sch', i.id),
        installerId: appIdFromUuid('crew', i.crew_id),
        projectId: appIdFromUuid('proj', i.project_id),
        estimateId: i.estimate_id ? appIdFromUuid('est', i.estimate_id) : '',
        sortIndex: i.sort_order,
        scheduleStatus: typeof i.status === 'string' && i.status ? normalizeScheduleStatus(i.status) : undefined,
        locked: typeof i.locked === 'boolean' ? i.locked : undefined,
        confirmedAt: typeof i.confirmed_at === 'string' ? i.confirmed_at : null,
        confirmedBy: typeof i.confirmed_by === 'string' ? i.confirmed_by : null,
        actualStartDate: typeof i.actual_start_date === 'string' ? i.actual_start_date : null,
        actualEndDate: typeof i.actual_end_date === 'string' ? i.actual_end_date : null,
        startDateOverride: i.start_date || undefined,
        durationHoursOverride: typeof i.duration_days === 'number' ? i.duration_days * WORK_HOURS_PER_DAY : undefined,
        updatedAt: i.updated_at ?? new Date(0).toISOString(),
      }));

      hydratedFromCacheRef.current = true;
      setLoadError(null);
      setInstallers(cachedInstallers);
      setProjects(cachedProjects);
      setScheduleItems(cachedItems);
      setEstimatesById(new Map());
      setHydrated(true);
      setSyncing(true);
    } catch {
      // ignore cache failures
    }
  }, [cachedSnapshot, hydrated, scheduleMode]);

	  useEffect(() => {
	    let cancelled = false;
	    void (async () => {
	      if (view === 'site_visits') return;
	      if (scheduleMode !== 'legacy') return;
	      setLoadError(null);
	      setSyncing(true);
	      try {
	        if (typeof window !== 'undefined') {
	          // Legacy localStorage contamination: schedule is DB-backed; do not merge/restore pre-DB schedule caches.
	          window.localStorage.removeItem('sp_schedule_items_v1');
	          window.localStorage.removeItem('sp_installers_v1');
	        }

	        const [installers, scheduleItems, projects, allEstimates] = await Promise.all([
	          listInstallers(),
	          listScheduleItems(),
	          listProjects(),
          listAllEstimates(),
        ]);
        if (cancelled) return;

        const scheduleProjects = projects.map(toScheduleProjectSummary);

        const estimatesById = new Map<string, Estimate>();
        for (const e of allEstimates) estimatesById.set(e.id, e);

        // Normalize sortIndex per lane for robustness.
        const laneOrder = new Map<string, number>();
        const normalised = scheduleItems
          .slice()
          .sort((a, b) => a.installerId.localeCompare(b.installerId) || a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt))
          .map((item) => {
            const idx = laneOrder.get(item.installerId) ?? 0;
            laneOrder.set(item.installerId, idx + 1);
            return item.sortIndex === idx ? item : { ...item, sortIndex: idx };
          });

        setInstallers(installers);
        setProjects(scheduleProjects);
        setScheduleItems(normalised);
        setEstimatesById(estimatesById);
        setHydrated(true);
        tryWriteScheduleSnapshotToCache({ installers, projects: scheduleProjects, scheduleItems: normalised, estimatesById });
        setSyncing(false);

        // Background: mark any jobs whose planned start is <= today as started (IN_PROGRESS).
        // This also emits an idempotent audit event for future automations.
        void (async () => {
          const res = await normalizeScheduleItemsStarted(today).catch(() => null);
          if (!res || res.updated <= 0) return;
          const refreshed = await listScheduleItems().catch(() => null);
          if (!refreshed || cancelled) return;

          const laneOrder = new Map<string, number>();
          const normalizedRefreshed = refreshed
            .slice()
            .sort((a, b) => a.installerId.localeCompare(b.installerId) || a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt))
            .map((item) => {
              const idx = laneOrder.get(item.installerId) ?? 0;
              laneOrder.set(item.installerId, idx + 1);
              return item.sortIndex === idx ? item : { ...item, sortIndex: idx };
            });

          setScheduleItems(normalizedRefreshed);
          tryWriteScheduleSnapshotToCache({ installers, projects: scheduleProjects, scheduleItems: normalizedRefreshed, estimatesById });
        })();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load schedule data.';
        const showingCached = hydratedFromCacheRef.current || installers.length > 0 || scheduleItems.length > 0 || projects.length > 0;
        if (showingCached) {
          toast.error("Couldn't refresh schedule (showing last saved).");
          setSyncing(false);
          return;
        }
        if (err instanceof SupabaseRepoError) {
          const code = typeof err.postgrestError?.code === 'string' ? String(err.postgrestError.code) : undefined;
          setLoadError({ message: msg, table: err.table, code });
        } else {
          setLoadError({ message: msg });
        }
        setHydrated(true);
        setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce, toast, view, scheduleMode, today]);

  const devOnly = process.env.NODE_ENV !== 'production';

  const projectsById = useMemo(() => {
    const map = new Map<string, ScheduleProjectSummary>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const scheduleItemsRenderable = useMemo(() => {
    return scheduleItems.filter((i) => i.itemType === 'downtime' || projectsById.has(i.projectId));
  }, [projectsById, scheduleItems]);

  const visibleScheduleItems = useMemo(() => {
    if (showCompleted) return scheduleItemsRenderable;
    return scheduleItemsRenderable.filter((item) => !isCompletedScheduleItem(item, today));
  }, [scheduleItemsRenderable, showCompleted, today]);

  const orphanedScheduleItems = useMemo(() => {
    return scheduleItems.filter((i) => i.itemType !== 'downtime' && !projectsById.has(i.projectId));
  }, [projectsById, scheduleItems]);

  const scheduleItemById = useMemo(() => {
    const map = new Map<string, ScheduleItem>();
    for (const item of scheduleItems) map.set(item.id, item);
    return map;
  }, [scheduleItems]);

  const scheduleStatusById = useMemo(() => {
    const map = new Map<string, ScheduleItemStatus>();
    for (const item of scheduleItems) {
      map.set(item.id, deriveScheduleStatus(item, today));
    }
    return map;
  }, [scheduleItems, today]);

  const installersById = useMemo(() => {
    const map = new Map<string, Installer>();
    for (const installer of installers) map.set(installer.id, installer);
    return map;
  }, [installers]);

  const boardModel = useMemo(() => {
    if (view === 'site_visits') return EMPTY_SCHEDULE_BOARD_MODEL;
    return buildScheduleBoardModel({
      estimatesById,
      installers,
      orphanedScheduleItems,
      projects,
      projectsById,
      query: deferredQuery,
      scheduleItems,
      scheduleItemsRenderable,
      scheduleMode,
      today,
      unscheduledJobsSeed,
      visibleScheduleItems,
    });
  }, [
    deferredQuery,
    estimatesById,
    installers,
    orphanedScheduleItems,
    projects,
    projectsById,
    scheduleItems,
    scheduleItemsRenderable,
    scheduleMode,
    today,
    unscheduledJobsSeed,
    view,
    visibleScheduleItems,
  ]);

  const schedulable = boardModel.schedulable;
  const unscheduledJobsAll = boardModel.unscheduledJobsAll;

  const unscheduledEmpty = unscheduledJobsAll.length === 0;

  useEffect(() => {
    setUnscheduledCollapsed(unscheduledEmpty);
  }, [unscheduledEmpty]);

  const unscheduledJobs = boardModel.unscheduledJobs;
  const laneItems = boardModel.laneItems;

  const schedule = useMemo(() => {
    if (scheduleMode === 'v2') {
      const base = buildScheduleBarsFromForecast({ scheduleItems: visibleScheduleItems, projectsById, estimatesById });
      const scheduleItemByJobId = new Map<string, string>();
      for (const item of visibleScheduleItems) {
        if (item.scheduledJobId) scheduleItemByJobId.set(item.scheduledJobId, item.id);
      }
      const conflictIssues: SchedulingIssue[] = (scheduleConflicts ?? [])
        .map((c: any) => {
          const scheduleItemId = scheduleItemByJobId.get(String(c.job_id));
          if (!scheduleItemId) return null;
          const pinned = typeof c.pinned_start === 'string' ? c.pinned_start : '';
          const expected = typeof c.expected_cursor_start === 'string' ? c.expected_cursor_start : '';
          const overlap = typeof c.overlap_days === 'number' ? c.overlap_days : null;
          const message = `Pinned start ${pinned || '—'} overlaps crew availability (${expected || '—'})${overlap ? ` by ${overlap} day(s)` : ''}.`;
          return { level: 'error' as const, scheduleItemId, message };
        })
        .filter(Boolean) as SchedulingIssue[];
      return { bars: base.bars, issues: [...base.issues, ...conflictIssues] };
    }

    return buildScheduleBars({
      today,
      installers,
      scheduleItems: visibleScheduleItems,
      projectsById,
      estimatesById,
    });
  }, [estimatesById, installers, projectsById, scheduleConflicts, scheduleMode, today, visibleScheduleItems]);

  const orphanedIssues = useMemo((): SchedulingIssue[] => {
    return orphanedScheduleItems.map((item) => {
      const installerName = installersById.get(item.installerId)?.name ?? item.installerId;
      return {
        level: 'error',
        scheduleItemId: item.id,
        projectId: item.projectId,
        estimateId: item.estimateId,
        message: `Orphaned scheduled job on ${installerName}: missing project (${item.projectId}).`,
      };
    });
  }, [installersById, orphanedScheduleItems]);

  const issueLevelByScheduleId = useMemo(() => {
    const map = new Map<string, 'warning' | 'error'>();
    for (const issue of schedule.issues) {
      const id = issue.scheduleItemId;
      if (!id) continue;
      if (issue.level === 'error') {
        map.set(id, 'error');
        continue;
      }
      if (!map.has(id)) map.set(id, 'warning');
    }
    return map;
  }, [schedule.issues]);

  const conflictMessageByScheduleId = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of schedule.issues) {
      if (issue.level !== 'error') continue;
      if (!issue.scheduleItemId) continue;
      map.set(issue.scheduleItemId, issue.message);
    }
    return map;
  }, [schedule.issues]);

  const barsByScheduleId = useMemo(() => {
    const map = new Map<string, { startDate: string; endDate: string }>();
    for (const bar of schedule.bars) map.set(bar.scheduleItemId, { startDate: bar.startDate, endDate: bar.endDate });
    return map;
  }, [schedule.bars]);

  const schedulingIssues = useMemo(() => {
    const fromScheduled = schedule.issues;
    const fromOrphans = orphanedIssues;
    const fromUnscheduled = unscheduledJobsAll
      .flatMap((j) => j.warnings)
      .filter((m) => m.toLowerCase().includes('defaulting') || m.toLowerCase().includes('missing'))
      .map((message) => ({ level: 'warning' as const, message }));
    return [...fromOrphans, ...fromScheduled, ...fromUnscheduled];
  }, [orphanedIssues, schedule.issues, unscheduledJobsAll]);

  const ganttJobsById = useMemo(() => {
    if (view !== 'gantt') return new Map<string, SchedulableJob>();

    const jobsById = new Map<string, SchedulableJob>();
    for (const item of visibleScheduleItems) {
      if (item.itemType === 'downtime') {
        const durationHours =
          typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
            ? item.durationHoursOverride
            : WORK_HOURS_PER_DAY;
        const reason = item.downtimeReason ? titleCase(item.downtimeReason) : 'Downtime';
        jobsById.set(item.id, {
          id: item.id,
          projectId: '',
          estimateId: '',
          projectName: reason,
          descriptor: item.downtimeNote ?? 'Crew unavailable',
          status: 'DOWNTIME',
          durationHours,
          durationLabel: formatDuration(durationHours),
          durationTitle: formatHours(durationHours),
          warnings: [],
        });
        continue;
      }

      const project = projectsById.get(item.projectId) ?? null;
      const estimate = estimatesById.get(item.estimateId) ?? null;
      const projectName = project?.projectName ?? project?.name ?? 'Untitled project';
      const status = project ? normalizeProjectStatus(project.status).status : '—';

      let durationHours = WORK_HOURS_PER_DAY;
      const warnings: string[] = [];
      if (typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0) {
        durationHours = item.durationHoursOverride;
      } else if (
        typeof item.forecastDurationDays === 'number' &&
        Number.isFinite(item.forecastDurationDays) &&
        item.forecastDurationDays > 0
      ) {
        durationHours = item.forecastDurationDays * WORK_HOURS_PER_DAY;
      } else if (estimate) {
        const derived = deriveDurationHoursFromEstimate(estimate);
        durationHours = derived.durationHours;
        warnings.push(...derived.issues.map((issue) => issue.message));
      }

      jobsById.set(item.id, {
        id: item.id,
        projectId: item.projectId,
        estimateId: item.estimateId,
        projectName,
        descriptor: estimate ? getJobDescriptorFromEstimate(estimate) : '—',
        status,
        durationHours,
        durationLabel: formatDuration(durationHours),
        durationTitle: formatHours(durationHours),
        warnings,
      });
    }

    return jobsById;
  }, [estimatesById, projectsById, view, visibleScheduleItems]);

  const emptyGantt = useMemo<ScheduleGanttModel>(() => {
    const rangeStart = startOfWeekMonday(today);
    const axis = buildGanttAxis({
      rangeStart,
      rangeDays: 1,
      baseDayPx: ganttBaseDayPxForZoomWeeks(zoomWeeks),
      weekendWeight: GANTT_WEEKEND_WEIGHT,
    });
    return {
      rangeStart,
      rangeEnd: rangeStart,
      rangeDays: 1,
      axis,
      totalWidth: axis.totalWidth,
      displayToday: today,
      todayLinePx: 0,
      todayColumnLeftPx: null,
      todayColumnWidthPx: 0,
      weekendBlocks: [],
      holidayBlocks: [],
      dayBoundaryLines: [],
      weekBoundaryLines: [],
      rows: [],
    };
  }, [today, zoomWeeks]);

  const gantt = useMemo(() => {
    if (view !== 'gantt') return emptyGantt;

    const rangeStart = startOfWeekMonday(today);
    const rangeDays = GANTT_TIMELINE_DAYS;
    const rangeEnd = addDaysYmd(rangeStart, rangeDays - 1);
    const baseDayPx = ganttBaseDayPxForZoomWeeks(zoomWeeks);
    const axis = buildGanttAxis({
      rangeStart,
      rangeDays,
      baseDayPx,
      weekendWeight: GANTT_WEEKEND_WEIGHT,
    });
    const totalWidth = axis.totalWidth;

    const displayToday = isWeekendDate(today) ? snapToWeekdayYmd(today) : today;
    const todayIndex = diffDaysYmd(rangeStart, displayToday);
    const todayLinePx = axisXForDayIndex(axis, todayIndex);
    const todayColumn = todayIndex >= 0 && todayIndex < axis.days.length ? axis.days[todayIndex] : null;

    const holidayNamesByDate = new Map<string, string[]>();
    for (const holiday of ganttHolidays) {
      if (!holiday?.date || !isYmd(holiday.date)) continue;
      const idx = diffDaysYmd(rangeStart, holiday.date);
      if (idx < 0 || idx >= rangeDays) continue;
      const names = holidayNamesByDate.get(holiday.date) ?? [];
      if (holiday.name?.trim()) names.push(holiday.name.trim());
      holidayNamesByDate.set(holiday.date, names);
    }

    const weekendBlocks: Array<{ leftPx: number; widthPx: number; date: string }> = [];
    const holidayBlocks: Array<{ leftPx: number; widthPx: number; date: string; label: string }> = [];
    for (const day of axis.days) {
      if (day.widthPx <= 0) continue;
      const holidayNames = holidayNamesByDate.get(day.date);
      if (holidayNames) {
        const uniqueHolidayNames = Array.from(new Set(holidayNames));
        const dateLabel = formatShortDate(day.date);
        const holidayLabel = uniqueHolidayNames.length ? `${uniqueHolidayNames.join(', ')} (${dateLabel})` : `Public holiday (${dateLabel})`;
        holidayBlocks.push({
          leftPx: day.startPx,
          widthPx: day.widthPx,
          date: day.date,
          label: holidayLabel,
        });
        continue;
      }
      if (day.isWeekend) {
        weekendBlocks.push({
          leftPx: day.startPx,
          widthPx: day.widthPx,
          date: day.date,
        });
      }
    }

    const weekBoundaryLines = Array.from(new Set(axis.weeks.map((week) => week.startPx).filter((px) => px > 0 && px < totalWidth))).sort(
      (a, b) => a - b,
    );
    const weekBoundarySet = new Set(weekBoundaryLines);
    const dayBoundarySet = new Set<number>();
    for (const day of axis.days) {
      if (day.isWeekend) continue;
      const px = day.startPx;
      if (px <= 0 || px >= totalWidth || weekBoundarySet.has(px)) continue;
      dayBoundarySet.add(px);
    }
    const dayBoundaryLines = Array.from(dayBoundarySet).sort((a, b) => a - b);

    const barsById = new Map(schedule.bars.map((b) => [b.scheduleItemId, b]));
    const plannedBarsById = new Map<string, { leftPx: number; widthPx: number; startDate: string; endDate: string }>();

    if (showPlanned && scheduleMode === 'v2') {
      for (const item of visibleScheduleItems) {
        if (item.itemType === 'downtime') continue;
        if (!item.plannedStart || !isYmd(item.plannedStart)) continue;
        const plannedDays =
          typeof item.plannedDurationDays === 'number' && Number.isFinite(item.plannedDurationDays) && item.plannedDurationDays > 0
            ? item.plannedDurationDays
            : null;
        if (!plannedDays) continue;
        const plannedEndExcl = addDaysYmd(item.plannedStart, plannedDays);
        const plannedEnd = endInclusiveFromExclusive(plannedEndExcl, item.plannedStart);
        const plannedSpan = axisSpanPx(axis, item.plannedStart, plannedEnd);
        if (plannedSpan.widthPx <= 0) continue;
        plannedBarsById.set(item.id, {
          leftPx: plannedSpan.leftPx,
          widthPx: Math.max(plannedSpan.widthPx, 6),
          startDate: item.plannedStart,
          endDate: plannedEnd,
        });
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
                if (span.widthPx <= 0) return null;
                return { leftPx: span.leftPx, widthPx: Math.max(span.widthPx, 8) };
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
        rows.push({
          kind: 'empty',
          id: `empty:${installer.id}`,
          installerId: installer.id,
          label: '(empty)',
        });
        continue;
      }

      if (collapsed) continue;

      for (const item of items) {
        const bar = barsById.get(item.id);
        if (!bar) continue;

        const job = ganttJobsById.get(item.id);
        const scheduleItem = scheduleItemById.get(item.id) ?? null;
        const isDowntime = scheduleItem?.itemType === 'downtime';
        const isPinned = scheduleItem?.mode === 'pinned';
        const plannedCommitmentLabel = scheduleItem ? formatCommitmentLabel(scheduleItem) : null;
        const plannedFlexDays = scheduleItem ? resolvePlannedFlexDays(scheduleItem) : null;
        const plannedDurationDays =
          scheduleItem && typeof scheduleItem.plannedDurationDays === 'number' && Number.isFinite(scheduleItem.plannedDurationDays)
            ? Math.max(1, Math.trunc(scheduleItem.plannedDurationDays))
            : null;
        const driftDays =
          scheduleItem && typeof scheduleItem.driftDays === 'number' && Number.isFinite(scheduleItem.driftDays)
            ? Math.max(0, Math.trunc(scheduleItem.driftDays))
            : null;
        const clientUpdateStatus = scheduleItem?.clientUpdateStatus ?? null;
        const issueLevel = issueLevelByScheduleId.get(item.id);
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
            const movingSpan = axisSpanPx(axis, displayStart, displayEnd);
            displayLeftPx = movingSpan.leftPx;
            displayWidthPx = movingSpan.widthPx > 0 ? Math.max(movingSpan.widthPx, 8) : 0;
          } else if (ganttDrag.mode === 'resize') {
            const requestedEnd = addDaysYmd(bar.endDate, ganttDragDelta);
            const snappedEnd = snapToWeekdayYmdDirectional(requestedEnd, ganttDragDelta);
            const nextDuration = Math.max(1, workingDaysInclusive(bar.startDate, snappedEnd));
            displayEnd = addWorkingDaysInclusive(bar.startDate, nextDuration);
            const resizedSpan = axisSpanPx(axis, bar.startDate, displayEnd);
            displayLeftPx = resizedSpan.leftPx;
            displayWidthPx = resizedSpan.widthPx > 0 ? Math.max(resizedSpan.widthPx, 8) : 0;
          }
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
          durationLabel: job?.durationLabel ?? formatDuration(bar.durationHours),
          durationDays: Math.max(1, workingDaysInclusive(displayStart, displayEnd)),
          startDate: displayStart,
          endDate: displayEnd,
          barLeftPx: displayLeftPx,
          barWidthPx: displayWidthPx,
          barColor: isDowntime ? '#6b7280' : installer.color,
          ghostLeftPx: ganttDrag && ganttDrag.id === item.id ? baseBarLeftPx : undefined,
          ghostWidthPx: ganttDrag && ganttDrag.id === item.id ? baseBarWidthPx : undefined,
          isDowntime,
          isPinned,
          issueLevel,
          plannedLeftPx: planned?.leftPx,
          plannedWidthPx: planned?.widthPx,
          plannedStart: planned?.startDate,
          plannedEnd: planned?.endDate,
          plannedCommitmentLabel,
          plannedFlexDays,
          plannedDurationDays,
          driftDays,
          clientUpdateStatus,
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
    ganttHolidays,
    installers,
    laneItems,
    zoomWeeks,
    ganttJobsById,
    schedule.bars,
    scheduleItemById,
    visibleScheduleItems,
    showPlanned,
    scheduleMode,
    issueLevelByScheduleId,
    ganttDrag,
    ganttDragDelta,
    today,
    emptyGantt,
    view,
  ]);

  const handleGanttZoomWeeksChange = (next: GanttZoomWeeks) => {
    if (next === zoomWeeks) return;

    const scroller = ganttScrollRef.current;
    if (view === 'gantt' && scroller && gantt.axis.rangeDays > 0) {
      const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
      const todayViewportOffsetPx = labelWidthPx + gantt.todayLinePx - scroller.scrollLeft;
      const minVisiblePx = labelWidthPx + 8;
      const maxVisiblePx = Math.max(minVisiblePx, scroller.clientWidth - 8);
      const fallbackVisiblePx = labelWidthPx + timelineViewportWidth * 0.3;
      const viewportOffsetPx =
        todayViewportOffsetPx >= minVisiblePx && todayViewportOffsetPx <= maxVisiblePx ? todayViewportOffsetPx : fallbackVisiblePx;
      pendingZoomAnchorRef.current = {
        date: gantt.displayToday,
        viewportOffsetPx,
      };
    }

    setZoomWeeks(next);
  };

  useLayoutEffect(() => {
    if (view !== 'gantt') return;
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
    const nextScrollLeft = Math.max(0, Math.min(maxLeft, nextTodayAbsolutePx - anchor.viewportOffsetPx));

    scroller.scrollLeft = nextScrollLeft;
    pendingZoomAnchorRef.current = null;
  }, [gantt.axis.boundaryPx, gantt.axis.rangeDays, gantt.rangeStart, gantt.totalWidth, labelWidthPx, view, zoomWeeks]);

  const activeGanttPopoverRow = useMemo(() => {
    if (!ganttPopover) return null;
    for (const row of gantt.rows) {
      if (row.kind !== 'item') continue;
      if (row.scheduleItemId === ganttPopover.scheduleItemId) return row;
    }
    return null;
  }, [gantt.rows, ganttPopover]);

  const activeGanttDragRow = useMemo(() => {
    if (!ganttDrag) return null;
    for (const row of gantt.rows) {
      if (row.kind !== 'item') continue;
      if (row.scheduleItemId === ganttDrag.id) return row;
    }
    return null;
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

    const openProjectAction = () =>
      runGanttPopoverAction(() => {
        router.push(`/staff/projects/${encodeURIComponent(row.projectId)}`);
      });
    const openProjectPackAction = () =>
      runGanttPopoverAction(() => {
        router.push(`/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`);
      });
    const pinAction = () =>
      runGanttPopoverAction(() => {
        if (isPinned) {
          let jobUuid: string;
          try {
            jobUuid = uuidFromAppId(scheduleItem.projectId, 'proj');
          } catch {
            toast.error('Invalid project ID for schedule action.');
            return;
          }
          void queueUnpinJob(jobUuid, {
            successToast: 'Job unpinned.',
            errorToast: 'Failed to unpin job.',
          });
          return;
        }

        const startCandidate = scheduleItem.forecastStart ?? scheduleItem.startDateOverride ?? today;
        setPinEdit({ id: row.scheduleItemId, requestedStart: isYmd(startCandidate) ? startCandidate : '' });
      });

    const commitmentAction = () =>
      runGanttPopoverAction(() => {
        openCommitmentEdit(row.scheduleItemId, hasCommitment ? 'reschedule' : 'lock');
      });

    const ackClientUpdateAction =
      clientUpdateStatus === 'needed'
        ? () =>
            runGanttPopoverAction(() => {
              const jobUuid = resolveProjectUuid(scheduleItem);
              if (!jobUuid) return;
              void ackClientUpdate({ job_id: jobUuid })
                .then(() => {
                  applyClientAckLocally(jobUuid);
                  toast.success('Client update marked as contacted.');
                })
                .catch((err) => {
                  const msg = err instanceof Error ? err.message : 'Failed to mark client as contacted.';
                  toast.error(msg);
                });
            })
        : null;

    const details = (
      <>
        <div className={styles.ganttPopoverTitle}>{row.projectName}</div>
        <div className={styles.ganttPopoverMeta}>
          Planned: {hasCommitment ? row.plannedCommitmentLabel ?? 'Committed' : 'Draft'}
          {hasCommitment && row.plannedDurationDays ? ` · ~${row.plannedDurationDays}d` : ''}
          {hasCommitment && typeof row.plannedFlexDays === 'number' ? ` · flex ${row.plannedFlexDays}wd` : ''}
        </div>
        <div className={styles.ganttPopoverMeta}>
          Forecast: {formatShortDate(row.startDate)} → {formatShortDate(row.endDate)} · {row.durationLabel}
        </div>
        {hasCommitment && typeof row.driftDays === 'number' ? (
          <div className={styles.ganttPopoverMeta}>Drift: +{row.driftDays} working day{row.driftDays === 1 ? '' : 's'}</div>
        ) : null}
        {clientUpdateStatus === 'needed' ? <div className={styles.clientUpdatePill}>Client update needed</div> : null}
        {clientUpdateStatus === 'acknowledged' ? <div className={styles.clientAckPill}>Client contacted</div> : null}
      </>
    );

    return {
      details,
      actions: [
        {
          label: 'Open project',
          shortcut: '⏎',
          onClick: openProjectAction,
        },
        {
          label: 'Open project pack',
          onClick: openProjectPackAction,
        },
        {
          label: hasCommitment ? 'Reschedule…' : 'Lock schedule…',
          onClick: commitmentAction,
        },
        ...(ackClientUpdateAction
          ? [
              {
                label: 'Mark client contacted',
                onClick: ackClientUpdateAction,
              },
            ]
          : clientUpdateStatus === 'acknowledged'
            ? [
                {
                  label: 'Client contacted',
                  onClick: () => {},
                  disabled: true,
                },
              ]
            : []),
        {
          label: isPinned ? 'Unpin' : 'Pin…',
          shortcut: 'P',
          onClick: pinAction,
        },
      ],
      openProjectAction,
      pinAction,
    };
  }, [
    activeGanttPopoverRow,
    ganttPopover,
    router,
    runGanttPopoverAction,
    scheduleItemById,
    setPinEdit,
    today,
    toast,
  ]);

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
    const key = event.key.toLowerCase();
    if (key === 'p') {
      event.preventDefault();
      ganttPopoverDetails.pinAction?.();
    }
  };

  useEffect(() => {
    if (!ganttPopover) return;
    if (!activeGanttPopoverRow) {
      setGanttPopover(null);
      return;
    }
    const timer = window.setTimeout(() => {
      ganttPopoverRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeGanttPopoverRow, ganttPopover]);

  useEffect(() => {
    if (view === 'gantt') return;
    setGanttPopover(null);
  }, [view]);

  function formatCommitImpactList(impacts: any[]): string {
    return impacts
      .slice(0, 10)
      .map((impact) => {
        const label = typeof impact.job_id === 'string' ? impact.job_id : 'Job';
        const before = typeof impact.before_start === 'string' ? impact.before_start : '—';
        const after = typeof impact.after_start === 'string' ? impact.after_start : '—';
        return `• ${label}: ${before} → ${after}`;
      })
      .join('\n');
  }

  function refreshSchedule(): void {
    setLoadError(null);
    if (scheduleMode === 'v2') {
      setSyncing(true);
      void queryClient.invalidateQueries({ queryKey: v2SnapshotKey });
      return;
    }
    setReloadNonce((n) => n + 1);
  }

  async function runWithCommitConfirmation(
    run: (force: boolean) => Promise<any>,
    opts?: {
      successToast?: string;
      errorToast?: string;
      refreshOnError?: boolean;
      formatErrorToast?: (error: unknown, fallback: string) => string;
    },
  ): Promise<boolean> {
    if (scheduleMode === 'v2') {
      v2PendingMutationsRef.current += 1;
      setSyncing(true);
      try {
        // Commit-horizon confirmations are intentionally disabled.
        const res = await enqueueV2Mutation(() => run(true));

        if (res?.requires_confirmation) {
          throw new Error('Schedule change still requires confirmation.');
        }
        if (res && res.ok === false) {
          throw new Error('Request failed.');
        }

        const shouldApplyResponseNow = v2PendingMutationsRef.current <= 1;
        const applied = res && res.ok ? (shouldApplyResponseNow ? applyV2MutationResponse(res as ScheduleMutationResult) : true) : false;
        if (!applied) refreshSchedule();

        if (opts?.successToast) toast.success(opts.successToast);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update schedule.';
        const fallback = opts?.errorToast ?? msg;
        toast.error(opts?.formatErrorToast ? opts.formatErrorToast(err, fallback) : fallback);
        if (opts?.refreshOnError !== false && v2PendingMutationsRef.current <= 1) refreshSchedule();
        return false;
      } finally {
        v2PendingMutationsRef.current = Math.max(0, v2PendingMutationsRef.current - 1);
        if (v2PendingMutationsRef.current === 0 && !v2SnapshotQuery.isFetching) {
          setSyncing(false);
        }
      }
    }

    try {
      // Commit-horizon confirmations are intentionally disabled.
      const res = await run(true);

      if (res?.requires_confirmation) {
        throw new Error('Schedule change still requires confirmation.');
      }
      if (res && res.ok === false) {
        throw new Error('Request failed.');
      }

      if (opts?.successToast) toast.success(opts.successToast);
      refreshSchedule();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update schedule.';
      const fallback = opts?.errorToast ?? msg;
      toast.error(opts?.formatErrorToast ? opts.formatErrorToast(err, fallback) : fallback);
      return false;
    }
  }

  function isObjectRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function compactAssignDiagnosticText(value: string): string {
    const trimmed = value.trim();
    return trimmed.length > 180 ? `${trimmed.slice(0, 177)}...` : trimmed;
  }

  function assignDiagnosticMessage(body: unknown): string | null {
    const diagnostic = isObjectRecord(body) && isObjectRecord(body.diagnostic) ? body.diagnostic : null;
    if (!diagnostic) return null;

    const rawCode = typeof diagnostic.errorCode === 'string' ? diagnostic.errorCode.trim() : '';
    const rawMessage = typeof diagnostic.errorMessage === 'string' ? diagnostic.errorMessage.trim() : '';
    const code = rawCode ? compactAssignDiagnosticText(rawCode) : '';
    const message = rawMessage ? compactAssignDiagnosticText(rawMessage) : '';
    if (code && message) return `${code}: ${message}`;
    return code || message || null;
  }

  function formatAssignMutationErrorToast(error: unknown, fallback: string): string {
    if (error instanceof ApiError) {
      if ([400, 404, 409, 501].includes(error.status) && error.message) return error.message;
      if (error.status >= 500 && error.requestId) {
        const diagnosticMessage = assignDiagnosticMessage(error.body);
        return diagnosticMessage ? `${fallback} ${diagnosticMessage}. Reference: ${error.requestId}.` : `${fallback} Reference: ${error.requestId}.`;
      }
    }
    return fallback;
  }

  const resolveProjectUuid = (item: ScheduleItem): string | null => {
    try {
      return uuidFromAppId(item.projectId, 'proj');
    } catch {
      toast.error('Invalid project ID for schedule action.');
      return null;
    }
  };

  const resolveCrewUuid = (installerId: string): string | null => {
    try {
      return uuidFromAppId(installerId, 'crew');
    } catch {
      toast.error('Invalid crew ID for schedule action.');
      return null;
    }
  };

  const applyClientAckLocally = (jobUuid: string) => {
    if (scheduleMode !== 'v2') return;
    const projectId = safeAppIdFromUuid('proj', jobUuid);
    const ackAt = nowIso();
    const nextItems = scheduleItemsRef.current.map((item) => {
      if (item.itemType === 'downtime') return item;
      if (item.projectId !== projectId) return item;
      return {
        ...item,
        clientUpdateStatus: 'acknowledged' as const,
        clientUpdateAckAt: ackAt,
        updatedAt: ackAt,
      };
    });
    setV2LocalState(
      {
        scheduleItems: nextItems,
        unscheduledJobsSeed: unscheduledJobsSeedRef.current,
        scheduleConflicts: scheduleConflictsRef.current,
        nextAvailableByInstallerId: nextAvailRef.current,
      },
      nextV2GeneratedAt(),
    );
  };

  const applyOptimisticJobPatchByProject = (
    projectId: string,
    patch: (item: ScheduleItem) => ScheduleItem,
  ): boolean => {
    if (scheduleMode !== 'v2') return false;
    const current = scheduleItemsRef.current;
    let changed = false;
    const nextItems = current.map((item) => {
      if (item.itemType === 'downtime') return item;
      if (item.projectId !== projectId) return item;
      const next = patch(item);
      if (next !== item) changed = true;
      return next;
    });
    if (!changed) return false;
    applyV2OptimisticState(nextItems, unscheduledJobsSeedRef.current);
    return true;
  };

  const runOptimisticUnpin = (jobUuid: string): void => {
    const projectId = safeAppIdFromUuid('proj', jobUuid);
    const updatedAt = nowIso();
    applyOptimisticJobPatchByProject(projectId, (item) => ({
      ...item,
      mode: 'floating',
      updatedAt,
    }));
  };

  const runOptimisticPin = (jobUuid: string, requestedStart: string): void => {
    const projectId = safeAppIdFromUuid('proj', jobUuid);
    const snappedStart = snapToWeekdayYmd(requestedStart);
    const updatedAt = nowIso();
    applyOptimisticJobPatchByProject(projectId, (item) => {
      const durationDays = durationDaysFromScheduleItem(item);
      const endInclusive = addWorkingDaysInclusive(snappedStart, durationDays);
      return {
        ...item,
        mode: 'pinned',
        forecastStart: snappedStart,
        forecastEndExclusive: addDaysYmd(endInclusive, 1),
        forecastDurationDays: durationDays,
        startDateOverride: snappedStart,
        durationHoursOverride: durationDays * WORK_HOURS_PER_DAY,
        updatedAt,
      };
    });
  };

  const runOptimisticDurationUpdate = (jobUuid: string, durationDays: number): void => {
    const projectId = safeAppIdFromUuid('proj', jobUuid);
    const nextDuration = Math.max(1, Math.round(durationDays));
    const updatedAt = nowIso();
    applyOptimisticJobPatchByProject(projectId, (item) => ({
      ...item,
      forecastDurationDays: nextDuration,
      durationHoursOverride: nextDuration * WORK_HOURS_PER_DAY,
      updatedAt,
    }));
  };

  const runOptimisticMarkInProgress = (jobUuid: string): void => {
    const projectId = safeAppIdFromUuid('proj', jobUuid);
    const updatedAt = nowIso();
    applyOptimisticJobPatchByProject(projectId, (item) => ({
      ...item,
      jobStatus: 'in_progress',
      scheduleStatus: 'IN_PROGRESS',
      actualStartDate: item.actualStartDate ?? item.forecastStart ?? today,
      updatedAt,
    }));
  };

  const runOptimisticDaysRemaining = (jobUuid: string, daysRemaining: number): void => {
    const projectId = safeAppIdFromUuid('proj', jobUuid);
    const nextDays = Math.max(1, Math.round(daysRemaining));
    const updatedAt = nowIso();
    applyOptimisticJobPatchByProject(projectId, (item) => ({
      ...item,
      jobStatus: item.jobStatus === 'done' ? 'done' : 'in_progress',
      scheduleStatus: item.scheduleStatus === 'COMPLETED' ? 'COMPLETED' : 'IN_PROGRESS',
      daysRemaining: nextDays,
      actualStartDate: item.actualStartDate ?? item.forecastStart ?? today,
      updatedAt,
    }));
  };

  const queueUnpinJob = (jobUuid: string, opts?: { successToast?: string; errorToast?: string }) => {
    runOptimisticUnpin(jobUuid);
    return runWithCommitConfirmation((force) => unpinJob({ job_id: jobUuid, force, today }), opts);
  };

  const queuePinJob = (jobUuid: string, requestedStart: string, opts?: { successToast?: string; errorToast?: string }) => {
    runOptimisticPin(jobUuid, requestedStart);
    return runWithCommitConfirmation((force) => pinJob({ job_id: jobUuid, requested_start_date: requestedStart, force, today }), opts);
  };

  const queueSetDurationJob = (jobUuid: string, durationDays: number, opts?: { successToast?: string; errorToast?: string }) => {
    runOptimisticDurationUpdate(jobUuid, durationDays);
    return runWithCommitConfirmation((force) => setJobDuration({ job_id: jobUuid, forecast_duration_days: durationDays, force, today }), opts);
  };

  const queueMarkInProgressJob = (jobUuid: string, opts?: { successToast?: string; errorToast?: string }) => {
    runOptimisticMarkInProgress(jobUuid);
    return runWithCommitConfirmation((force) => markJobInProgress({ job_id: jobUuid, force, today }), opts);
  };

  const queueSetDaysRemainingJob = (jobUuid: string, daysRemaining: number, opts?: { successToast?: string; errorToast?: string }) => {
    runOptimisticDaysRemaining(jobUuid, daysRemaining);
    return runWithCommitConfirmation((force) => setDaysRemaining({ job_id: jobUuid, days_remaining: daysRemaining, force, today }), opts);
  };

  const scheduleItemByIdRef = useRef(scheduleItemById);
  const runWithCommitConfirmationRef = useRef(runWithCommitConfirmation);
  const resolveProjectUuidRef = useRef(resolveProjectUuid);
  const todayRef = useRef(today);

  useEffect(() => {
    scheduleItemByIdRef.current = scheduleItemById;
  }, [scheduleItemById]);

  useEffect(() => {
    runWithCommitConfirmationRef.current = runWithCommitConfirmation;
  }, [runWithCommitConfirmation]);

  useEffect(() => {
    resolveProjectUuidRef.current = resolveProjectUuid;
  }, [resolveProjectUuid]);

  useEffect(() => {
    todayRef.current = today;
  }, [today]);

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
      let nextDelta = rawDelta;
      if (ganttDrag.mode === 'move') {
        const requestedStart = addDaysYmd(ganttDrag.startDate, rawDelta);
        const snappedStart = snapToWeekdayYmdDirectional(requestedStart, rawDelta);
        nextDelta = diffDaysYmd(ganttDrag.startDate, snappedStart);
      } else {
        const requestedEnd = addDaysYmd(ganttDrag.endDate, rawDelta);
        const snappedEnd = snapToWeekdayYmdDirectional(requestedEnd, rawDelta);
        nextDelta = diffDaysYmd(ganttDrag.endDate, snappedEnd);
      }
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

      const jobUuid = resolveProjectUuidRef.current(item);
      if (!jobUuid) return;

      const todayValue = todayRef.current;

      if (ganttDrag.mode === 'move') {
        const requested = addDaysYmd(ganttDrag.startDate, deltaDays);
        const snapped = snapToWeekdayYmdDirectional(requested, deltaDays);

        const optimisticItems = scheduleItemsRef.current.map((item) => {
          if (item.id !== ganttDrag.id || item.itemType === 'downtime') return item;
          const durationDays = Math.max(1, ganttDrag.durationDays);
          const snappedEnd = addWorkingDaysInclusive(snapped, durationDays);
          const endExclusive = addDaysYmd(snappedEnd, 1);
          return {
            ...item,
            mode: 'pinned' as const,
            forecastStart: snapped,
            forecastEndExclusive: endExclusive,
            forecastDurationDays: durationDays,
            startDateOverride: snapped,
            durationHoursOverride: durationDays * WORK_HOURS_PER_DAY,
            updatedAt: new Date().toISOString(),
          };
        });
        applyV2OptimisticState(optimisticItems, unscheduledJobsSeedRef.current);

        void (async () => {
          await runWithCommitConfirmationRef.current(
            (force) => pinJob({ job_id: jobUuid, requested_start_date: snapped, force, today: todayValue }),
            { successToast: 'Job pinned.', errorToast: 'Failed to pin job.' },
          );
        })();
        return;
      }

      const baseStart = item.forecastStart ?? ganttDrag.startDate;
      const snappedStart = snapToWeekdayYmd(baseStart);
      const requestedEnd = addDaysYmd(ganttDrag.endDate, deltaDays);
      const snappedEnd = snapToWeekdayYmdDirectional(requestedEnd, deltaDays);
      const nextDuration = Math.max(1, workingDaysInclusive(snappedStart, snappedEnd));

      const optimisticItems = scheduleItemsRef.current.map((scheduleItem) => {
        if (scheduleItem.id !== ganttDrag.id || scheduleItem.itemType === 'downtime') return scheduleItem;
        const computedEnd = addWorkingDaysInclusive(snappedStart, nextDuration);
        const endExclusive = addDaysYmd(computedEnd, 1);
        return {
          ...scheduleItem,
          mode: 'pinned' as const,
          forecastStart: snappedStart,
          forecastEndExclusive: endExclusive,
          forecastDurationDays: nextDuration,
          startDateOverride: snappedStart,
          durationHoursOverride: nextDuration * WORK_HOURS_PER_DAY,
          updatedAt: new Date().toISOString(),
        };
      });
      applyV2OptimisticState(optimisticItems, unscheduledJobsSeedRef.current);

      void (async () => {
        const ok = await runWithCommitConfirmationRef.current(
          (force) => setJobDuration({ job_id: jobUuid, forecast_duration_days: nextDuration, force, today: todayValue }),
          { successToast: 'Duration updated.', errorToast: 'Failed to update duration.' },
        );
        if (!ok) return;

        // server pins too (keep consistent). If this fails, rollback is not required; refetch will correct.
        await runWithCommitConfirmationRef.current(
          (force) => pinJob({ job_id: jobUuid, requested_start_date: snappedStart, force, today: todayValue }),
          { successToast: 'Job pinned.', errorToast: 'Failed to pin job.' },
        );
      })();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [gantt.axis.baseDayPx, gantt.rangeDays, ganttDrag]);

  useEffect(() => {
    if (!ganttLabelResize) return;

    const onMove = (event: PointerEvent) => {
      const deltaX = event.clientX - ganttLabelResize.startX;
      setLabelWidthPx(clampGanttLabelWidth(ganttLabelResize.startWidth + deltaX));
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

  const shouldBlockGanttClick = () => {
    if (typeof window === 'undefined') return false;
    return Date.now() < ganttClickBlockUntilRef.current;
  };

  const toggleCrewCollapsed = (installerId: string) => {
    startUiTransition(() => {
      setCollapsedCrews((prev) => ({ ...prev, [installerId]: !prev[installerId] }));
    });
  };

  const jumpGanttToToday = () => {
    const scroller = ganttScrollRef.current;
    if (!scroller) return;
    const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
    const todayAbsolutePx = labelWidthPx + gantt.todayLinePx;
    const targetLeft = Math.max(0, todayAbsolutePx - (labelWidthPx + timelineViewportWidth * 0.3));
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollTo({
      left: Math.min(maxLeft, targetLeft),
      behavior: 'smooth',
    });
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
      anchor: {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    });
  };

  const beginGanttDrag = (
    row: {
      scheduleItemId: string;
      startDate: string;
      endDate: string;
      durationDays: number;
      isDowntime?: boolean;
    },
    mode: 'move' | 'resize',
    e: React.PointerEvent,
  ) => {
    if (scheduleMode !== 'v2') return;
    if (row.isDowntime) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setGanttPopover(null);
    const durationDays = Math.max(1, Math.trunc(row.durationDays));
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
      durationDays,
    });
    try {
      const target = e.currentTarget as HTMLElement | null;
      target?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  };

  function rectFromElement(element: Element | null | undefined): BoardDragRect | null {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function dragPointFromEvent(event: DragMoveEvent | DragEndEvent): BoardDragPoint | null {
    const rect = ((event.active.rect?.current as any)?.translated ?? (event.active.rect?.current as any)?.initial) as
      | { left: number; top: number; width: number; height: number }
      | undefined;
    if (!rect) return null;
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  function buildBoardDragLanes(): BoardDragLane[] {
    return installers
      .filter((installer) => installer.active)
      .map((installer) => {
        const items = laneItems.get(installer.id) ?? [];
        const itemRects: BoardDragLane['itemRects'] = {};
        for (const item of items) {
          itemRects[item.id] = rectFromElement(boardCardRefs.current.get(item.id));
        }
        return {
          id: installer.id,
          itemIds: items.map((item) => item.id),
          rect: rectFromElement(laneBodyRefs.current.get(installer.id) ?? null),
          itemRects,
        };
      });
  }

  function resolveBoardDrop(event: DragMoveEvent | DragEndEvent): BoardDropTarget {
    const activeId = String(event.active.id);
    const eventOverId = event.over ? String(event.over.id) : null;
    const activeItem = scheduleItemsRef.current.find((item) => item.id === activeId) ?? null;
    return resolveBoardDropTarget({
      activeId,
      sourceLaneId: activeItem?.installerId ?? null,
      overId: eventOverId,
      point: dragPointFromEvent(event),
      lanes: buildBoardDragLanes(),
      unscheduledRect: rectFromElement(unscheduledBodyRef.current),
    });
  }

  function applyBoardDropTarget(target: BoardDropTarget): void {
    setBoardDropTarget(target);
    if (!target.valid) {
      setOverId(null);
      setOverLaneId(null);
      return;
    }
    if (target.kind === 'unscheduled') {
      setOverId('unscheduled');
      setOverLaneId(null);
      return;
    }
    setOverId(target.overId);
    setOverLaneId(target.laneId);
  }

  function clearBoardDragState(): void {
    setActiveDragId(null);
    setOverId(null);
    setOverLaneId(null);
    setBoardDropTarget(null);
  }

  function handleDragMove(event: DragMoveEvent) {
    if (view !== 'board') return;
    if (!activeDragId) return;

    const target = resolveBoardDrop(event);
    applyBoardDropTarget(target);

    const point = dragPointFromEvent(event);
    if (!point) return;

    const EDGE_PX = 80;
    const STEP_PX = 32;

    const board = boardScrollRef.current;
    if (board) {
      const br = board.getBoundingClientRect();
      if (point.x < br.left + EDGE_PX) board.scrollLeft -= STEP_PX;
      else if (point.x > br.right - EDGE_PX) board.scrollLeft += STEP_PX;
    }

    const verticalTarget =
      target.valid && target.kind === 'unscheduled'
        ? unscheduledBodyRef.current
        : target.valid && target.kind === 'lane'
          ? laneBodyRefs.current.get(target.laneId) ?? null
          : null;
    if (verticalTarget) {
      const vr = verticalTarget.getBoundingClientRect();
      if (point.y < vr.top + EDGE_PX) verticalTarget.scrollTop -= STEP_PX;
      else if (point.y > vr.bottom - EDGE_PX) verticalTarget.scrollTop += STEP_PX;
    }
  }

  async function persist(
    next: ScheduleItem[],
    opts?: { successToast?: string; errorToast?: string },
  ): Promise<boolean> {
    if (scheduleMode === 'v2') {
      toast.error('Schedule v2 changes must be applied via the new endpoints. Refresh and try again.');
      return false;
    }
    const prev = scheduleItems;
    setScheduleItems(next);
    tryWriteScheduleSnapshotToCache({ installers, projects, scheduleItems: next, estimatesById });

    try {
      const renderable = next.filter((i) => projectsById.has(i.projectId));
      const build = buildScheduleBars({ today, installers, scheduleItems: renderable, projectsById, estimatesById });
      const barsById = new Map(build.bars.map((b) => [b.scheduleItemId, { startDate: b.startDate, endDate: b.endDate, durationHours: b.durationHours }]));
      const persisted = await replaceScheduleItems(next, { barsById, today });
      setScheduleItems(persisted);
      tryWriteScheduleSnapshotToCache({ installers, projects, scheduleItems: persisted, estimatesById });
      if (opts?.successToast) toast.success(opts.successToast);
      return true;
    } catch (err) {
      setScheduleItems(prev);
      tryWriteScheduleSnapshotToCache({ installers, projects, scheduleItems: prev, estimatesById });
      const msg = err instanceof Error ? err.message : 'Failed to update schedule.';
      toast.error(opts?.errorToast ?? msg);
      return false;
    }
  }

  async function handleUnschedule(id: string, options?: { optimisticAlreadyApplied?: boolean }): Promise<boolean> {
    if (scheduleMode === 'v2') {
      const item = scheduleItemById.get(id) ?? null;
      if (!item || item.itemType === 'downtime') return false;
      const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
      if (isLockedScheduleStatus(status) && typeof window !== 'undefined') {
        const ok = window.confirm(`This job is ${scheduleStatusLabel(status)}. Unschedule anyway?`);
        if (!ok) return false;
      }
      let projectUuid: string;
      try {
        projectUuid = uuidFromAppId(item.projectId, 'proj');
      } catch {
        toast.error('Invalid project ID for unscheduling.');
        return false;
      }
      if (!options?.optimisticAlreadyApplied) {
        const optimistic = optimisticUnassign(scheduleItemsRef.current, unscheduledJobsSeedRef.current, id, projectsById);
        applyV2OptimisticState(optimistic.items, optimistic.unscheduledSeed);
      }
      return await runWithCommitConfirmation((force) => unassignJob({ job_id: projectUuid, force, today }), {
        successToast: 'Job unscheduled.',
        errorToast: 'Failed to unschedule job.',
      });
    }

    const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
    if (isLockedScheduleStatus(status) && typeof window !== 'undefined') {
      const ok = window.confirm(`This job is ${scheduleStatusLabel(status)}. Unschedule anyway?`);
      if (!ok) return false;
    }
    const next = scheduleItems.filter((i) => i.id !== id);
    return await persist(next, { successToast: 'Job unscheduled.', errorToast: 'Failed to unschedule job.' });
  }

  async function handleConfirmSchedule(id: string) {
    if (scheduleMode === 'v2') {
      toast.info('Schedule confirmations are not used in V2.');
      return;
    }
    try {
      const res = await confirmScheduleItem(id);
      setScheduleItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                scheduleStatus: normalizeScheduleStatus(res.status),
                locked: true,
                confirmedAt: res.confirmedAt ?? it.confirmedAt ?? null,
                confirmedBy: res.confirmedBy ?? it.confirmedBy ?? null,
              }
            : it,
        ),
      );
      toast.success('Schedule confirmed.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        toast.error('Schedule schema not upgraded yet. Run supabase/schedule_engine.sql then refresh.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to confirm schedule.';
      toast.error(msg);
    }
  }

  async function handleUnlockSchedule(id: string) {
    if (scheduleMode === 'v2') {
      toast.info('Schedule locks are not used in V2.');
      return;
    }
    const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
    const needsForce = status === 'IN_PROGRESS';
    const force = needsForce && typeof window !== 'undefined' ? window.confirm('This job is in progress. Unlock anyway?') : false;
    if (needsForce && !force) return;

    try {
      await unlockScheduleItem(id, { force });
      setScheduleItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? {
                ...it,
                scheduleStatus: 'TENTATIVE',
                locked: false,
                confirmedAt: null,
                confirmedBy: null,
              }
            : it,
        ),
      );
      toast.success('Schedule unlocked.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && needsForce && typeof window !== 'undefined') {
        const ok = window.confirm('Unlock requires confirmation. Unlock anyway?');
        if (!ok) return;
        void handleUnlockSchedule(id);
        return;
      }
      if (err instanceof ApiError && err.status === 501) {
        toast.error('Schedule schema not upgraded yet. Run supabase/schedule_engine.sql then refresh.');
        return;
      }
      const msg = err instanceof Error ? err.message : 'Failed to unlock schedule.';
      toast.error(msg);
    }
  }

  async function handleRemoveOrphanedScheduleItems() {
    if (scheduleMode === 'v2') {
      toast.info('Orphan cleanup is not available in Schedule V2 yet.');
      return;
    }
    if (cleanupBusy) return;
    if (!orphanedScheduleItems.length) return;

    setCleanupBusy(true);
    try {
      const candidates = orphanedScheduleItems.slice();
      const uniqueProjectIds = Array.from(new Set(candidates.map((i) => i.projectId)));

      // Confirm missing foreign keys via authoritative lookup (do not delete based on list-join alone).
      const missingProjectIds = new Set<string>();
      for (const projectId of uniqueProjectIds) {
        const project = await getProject(projectId).catch(() => null);
        if (!project) missingProjectIds.add(projectId);
      }

      const confirmedOrphans = candidates.filter((i) => missingProjectIds.has(i.projectId));
      const count = confirmedOrphans.length;
      if (!count) {
        toast.info('No orphaned schedule items found.');
        return;
      }

      if (typeof window !== 'undefined') {
        const ok = window.confirm(`Remove ${count} orphaned schedule item(s)? This cannot be undone.`);
        if (!ok) return;
      }

      const orphanIds = new Set(confirmedOrphans.map((i) => i.id));
      const nextItems = scheduleItems.filter((i) => !orphanIds.has(i.id));
      const okPersisted = await persist(nextItems, { successToast: `Removed ${count} orphaned schedule items` });
      if (!okPersisted) return;
      refreshSchedule();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove orphaned schedule items.';
      toast.error(msg);
    } finally {
      setCleanupBusy(false);
    }
  }

  const openQuickEdit = (id: string) => {
    if (scheduleMode === 'v2') {
      toast.info('Use the actions menu to update duration or pinning in Schedule V2.');
      return;
    }
    const item = scheduleItemById.get(id) ?? null;
    if (!item) {
      toast.error('Quick edit unavailable: schedule item not found. Try refreshing the page.');
      if (process.env.NODE_ENV === 'development') {
        console.warn('[schedule] Quick edit: schedule item not found', { id });
      }
      return;
    }
    if (item.itemType === 'downtime') {
      toast.info('Downtime blocks can be edited from their own actions.');
      return;
    }
    const status = scheduleStatusById.get(id) ?? deriveScheduleStatus(item, today);
    if (isLockedScheduleStatus(status)) {
      toast.info(`${scheduleStatusLabel(status)} jobs are locked. Unlock to edit.`);
      return;
    }
    const job = schedulable.jobsById.get(id) ?? null;
    const durationHours = typeof item.durationHoursOverride === 'number' ? item.durationHoursOverride : job?.durationHours ?? WORK_HOURS_PER_DAY;
    const durationDays = durationHours > 0 ? String(Math.max(0.5, Math.round((durationHours / WORK_HOURS_PER_DAY) * 2) / 2)) : '1';
    const startCandidate = barsByScheduleId.get(id)?.startDate ?? item.startDateOverride ?? '';
    setQuickEdit({ id, startDateOverride: isYmd(startCandidate) ? startCandidate : '', durationDays });
  };

  const openCommitmentEdit = (id: string, mode: 'lock' | 'reschedule') => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Schedule commitment is only available for scheduled jobs.');
      return;
    }

    const existingCommitmentType = resolveCommitmentType(item);
    const hasCommitment = hasPlannedCommitment(item);
    const commitmentType: 'week_of' | 'fixed_date' = existingCommitmentType ?? 'week_of';

    const baseStart = item.forecastStart ?? item.startDateOverride ?? today;
    const safeBaseStart = isYmd(baseStart) ? baseStart : today;
    const weekOfDate = item.plannedWeekStart ?? (item.plannedStart ? startOfWeekMonday(item.plannedStart) : startOfWeekMonday(safeBaseStart));
    const startDate = item.plannedStart ?? safeBaseStart;

    const fallbackDurationDays =
      typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? Math.max(1, Math.trunc(item.forecastDurationDays))
        : typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? Math.max(1, Math.ceil(item.durationHoursOverride / WORK_HOURS_PER_DAY))
          : 1;

    const durationDays =
      typeof item.plannedDurationDays === 'number' && Number.isFinite(item.plannedDurationDays) && item.plannedDurationDays > 0
        ? Math.max(1, Math.trunc(item.plannedDurationDays))
        : fallbackDurationDays;
    const flexDays = resolvePlannedFlexDays(item) ?? (commitmentType === 'week_of' ? 4 : 1);

    const defaultHardLock = commitmentType === 'fixed_date';
    const hardLock = hasCommitment ? item.mode === 'pinned' : defaultHardLock;

    setCommitmentEdit({
      id,
      mode,
      commitmentType,
      weekOfDate,
      startDate,
      durationDays: String(durationDays),
      flexDays: String(flexDays),
      hardLock,
    });
  };

  const openDurationEdit = (id: string) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Duration edit is only available for scheduled jobs.');
      return;
    }
    const job = schedulable.jobsById.get(id) ?? null;
    const durationDays =
      typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? item.forecastDurationDays
        : typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? Math.ceil(item.durationHoursOverride / WORK_HOURS_PER_DAY)
          : job && Number.isFinite(job.durationHours) && job.durationHours > 0
            ? Math.ceil(job.durationHours / WORK_HOURS_PER_DAY)
            : 1;
    setDurationEdit({ id, durationDays: String(Math.max(1, Math.round(durationDays))) });
  };

  const openPinEdit = (id: string) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Pinning is only available for scheduled jobs.');
      return;
    }
    const startCandidate = item.forecastStart ?? item.startDateOverride ?? today;
    setPinEdit({ id, requestedStart: isYmd(startCandidate) ? startCandidate : '' });
  };

  const openDaysRemainingEdit = (id: string) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Days remaining is only available for scheduled jobs.');
      return;
    }
    const days =
      typeof item.daysRemaining === 'number' && Number.isFinite(item.daysRemaining) && item.daysRemaining > 0
        ? item.daysRemaining
        : 1;
    setDaysRemainingEdit({ id, daysRemaining: String(Math.max(1, Math.round(days))) });
  };

  const openCreateDowntimeAfter = (item: ScheduleItem) => {
    const lane = laneItems.get(item.installerId) ?? [];
    const index = lane.findIndex((i) => i.id === item.id);
    const position = index >= 0 ? index + 1 : lane.length;
    setDowntimeEdit({
      mode: 'create',
      crewId: item.installerId,
      position,
      durationDays: '1',
      reason: 'other',
      note: '',
    });
  };

  const openEditDowntime = (item: ScheduleItem) => {
    if (!item.downtimeId) {
      toast.error('Downtime details are missing. Refresh and try again.');
      return;
    }
    const durationDays =
      typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? item.forecastDurationDays
        : typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
          ? Math.ceil(item.durationHoursOverride / WORK_HOURS_PER_DAY)
          : 1;
    setDowntimeEdit({
      mode: 'edit',
      crewId: item.installerId,
      position: item.sortIndex,
      downtimeId: item.downtimeId,
      durationDays: String(Math.max(1, Math.round(durationDays))),
      reason: item.downtimeReason ?? 'other',
      note: item.downtimeNote ?? '',
    });
  };

  const handleMarkDoneV2 = async (item: ScheduleItem) => {
    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;
    v2PendingMutationsRef.current += 1;
    setSyncing(true);
    try {
      const res: any = await enqueueV2Mutation(() => markJobDone({ job_id: jobUuid, today }));
      if (res?.requires_finish_early) {
        setFinishEarlyPrompt({
          jobId: jobUuid,
          scheduleItemId: item.id,
          freedDays: typeof res.freed_days === 'number' ? res.freed_days : 0,
          actualFinish: typeof res.actual_finish === 'string' ? res.actual_finish : today,
          forecastEndExclusive: typeof res.forecast_end_exclusive === 'string' ? res.forecast_end_exclusive : null,
          impacts: Array.isArray(res.impacts) ? res.impacts : [],
        });
        return;
      }
      let finalResult = res;
      if (res?.requires_confirmation) {
        finalResult = await enqueueV2Mutation(() => markJobDone({ job_id: jobUuid, force: true, today }));
      }
      if (!finalResult?.ok) {
        throw new Error('Failed to mark job done.');
      }
      const shouldApplyResponseNow = v2PendingMutationsRef.current <= 1;
      const applied = shouldApplyResponseNow ? applyV2MutationResponse(finalResult as ScheduleMutationResult) : true;
      if (!applied) refreshSchedule();
      toast.success('Job marked done.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark job done.';
      toast.error(msg);
      if (v2PendingMutationsRef.current <= 1) refreshSchedule();
    } finally {
      v2PendingMutationsRef.current = Math.max(0, v2PendingMutationsRef.current - 1);
      if (v2PendingMutationsRef.current === 0 && !v2SnapshotQuery.isFetching) {
        setSyncing(false);
      }
    }
  };

  function runGanttPopoverAction(action: (() => void) | null | undefined) {
    if (!action) return;
    setGanttPopover(null);
    window.setTimeout(() => action(), 0);
  }

  function buildDowntimeMenuActions(id: string, scheduleItem: ScheduleItem): MenuAction[] {
    if (scheduleMode === 'v2') {
      return [
        {
          label: 'Edit downtime…',
          onClick: () => openEditDowntime(scheduleItem),
        },
        {
          label: 'Delete downtime',
          tone: 'danger',
          onClick: () => {
            if (!scheduleItem.downtimeId) {
              toast.error('Downtime record not found.');
              return;
            }
            if (typeof window !== 'undefined') {
              const ok = window.confirm('Delete this downtime block? This cannot be undone.');
              if (!ok) return;
            }
            void runWithCommitConfirmation(
              (force) => deleteDowntime({ downtime_id: scheduleItem.downtimeId as string, force, today }),
              { successToast: 'Downtime deleted.', errorToast: 'Failed to delete downtime.' },
            );
          },
        },
      ];
    }

    return [
      {
        label: 'Remove downtime',
        tone: 'danger',
        onClick: () => void handleUnschedule(id),
      },
    ];
  }

  function buildJobMenuActions({
    id,
    scheduleItem,
    job,
    scheduleStatus,
  }: {
    id: string;
    scheduleItem: ScheduleItem;
    job: SchedulableJob | null;
    scheduleStatus: ScheduleItemStatus;
  }): MenuAction[] {
    if (scheduleItem.itemType === 'downtime') return [];

    const jobStatus = scheduleItem.jobStatus ?? null;
    const isInProgress = jobStatus === 'in_progress' || jobStatus === 'paused';
    const isDone = jobStatus === 'done';
    const isPinned = scheduleItem.mode === 'pinned';
    const hasCommitment = hasPlannedCommitment(scheduleItem);
    const clientUpdateStatus = scheduleItem.clientUpdateStatus ?? 'none';
    const baseDurationDays =
      typeof scheduleItem.forecastDurationDays === 'number' && Number.isFinite(scheduleItem.forecastDurationDays) && scheduleItem.forecastDurationDays > 0
        ? scheduleItem.forecastDurationDays
        : typeof scheduleItem.durationHoursOverride === 'number' && Number.isFinite(scheduleItem.durationHoursOverride) && scheduleItem.durationHoursOverride > 0
          ? Math.ceil(scheduleItem.durationHoursOverride / WORK_HOURS_PER_DAY)
          : job && Number.isFinite(job.durationHours) && job.durationHours > 0
            ? Math.ceil(job.durationHours / WORK_HOURS_PER_DAY)
            : 1;

    if (scheduleMode === 'v2') {
      const v2Actions: MenuAction[] = [];
      if (!isDone) {
        v2Actions.push({
          label: hasCommitment ? 'Reschedule…' : 'Lock schedule…',
          onClick: () => openCommitmentEdit(id, hasCommitment ? 'reschedule' : 'lock'),
        });
      }

      if (clientUpdateStatus === 'needed') {
        v2Actions.push({
          label: 'Mark client contacted',
          onClick: () => {
            const jobUuid = resolveProjectUuid(scheduleItem);
            if (!jobUuid) return;
            void ackClientUpdate({ job_id: jobUuid })
              .then(() => {
                applyClientAckLocally(jobUuid);
                toast.success('Client update marked as contacted.');
              })
              .catch((err) => {
                const msg = err instanceof Error ? err.message : 'Failed to mark client as contacted.';
                toast.error(msg);
              });
          },
        });
      } else if (clientUpdateStatus === 'acknowledged') {
        v2Actions.push({
          label: 'Client contacted',
          disabled: true,
          onClick: () => {},
        });
      }

      if (!isInProgress && !isDone) {
        v2Actions.push({
          label: isPinned ? 'Unpin' : 'Pin…',
          onClick: () => {
            if (isPinned) {
              const jobUuid = resolveProjectUuid(scheduleItem);
              if (!jobUuid) return;
              void queueUnpinJob(jobUuid, {
                successToast: 'Job unpinned.',
                errorToast: 'Failed to unpin job.',
              });
              return;
            }
            openPinEdit(id);
          },
        });
        v2Actions.push({
          label: 'Set duration…',
          onClick: () => openDurationEdit(id),
        });
        v2Actions.push({
          label: 'Extend +1 day',
          onClick: () => {
            const jobUuid = resolveProjectUuid(scheduleItem);
            if (!jobUuid) return;
            const nextDays = Math.max(1, Math.round(baseDurationDays + 1));
            void queueSetDurationJob(
              jobUuid,
              nextDays,
              { successToast: 'Duration extended.', errorToast: 'Failed to update duration.' },
            );
          },
        });
        v2Actions.push({
          label: 'Extend +2 days',
          onClick: () => {
            const jobUuid = resolveProjectUuid(scheduleItem);
            if (!jobUuid) return;
            const nextDays = Math.max(1, Math.round(baseDurationDays + 2));
            void queueSetDurationJob(
              jobUuid,
              nextDays,
              { successToast: 'Duration extended.', errorToast: 'Failed to update duration.' },
            );
          },
        });
      }

      v2Actions.push({
        label: 'Add delay…',
        onClick: () => openCreateDowntimeAfter(scheduleItem),
      });

      if (!isInProgress && !isDone) {
        v2Actions.push({
          label: 'Mark in progress',
          onClick: () => {
            const jobUuid = resolveProjectUuid(scheduleItem);
            if (!jobUuid) return;
            void queueMarkInProgressJob(jobUuid, {
              successToast: 'Job marked in progress.',
              errorToast: 'Failed to mark job in progress.',
            });
          },
        });
      }

      if (isInProgress) {
        v2Actions.push({
          label: 'Set days remaining…',
          onClick: () => openDaysRemainingEdit(id),
        });
      }

      if (!isDone) {
        v2Actions.push({
          label: 'Mark done',
          onClick: () => {
            void handleMarkDoneV2(scheduleItem);
          },
        });
      }

      v2Actions.push({
        label: 'Unschedule',
        tone: 'danger',
        onClick: () => void handleUnschedule(id),
      });

      return v2Actions;
    }

    const locked = isLockedScheduleStatus(scheduleStatus);
    const legacyActions: MenuAction[] = [
      ...(scheduleStatus === 'TENTATIVE'
        ? [
            {
              label: 'Confirm dates',
              onClick: () => void handleConfirmSchedule(id),
            },
          ]
        : []),
      ...(locked
        ? [
            {
              label: 'Unlock',
              onClick: () => void handleUnlockSchedule(id),
            },
          ]
        : []),
      ...(!locked
        ? [
            {
              label: 'Quick edit…',
              onClick: () => openQuickEdit(id),
            },
          ]
        : []),
      {
        label: 'Unschedule',
        tone: 'danger',
        onClick: () => void handleUnschedule(id),
      },
    ];
    return legacyActions;
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active } = event;
    const dropTarget = view === 'board' ? resolveBoardDrop(event) : null;
    clearBoardDragState();
    if (!dropTarget?.valid) return;

    const activeId = String(active.id);
    const resolvedOverId = dropTarget.kind === 'lane' ? dropTarget.overId ?? `lane:${dropTarget.laneId}` : dropTarget.overId;

    const isScheduled = scheduleItems.some((i) => i.id === activeId);

    if (scheduleMode === 'v2') {
      if (dropTarget.kind === 'unscheduled') {
        if (!isScheduled) return;

        const optimistic = optimisticUnassign(scheduleItemsRef.current, unscheduledJobsSeedRef.current, activeId, projectsById);
        applyV2OptimisticState(optimistic.items, optimistic.unscheduledSeed);

        void (async () => {
          await handleUnschedule(activeId, { optimisticAlreadyApplied: true });
        })();

        return;
      }

      const destInstallerId = dropTarget.laneId;
      if (!destInstallerId) return;

      if (!isScheduled) {
        const job = schedulable.jobsById.get(activeId);
        if (!job) return;
        const existing = laneItems.get(destInstallerId) ?? [];
        const destIndex = Math.max(0, Math.min(dropTarget.insertionIndex, existing.length));
        let projectUuid: string;
        let crewUuid: string;
        try {
          projectUuid = uuidFromAppId(job.projectId, 'proj');
          crewUuid = uuidFromAppId(destInstallerId, 'crew');
        } catch {
          toast.error('Failed to map job/crew IDs for scheduling.');
          return;
        }

        const previousState = {
          scheduleItems: scheduleItemsRef.current,
          unscheduledJobsSeed: unscheduledJobsSeedRef.current,
          scheduleConflicts: scheduleConflictsRef.current,
          nextAvailableByInstallerId: new Map(nextAvailRef.current),
        };
        const optimisticItems = optimisticAssignUnscheduled(scheduleItemsRef.current, job, destInstallerId, destIndex);
        const optimisticUnscheduled = unscheduledJobsSeedRef.current.filter((unscheduled) => unscheduled.id !== activeId);
        applyV2OptimisticState(optimisticItems, optimisticUnscheduled);

        void (async () => {
          const ok = await runWithCommitConfirmation(
            (force) => assignJob({ job_id: projectUuid, crew_id: crewUuid, position: destIndex, force, today }),
            {
              successToast: 'Job scheduled.',
              errorToast: 'Failed to schedule job.',
              refreshOnError: false,
              formatErrorToast: formatAssignMutationErrorToast,
            },
          );
          if (!ok) setV2LocalState(previousState, nextV2GeneratedAt());
        })();
        return;
      }

      const activeItem = scheduleItems.find((i) => i.id === activeId);
      if (!activeItem) return;
      if (activeItem.itemType === 'downtime' && activeItem.installerId !== destInstallerId) {
        toast.info('Downtime blocks cannot move between crews.');
        return;
      }

      {
        const status = scheduleStatusById.get(activeId) ?? deriveScheduleStatus(activeItem, today);
        if (isLockedScheduleStatus(status)) {
          toast.info(`${scheduleStatusLabel(status)} jobs are locked. Unlock to reschedule.`);
          return;
        }
      }

      const sourceInstallerId = activeItem.installerId;
      const sourceList = (laneItems.get(sourceInstallerId) ?? []).map((i) => i.id);
      const destList = (laneItems.get(destInstallerId) ?? []).map((i) => i.id);

      if (sourceInstallerId === destInstallerId && resolvedOverId === activeId) return;

      const destIndex = Math.max(0, Math.min(dropTarget.insertionIndex, sourceInstallerId === destInstallerId ? Math.max(0, destList.length - 1) : destList.length));

      const nextSource = sourceList.filter((id) => id !== activeId);
      const nextDest = sourceInstallerId === destInstallerId ? nextSource.slice() : destList.slice();
      const insertAt = destIndex;

      nextDest.splice(Math.max(0, insertAt), 0, activeId);

      if (sourceInstallerId === destInstallerId) {
        let crewUuid: string;
        try {
          crewUuid = uuidFromAppId(destInstallerId, 'crew');
        } catch {
          toast.error('Failed to map crew ID for reorder.');
          return;
        }
        const ordered = nextDest.map((id) => {
          try {
            return uuidFromAppId(id, 'sch');
          } catch {
            return null;
          }
        }).filter(Boolean) as string[];

        const optimisticItems = optimisticReorderCrew(scheduleItemsRef.current, destInstallerId, nextDest);
        applyV2OptimisticState(optimisticItems, unscheduledJobsSeedRef.current);

        void (async () => {
          await runWithCommitConfirmation(
            (force) => reorderScheduleItemsV2({ crew_id: crewUuid, ordered_item_ids: ordered, force, today }),
            { successToast: 'Schedule updated.', errorToast: 'Failed to reorder schedule.' },
          );
        })();
        return;
      }

      // Moving a job between crews uses assign.
      if (activeItem.itemType === 'job') {
        let projectUuid: string;
        let crewUuid: string;
        try {
          projectUuid = uuidFromAppId(activeItem.projectId, 'proj');
          crewUuid = uuidFromAppId(destInstallerId, 'crew');
        } catch {
          toast.error('Failed to map job/crew IDs for move.');
          return;
        }

        const optimisticItems = optimisticMoveBetweenCrews(scheduleItemsRef.current, activeId, sourceInstallerId, destInstallerId, insertAt);
        applyV2OptimisticState(optimisticItems, unscheduledJobsSeedRef.current);

        void (async () => {
          await runWithCommitConfirmation(
            (force) => assignJob({ job_id: projectUuid, crew_id: crewUuid, position: insertAt, force, today }),
            { successToast: 'Job moved.', errorToast: 'Failed to move job.', formatErrorToast: formatAssignMutationErrorToast },
          );
        })();
      }
      return;
    }

    if (dropTarget.kind === 'unscheduled') {
      if (isScheduled) void handleUnschedule(activeId);
      return;
    }

    const destInstallerId = dropTarget.laneId;
    if (!destInstallerId) return;

    if (!isScheduled) {
      const job = schedulable.jobsById.get(activeId);
      if (!job) return;
      const existing = laneItems.get(destInstallerId) ?? [];
      const sortIndex = Math.max(0, Math.min(dropTarget.insertionIndex, existing.length));
      const item: ScheduleItem = {
        id: newId('sch'),
        projectId: job.projectId,
        estimateId: job.estimateId,
        installerId: destInstallerId,
        sortIndex,
        updatedAt: new Date().toISOString(),
      };
      void persist([...scheduleItems, item], { successToast: 'Job scheduled.' });
      return;
    }

    const activeItem = scheduleItems.find((i) => i.id === activeId);
    if (!activeItem) return;
    {
      const status = scheduleStatusById.get(activeId) ?? deriveScheduleStatus(activeItem, today);
      if (isLockedScheduleStatus(status)) {
        toast.info(`${scheduleStatusLabel(status)} jobs are locked. Unlock to reschedule.`);
        return;
      }
    }

    const sourceInstallerId = activeItem.installerId;
    const sourceList = (laneItems.get(sourceInstallerId) ?? []).map((i) => i.id);
    const destList = (laneItems.get(destInstallerId) ?? []).map((i) => i.id);

    if (sourceInstallerId === destInstallerId && resolvedOverId === activeId) return;

    const destIndex = Math.max(0, Math.min(dropTarget.insertionIndex, sourceInstallerId === destInstallerId ? Math.max(0, destList.length - 1) : destList.length));

    const nextSource = sourceList.filter((id) => id !== activeId);
    const nextDest = sourceInstallerId === destInstallerId ? nextSource.slice() : destList.slice();
    const insertAt = destIndex;

    nextDest.splice(Math.max(0, insertAt), 0, activeId);

    const nextItems = scheduleItems.map((i) => ({ ...i }));
    const byId = new Map(nextItems.map((i) => [i.id, i]));

    const applyOrder = (installerId: string, orderedIds: string[]) => {
      orderedIds.forEach((id, idx) => {
        const item = byId.get(id);
        if (!item) return;
        item.installerId = installerId;
        item.sortIndex = idx;
        item.updatedAt = new Date().toISOString();
      });
    };

    if (sourceInstallerId === destInstallerId) {
      applyOrder(destInstallerId, nextDest);
    } else {
      applyOrder(sourceInstallerId, nextSource);
      applyOrder(destInstallerId, nextDest);
    }

    void persist(nextItems, { successToast: 'Schedule updated.' });
  }

  const overlayJob = activeDragId ? schedulable.jobsById.get(activeDragId) ?? null : null;
  const handleRunDiagnostics = () => {
    if (diagnosticsBusy) return;
    setDiagnosticsBusy(true);
    void (async () => {
      try {
        const res = await runScheduleDiagnostics();
        setDiagnostics(res);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Diagnostics failed';
        setDiagnostics({
          host: supabaseHostFromUrl(supabaseRuntimeUrl()),
          crewsOk: false,
          crewsError: msg,
          itemsOk: false,
          itemsError: msg,
          projectsOk: false,
          projectsError: msg,
          estimatesOk: false,
          estimatesError: msg,
        });
      } finally {
        setDiagnosticsBusy(false);
      }
    })();
  };

  const handleSaveQuickEdit = () => {
    if (!quickEdit) return;

    const item = scheduleItemById.get(quickEdit.id) ?? null;
    if (!item) {
      setQuickEdit(null);
      return;
    }

    const start = quickEdit.startDateOverride.trim();
    const daysRaw = quickEdit.durationDays.trim();
    const days = daysRaw ? Number(daysRaw) : Number.NaN;

    if (scheduleMode === 'v2') {
      if (item.itemType === 'downtime') {
        setQuickEdit(null);
        return;
      }

      const projectUuid = resolveProjectUuid(item);
      if (!projectUuid) return;

      const durationDays = Number.isFinite(days) && days > 0 ? Math.max(1, Math.round(days)) : null;

      void (async () => {
        let ok = true;
        if (durationDays != null) {
          ok = await queueSetDurationJob(projectUuid, durationDays, {
            successToast: 'Duration updated.',
            errorToast: 'Failed to update duration.',
          });
          if (!ok) return;
        }

        if (start) {
          ok = await queuePinJob(projectUuid, start, {
            successToast: 'Job pinned.',
            errorToast: 'Failed to pin job.',
          });
          if (!ok) return;
        } else if (item.mode === 'pinned') {
          ok = await queueUnpinJob(projectUuid, {
            successToast: 'Job unpinned.',
            errorToast: 'Failed to unpin job.',
          });
          if (!ok) return;
        }

        setQuickEdit(null);
      })();
      return;
    }

    const durationHoursOverride = Number.isFinite(days) && days > 0 ? days * WORK_HOURS_PER_DAY : null;
    const nextItems = scheduleItems.map((scheduleItem) => {
      if (scheduleItem.id !== item.id) return scheduleItem;
      return {
        ...scheduleItem,
        startDateOverride: start ? start : undefined,
        durationHoursOverride: durationHoursOverride ?? undefined,
        updatedAt: new Date().toISOString(),
      };
    });

    void persist(nextItems, { successToast: 'Job updated.' }).then((ok) => {
      if (ok) setQuickEdit(null);
    });
  };

  const handleSaveCommitment = () => {
    if (!commitmentEdit) return;

    const item = scheduleItemById.get(commitmentEdit.id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }

    const durationDays = parsePositiveInt(commitmentEdit.durationDays);
    if (durationDays === null) {
      toast.error('Enter a valid duration in whole days.');
      return;
    }

    const flexRaw = Number(commitmentEdit.flexDays.trim());
    if (!Number.isFinite(flexRaw)) {
      toast.error('Enter a valid flex value.');
      return;
    }
    const flexDays = Math.max(0, Math.trunc(flexRaw));

    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;

    const payload =
      commitmentEdit.commitmentType === 'week_of'
        ? {
            job_id: jobUuid,
            commitment_type: 'week_of' as const,
            week_of_date: startOfWeekMonday(commitmentEdit.weekOfDate),
            duration_days: durationDays,
            flex_days: flexDays,
            hard_lock: commitmentEdit.hardLock,
            today,
          }
        : {
            job_id: jobUuid,
            commitment_type: 'fixed_date' as const,
            start_date: snapToWeekdayYmd(commitmentEdit.startDate),
            duration_days: durationDays,
            flex_days: flexDays,
            hard_lock: commitmentEdit.hardLock,
            today,
          };

    const runMutation =
      commitmentEdit.mode === 'lock'
        ? (force: boolean) => lockJobSchedule({ ...payload, force })
        : (force: boolean) => rescheduleJob({ ...payload, force });

    const successToast = commitmentEdit.mode === 'lock' ? 'Schedule locked.' : 'Schedule updated.';
    void runWithCommitConfirmation(runMutation, {
      successToast,
      errorToast: 'Failed to save schedule commitment.',
    }).then((ok) => {
      if (ok) setCommitmentEdit(null);
    });
  };

  const handleSaveDuration = () => {
    if (!durationEdit) return;

    const item = scheduleItemById.get(durationEdit.id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }

    const days = Number(durationEdit.durationDays.trim());
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Enter a valid duration in days.');
      return;
    }

    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;

    const durationDays = Math.max(1, Math.round(days));
    void queueSetDurationJob(jobUuid, durationDays, {
      successToast: 'Duration updated.',
      errorToast: 'Failed to update duration.',
    }).then((ok) => {
      if (ok) setDurationEdit(null);
    });
  };

  const handleSavePin = () => {
    if (!pinEdit) return;

    const item = scheduleItemById.get(pinEdit.id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }

    const start = pinEdit.requestedStart.trim();
    if (!isYmd(start)) {
      toast.error('Select a valid start date.');
      return;
    }

    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;

    void queuePinJob(jobUuid, start, {
      successToast: 'Job pinned.',
      errorToast: 'Failed to pin job.',
    }).then((ok) => {
      if (ok) setPinEdit(null);
    });
  };

  const handleSaveDaysRemaining = () => {
    if (!daysRemainingEdit) return;

    const item = scheduleItemById.get(daysRemainingEdit.id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }

    const days = Number(daysRemainingEdit.daysRemaining.trim());
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Enter a valid number of days.');
      return;
    }

    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;

    const daysRemaining = Math.max(1, Math.round(days));
    void queueSetDaysRemainingJob(jobUuid, daysRemaining, {
      successToast: 'Days remaining updated.',
      errorToast: 'Failed to update days remaining.',
    }).then((ok) => {
      if (ok) setDaysRemainingEdit(null);
    });
  };

  const handleSaveDowntime = () => {
    if (!downtimeEdit) return;

    const days = Number(downtimeEdit.durationDays.trim());
    if (!Number.isFinite(days) || days <= 0) {
      toast.error('Enter a valid duration in days.');
      return;
    }

    const durationDays = Math.max(1, Math.round(days));
    const reason = downtimeEdit.reason || 'other';
    const note = downtimeEdit.note.trim();

    if (downtimeEdit.mode === 'create') {
      const crewUuid = resolveCrewUuid(downtimeEdit.crewId);
      if (!crewUuid) return;

      void runWithCommitConfirmation(
        (force) =>
          createDowntime({
            crew_id: crewUuid,
            position: downtimeEdit.position,
            duration_days: durationDays,
            reason,
            note: note || null,
            force,
            today,
          }),
        { successToast: 'Downtime added.', errorToast: 'Failed to add downtime.' },
      ).then((ok) => {
        if (ok) setDowntimeEdit(null);
      });
      return;
    }

    if (!downtimeEdit.downtimeId) {
      toast.error('Downtime record not found.');
      return;
    }

    void runWithCommitConfirmation(
      (force) =>
        updateDowntime({
          downtime_id: downtimeEdit.downtimeId as string,
          duration_days: durationDays,
          reason,
          note: note || null,
          force,
          today,
        }),
      { successToast: 'Downtime updated.', errorToast: 'Failed to update downtime.' },
    ).then((ok) => {
      if (ok) setDowntimeEdit(null);
    });
  };

  const handleFinishEarlyKeepSchedule = () => {
    if (!finishEarlyPrompt) return;
    void runWithCommitConfirmation(
      (force) =>
        markJobDone({
          job_id: finishEarlyPrompt.jobId,
          finish_early_action: 'keep_schedule',
          force,
          today,
        }),
      { successToast: 'Buffer added. Schedule held.', errorToast: 'Failed to keep schedule as-is.' },
    ).then((ok) => {
      if (ok) setFinishEarlyPrompt(null);
    });
  };

  const handleFinishEarlyPullForward = () => {
    if (!finishEarlyPrompt) return;
    void runWithCommitConfirmation(
      (force) =>
        markJobDone({
          job_id: finishEarlyPrompt.jobId,
          finish_early_action: 'pull_forward',
          force,
          today,
        }),
      { successToast: 'Schedule pulled forward.', errorToast: 'Failed to pull schedule forward.' },
    ).then((ok) => {
      if (ok) setFinishEarlyPrompt(null);
    });
  };

  const actionModalState: ScheduleModalState = {
    quickEdit,
    commitmentEdit,
    durationEdit,
    pinEdit,
    daysRemainingEdit,
    downtimeEdit,
    finishEarlyPrompt,
  };

  const hasOpenActionModal = Boolean(
    quickEdit || commitmentEdit || durationEdit || pinEdit || daysRemainingEdit || downtimeEdit || finishEarlyPrompt,
  );

  const diagnosticsPanel = devOnly ? (
    <LazyScheduleDiagnosticsPanel
      open={diagnosticsOpen}
      busy={diagnosticsBusy}
      diagnostics={diagnostics}
      onToggle={() => setDiagnosticsOpen((value) => !value)}
      onRun={handleRunDiagnostics}
    />
  ) : null;

  if (view === 'site_visits') {
    return (
      <main className={cx(styles.page, styles.pageLocked)}>
        <PageHeader
          title="Schedule"
          right={
            <HeaderActions>
              {scheduleTabs}
            </HeaderActions>
          }
        />
        <div className={cx(styles.stack, styles.stackLocked)}>
          <LazySiteVisitsView />
        </div>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main className={cx(styles.page, styles.pageLocked)}>
        <PageHeader
          title="Schedule"
          right={
            <HeaderActions>
              {scheduleTabs}
            </HeaderActions>
          }
        />
        <div className={styles.stack}>
          <p className={styles.note}>Loading schedule data from the portal database…</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    const table = loadError.table;
    const supabaseHostLabel = supabaseHost ? (
      <>
        {' '}
        on <strong>{supabaseHost}</strong>.
      </>
    ) : (
      '.'
    );
    const schemaFixFile =
      table === 'schedule_crews' || table === 'schedule_items'
        ? 'supabase/schedule.sql'
        : 'supabase/portal_schema.sql';

    return (
      <main className={cx(styles.page, styles.pageLocked)}>
        <PageHeader
          title="Schedule"
          right={
            <HeaderActions>
              {scheduleTabs}
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  setHydrated(false);
                  refreshSchedule();
                }}
              >
                Retry
              </button>
            </HeaderActions>
          }
        />
        <div className={styles.stack}>
          <p className={styles.note}>
            {loadError.table ? (
              <>
                Failed to query <strong>public.{loadError.table}</strong>
                {supabaseHostLabel}{' '}
                {loadError.code ? <span className={styles.muted}>({loadError.code})</span> : null}
                <br />
                {loadError.message}
                <br />
                Run <code>{schemaFixFile}</code> in Supabase SQL editor, then refresh.
                {schemaFixFile === 'supabase/schedule.sql' ? (
                  <>
                    <br />
                    If it errors on missing <code>public.projects</code> or <code>public.estimates</code>, run <code>supabase/portal_schema.sql</code> first.
                    <br />
                    Then run <code>supabase/seed_schedule_crews.sql</code> to seed default crews.
                  </>
                ) : (
                  <>
                    <br />
                    Then run <code>supabase/seed_schedule_crews.sql</code> to seed default crews (if empty).
                  </>
                )}
              </>
            ) : (
              <>
                {loadError.message}
                {supabaseHost ? (
                  <>
                    <br />
                    Host: <strong>{supabaseHost}</strong>
                  </>
                ) : null}
                <br />
                Run <code>supabase/portal_schema.sql</code> (or <code>supabase/schedule.sql</code>) in Supabase SQL editor, then refresh.
              </>
            )}
          </p>
          {diagnosticsPanel}
        </div>
      </main>
    );
  }

  return (
    <main className={cx(styles.page, styles.pageLocked)}>
      <PageHeader
        title="Schedule"
        right={
          <HeaderActions>
            {syncing ? <span className={styles.muted}>Syncing…</span> : null}
            {scheduleTabs}
          </HeaderActions>
        }
      />

      <div className={cx(styles.stack, styles.stackLocked)}>
        {schedulingIssues.length ? (
          <section className={styles.issues} aria-label="Scheduling issues">
            <div className={styles.issuesHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className={styles.panelTitle}>Scheduling issues</h2>
                <span className={styles.muted}>{schedulingIssues.length}</span>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={cleanupBusy || !orphanedScheduleItems.length}
                  onClick={() => void handleRemoveOrphanedScheduleItems()}
                  title={
                    orphanedScheduleItems.length
                      ? `Remove ${orphanedScheduleItems.length} orphaned schedule item(s)`
                      : 'No orphaned schedule items found'
                  }
                >
                  {cleanupBusy ? 'Removing orphaned schedule items…' : orphanedScheduleItems.length ? 'Remove orphaned schedule items' : 'No orphaned items'}
                </button>
              </div>
            </div>
            <div className={styles.issuesBody}>
              <ul className={styles.issueList}>
                {schedulingIssues.slice(0, 10).map((i, idx) => (
                  <li key={`${idx}-${i.message}`} className={styles.issueItem}>
                    <span className={styles.warnBadge}>{i.level}</span>
                    <span>{i.message}</span>
                  </li>
                ))}
              </ul>
              {schedulingIssues.length > 10 ? <p className={styles.hint}>Showing first 10 issues.</p> : null}
            </div>
          </section>
        ) : null}

        {diagnosticsPanel}

        <DndContext
          sensors={sensors}
          collisionDetection={view === 'board' ? boardCollisionDetection : closestCenter}
          autoScroll={view === 'board' ? false : undefined}
          onDragStart={(e) => {
            setActiveDragId(String(e.active.id));
            setBoardDropTarget(null);
          }}
          onDragOver={(e: DragOverEvent) => {
            applyBoardDropTarget(resolveBoardDrop(e));
          }}
          onDragMove={handleDragMove}
          onDragCancel={clearBoardDragState}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.panels}>
            <aside className={cx(styles.leftPanel, unscheduledCollapsed && styles.leftPanelCollapsed)} aria-label="Unscheduled jobs">
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Unscheduled</h2>
                <div className={styles.panelHeaderActions}>
                  <span className={styles.muted}>{unscheduledJobs.length}</span>
                  <button
                    type="button"
                    className={styles.panelCollapseButton}
                    aria-label={unscheduledCollapsed ? 'Expand unscheduled panel' : 'Collapse unscheduled panel'}
                    aria-expanded={!unscheduledCollapsed}
                    onClick={handleToggleUnscheduledCollapsed}
                  >
                    {unscheduledCollapsed ? '▸' : '◂'}
                  </button>
                </div>
              </div>

              <div className={styles.filters}>
                <input
                  className={styles.input}
                  placeholder="Search projects…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <p className={styles.hint}>Only deposit-stage projects with at least one active estimate appear here.</p>
              </div>

              <UnscheduledDropZone onMount={(node) => (unscheduledBodyRef.current = node)}>
                {unscheduledJobs.length ? (
                  <div className={styles.cardList}>
                    {unscheduledJobs.map((job) => (
                      <UnscheduledJobCard key={job.id} job={job} />
                    ))}
                  </div>
                ) : (
                  <div>
                    {unscheduledJobsAll.length === 0 ? (
                      <>
                        <p className={styles.note}>No unscheduled deposit-stage projects.</p>
                        <p className={styles.hint}>Projects appear here once they reach Deposit and have an active estimate.</p>
                      </>
                    ) : (
                      <p className={styles.note}>No projects match this search.</p>
                    )}
                  </div>
                )}
              </UnscheduledDropZone>

              {process.env.NODE_ENV === 'development' ? (
                <details className={styles.debugDetails}>
                  <summary className={styles.debugSummary}>Debug: schedulable jobs</summary>
                  <div className={styles.debugBody}>
                    <div className={styles.debugRow}>
                    <span className={styles.muted}>Projects</span>
                    <span>{schedulable.debug.totalProjects}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Schedulable (has active estimate)</span>
                    <span>{schedulable.debug.schedulableProjects}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Unscheduled</span>
                    <span>{schedulable.debug.unscheduledJobs}</span>
                  </div>

                  <div className={styles.debugSectionTitle}>Excluded projects</div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>No estimates</span>
                    <span>{schedulable.debug.excluded.noEstimates}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>No active estimate</span>
                    <span>{schedulable.debug.excluded.noSchedulableEstimate}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Already scheduled</span>
                    <span>{schedulable.debug.excluded.alreadyScheduled}</span>
                  </div>

                  <div className={styles.debugSectionTitle}>Schedule items</div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Total</span>
                    <span>{schedulable.debug.scheduleItems.total}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Blocking (valid + active estimate)</span>
                    <span>{schedulable.debug.scheduleItems.blocking}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Missing project</span>
                    <span>{schedulable.debug.scheduleItems.missingProject}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Missing estimate</span>
                    <span>{schedulable.debug.scheduleItems.missingEstimate}</span>
                  </div>
                  <div className={styles.debugRow}>
                    <span className={styles.muted}>Estimate archived</span>
                    <span>{schedulable.debug.scheduleItems.estimateNotSchedulable}</span>
                  </div>
                </div>
              </details>
            ) : null}
          </aside>

          <section className={styles.mainPanel} aria-label="Installer lanes">
            {view === 'gantt' ? (
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
                      <option value={4}>4 weeks</option>
                      <option value={8}>8 weeks</option>
                      <option value={12}>12 weeks</option>
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
                        <span className={styles.legendItem}>
                          <span className={styles.legendSwatch} />
                          Forecast
                        </span>
                        {showPlanned ? (
                          <span className={styles.legendItem}>
                            <span className={cx(styles.legendSwatch, styles.legendSwatchPlanned)} />
                            Planned
                          </span>
                        ) : null}
                        <span className={styles.legendItem}>
                          <span className={styles.legendDot} aria-hidden="true" />
                          Pinned
                        </span>
                        <span className={styles.legendItem}>
                          <span className={cx(styles.legendSwatch, styles.legendSwatchConflict)} />
                          Conflict
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.ganttControlsRight}>
                    <label className={styles.toggleControl}>
                      <input
                        type="checkbox"
                        className={styles.toggleCheckbox}
                        checked={showCompleted}
                        onChange={(e) => handleShowCompletedChange(e.target.checked)}
                      />
                      Show completed jobs
                    </label>
                    <button
                      type="button"
                      className={cx(styles.buttonSecondary, styles.ganttControlButton, styles.ganttJumpButton)}
                      onClick={jumpGanttToToday}
                    >
                      Jump to today
                    </button>
                    {scheduleMode === 'v2' ? (
                      <button
                        type="button"
                        className={cx(styles.buttonSecondary, styles.ganttControlButton)}
                        aria-pressed={showPlanned}
                        onClick={() => setShowPlanned((v) => !v)}
                      >
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
                      <div
                        className={styles.todayColumnWash}
                        style={{ left: labelWidthPx + gantt.todayColumnLeftPx, width: gantt.todayColumnWidthPx }}
                        aria-hidden="true"
                      />
                    ) : null}
                    {gantt.weekendBlocks.map((b) => (
                      <div
                        key={`weekend-${b.date}`}
                        className={styles.weekendShade}
                        style={{ left: labelWidthPx + b.leftPx, width: b.widthPx }}
                        aria-hidden="true"
                      />
                    ))}
                    {gantt.holidayBlocks.map((b) => (
                      <div
                        key={`holiday-${b.date}`}
                        className={styles.holidayShade}
                        style={{ left: labelWidthPx + b.leftPx, width: b.widthPx }}
                        aria-hidden="true"
                      />
                    ))}
                    <div className={styles.ganttGridLines} aria-hidden="true">
                      {gantt.dayBoundaryLines.map((leftPx, idx) => (
                        <div key={`day-line-${idx}-${leftPx}`} className={styles.ganttDayBoundary} style={{ left: labelWidthPx + leftPx }} />
                      ))}
                      {gantt.weekBoundaryLines.map((leftPx, idx) => (
                        <div key={`week-line-${idx}-${leftPx}`} className={styles.ganttWeekBoundary} style={{ left: labelWidthPx + leftPx }} />
                      ))}
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

                    <div className={styles.ganttCorner}>
                      <div className={styles.ganttLeftHeaderGrid}>
                        <div className={styles.ganttColProject}>Crew / Project</div>
                      </div>
                    </div>

                    <div className={styles.ganttHeader} style={{ width: gantt.totalWidth }}>
                      <div className={styles.ganttTodayPillTrack}>
                        {gantt.todayColumnLeftPx != null ? (
                          <span className={styles.ganttTodayPill} style={{ left: gantt.todayColumnLeftPx + gantt.todayColumnWidthPx / 2 }}>
                            Today · {formatShortDate(gantt.displayToday)}
                          </span>
                        ) : null}
                      </div>
                      <div className={styles.ganttMonthBand}>
                        {gantt.axis.months.map((month) => (
                          <div
                            key={`month-${month.key}-${month.startWeekIndex}`}
                            className={styles.ganttMonthLabel}
                            style={{ left: month.startPx, width: month.widthPx }}
                          >
                            {month.label}
                          </div>
                        ))}
                      </div>
                      <div className={styles.ganttWeekBand}>
                        {gantt.axis.weeks.map((week) => (
                          <div key={`week-${week.index}-${week.startDate}`} className={styles.ganttWeekLabel} style={{ left: week.startPx, width: week.widthPx }}>
                            {week.label}
                          </div>
                        ))}
                      </div>
                      {gantt.holidayBlocks.map((b) => (
                        <div
                          key={`holiday-hover-${b.date}`}
                          className={styles.ganttHolidayHoverZone}
                          style={{ left: b.leftPx, width: b.widthPx }}
                          title={b.label}
                          aria-label={b.label}
                        />
                      ))}
                    </div>

                    <div className={styles.todayLine} style={{ left: labelWidthPx + gantt.todayLinePx }} aria-hidden="true" />
                    {ganttDragFeedback ? (
                      <div className={styles.ganttSnapGuide} style={{ left: labelWidthPx + ganttDragFeedback.snapLinePx }} aria-hidden="true" />
                    ) : null}

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
                                    {row.collapsed ? '▸' : '▾'}
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
                                <span className={styles.ganttProjectText} title={row.projectName}>
                                  {row.projectName}
                                </span>
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
                            ? row.summarySpans.map((span, idx) => (
                                <div
                                  key={`crew-summary-${row.installerId}-${idx}`}
                                  className={styles.ganttCrewSummaryBar}
                                  style={{ left: span.leftPx, width: span.widthPx, backgroundColor: row.color }}
                                  aria-hidden="true"
                                />
                              ))
                            : null}
                          {row.kind === 'item' && row.plannedWidthPx && row.plannedWidthPx > 0 ? (
                            <div
                              className={styles.ganttPlannedBar}
                              style={{
                                left: row.plannedLeftPx,
                                width: row.plannedWidthPx,
                              }}
                              title={
                                row.plannedStart && row.plannedEnd
                                  ? `Planned: ${formatShortDate(row.plannedStart)} → ${formatShortDate(row.plannedEnd)}`
                                  : 'Planned dates'
                              }
                            />
                          ) : null}
                          {row.kind === 'item' && row.ghostWidthPx && row.ghostWidthPx > 0 ? (
                            <div
                              className={styles.ganttGhostBar}
                              style={{
                                left: row.ghostLeftPx,
                                width: row.ghostWidthPx,
                              }}
                              aria-hidden="true"
                            />
                          ) : null}
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
                                const crewName = installersById.get(row.installerId)?.name ?? null;
                                const conflict = row.issueLevel === 'error' ? conflictMessageByScheduleId.get(row.scheduleItemId) : null;
                                const lines = [
                                  row.projectName,
                                  crewName ? `Crew: ${crewName}` : null,
                                  row.isPinned ? 'Pinned' : null,
                                  row.plannedCommitmentLabel ? `Planned: ${row.plannedCommitmentLabel}` : 'Planned: Draft',
                                  typeof row.driftDays === 'number' ? `Drift: +${row.driftDays} working day${row.driftDays === 1 ? '' : 's'}` : null,
                                  row.clientUpdateStatus === 'needed'
                                    ? 'Client update needed'
                                    : row.clientUpdateStatus === 'acknowledged'
                                      ? 'Client contacted'
                                      : null,
                                  conflict ? `Conflict: ${conflict}` : null,
                                  `Status: ${formatStatusLabel(row.status)}`,
                                  `Duration: ${row.durationLabel}`,
                                  `Start: ${formatShortDate(row.startDate)}`,
                                  `End: ${formatShortDate(row.endDate)}`,
                                ].filter((line): line is string => Boolean(line));
                                return lines.join('\n');
                              })()}
                              onPointerDown={(e) => beginGanttDrag(row, 'move', e)}
                              onClick={(e) => {
                                if (shouldBlockGanttClick()) return;
                                e.stopPropagation();
                                openGanttPopover(row, e.currentTarget);
                              }}
                            >
                              {row.isPinned ? <span className={styles.ganttPin} aria-hidden="true" /> : null}
                              {row.barWidthPx >= GANTT_BAR_LABEL_MIN_PX ? (
                                <span className={styles.ganttBarTextFade}>
                                  <span className={styles.ganttBarText}>{row.projectName}</span>
                                </span>
                              ) : null}
                              {scheduleMode === 'v2' && !row.isDowntime ? (
                                <span
                                  className={styles.ganttResizeHandle}
                                  role="presentation"
                                  onPointerDown={(e) => beginGanttDrag(row, 'resize', e)}
                                  onClick={(e) => e.stopPropagation()}
                                />
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
              </div>
            ) : (
              <>
                <div className={styles.legendRow} aria-label="Schedule controls">
                  {scheduleMode === 'v2' ? (
                    <>
                      <span className={styles.legendItem}>
                        <span className={styles.legendSwatch} />
                        Forecast
                      </span>
                      <span className={styles.legendItem}>
                        <span className={styles.legendDot} aria-hidden="true" />
                        Pinned
                      </span>
                      <span className={styles.legendItem}>
                        <span className={cx(styles.legendSwatch, styles.legendSwatchConflict)} />
                        Conflict
                      </span>
                    </>
                  ) : null}
                    <label className={styles.toggleControl}>
                      <input
                        type="checkbox"
                        className={styles.toggleCheckbox}
                        checked={showCompleted}
                        onChange={(e) => handleShowCompletedChange(e.target.checked)}
                      />
                      Show completed jobs
                    </label>
                </div>
                <div className={styles.lanes} ref={boardScrollRef}>
                {installers.filter((i) => i.active).map((installer) => {
                  const items = laneItems.get(installer.id) ?? [];
                  const ids = items.map((i) => i.id);
                  const laneIsOver = overLaneId === installer.id && Boolean(activeDragId);
                  const laneDropTarget = boardDropTarget?.valid && boardDropTarget.kind === 'lane' && boardDropTarget.laneId === installer.id ? boardDropTarget : null;
                  const insertionAtEnd = Boolean(laneDropTarget && laneDropTarget.placement === 'end' && activeDragId);
                  let maxEnd: string | null = null;
                  for (const id of ids) {
                    const dates = barsByScheduleId.get(id);
                    if (!dates) continue;
                    const end = dates.endDate;
                    if (!maxEnd || end > maxEnd) maxEnd = end;
                  }
                  const nextAvailableCandidate = maxEnd ? nextWorkdayAfter(maxEnd) : null;
                  const computedNextAvailable = nextAvailableCandidate && nextAvailableCandidate < today ? today : nextAvailableCandidate;
                  const nextAvailable = scheduleMode === 'v2' ? nextAvailableByInstallerId.get(installer.id) ?? computedNextAvailable : computedNextAvailable;

                  const cards: React.ReactNode[] = [];
                  for (const id of ids) {
                    const showInsertBefore = Boolean(laneDropTarget && laneDropTarget.overId === id && activeDragId !== id && activeDragId);
                    if (showInsertBefore) cards.push(<div key={`insert-${id}`} className={styles.insertionMarker} aria-hidden="true" />);

                    const job = schedulable.jobsById.get(id) ?? null;
                    const dates = barsByScheduleId.get(id);
                    const dateLine = dates ? formatDateRange(dates.startDate, dates.endDate) : undefined;
                    const scheduleItem = scheduleItemById.get(id) ?? null;
                    const scheduleStatus = scheduleItem ? deriveScheduleStatus(scheduleItem, today) : 'TENTATIVE';
                    const issueLevel = issueLevelByScheduleId.get(id);

                    if (scheduleItem?.itemType === 'downtime') {
                      const downtimeActions = buildDowntimeMenuActions(id, scheduleItem);

                      cards.push(
                        <DowntimeCard
                          key={id}
                          id={id}
                          item={scheduleItem}
                          dateLine={dateLine}
                          dropTarget={overId === id && activeDragId !== id}
                          menuActions={downtimeActions}
                          issueLevel={issueLevel}
                          onMount={(node) => boardCardRefs.current.set(id, node)}
                        />,
                      );
                      continue;
                    }

                    if (!scheduleItem) continue;
                    const menuActions = buildJobMenuActions({ id, scheduleItem, job, scheduleStatus });
                    const commitmentLabel = formatCommitmentLabel(scheduleItem);
                    const commitmentType = resolveCommitmentType(scheduleItem);
                    const flexDays = resolvePlannedFlexDays(scheduleItem);
                    const driftDays =
                      typeof scheduleItem.driftDays === 'number' && Number.isFinite(scheduleItem.driftDays)
                        ? Math.max(0, Math.trunc(scheduleItem.driftDays))
                        : null;
                    const driftExceeded = driftDays !== null && flexDays !== null ? driftDays > flexDays : false;
                    const clientUpdateStatus = scheduleItem.clientUpdateStatus ?? 'none';
                    const extraBadges = (
                      <>
                        {!hasPlannedCommitment(scheduleItem) ? <span className={styles.draftPill}>Draft</span> : null}
                        {hasPlannedCommitment(scheduleItem) && commitmentLabel ? <span className={styles.commitmentPill}>{commitmentLabel}</span> : null}
                        {commitmentType && driftDays !== null && driftDays > 0 && !driftExceeded ? (
                          <span className={styles.driftPill}>Drift +{driftDays}d</span>
                        ) : null}
                        {clientUpdateStatus === 'needed' ? <span className={styles.clientUpdatePill}>Client update needed</span> : null}
                        {clientUpdateStatus === 'acknowledged' ? <span className={styles.clientAckPill}>Client contacted</span> : null}
                      </>
                    );

                    cards.push(
                      <ScheduledJobCard
                        key={id}
                        id={id}
                        job={job}
                        scheduleStatus={scheduleStatus}
                        dateLine={dateLine}
                        dropTarget={overId === id && activeDragId !== id}
                        menuActions={menuActions}
                        issueLevel={issueLevel}
                        pinned={scheduleMode === 'v2' && scheduleItem.mode === 'pinned'}
                        extraBadges={extraBadges}
                        onMount={(node) => boardCardRefs.current.set(id, node)}
                      />,
                    );
                  }
                  if (insertionAtEnd) cards.push(<div key="insert-end" className={styles.insertionMarker} aria-hidden="true" />);

                  return (
                    <section
                      key={installer.id}
                      className={styles.lane}
                      style={{ borderLeftColor: installer.color }}
                      data-over={laneIsOver ? 'true' : 'false'}
                      aria-label={`Lane ${installer.name}`}
                    >
                      <div className={styles.laneHeader}>
                        <div>
                          <div className={styles.laneNameRow}>
                            <span className={styles.colorDot} style={{ background: installer.color }} />
                            <h3 className={styles.laneTitle}>{installer.name}</h3>
                          </div>
                          {nextAvailable ? (
                            <div className={styles.smallMeta}>Next available: {formatShortDate(nextAvailable)}</div>
                          ) : null}
                        </div>
                        <span className={styles.muted}>{ids.length}</span>
                      </div>
                      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                        <LaneDropZone laneId={installer.id} onMount={(node) => laneBodyRefs.current.set(installer.id, node)}>
                          {ids.length ? (
                            <div className={styles.cardList}>
                              {cards}
                            </div>
                          ) : (
                            <div className={styles.emptyLane}>
                              <div className={styles.emptyLaneIcon} aria-hidden="true">
                                ↓
                              </div>
                              <p className={styles.emptyLaneTitle}>Drop jobs here</p>
                              <p className={styles.emptyLaneHint}>Drag from Unscheduled or move from another crew</p>
                            </div>
                          )}
                        </LaneDropZone>
                      </SortableContext>
                    </section>
                  );
                })}
                </div>
              </>
            )}
          </section>
        </div>

        <DragOverlay>
          {overlayJob ? (
            <div className={styles.dragOverlay}>
              <div className={styles.jobTitle}>{overlayJob.projectName}</div>
              <div className={styles.jobDescriptor}>{overlayJob.descriptor}</div>
              <div className={styles.badgesRow}>
                <span className={styles.statusPill}>{formatStatusLabel(overlayJob.status)}</span>
                <span className={styles.durationPill}>{overlayJob.durationLabel}</span>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

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

      {hasOpenActionModal ? (
        <LazyScheduleActionModals
          state={actionModalState}
          scheduleMode={scheduleMode}
          findScheduleItem={(id) => scheduleItemById.get(id) ?? null}
          findProjectName={(scheduleItemId) => {
            const scheduleItem = scheduleItemById.get(scheduleItemId) ?? null;
            const project = scheduleItem?.projectId ? projectsById.get(scheduleItem.projectId) ?? null : null;
            return scheduleItem?.itemType === 'job' ? safeProjectName(project) : 'Job';
          }}
          formatShortDate={formatShortDate}
          formatCommitImpactList={formatCommitImpactList}
          setQuickEdit={setQuickEdit}
          setCommitmentEdit={setCommitmentEdit}
          setDurationEdit={setDurationEdit}
          setPinEdit={setPinEdit}
          setDaysRemainingEdit={setDaysRemainingEdit}
          setDowntimeEdit={setDowntimeEdit}
          setFinishEarlyPrompt={setFinishEarlyPrompt}
          onSaveQuickEdit={handleSaveQuickEdit}
          onSaveCommitment={handleSaveCommitment}
          onSaveDuration={handleSaveDuration}
          onSavePin={handleSavePin}
          onSaveDaysRemaining={handleSaveDaysRemaining}
          onSaveDowntime={handleSaveDowntime}
          onFinishEarlyKeepSchedule={handleFinishEarlyKeepSchedule}
          onFinishEarlyPullForward={handleFinishEarlyPullForward}
        />
      ) : null}
      </div>
    </main>
  );
}
