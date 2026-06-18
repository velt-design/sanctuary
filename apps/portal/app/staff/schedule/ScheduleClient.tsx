'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import styles from './schedule.module.css';
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
import { scheduleGanttV2SnapshotQueryOptions, scheduleV2SnapshotQueryOptions, type ScheduleProjectSummary, type ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { isSchedulingReadyProjectStatus } from '@/lib/scheduling/readiness';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { Installer, ScheduleItem, ScheduleItemStatus, SchedulingIssue } from '@/lib/types/scheduling';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { addDaysYmd, isYmd } from '@/lib/scheduling/date';
import { recomputeCrewSchedule, type CrewDowntime, type CrewScheduleItem, type ScheduledJob as RecomputeScheduledJob } from '@/lib/scheduling/recompute';
import { resolveDefaultScheduleGanttRange } from '@/lib/scheduling/scheduleGanttRange';
import { resolveScheduleTodayYmd, SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import { buildWorkingDayIndex, type CompanyClosure, type NzHoliday } from '@/lib/scheduling/workingDays';
import { useToast } from '@/components/ui/toast/ToastProvider';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { ApiError } from '@/lib/repo/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runScheduleDiagnostics } from '@/lib/queries/scheduleDiagnostics';
import type { ScheduleActionModalsProps, ScheduleModalState } from './ScheduleActionModals';
import type { ScheduleDiagnosticsResult } from './ScheduleDiagnosticsPanel';
import type { ScheduleBoardDrop, ScheduleBoardMenuAction, ScheduleBoardViewProps } from './ScheduleBoardView';
import type { ScheduleGanttViewProps } from './ScheduleGanttView';
import ScheduleViewTabs, { type ScheduleView } from './ScheduleViewTabs';
import type { ScheduleLegacyFallbackClientProps } from './ScheduleLegacyFallbackClient';
import { getScheduleSupabaseHost } from './scheduleRuntime';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import { EMPTY_SCHEDULE_BOARD_MODEL, buildScheduleBarsFromForecast, formatDuration, formatHours, makeJobId, mapV2UnscheduledJobs, safeProjectName } from './ScheduleBoardModelShared';
import { buildScheduleBoardModelV2 } from './ScheduleBoardModelV2';
import { logScheduleDebug } from './scheduleDebug';
import { recentScheduleTelemetryEvents, sendScheduleTelemetry } from './scheduleTelemetryClient';
import type { ScheduleClientTelemetryEvent } from '@/lib/scheduling/scheduleTelemetry';

const LazyScheduleBoardView = dynamic<ScheduleBoardViewProps>(
  () => import('./ScheduleBoardView'),
  {
    ssr: false,
    loading: () => <p className={styles.note}>Loading Board...</p>,
  },
);

const LazyScheduleGanttView = dynamic<ScheduleGanttViewProps>(
  () => import('./ScheduleGanttView'),
  {
    ssr: false,
    loading: () => <p className={styles.note}>Loading Gantt...</p>,
  },
);

const LazyScheduleLegacyFallbackClient = dynamic<ScheduleLegacyFallbackClientProps>(
  () => import('./ScheduleLegacyFallbackClient'),
  {
    ssr: false,
    loading: () => <p className={styles.note}>Loading legacy schedule fallback...</p>,
  },
);

const LazyScheduleActionModals = dynamic<ScheduleActionModalsProps>(
  () => import('./ScheduleActionModals'),
  {
    ssr: false,
  },
);

const LazyScheduleDiagnosticsPanel = dynamic(() => import('./ScheduleDiagnosticsPanel'), {
  ssr: false,
});

const USE_SCHEDULE_V2 = true;
const V2_MUTATION_DEBOUNCE_MS = 180;

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

function isLockedScheduleStatus(status: ScheduleItemStatus): boolean {
  return status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED';
}

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
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', timeZone: SCHEDULE_TIME_ZONE }).format(dt);
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

export default function ScheduleClient({
  initialScheduleMode = 'v2',
  initialSeedKind = 'board',
  initialV2Snapshot: initialV2SnapshotProp = null,
}: {
  initialScheduleMode?: 'v2' | 'legacy';
  initialSeedKind?: 'board' | 'gantt';
  initialV2Snapshot?: ScheduleV2Snapshot | null;
}) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { beginRouteTransition } = usePortalRouteTransition();
  const queryClient = useQueryClient();
  const [isTransitionPending, startUiTransition] = useTransition();
  const hydratedFromCacheRef = useRef(false);
  const scheduleItemsRef = useRef<ScheduleItem[]>([]);
  const unscheduledJobsSeedRef = useRef<SchedulableJob[]>([]);
  const scheduleConflictsRef = useRef<any[]>([]);
  const nextAvailRef = useRef<Map<string, string>>(new Map());
  const installersRef = useRef<Installer[]>([]);
  const projectsRef = useRef<ScheduleProjectSummary[]>([]);

  const initialView = (() => {
    const raw = (searchParams.get('view') || '').trim().toLowerCase();
    if (raw === 'site-visits') return 'site_visits' as const;
    if (raw === 'gantt') return 'gantt' as const;
    return 'board' as const;
  })();

  const today = useMemo(() => resolveScheduleTodayYmd(), []);

  const supabaseHost = useMemo(() => getScheduleSupabaseHost(), []);
  const hostKey = supabaseHost || 'unknown';

  const ganttRange = useMemo(() => resolveDefaultScheduleGanttRange(today), [today]);
  const boardSnapshotKey = useMemo(() => qk.schedule.board(hostKey, today), [hostKey, today]);
  const ganttSnapshotKey = useMemo(
    () => qk.schedule.gantt(hostKey, ganttRange.rangeStart, ganttRange.rangeEnd, today),
    [ganttRange.rangeEnd, ganttRange.rangeStart, hostKey, today],
  );
  const cachedV2Snapshot = USE_SCHEDULE_V2
    ? (initialView === 'gantt'
        ? queryClient.getQueryData<ScheduleV2Snapshot>(ganttSnapshotKey)
        : queryClient.getQueryData<ScheduleV2Snapshot>(boardSnapshotKey)) ?? null
    : null;
  const initialV2Snapshot = USE_SCHEDULE_V2 && initialScheduleMode === 'v2' ? initialV2SnapshotProp ?? cachedV2Snapshot : null;
  const initialSnapshotKind = initialV2Snapshot ? (initialV2SnapshotProp ? initialSeedKind : initialView === 'gantt' ? 'gantt' : 'board') : null;
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
  const [installers, setInstallers] = useState<Installer[]>(() => initialV2Snapshot?.installers ?? []);
  const [projects, setProjects] = useState<ScheduleProjectSummary[]>(() => initialV2Snapshot?.projects ?? []);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => initialV2Snapshot?.scheduleItems ?? []);
  const [unscheduledJobsSeed, setUnscheduledJobsSeed] = useState<SchedulableJob[]>(() => mapV2UnscheduledJobs(initialV2Snapshot?.unscheduledJobs));
  const [scheduleMode, setScheduleMode] = useState<'v2' | 'legacy'>(initialScheduleMode);
  const [activeSnapshotKind, setActiveSnapshotKind] = useState<'board' | 'gantt' | null>(initialSnapshotKind);
  const [legacyFallbackReason, setLegacyFallbackReason] = useState<ScheduleLegacyFallbackClientProps['initialReason']>(
    initialScheduleMode === 'legacy' ? 'server-schema-not-ready' : undefined,
  );
  const [scheduleConflicts, setScheduleConflicts] = useState<any[]>(() => initialV2Snapshot?.conflicts ?? []);
  const [nextAvailableByInstallerId, setNextAvailableByInstallerId] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialV2Snapshot?.nextAvailableByInstallerId ?? {})),
  );
  const [ganttHolidays, setGanttHolidays] = useState<Array<{ date: string; name?: string; kind: 'holiday' }>>(() =>
    mapGanttHolidaysFromSnapshot(initialV2Snapshot?.holidays),
  );
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

  const [view, setView] = useState<'board' | 'gantt' | 'site_visits'>(initialView);
  const [query, setQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState<boolean>(() => !mapV2UnscheduledJobs(initialV2Snapshot?.unscheduledJobs).length);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnosticsResult | null>(null);
  const [recentTelemetryEvents, setRecentTelemetryEvents] = useState<ScheduleClientTelemetryEvent[]>(() => recentScheduleTelemetryEvents());
  const [syncing, setSyncing] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const devOnly = process.env.NODE_ENV !== 'production';
  const telemetryEmittedRef = useRef<Set<string>>(new Set());
  const boardFetchCountRef = useRef(0);
  const ganttFetchCountRef = useRef(0);
  const previousBoardFetchingRef = useRef(false);
  const previousGanttFetchingRef = useRef(false);

  const emitScheduleTelemetry = useCallback((input: Parameters<typeof sendScheduleTelemetry>[0]) => {
    const event = sendScheduleTelemetry(input);
    if (event && devOnly) setRecentTelemetryEvents(recentScheduleTelemetryEvents());
  }, [devOnly]);

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
    queryClient.setQueryData<ScheduleV2Snapshot>(boardSnapshotKey, {
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
    setActiveSnapshotKind(view === 'gantt' ? 'gantt' : 'board');
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

  const setScheduleView = (next: ScheduleView) => {
    if (next === view) return;
    const qs = new URLSearchParams(searchParams.toString());
    const viewParam = next === 'site_visits' ? 'site-visits' : next;
    qs.set('view', viewParam);
    const href = `/staff/schedule?${qs.toString()}`;
    const label = next === 'site_visits' ? 'Site visits' : next === 'gantt' ? 'Gantt' : 'Board';
    beginRouteTransition({ href, label, source: 'schedule-view', show: 'immediate' });
    startUiTransition(() => {
      router.replace(href);
      if (next === 'board' && activeSnapshotKind !== 'board') {
        v2GeneratedAtRef.current = '';
        setActiveSnapshotKind(null);
      }
      if (next !== 'site_visits') setView(next);
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

  const scheduleTabs = <ScheduleViewTabs view={view} onChange={setScheduleView} />;

  const boardSnapshotQuery = useQuery({
    ...scheduleV2SnapshotQueryOptions(hostKey, today),
    enabled: scheduleMode === 'v2' && view === 'board',
    initialData: scheduleMode === 'v2' && initialSnapshotKind === 'board' ? initialV2Snapshot ?? undefined : undefined,
    initialDataUpdatedAt: scheduleMode === 'v2' && initialSnapshotKind === 'board' ? initialV2SnapshotUpdatedAt : undefined,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 501) && failureCount < 1,
  });

  const ganttSnapshotQuery = useQuery({
    ...scheduleGanttV2SnapshotQueryOptions(hostKey, today, ganttRange),
    enabled: scheduleMode === 'v2' && view === 'gantt',
    initialData: scheduleMode === 'v2' && initialSnapshotKind === 'gantt' ? initialV2Snapshot ?? undefined : undefined,
    initialDataUpdatedAt: scheduleMode === 'v2' && initialSnapshotKind === 'gantt' ? initialV2SnapshotUpdatedAt : undefined,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 501) && failureCount < 1,
  });

  const activeV2SnapshotError = view === 'gantt' ? ganttSnapshotQuery.error : boardSnapshotQuery.error;
  const activeV2SnapshotIsFetching = view === 'gantt' ? ganttSnapshotQuery.isFetching : boardSnapshotQuery.isFetching;
  const activeV2SnapshotKind = view === 'gantt' ? 'gantt' : 'board';

  const v2ErrorNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialScheduleMode !== 'legacy') return;
    const key = 'fallback:server-schema-not-ready';
    if (telemetryEmittedRef.current.has(key)) return;
    telemetryEmittedRef.current.add(key);
    emitScheduleTelemetry({
      event: 'fallback_activated',
      view: initialView === 'site_visits' ? 'site_visits' : initialView,
      reason: 'server-schema-not-ready',
      meta: { initialSeedKind },
    });
  }, [emitScheduleTelemetry, initialScheduleMode, initialSeedKind, initialView]);

  useEffect(() => {
    if (boardSnapshotQuery.isFetching && !previousBoardFetchingRef.current) {
      boardFetchCountRef.current += 1;
      if (initialSnapshotKind === 'board' && boardFetchCountRef.current === 1) {
        emitScheduleTelemetry({
          event: 'duplicate_initial_fetch',
          view: 'board',
          counts: { fetchCount: boardFetchCountRef.current },
          meta: { initialSeedKind },
        });
      }
    }
    previousBoardFetchingRef.current = boardSnapshotQuery.isFetching;
  }, [boardSnapshotQuery.isFetching, emitScheduleTelemetry, initialSeedKind, initialSnapshotKind]);

  useEffect(() => {
    if (ganttSnapshotQuery.isFetching && !previousGanttFetchingRef.current) {
      ganttFetchCountRef.current += 1;
      if (initialSnapshotKind === 'gantt' && ganttFetchCountRef.current === 1) {
        emitScheduleTelemetry({
          event: 'duplicate_initial_fetch',
          view: 'gantt',
          counts: { fetchCount: ganttFetchCountRef.current },
          meta: { initialSeedKind },
        });
      }
    }
    previousGanttFetchingRef.current = ganttSnapshotQuery.isFetching;
  }, [emitScheduleTelemetry, ganttSnapshotQuery.isFetching, initialSeedKind, initialSnapshotKind]);

  function applySnapshotFromQuery(snapshot: ScheduleV2Snapshot, kind: 'board' | 'gantt') {
    const incomingGeneratedAt = typeof snapshot.generatedAt === 'string' && snapshot.generatedAt ? snapshot.generatedAt : nowIso();
    const latestGeneratedAt = v2GeneratedAtRef.current;
    const replacingSnapshotKind = activeSnapshotKind !== kind;
    if (!replacingSnapshotKind && v2PendingMutationsRef.current > 0 && latestGeneratedAt && incomingGeneratedAt <= latestGeneratedAt) return;

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
    setUnscheduledJobsSeed(nextUnscheduled);
    setScheduleConflicts(nextConflicts);
    setNextAvailableByInstallerId(nextAvail);
    setActiveSnapshotKind(kind);
    setHydrated(true);

    const telemetryKey = `hydrated:${kind}`;
    if (!telemetryEmittedRef.current.has(telemetryKey)) {
      telemetryEmittedRef.current.add(telemetryKey);
      emitScheduleTelemetry({
        event: 'schedule_hydrated',
        view: kind,
        counts: {
          installers: snapshot.installers.length,
          projects: snapshot.projects.length,
          scheduleItems: nextItems.length,
          unscheduledJobs: nextUnscheduled.length,
        },
        meta: {
          source: initialV2SnapshotProp ? 'server_seed' : hydratedFromCacheRef.current ? 'cache_or_query' : 'query',
          generatedAt: incomingGeneratedAt,
        },
      });
    }
  }

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view !== 'board') return;
    const snapshot = boardSnapshotQuery.data ?? queryClient.getQueryData<ScheduleV2Snapshot>(boardSnapshotKey) ?? null;
    if (!snapshot) return;
    applySnapshotFromQuery(snapshot, 'board');
  }, [activeSnapshotKind, boardSnapshotKey, boardSnapshotQuery.data, boardSnapshotQuery.isFetching, queryClient, scheduleMode, view]);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view !== 'gantt') return;
    if (!ganttSnapshotQuery.data) return;
    applySnapshotFromQuery(ganttSnapshotQuery.data, 'gantt');
  }, [activeSnapshotKind, ganttSnapshotQuery.data, scheduleMode, view]);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;
    setSyncing(activeV2SnapshotIsFetching || v2PendingMutationsRef.current > 0);
  }, [activeV2SnapshotIsFetching, scheduleMode, view]);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;

    const err = activeV2SnapshotError;
    if (!err) {
      v2ErrorNotifiedRef.current = null;
      return;
    }

    const errKey = err instanceof Error ? err.message : String(err);
    if (v2ErrorNotifiedRef.current === errKey) return;
    v2ErrorNotifiedRef.current = errKey;

    if (err instanceof ApiError && err.status === 501) {
      toast.error(err.message || 'Schedule v2 schema not ready yet. Falling back to legacy.');
      const telemetryKey = `fallback:client-schema-not-ready:${activeV2SnapshotKind}`;
      if (!telemetryEmittedRef.current.has(telemetryKey)) {
        telemetryEmittedRef.current.add(telemetryKey);
        emitScheduleTelemetry({
          event: 'fallback_activated',
          view: activeV2SnapshotKind,
          reason: 'client-schema-not-ready',
          requestId: err.requestId ?? null,
          meta: { status: err.status },
        });
      }
      setLegacyFallbackReason('client-schema-not-ready');
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
      setScheduleConflicts([]);
      setNextAvailableByInstallerId(new Map());
      setActiveSnapshotKind(null);
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
  }, [activeV2SnapshotError, activeV2SnapshotKind, emitScheduleTelemetry, installers.length, projects.length, scheduleItems.length, scheduleMode, toast, view]);

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
    return buildScheduleBoardModelV2({
      installers,
      orphanedScheduleItems,
      projects,
      projectsById,
      query: deferredQuery,
      scheduleItems,
      scheduleItemsRenderable,
      unscheduledJobsSeed,
      visibleScheduleItems,
    });
  }, [
    deferredQuery,
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
  const emptyEstimatesById = useMemo(() => new Map(), []);

  const schedule = useMemo(() => {
    const base = buildScheduleBarsFromForecast({ scheduleItems: visibleScheduleItems, projectsById });
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
  }, [projectsById, scheduleConflicts, visibleScheduleItems]);

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
    setSyncing(true);
    void queryClient.invalidateQueries({ queryKey: view === 'gantt' ? ganttSnapshotKey : boardSnapshotKey });
  }

  async function runWithCommitConfirmation(
    run: (force: boolean) => Promise<any>,
    opts?: {
      successToast?: string;
      errorToast?: string;
      refreshOnError?: boolean;
      formatErrorToast?: (error: unknown, fallback: string) => string;
      onSuccess?: (response: unknown) => void;
      onError?: (error: unknown) => void;
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

        opts?.onSuccess?.(res);
        if (opts?.successToast) toast.success(opts.successToast);
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to update schedule.';
        const fallback = opts?.errorToast ?? msg;
        opts?.onError?.(err);
        toast.error(opts?.formatErrorToast ? opts.formatErrorToast(err, fallback) : fallback);
        if (opts?.refreshOnError !== false && v2PendingMutationsRef.current <= 1) refreshSchedule();
        return false;
      } finally {
        v2PendingMutationsRef.current = Math.max(0, v2PendingMutationsRef.current - 1);
        if (v2PendingMutationsRef.current === 0 && !activeV2SnapshotIsFetching) {
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
      opts?.onSuccess?.(res);
      refreshSchedule();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update schedule.';
      const fallback = opts?.errorToast ?? msg;
      opts?.onError?.(err);
      toast.error(opts?.formatErrorToast ? opts.formatErrorToast(err, fallback) : fallback);
      return false;
    }
  }

  function scheduleMutationErrorDebug(error: unknown): Record<string, unknown> {
    if (error instanceof ApiError) {
      return {
        status: error.status,
        requestId: error.requestId ?? null,
        message: error.message,
        body: error.body,
      };
    }
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }
    return {
      message: String(error),
    };
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

  async function persist(
    _next: ScheduleItem[],
    opts?: { successToast?: string; errorToast?: string },
  ): Promise<boolean> {
    toast.error(opts?.errorToast ?? 'Legacy schedule changes are handled by the fallback client. Refresh and try again.');
    return false;
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

    return false;
  }

  async function handleRemoveOrphanedScheduleItems() {
    if (scheduleMode === 'v2') {
      toast.info('Orphan cleanup is not available in Schedule V2 yet.');
      return;
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

  const handleGanttOpenProject = (projectId: string) => {
    router.push(`/staff/projects/${encodeURIComponent(projectId)}`);
  };

  const handleGanttOpenProjectPack = (projectId: string, estimateId: string) => {
    router.push(`/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(estimateId)}`);
  };

  const handleGanttOpenPinEdit = (id: string, requestedStart: string) => {
    if (isYmd(requestedStart)) {
      setPinEdit({ id, requestedStart });
      return;
    }
    openPinEdit(id);
  };

  const handleGanttUnpinScheduleItem = (id: string) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }
    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;
    void queueUnpinJob(jobUuid, {
      successToast: 'Job unpinned.',
      errorToast: 'Failed to unpin job.',
    });
  };

  const handleGanttAckClientUpdate = (id: string) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }
    const jobUuid = resolveProjectUuid(item);
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
  };

  const handleGanttMovePin = (id: string, requestedStart: string) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }
    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;
    void queuePinJob(jobUuid, requestedStart, {
      successToast: 'Job pinned.',
      errorToast: 'Failed to pin job.',
    });
  };

  const handleGanttResizePin = (id: string, requestedStart: string, durationDays: number) => {
    const item = scheduleItemById.get(id) ?? null;
    if (!item || item.itemType === 'downtime') {
      toast.error('Scheduled job not found.');
      return;
    }
    const jobUuid = resolveProjectUuid(item);
    if (!jobUuid) return;
    const nextDuration = Math.max(1, Math.round(durationDays));
    void (async () => {
      const ok = await queueSetDurationJob(jobUuid, nextDuration, {
        successToast: 'Duration updated.',
        errorToast: 'Failed to update duration.',
      });
      if (!ok) return;
      await queuePinJob(jobUuid, requestedStart, {
        successToast: 'Job pinned.',
        errorToast: 'Failed to pin job.',
      });
    })();
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
      if (v2PendingMutationsRef.current === 0 && !activeV2SnapshotIsFetching) {
        setSyncing(false);
      }
    }
  };

  function buildDowntimeMenuActions(id: string, scheduleItem: ScheduleItem): ScheduleBoardMenuAction[] {
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
  }): ScheduleBoardMenuAction[] {
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
      const v2Actions: ScheduleBoardMenuAction[] = [];
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

    return [];
  }

  function handleBoardDrop(activeId: string, dropTarget: ScheduleBoardDrop) {
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

        const assignDebug = {
          activeId,
          activeType: 'unscheduled',
          projectId: job.projectId,
          projectUuid,
          crewId: destInstallerId,
          crewUuid,
          position: destIndex,
          overId: resolvedOverId,
          drop: dropTarget.debug ?? null,
        };
        logScheduleDebug('board.assign.attempt', assignDebug);

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
              onSuccess: (response) => logScheduleDebug('board.assign.success', { ...assignDebug, response }),
              onError: (error) => logScheduleDebug('board.assign.failure', { ...assignDebug, error: scheduleMutationErrorDebug(error) }),
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

        const reorderDebug = {
          activeId,
          activeType: activeItem.itemType ?? 'job',
          crewId: destInstallerId,
          crewUuid,
          sourceLaneId: sourceInstallerId,
          destinationLaneId: destInstallerId,
          insertionIndex: insertAt,
          overId: resolvedOverId,
          orderedItemIds: nextDest,
          orderedScheduleItemUuids: ordered,
          drop: dropTarget.debug ?? null,
        };
        logScheduleDebug('board.reorder.attempt', reorderDebug);

        const optimisticItems = optimisticReorderCrew(scheduleItemsRef.current, destInstallerId, nextDest);
        applyV2OptimisticState(optimisticItems, unscheduledJobsSeedRef.current);

        void (async () => {
          await runWithCommitConfirmation(
            (force) => reorderScheduleItemsV2({ crew_id: crewUuid, ordered_item_ids: ordered, force, today }),
            {
              successToast: 'Schedule updated.',
              errorToast: 'Failed to reorder schedule.',
              onSuccess: (response) => logScheduleDebug('board.reorder.success', { ...reorderDebug, response }),
              onError: (error) => logScheduleDebug('board.reorder.failure', { ...reorderDebug, error: scheduleMutationErrorDebug(error) }),
            },
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

        const moveDebug = {
          activeId,
          activeType: 'scheduled',
          scheduleItemId: activeItem.id,
          scheduledJobId: activeItem.scheduledJobId ?? null,
          projectId: activeItem.projectId,
          projectUuid,
          sourceLaneId: sourceInstallerId,
          destinationLaneId: destInstallerId,
          crewUuid,
          position: insertAt,
          overId: resolvedOverId,
          drop: dropTarget.debug ?? null,
        };
        logScheduleDebug('board.assign.attempt', moveDebug);

        const optimisticItems = optimisticMoveBetweenCrews(scheduleItemsRef.current, activeId, sourceInstallerId, destInstallerId, insertAt);
        applyV2OptimisticState(optimisticItems, unscheduledJobsSeedRef.current);

        void (async () => {
          await runWithCommitConfirmation(
            (force) => assignJob({ job_id: projectUuid, crew_id: crewUuid, position: insertAt, force, today }),
            {
              successToast: 'Job moved.',
              errorToast: 'Failed to move job.',
              formatErrorToast: formatAssignMutationErrorToast,
              onSuccess: (response) => logScheduleDebug('board.assign.success', { ...moveDebug, response }),
              onError: (error) => logScheduleDebug('board.assign.failure', { ...moveDebug, error: scheduleMutationErrorDebug(error) }),
            },
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
          host: getScheduleSupabaseHost(),
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
      recentTelemetryEvents={recentTelemetryEvents}
      onToggle={() => setDiagnosticsOpen((value) => !value)}
      onRun={handleRunDiagnostics}
    />
  ) : null;

  if (scheduleMode === 'legacy') {
    return (
      <LazyScheduleLegacyFallbackClient
        initialReason={legacyFallbackReason}
        today={today}
        initialView={view === 'gantt' ? 'gantt' : 'board'}
      />
    );
  }

  const waitingForBoardSnapshot = scheduleMode === 'v2' && view === 'board' && activeSnapshotKind !== 'board';

  if (!hydrated || waitingForBoardSnapshot) {
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

        {view === 'gantt' ? (
          <div className={styles.panels}>
            <section className={styles.mainPanel} aria-label="Installer lanes">
              <LazyScheduleGanttView
                today={today}
                scheduleMode={scheduleMode}
                installers={installers}
                laneItems={laneItems}
                visibleScheduleItems={visibleScheduleItems}
                projectsById={projectsById}
                estimatesById={emptyEstimatesById}
                scheduleBars={schedule.bars}
                scheduleIssues={schedule.issues}
                holidays={ganttHolidays}
                showCompleted={showCompleted}
                onShowCompletedChange={handleShowCompletedChange}
                onOpenProject={handleGanttOpenProject}
                onOpenProjectPack={handleGanttOpenProjectPack}
                onOpenCommitmentEdit={openCommitmentEdit}
                onOpenPinEdit={handleGanttOpenPinEdit}
                onUnpinScheduleItem={handleGanttUnpinScheduleItem}
                onAckClientUpdate={handleGanttAckClientUpdate}
                onMovePin={handleGanttMovePin}
                onResizePin={handleGanttResizePin}
              />
            </section>
          </div>
        ) : (
          <LazyScheduleBoardView
            today={today}
            scheduleMode={scheduleMode}
            installers={installers}
            schedulable={schedulable}
            unscheduledJobs={unscheduledJobs}
            unscheduledJobsAll={unscheduledJobsAll}
            laneItems={laneItems}
            scheduleItemById={scheduleItemById}
            barsByScheduleId={barsByScheduleId}
            issueLevelByScheduleId={issueLevelByScheduleId}
            nextAvailableByInstallerId={nextAvailableByInstallerId}
            unscheduledCollapsed={unscheduledCollapsed}
            query={query}
            showCompleted={showCompleted}
            onQueryChange={setQuery}
            onToggleUnscheduledCollapsed={handleToggleUnscheduledCollapsed}
            onShowCompletedChange={handleShowCompletedChange}
            onDrop={handleBoardDrop}
            buildJobMenuActions={buildJobMenuActions}
            buildDowntimeMenuActions={buildDowntimeMenuActions}
          />
        )}

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
