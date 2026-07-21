'use client';

import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import styles from './schedule.module.css';
import { listInstallers } from '@/lib/repo/installersRepo';
import { getProject, listProjects } from '@/lib/repo/projectsRepo';
import { listAllEstimates } from '@/lib/repo/estimatesRepo';
import { confirmScheduleItem, listScheduleItems, normalizeScheduleItemsStarted, replaceScheduleItems, unlockScheduleItem } from '@/lib/repo/scheduleRepo';
import { qk } from '@/lib/queries/keys';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import type { Estimate } from '@/lib/types/estimate';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { Installer, ScheduleItem, ScheduleItemStatus, SchedulingIssue } from '@/lib/types/scheduling';
import { buildScheduleBars } from '@/lib/scheduling/engine';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { addDaysYmd, isYmd } from '@/lib/scheduling/date';
import { resolveScheduleTodayYmd, SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import { useToast } from '@/components/ui/toast/ToastProvider';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { SupabaseRepoError } from '@/lib/supabase/repoError';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { ApiError } from '@/lib/repo/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PORTAL_DEFAULT_ACCENT_HEX } from '@/lib/theme/presets';
import { runScheduleDiagnostics } from '@/lib/queries/scheduleDiagnostics';
import ScheduleActionModals, { type ScheduleModalState } from './ScheduleActionModals';
import type { ScheduleDiagnosticsResult } from './ScheduleDiagnosticsPanel';
import type { ScheduleBoardDrop, ScheduleBoardMenuAction, ScheduleBoardViewProps } from './ScheduleBoardView';
import type { ScheduleGanttViewProps } from './ScheduleGanttView';
import ScheduleViewTabs, { type ScheduleView } from './ScheduleViewTabs';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import { EMPTY_SCHEDULE_BOARD_MODEL, isCompletedScheduleItem, safeProjectName } from './ScheduleBoardModelShared';
import { buildScheduleBoardModelLegacy, toScheduleProjectSummary } from './ScheduleBoardModelLegacy';
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

const LazyScheduleDiagnosticsPanel = dynamic(() => import('./ScheduleDiagnosticsPanel'), {
  ssr: false,
});

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

export type ScheduleLegacyFallbackClientProps = {
  initialReason?: 'server-schema-not-ready' | 'client-schema-not-ready';
  today: string;
  initialView?: Extract<ScheduleView, 'board' | 'gantt'>;
};

export default function ScheduleLegacyFallbackClient({
  initialReason,
  today: todayProp,
  initialView,
}: ScheduleLegacyFallbackClientProps) {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { beginRouteTransition } = usePortalRouteTransition();
  const queryClient = useQueryClient();
  const [isTransitionPending, startUiTransition] = useTransition();
  const hydratedFromCacheRef = useRef(false);
  const scheduleItemsRef = useRef<ScheduleItem[]>([]);
  const installersRef = useRef<Installer[]>([]);
  const projectsRef = useRef<ScheduleProjectSummary[]>([]);

  const today = useMemo(() => todayProp || resolveScheduleTodayYmd(), [todayProp]);

  const supabaseHost = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()), []);
  const hostKey = supabaseHost || 'unknown';

  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; table?: string; code?: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [projects, setProjects] = useState<ScheduleProjectSummary[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [estimatesById, setEstimatesById] = useState<Map<string, Estimate>>(() => new Map());
  const scheduleMode: 'legacy' = 'legacy';
  const nextAvailableByInstallerId = useMemo(() => new Map<string, string>(), []);
  const ganttHolidays = useMemo<Array<{ date: string; name?: string; kind: 'holiday' }>>(() => [], []);
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
    if (initialView === 'board' || initialView === 'gantt') return initialView;
    const raw = (searchParams.get('view') || '').trim().toLowerCase();
    if (raw === 'site-visits') return 'site_visits';
    if (raw === 'gantt') return 'gantt';
    return 'board';
  });
  const [query, setQuery] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState<boolean>(true);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ScheduleDiagnosticsResult | null>(null);
  const [recentTelemetryEvents, setRecentTelemetryEvents] = useState<ScheduleClientTelemetryEvent[]>(() => recentScheduleTelemetryEvents());
  const [syncing, setSyncing] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const devOnly = process.env.NODE_ENV !== 'production';
  const legacyTelemetryEmittedRef = useRef<Set<string>>(new Set());

  const emitLegacyScheduleTelemetry = useCallback((input: Parameters<typeof sendScheduleTelemetry>[0]) => {
    const event = sendScheduleTelemetry(input);
    if (event && devOnly) setRecentTelemetryEvents(recentScheduleTelemetryEvents());
  }, [devOnly]);

  useEffect(() => {
    const key = 'legacy_fallback_mounted';
    if (legacyTelemetryEmittedRef.current.has(key)) return;
    legacyTelemetryEmittedRef.current.add(key);
    emitLegacyScheduleTelemetry({
      event: 'legacy_fallback_mounted',
      view: 'legacy',
      reason: initialReason ?? 'unknown',
      meta: {
        initialReason: initialReason ?? 'unknown',
        loadSource: 'component',
      },
    });
  }, [emitLegacyScheduleTelemetry, initialReason]);

  useEffect(() => {
    scheduleItemsRef.current = scheduleItems;
  }, [scheduleItems]);

  useEffect(() => {
    installersRef.current = installers;
  }, [installers]);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  const setScheduleView = (next: ScheduleView, control: HTMLButtonElement) => {
    if (next === view) return;
    const qs = new URLSearchParams(searchParams.toString());
    const viewParam = next === 'site_visits' ? 'site-visits' : next;
    qs.set('view', viewParam);
    const href = `/staff/schedule?${qs.toString()}`;
    const label = next === 'site_visits' ? 'Site visits' : next === 'gantt' ? 'Gantt' : 'Board';
    beginRouteTransition({ href, label, source: 'schedule-view', control });
    startUiTransition(() => {
      router.replace(href);
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

  useEffect(() => {
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
      const telemetryKey = 'legacy_fallback_cache_used';
      if (!legacyTelemetryEmittedRef.current.has(telemetryKey)) {
        legacyTelemetryEmittedRef.current.add(telemetryKey);
        emitLegacyScheduleTelemetry({
          event: 'legacy_fallback_cache_used',
          view: 'legacy',
          reason: initialReason ?? 'unknown',
          counts: {
            installers: cachedInstallers.length,
            projects: cachedProjects.length,
            scheduleItems: cachedItems.length,
          },
          meta: { loadSource: 'cache' },
        });
      }
    } catch {
      // ignore cache failures
    }
  }, [cachedSnapshot, emitLegacyScheduleTelemetry, hydrated, initialReason, scheduleMode]);

	  useEffect(() => {
	    let cancelled = false;
	    void (async () => {
	      if (view === 'site_visits') return;
	      if (scheduleMode !== 'legacy') return;
        const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
        emitLegacyScheduleTelemetry({
          event: 'legacy_fallback_hydrated',
          view: 'legacy',
          reason: initialReason ?? 'unknown',
          timings: {
            loadMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
          },
          counts: {
            installers: installers.length,
            projects: scheduleProjects.length,
            scheduleItems: normalised.length,
            estimates: allEstimates.length,
          },
          meta: { loadSource: 'repo' },
        });

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
        const showingCached =
          hydratedFromCacheRef.current ||
          installersRef.current.length > 0 ||
          scheduleItemsRef.current.length > 0 ||
          projectsRef.current.length > 0;
        const errorType = err instanceof SupabaseRepoError ? 'supabase_repo_error' : err instanceof Error ? err.name || 'error' : 'unknown';
        const table = err instanceof SupabaseRepoError ? err.table : undefined;
        emitLegacyScheduleTelemetry({
          event: 'legacy_fallback_load_failed',
          view: 'legacy',
          reason: showingCached ? 'refresh_failed_showing_cache' : 'initial_load_failed',
          timings: {
            loadMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt,
          },
          counts: {
            installers: installersRef.current.length,
            projects: projectsRef.current.length,
            scheduleItems: scheduleItemsRef.current.length,
          },
          meta: {
            loadSource: 'repo',
            errorType,
            ...(table ? { table } : null),
          },
        });
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
  }, [emitLegacyScheduleTelemetry, initialReason, reloadNonce, toast, view, scheduleMode, today]);

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
    return buildScheduleBoardModelLegacy({
      estimatesById,
      installers,
      projects,
      projectsById,
      query: deferredQuery,
      scheduleItems,
      visibleScheduleItems,
    });
  }, [
    deferredQuery,
    estimatesById,
    installers,
    projects,
    projectsById,
    scheduleItems,
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
    return buildScheduleBars({
      today,
      installers,
      scheduleItems: visibleScheduleItems,
      projectsById,
      estimatesById,
    });
  }, [estimatesById, installers, projectsById, today, visibleScheduleItems]);

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
    setReloadNonce((n) => n + 1);
  }

  async function persist(
    next: ScheduleItem[],
    opts?: { successToast?: string; errorToast?: string },
  ): Promise<boolean> {
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

  async function handleUnschedule(id: string): Promise<boolean> {
    const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
    if (isLockedScheduleStatus(status) && typeof window !== 'undefined') {
      const ok = window.confirm(`This job is ${scheduleStatusLabel(status)}. Unschedule anyway?`);
      if (!ok) return false;
    }
    const next = scheduleItems.filter((i) => i.id !== id);
    return await persist(next, { successToast: 'Job unscheduled.', errorToast: 'Failed to unschedule job.' });
  }

  async function handleConfirmSchedule(id: string) {
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

  const showLegacyUnavailable = (message: string) => {
    toast.info(message);
  };

  const openCommitmentEdit = () => {
    showLegacyUnavailable('Schedule commitments are not available in the legacy fallback.');
  };

  const openPinEdit = () => {
    showLegacyUnavailable('Schedule pinning is not available in the legacy fallback.');
  };

  const handleGanttOpenProject = (projectId: string) => {
    router.push(`/staff/projects/${encodeURIComponent(projectId)}`);
  };

  const handleGanttOpenProjectPack = (projectId: string, estimateId: string) => {
    router.push(`/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(estimateId)}`);
  };

  const handleGanttOpenPinEdit = (id: string, requestedStart: string) => {
    if (isYmd(requestedStart)) {
      openPinEdit();
      return;
    }
    openPinEdit();
  };

  const handleGanttUnpinScheduleItem = (id: string) => {
    void id;
    showLegacyUnavailable('Schedule pinning is not available in the legacy fallback.');
  };

  const handleGanttAckClientUpdate = (id: string) => {
    void id;
    showLegacyUnavailable('Client update acknowledgements are not available in the legacy fallback.');
  };

  const handleGanttMovePin = (id: string, requestedStart: string) => {
    void id;
    void requestedStart;
    showLegacyUnavailable('Schedule pinning is not available in the legacy fallback.');
  };

  const handleGanttResizePin = (id: string, requestedStart: string, durationDays: number) => {
    void id;
    void requestedStart;
    void durationDays;
    showLegacyUnavailable('Schedule pinning and duration edits are not available in the legacy fallback.');
  };

  function buildDowntimeMenuActions(id: string, scheduleItem: ScheduleItem): ScheduleBoardMenuAction[] {
    void scheduleItem;

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
    scheduleStatus,
  }: {
    id: string;
    scheduleItem: ScheduleItem;
    job: SchedulableJob | null;
    scheduleStatus: ScheduleItemStatus;
  }): ScheduleBoardMenuAction[] {
    if (scheduleItem.itemType === 'downtime') return [];

    const locked = isLockedScheduleStatus(scheduleStatus);
    const legacyActions: ScheduleBoardMenuAction[] = [
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

  function handleBoardDrop(activeId: string, dropTarget: ScheduleBoardDrop) {
    const resolvedOverId = dropTarget.kind === 'lane' ? dropTarget.overId ?? `lane:${dropTarget.laneId}` : dropTarget.overId;

    const isScheduled = scheduleItems.some((i) => i.id === activeId);

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
    toast.info('Schedule commitments are not available in the legacy fallback.');
    setCommitmentEdit(null);
  };

  const handleSaveDuration = () => {
    if (!durationEdit) return;
    toast.info('Duration edits are not available in the legacy fallback.');
    setDurationEdit(null);
  };

  const handleSavePin = () => {
    if (!pinEdit) return;
    toast.info('Schedule pinning is not available in the legacy fallback.');
    setPinEdit(null);
  };

  const handleSaveDaysRemaining = () => {
    if (!daysRemainingEdit) return;
    toast.info('Days remaining edits are not available in the legacy fallback.');
    setDaysRemainingEdit(null);
  };

  const handleSaveDowntime = () => {
    if (!downtimeEdit) return;
    toast.info('Downtime editing is not available in the legacy fallback.');
    setDowntimeEdit(null);
  };

  const handleFinishEarlyKeepSchedule = () => {
    if (!finishEarlyPrompt) return;
    toast.info('Finish-early actions are not available in the legacy fallback.');
    setFinishEarlyPrompt(null);
  };

  const handleFinishEarlyPullForward = () => {
    if (!finishEarlyPrompt) return;
    toast.info('Finish-early actions are not available in the legacy fallback.');
    setFinishEarlyPrompt(null);
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

  const legacyFallbackNotice = initialReason ? (
    <section className={styles.issues} aria-label="Legacy schedule fallback">
      <div className={styles.issuesHeader}>
        <div>
          <h2 className={styles.panelTitle}>Legacy schedule fallback</h2>
          <p className={styles.hint}>
            {initialReason === 'server-schema-not-ready'
              ? 'Schedule V2 schema was not ready during the server load. Showing the legacy schedule fallback.'
              : 'Schedule V2 schema was not ready during refresh. Showing the legacy schedule fallback.'}
          </p>
        </div>
      </div>
    </section>
  ) : null;

  if (!hydrated) {
    return (
      <PageLayout width="full" density="compact" data-ui-foundation-consumer="schedule" className={cx(styles.page, styles.pageLocked)}>
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
      </PageLayout>
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
      <PageLayout width="full" density="compact" data-ui-foundation-consumer="schedule" className={cx(styles.page, styles.pageLocked)}>
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
      </PageLayout>
    );
  }

  return (
    <PageLayout width="full" density="compact" data-ui-foundation-consumer="schedule" className={cx(styles.page, styles.pageLocked)}>
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
        {legacyFallbackNotice}

        {schedulingIssues.length ? (
          <section className={styles.issues} aria-label="Scheduling issues">
            <div className={styles.issuesHeader}>
              <div className={styles.issueSummaryRow}>
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
                estimatesById={estimatesById}
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
        <ScheduleActionModals
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
    </PageLayout>
  );
}
