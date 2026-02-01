'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './schedule.module.css';
import { listInstallers } from '@/lib/repo/installersRepo';
import { getProject, listProjects } from '@/lib/repo/projectsRepo';
import { listAllEstimates } from '@/lib/repo/estimatesRepo';
import { confirmScheduleItem, deleteScheduleItem, listScheduleItems, normalizeScheduleItemsStarted, replaceScheduleItems, unlockScheduleItem } from '@/lib/repo/scheduleRepo';
import { scheduleSnapshotSWRKey } from '@/lib/cache/scheduleSnapshotKey';
import type { Estimate } from '@/lib/types/estimate';
import type { Project } from '@/lib/types/project';
import { nextActionTypeLabel, PROJECT_STATUS_ORDER, normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { Installer, ScheduleItem, ScheduleItemStatus, SchedulingIssue } from '@/lib/types/scheduling';
import { isCalculatorInputsV2, isLegacyCalculatorInputsV1 } from '@/lib/types/calculator';
import { buildScheduleBars } from '@/lib/scheduling/engine';
import { deriveDurationHoursFromEstimate, WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { addDaysYmd, diffDaysYmd, isYmd, todayYmd } from '@/lib/scheduling/date';
import { useToast } from '@/components/ui/toast/ToastProvider';
import Modal from '@/components/ui/modal/Modal';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { newId } from '@/lib/utils/id';
import { nowIso } from '@/lib/utils/time';
import { SupabaseRepoError } from '@/lib/supabase/repoError';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { ApiError } from '@/lib/repo/apiClient';
import useSWR from 'swr';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  type DragMoveEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SiteVisitsView from './SiteVisitsView';

type SchedulableJob = {
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

const GANTT_DAY_PX = 18;
const GANTT_LABEL_PX = 420;
const GANTT_BAR_LABEL_MIN_PX = 120;

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

type GanttRow =
  | {
      kind: 'group';
      id: string;
      installerId: string;
      label: string;
      color: string;
      jobCount: number;
      collapsed: boolean;
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
      startDate: string;
      endDate: string;
      barLeftPx: number;
      barWidthPx: number;
      barColor: string;
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

function formatShortDate(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short' }).format(dt);
}

function formatDateRange(startYmd: string, endYmd: string): string {
  return `${formatShortDate(startYmd)} → ${formatShortDate(endYmd)}`;
}

function makeJobId(projectId: string, estimateId: string): string {
  return `job_${projectId}_${estimateId}`;
}

function normaliseEnumValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function isApprovedEstimate(estimate: Estimate): boolean {
  return normaliseEnumValue((estimate as any).status) === 'approved';
}

function getLatestApprovedEstimate(estimates: Estimate[]): Estimate | null {
  const approved = estimates.filter((e) => isApprovedEstimate(e));
  if (!approved.length) return null;
  approved.sort((a, b) => ((b as any).version ?? 0) - ((a as any).version ?? 0) || b.createdAt.localeCompare(a.createdAt));
  return approved[0] ?? null;
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

function JobActionsMenu({
  onUnschedule,
  onQuickEdit,
  onConfirm,
  onUnlock,
}: {
  onUnschedule: () => void;
  onQuickEdit?: () => void;
  onConfirm?: () => void;
  onUnlock?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.kebab}
        aria-haspopup="menu"
        aria-expanded={open}
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
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {onConfirm ? (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onConfirm();
              }}
            >
              Confirm dates
            </button>
          ) : null}
          {onUnlock ? (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onUnlock();
              }}
            >
              Unlock
            </button>
          ) : null}
          {onQuickEdit ? (
            <button
              type="button"
              role="menuitem"
              className={styles.menuItem}
              onMouseDown={(e) => {
                // Safari + nested handlers: ensure pointer interaction triggers even if click is suppressed.
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                window.setTimeout(() => onQuickEdit(), 0);
              }}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                // Run after the menu closes to avoid any event-ordering/unmount edge cases.
                window.setTimeout(() => onQuickEdit(), 0);
              }}
            >
              Quick edit…
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={styles.menuItem}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onUnschedule();
            }}
          >
            Unschedule
          </button>
        </div>
      ) : null}
    </div>
  );
}

function JobCardShell({
  title,
  descriptor,
  statusLabel,
  durationLabel,
  durationTitle,
  scheduleStatus,
  onOpen,
  dateLine,
  warning,
  issueLevel,
  dragHandleRef,
  dragHandleProps,
  dragDisabled,
  dragDisabledTitle,
  menu,
  cardRef,
  style,
  dropTarget,
}: {
  title: string;
  descriptor: string;
  statusLabel: string;
  durationLabel: string;
  durationTitle: string;
  scheduleStatus?: ScheduleItemStatus;
  onOpen?: () => void;
  dateLine?: string;
  warning?: boolean;
  issueLevel?: 'warning' | 'error';
  dragHandleRef: (node: HTMLElement | null) => void;
  dragHandleProps: Record<string, unknown>;
  dragDisabled?: boolean;
  dragDisabledTitle?: string;
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
      data-drop-target={dropTarget ? 'true' : 'false'}
      data-clickable={onOpen ? 'true' : 'false'}
      data-issue-level={issueLevel ?? (warning ? 'warning' : undefined)}
      role={onOpen ? 'link' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={styles.jobTopRow}>
        <button
          type="button"
          className={styles.dragHandle}
          ref={dragHandleRef as any}
          aria-label="Drag job"
          disabled={Boolean(dragDisabled)}
          title={dragDisabledTitle}
          onClick={(e) => e.stopPropagation()}
          {...(dragHandleProps as any)}
        >
          ⋮⋮
        </button>

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
        {scheduleStatus ? <span className={styles.schedulePill}>{scheduleStatusLabel(scheduleStatus)}</span> : null}
        {issueLevel === 'error' ? <span className={styles.warnBadge}>Conflict</span> : warning || issueLevel === 'warning' ? <span className={styles.warnBadge}>Warning</span> : null}
      </div>

      {dateLine ? <div className={styles.dateLine}>{dateLine}</div> : null}
    </div>
  );
}

function UnscheduledJobCard({ job }: { job: SchedulableJob }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { kind: 'job' },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  } as React.CSSProperties;

  return (
    <JobCardShell
      title={job.projectName}
      descriptor={job.descriptor}
      statusLabel={formatStatusLabel(job.status)}
      durationLabel={job.durationLabel}
      durationTitle={job.durationTitle}
      onOpen={() => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`)}
      warning={job.warnings.length > 0}
      dragHandleRef={(node) => setActivatorNodeRef(node as any)}
      dragHandleProps={{ ...attributes, ...listeners }}
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
  onUnschedule,
  onQuickEdit,
  onConfirm,
  onUnlock,
  issueLevel,
}: {
  id: string;
  job: SchedulableJob | null;
  scheduleStatus: ScheduleItemStatus;
  dateLine?: string;
  dropTarget?: boolean;
  onUnschedule: () => void;
  onQuickEdit?: () => void;
  onConfirm?: () => void;
  onUnlock?: () => void;
  issueLevel?: 'warning' | 'error';
}) {
  const router = useRouter();
  const locked = isLockedScheduleStatus(scheduleStatus);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as React.CSSProperties;

  return (
    <JobCardShell
      title={job?.projectName ?? 'Untitled project'}
      descriptor={job?.descriptor ?? '—'}
      statusLabel={formatStatusLabel(job?.status ?? '')}
      durationLabel={job?.durationLabel ?? '—'}
      durationTitle={job?.durationTitle ?? '—'}
      scheduleStatus={scheduleStatus}
      onOpen={
        job
          ? () => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`)
          : undefined
      }
      dateLine={dateLine}
      warning={Boolean(job?.warnings?.length)}
      issueLevel={issueLevel}
      dragHandleRef={(node) => setActivatorNodeRef(node as any)}
      dragHandleProps={locked ? {} : { ...attributes, ...listeners }}
      dragDisabled={locked}
      dragDisabledTitle={locked ? `${scheduleStatusLabel(scheduleStatus)} jobs are locked. Unlock to reschedule.` : undefined}
      menu={<JobActionsMenu onUnschedule={onUnschedule} onQuickEdit={onQuickEdit} onConfirm={onConfirm} onUnlock={onUnlock} />}
      cardRef={(node) => setNodeRef(node as any)}
      style={style}
      dropTarget={dropTarget}
    />
  );
}

export default function ScheduleClient() {
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const laneBodyRefs = useRef(new Map<string, HTMLDivElement | null>());
  const unscheduledBodyRef = useRef<HTMLDivElement | null>(null);
  const hydratedFromCacheRef = useRef(false);

  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<{ message: string; table?: string; code?: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);
  const [estimatesById, setEstimatesById] = useState<Map<string, Estimate>>(new Map());
  const [quickEdit, setQuickEdit] = useState<{ id: string; startDateOverride: string; durationDays: string } | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const [view, setView] = useState<'board' | 'gantt' | 'site_visits'>(() => {
    const raw = (searchParams.get('view') || '').trim().toLowerCase();
    if (raw === 'site-visits') return 'site_visits';
    if (raw === 'gantt') return 'gantt';
    return 'board';
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rangeWeeks, setRangeWeeks] = useState(12);
  const [hoveredGanttRowId, setHoveredGanttRowId] = useState<string | null>(null);
  const [collapsedCrews, setCollapsedCrews] = useState<Record<string, boolean>>({});
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<{
    host: string;
    crewsOk: boolean;
    crewsError?: string;
    itemsOk: boolean;
    itemsError?: string;
    projectsOk: boolean;
    projectsError?: string;
    estimatesOk: boolean;
    estimatesError?: string;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);

  const setScheduleView = (next: 'board' | 'gantt' | 'site_visits') => {
    const qs = new URLSearchParams(searchParams.toString());
    qs.set('view', next === 'site_visits' ? 'site-visits' : next);
    router.replace(`/staff/schedule?${qs.toString()}`);
    setView(next);
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
      site_address: string | null;
      created_at: string | null;
      updated_at: string | null;
    }>;
  };

  const snapshotKey = useMemo(() => scheduleSnapshotSWRKey(), []);
  const { data: cachedSnapshot, mutate: mutateSnapshot } = useSWR<ScheduleSnapshotV1>(snapshotKey, null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);

  function tryWriteScheduleSnapshotToCache(input: {
    installers: Installer[];
    projects: Project[];
    scheduleItems: ScheduleItem[];
    estimatesById: Map<string, Estimate>;
  }): void {
    try {
      const projectsById = new Map<string, Project>();
      for (const p of input.projects) projectsById.set(p.id, p);
      const renderable = input.scheduleItems.filter((i) => projectsById.has(i.projectId));
      const build = buildScheduleBars({ today, installers: input.installers, scheduleItems: renderable, projectsById, estimatesById: input.estimatesById });
      const bars = new Map(build.bars.map((b) => [b.scheduleItemId, b]));

      void mutateSnapshot(
        {
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
          name: p.projectName ?? p.name ?? 'Untitled project',
          pipeline_stage: String(p.status ?? 'NEW'),
          site_address: p.siteAddress ?? p.address ?? null,
          created_at: p.createdAt ?? null,
            updated_at: p.updatedAt ?? null,
          })),
        },
        { revalidate: false },
      );
    } catch {
      // ignore cache failures
    }
  }

  const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    if (hydrated) return;
    if (!cachedSnapshot) return;

    try {
      const cachedInstallers: Installer[] = cachedSnapshot.crews.map((c) => ({
        id: appIdFromUuid('crew', c.id),
        name: c.name,
        color: c.color ?? '#7A3B3B',
        active: c.is_active,
        sortOrder: c.sort_order,
      }));

      const cachedProjects: Project[] = cachedSnapshot.projectsIndex.map((p) => ({
        id: appIdFromUuid('proj', p.id),
        createdAt: p.created_at ?? p.updated_at ?? new Date(0).toISOString(),
        updatedAt: p.updated_at ?? p.created_at ?? undefined,
        projectName: p.name,
        name: p.name,
        siteAddress: p.site_address ?? undefined,
        address: p.site_address ?? undefined,
        status: p.pipeline_stage as any,
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
  }, [cachedSnapshot, hydrated]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (view === 'site_visits') return;
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
        setProjects(projects);
        setScheduleItems(normalised);
        setEstimatesById(estimatesById);
        setHydrated(true);
        tryWriteScheduleSnapshotToCache({ installers, projects, scheduleItems: normalised, estimatesById });
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
          tryWriteScheduleSnapshotToCache({ installers, projects, scheduleItems: normalizedRefreshed, estimatesById });
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
  }, [reloadNonce, toast, view]);

  const today = useMemo(() => todayYmd(), []);
  const supabaseHost = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()), []);
  const devOnly = process.env.NODE_ENV !== 'production';

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const scheduleItemsRenderable = useMemo(() => {
    return scheduleItems.filter((i) => projectsById.has(i.projectId));
  }, [projectsById, scheduleItems]);

  const orphanedScheduleItems = useMemo(() => {
    return scheduleItems.filter((i) => !projectsById.has(i.projectId));
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

  const schedulable = useMemo(() => {
    const jobsById = new Map<string, SchedulableJob>();
    const unscheduledJobs: SchedulableJob[] = [];

    const debug = {
      totalProjects: projects.length,
      schedulableProjects: 0,
      unscheduledJobs: 0,
      excluded: {
        noEstimates: 0,
        noApprovedEstimate: 0,
        alreadyScheduled: 0,
      },
      scheduleItems: {
        total: scheduleItems.length,
        blocking: 0,
        missingProject: 0,
        missingEstimate: 0,
        estimateNotApproved: 0,
      },
    };

    const blockingProjectIds = new Set<string>();
    for (const item of scheduleItems) {
      const project = projectsById.get(item.projectId) ?? null;
      if (!project) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[schedule] ScheduleItem references missing project', item);
        }
        debug.scheduleItems.missingProject += 1;
        continue;
      }

      const estimate = estimatesById.get(item.estimateId) ?? null;
      if (!estimate) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[schedule] ScheduleItem references missing estimate', item);
        }
        debug.scheduleItems.missingEstimate += 1;
        continue;
      }

      if (!isApprovedEstimate(estimate)) {
        debug.scheduleItems.estimateNotApproved += 1;
        continue;
      }

      blockingProjectIds.add(item.projectId);
      debug.scheduleItems.blocking += 1;
    }

    const estimatesByProjectId = new Map<string, Estimate[]>();
    for (const e of estimatesById.values()) {
      const list = estimatesByProjectId.get(e.projectId) ?? [];
      list.push(e);
      estimatesByProjectId.set(e.projectId, list);
    }

    for (const p of projects) {
      const estimates = (estimatesByProjectId.get(p.id) ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      if (!estimates.length) {
        debug.excluded.noEstimates += 1;
        continue;
      }

      const latestApproved = getLatestApprovedEstimate(estimates);
      if (!latestApproved) {
        debug.excluded.noApprovedEstimate += 1;
        continue;
      }

      debug.schedulableProjects += 1;

      if (blockingProjectIds.has(p.id)) {
        debug.excluded.alreadyScheduled += 1;
        continue;
      }

      const derived = deriveDurationHoursFromEstimate(latestApproved);
      const durationHours = derived.durationHours;
      const warnings = derived.issues.map((i) => i.message);

      const projectName = p.projectName ?? p.name ?? 'Untitled project';
      const status = normalizeProjectStatus(p.status).status;
      const nextActionDate = (p as any).nextActionDate ?? (p as any).followUpDate ?? null;
      const nextActionType = (p as any).nextActionType ?? null;
      const nextActionSuffix =
        typeof nextActionDate === 'string' && nextActionDate
          ? ` · Next: ${nextActionDate}${typeof nextActionType === 'string' && nextActionType ? ` (${nextActionTypeLabel(nextActionType as any)})` : ''}`
          : '';

      const id = makeJobId(p.id, latestApproved.id);
      const job: SchedulableJob = {
        id,
        projectId: p.id,
        estimateId: latestApproved.id,
        projectName,
        descriptor: `${getJobDescriptorFromEstimate(latestApproved)}${nextActionSuffix}`,
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

    // Scheduled jobs: ensure they have job entries too (even if estimate/project missing).
    for (const item of scheduleItemsRenderable) {
      const id = item.id;
      if (jobsById.has(id)) continue;

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
        warnings.push(...derived.issues.map((i) => i.message));
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
  }, [estimatesById, projects, projectsById, scheduleItems]);

  const unscheduledJobsAll = useMemo(() => {
    return schedulable.unscheduledJobs;
  }, [schedulable.unscheduledJobs]);

  const unscheduledJobs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const status = statusFilter;
    return unscheduledJobsAll
      .filter((j) => (!q ? true : j.projectName.toLowerCase().includes(q)))
      .filter((j) => (status === 'all' ? true : j.status === status));
  }, [query, statusFilter, unscheduledJobsAll]);

  const laneItems = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const installer of installers) map.set(installer.id, []);
    for (const item of scheduleItemsRenderable) {
      const list = map.get(item.installerId);
      if (list) list.push(item);
      else map.set(item.installerId, [item]);
    }
    for (const list of map.values()) list.sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));
    return map;
  }, [installers, scheduleItemsRenderable]);

  const schedule = useMemo(() => {
    return buildScheduleBars({
      today,
      installers,
      scheduleItems: scheduleItemsRenderable,
      projectsById,
      estimatesById,
    });
  }, [estimatesById, installers, projectsById, scheduleItemsRenderable, today]);

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

  const gantt = useMemo(() => {
    const rangeStart = startOfWeekMonday(today);
    const rangeDays = rangeWeeks * 7;
    const rangeEnd = addDaysYmd(rangeStart, rangeDays - 1);
    const totalWidth = rangeDays * GANTT_DAY_PX;
    const todayOffset = Math.max(0, Math.min(rangeDays, diffDaysYmd(rangeStart, today)));

    const weekendBlocks: Array<{ leftPx: number; widthPx: number }> = [];
    let weekendStart: number | null = null;
    for (let idx = 0; idx < rangeDays; idx += 1) {
      const dt = parseYmd(addDaysYmd(rangeStart, idx));
      const day = dt ? dt.getUTCDay() : -1;
      const isWeekend = day === 0 || day === 6;
      if (isWeekend && weekendStart == null) weekendStart = idx;
      if (!isWeekend && weekendStart != null) {
        weekendBlocks.push({ leftPx: weekendStart * GANTT_DAY_PX, widthPx: (idx - weekendStart) * GANTT_DAY_PX });
        weekendStart = null;
      }
    }
    if (weekendStart != null) {
      weekendBlocks.push({ leftPx: weekendStart * GANTT_DAY_PX, widthPx: (rangeDays - weekendStart) * GANTT_DAY_PX });
    }

    const barsById = new Map(schedule.bars.map((b) => [b.scheduleItemId, b]));
    const rows: GanttRow[] = [];

    for (const installer of installers.filter((i) => i.active)) {
      const items = laneItems.get(installer.id) ?? [];
      const collapsed = Boolean(collapsedCrews[installer.id]);
      rows.push({
        kind: 'group',
        id: `group:${installer.id}`,
        installerId: installer.id,
        label: installer.name,
        color: installer.color,
        jobCount: items.length,
        collapsed,
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

        const job = schedulable.jobsById.get(item.id);

        const leftDays = diffDaysYmd(rangeStart, bar.startDate);
        const endDays = diffDaysYmd(rangeStart, bar.endDate) + 1; // inclusive
        const clampedLeft = Math.max(0, leftDays);
        const clampedRight = Math.min(rangeDays, Math.max(clampedLeft, endDays));

        const visibleWidthDays = Math.max(0, clampedRight - clampedLeft);
        const barWidthPx = visibleWidthDays > 0 ? Math.max(visibleWidthDays * GANTT_DAY_PX, 8) : 0;

        rows.push({
          kind: 'item',
          id: item.id,
          installerId: installer.id,
          scheduleItemId: item.id,
          projectId: bar.projectId,
          estimateId: bar.estimateId,
          projectName: bar.projectName,
          status: bar.status,
          durationLabel: job?.durationLabel ?? formatDuration(bar.durationHours),
          startDate: bar.startDate,
          endDate: bar.endDate,
          barLeftPx: clampedLeft * GANTT_DAY_PX,
          barWidthPx,
          barColor: installer.color,
        });
      }
    }

    return {
      rangeStart,
      rangeEnd,
      rangeDays,
      totalWidth,
      todayOffsetPx: todayOffset * GANTT_DAY_PX,
      weekendBlocks,
      rows,
    };
  }, [collapsedCrews, installers, laneItems, rangeWeeks, schedulable.jobsById, schedule.bars, today]);

  function handleDragMove(event: DragMoveEvent) {
    if (view !== 'board') return;
    if (!activeDragId) return;

    const rect = ((event.active.rect?.current as any)?.translated ?? (event.active.rect?.current as any)?.initial) as
      | { left: number; top: number; width: number; height: number }
      | undefined;
    if (!rect) return;

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const EDGE_PX = 80;
    const STEP_PX = 32;

    const board = boardScrollRef.current;
    if (board) {
      const br = board.getBoundingClientRect();
      if (x < br.left + EDGE_PX) board.scrollLeft -= STEP_PX;
      else if (x > br.right - EDGE_PX) board.scrollLeft += STEP_PX;
    }

    const verticalTarget =
      overId === 'unscheduled'
        ? unscheduledBodyRef.current
        : overLaneId
          ? laneBodyRefs.current.get(overLaneId) ?? null
          : null;
    if (verticalTarget) {
      const vr = verticalTarget.getBoundingClientRect();
      if (y < vr.top + EDGE_PX) verticalTarget.scrollTop -= STEP_PX;
      else if (y > vr.bottom - EDGE_PX) verticalTarget.scrollTop += STEP_PX;
    }
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

  async function handleUnschedule(id: string) {
    const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
    if (isLockedScheduleStatus(status) && typeof window !== 'undefined') {
      const ok = window.confirm(`This job is ${scheduleStatusLabel(status)}. Unschedule anyway?`);
      if (!ok) return;
    }
    const next = scheduleItems.filter((i) => i.id !== id);
    await persist(next, { successToast: 'Job unscheduled.', errorToast: 'Failed to unschedule job.' });
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
      setReloadNonce((n) => n + 1);
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);
    setOverId(null);
    setOverLaneId(null);
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const isScheduled = scheduleItems.some((i) => i.id === activeId);

    if (overId === 'unscheduled') {
      if (isScheduled) void handleUnschedule(activeId);
      return;
    }

    const destInstallerId = (() => {
      if (overId.startsWith('lane:')) return overId.slice('lane:'.length);
      const overItem = scheduleItems.find((i) => i.id === overId);
      return overItem?.installerId ?? null;
    })();
    if (!destInstallerId) return;

    if (!isScheduled) {
      const job = schedulable.jobsById.get(activeId);
      if (!job) return;
      const existing = laneItems.get(destInstallerId) ?? [];
      const sortIndex = existing.length ? Math.max(...existing.map((i) => i.sortIndex)) + 1 : 0;
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

    if (sourceInstallerId === destInstallerId && overId === activeId) return;

    const sourceIndex = sourceList.indexOf(activeId);
    const destIndex = overId.startsWith('lane:')
      ? destList.length
      : destList.indexOf(overId) >= 0
        ? destList.indexOf(overId)
        : destList.length;

    const nextSource = sourceList.filter((id) => id !== activeId);
    const nextDest = sourceInstallerId === destInstallerId ? nextSource.slice() : destList.slice();

    const insertAt = (() => {
      if (sourceInstallerId !== destInstallerId) return destIndex;
      if (sourceIndex < 0) return destIndex;
      if (destIndex > sourceIndex) return Math.max(0, destIndex - 1);
      return destIndex;
    })();

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

  const diagnosticsPanel = devOnly ? (
    <div
      aria-label="Schedule diagnostics"
      style={{
        marginTop: 12,
        border: '1px solid rgba(15, 15, 16, 0.14)',
        borderRadius: 14,
        background: 'rgba(255, 255, 255, 0.92)',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <strong style={{ fontSize: 12, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Diagnostics (dev only)</strong>
          <span className={styles.muted} style={{ fontSize: 12 }}>
            Checks projects + estimates + schedule tables
          </span>
        </div>
        <button
          type="button"
          className={styles.buttonSecondary}
          aria-expanded={diagnosticsOpen}
          onClick={() => setDiagnosticsOpen((v) => !v)}
        >
          {diagnosticsOpen ? 'Hide' : 'Show'}
        </button>
      </div>

      {diagnosticsOpen ? (
        <div style={{ padding: 12, borderTop: '1px solid rgba(15, 15, 16, 0.08)' }}>
          <button
            type="button"
            className={styles.buttonSecondary}
            disabled={diagnosticsBusy}
            onClick={() => {
              if (diagnosticsBusy) return;
              setDiagnosticsBusy(true);
              void (async () => {
                try {
                  const supabase = getSupabaseBrowser();
                  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
                  const crews = await supabase.from('schedule_crews').select('id').limit(1);
                  const items = await supabase.from('schedule_items').select('id').limit(1);
                  const projects = await supabase.from('projects').select('id').limit(1);
                  const estimates = await supabase.from('estimates').select('id').limit(1);
                  setDiagnostics({
                    host,
                    crewsOk: !crews.error,
                    crewsError: crews.error ? JSON.stringify(crews.error) : undefined,
                    itemsOk: !items.error,
                    itemsError: items.error ? JSON.stringify(items.error) : undefined,
                    projectsOk: !projects.error,
                    projectsError: projects.error ? JSON.stringify(projects.error) : undefined,
                    estimatesOk: !estimates.error,
                    estimatesError: estimates.error ? JSON.stringify(estimates.error) : undefined,
                  });
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
            }}
          >
            {diagnosticsBusy ? 'Checking…' : 'Run diagnostics'}
          </button>

          {diagnostics ? (
            <div className={styles.note} style={{ marginTop: 12 }}>
              <div>
                Host: <strong>{diagnostics.host || '—'}</strong>
              </div>
              <div>
                schedule_crews: <strong>{diagnostics.crewsOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.crewsOk && diagnostics.crewsError ? <div className={styles.muted}>{diagnostics.crewsError}</div> : null}
              </div>
              <div>
                schedule_items: <strong>{diagnostics.itemsOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.itemsOk && diagnostics.itemsError ? <div className={styles.muted}>{diagnostics.itemsError}</div> : null}
              </div>
              <div>
                projects: <strong>{diagnostics.projectsOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.projectsOk && diagnostics.projectsError ? <div className={styles.muted}>{diagnostics.projectsError}</div> : null}
              </div>
              <div>
                estimates: <strong>{diagnostics.estimatesOk ? 'OK' : 'FAIL'}</strong>
                {!diagnostics.estimatesOk && diagnostics.estimatesError ? <div className={styles.muted}>{diagnostics.estimatesError}</div> : null}
              </div>
            </div>
          ) : (
            <p className={styles.note} style={{ marginTop: 12 }}>
              Click “Run diagnostics” to test PostgREST access.
            </p>
          )}
        </div>
      ) : null}
    </div>
  ) : null;

  if (view === 'site_visits') {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Schedule"
          right={
            <HeaderActions>
              {scheduleTabs}
            </HeaderActions>
          }
        />
        <div className={styles.stack}>
          <SiteVisitsView />
        </div>
      </main>
    );
  }

  if (!hydrated) {
    return (
      <main className={styles.page}>
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
      <main className={styles.page}>
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
                  setReloadNonce((n) => n + 1);
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
    <main className={styles.page}>
      <PageHeader
        title="Schedule"
        right={
          <HeaderActions>
            {syncing ? <span className={styles.muted}>Syncing…</span> : null}
            {scheduleTabs}
          </HeaderActions>
        }
      />

      <div className={styles.stack}>
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
          collisionDetection={closestCenter}
          onDragStart={(e) => setActiveDragId(String(e.active.id))}
          onDragOver={(e: DragOverEvent) => {
            const nextOverId = e.over ? String(e.over.id) : null;
            setOverId(nextOverId);
            if (!nextOverId) {
              setOverLaneId(null);
              return;
            }
            if (nextOverId.startsWith('lane:')) {
              setOverLaneId(nextOverId.slice('lane:'.length));
              return;
            }
            const overItem = scheduleItems.find((i) => i.id === nextOverId);
            setOverLaneId(overItem?.installerId ?? null);
          }}
          onDragMove={handleDragMove}
          onDragCancel={() => {
            setActiveDragId(null);
            setOverId(null);
            setOverLaneId(null);
          }}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.panels}>
            <aside className={styles.leftPanel} aria-label="Unscheduled jobs">
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Unscheduled</h2>
                <span className={styles.muted}>{unscheduledJobs.length}</span>
              </div>

              <div className={styles.filters}>
                <input
                  className={styles.input}
                  placeholder="Search projects…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select className={styles.input} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All statuses</option>
                  {PROJECT_STATUS_ORDER.map((status) => (
                    <option key={status} value={status}>
                      {projectStatusLabel(status)}
                    </option>
                  ))}
                </select>
                <p className={styles.hint}>Only projects with an approved estimate appear here.</p>
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
                        <p className={styles.note}>No unscheduled approved projects.</p>
                        <p className={styles.hint}>Approve an estimate to make it schedulable.</p>
                      </>
                    ) : (
                      <p className={styles.note}>No projects match this filter.</p>
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
                    <span className={styles.muted}>Schedulable (has approved estimate)</span>
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
                    <span className={styles.muted}>No approved estimate</span>
                    <span>{schedulable.debug.excluded.noApprovedEstimate}</span>
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
                    <span className={styles.muted}>Blocking (valid + approved)</span>
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
                    <span className={styles.muted}>Estimate not approved</span>
                    <span>{schedulable.debug.scheduleItems.estimateNotApproved}</span>
                  </div>
                </div>
              </details>
            ) : null}
          </aside>

          <section className={styles.mainPanel} aria-label="Installer lanes">
            {view === 'gantt' ? (
              <div className={styles.gantt}>
                <div className={styles.ganttControls}>
                  <div className={styles.ganttMeta}>
                    Range: <strong>{formatShortDate(gantt.rangeStart)}</strong> → <strong>{formatShortDate(gantt.rangeEnd)}</strong>
                  </div>
                  <select
                    className={styles.input}
                    value={rangeWeeks}
                    onChange={(e) => setRangeWeeks(Number(e.target.value) || 12)}
                    aria-label="Range"
                  >
                    <option value={4}>4 weeks</option>
                    <option value={8}>8 weeks</option>
                    <option value={12}>12 weeks</option>
                  </select>
                </div>

                <div className={styles.ganttScroll} aria-label="Gantt timeline">
                  <div
                    className={styles.ganttTable}
                    style={
                      {
                        gridTemplateColumns: `${GANTT_LABEL_PX}px ${gantt.totalWidth}px`,
                        ['--ganttLabelW' as any]: `${GANTT_LABEL_PX}px`,
                        ['--ganttDayW' as any]: `${GANTT_DAY_PX}px`,
                      } as React.CSSProperties
                    }
                  >
	                    {gantt.weekendBlocks.map((b, idx) => (
	                      <div
	                        key={`weekend-${idx}-${b.leftPx}`}
	                        className={styles.weekendShade}
	                        style={{ left: GANTT_LABEL_PX + b.leftPx, width: b.widthPx }}
	                        aria-hidden="true"
	                      />
	                    ))}

	                    <div className={styles.ganttCorner}>
	                      <div className={styles.ganttLeftHeaderGrid}>
	                        <div className={styles.ganttColProject}>Crew / Project</div>
	                      </div>
	                    </div>

	                    <div className={styles.ganttHeader} style={{ width: gantt.totalWidth }}>
	                      {Array.from({ length: gantt.rangeDays }).map((_, idx) => {
	                        if (idx % 7 !== 0) return null;
	                        const label = formatShortDate(addDaysYmd(gantt.rangeStart, idx));
	                        return (
	                          <div key={`${idx}-${label}`} className={styles.ganttTick} style={{ left: idx * GANTT_DAY_PX }}>
	                            Wk of {label}
	                          </div>
	                        );
	                      })}
	                    </div>

	                    <div className={styles.todayLine} style={{ left: GANTT_LABEL_PX + gantt.todayOffsetPx }} aria-hidden="true" />

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
	                                      setCollapsedCrews((prev) => ({ ...prev, [row.installerId]: !prev[row.installerId] }));
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
	                              ) : (
	                                <span
	                                  className={cx(styles.ganttProjectText, styles.ganttProjectTextItem)}
	                                  title={row.projectName}
	                                  role="link"
	                                  tabIndex={0}
	                                  onClick={() =>
	                                    router.push(
	                                      `/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`,
	                                    )
	                                  }
	                                  onKeyDown={(e) => {
	                                    if (e.key === 'Enter' || e.key === ' ') {
	                                      e.preventDefault();
	                                      router.push(
	                                        `/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`,
	                                      );
	                                    }
	                                  }}
	                                >
	                                  {row.projectName}
	                                </span>
	                              )}
	                            </div>
	                          </div>
	                        </div>

	                        <div
	                          className={cx(styles.ganttTimelineRow, row.kind === 'group' && styles.ganttTimelineRowGroup)}
	                          style={{ width: gantt.totalWidth }}
	                          role={row.kind === 'item' ? 'link' : undefined}
	                          tabIndex={row.kind === 'item' ? 0 : undefined}
	                          onClick={
	                            row.kind === 'item'
	                              ? () =>
	                                  router.push(
	                                    `/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`,
	                                  )
	                              : undefined
	                          }
	                          onKeyDown={
	                            row.kind === 'item'
	                              ? (e) => {
	                                  if (e.key === 'Enter' || e.key === ' ') {
	                                    e.preventDefault();
	                                    router.push(
	                                      `/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`,
	                                    );
	                                  }
	                                }
	                              : undefined
	                          }
	                        >
                      {row.kind === 'item' && row.barWidthPx > 0 ? (
                        <div
                          className={styles.ganttBar}
                          style={{
                            left: row.barLeftPx,
                            width: row.barWidthPx,
                            backgroundColor: row.barColor,
                            borderColor: darkenHex(row.barColor, 0.12),
                            color: getReadableTextColor(row.barColor),
                          }}
                          title={(() => {
                            const crewName = installersById.get(row.installerId)?.name ?? null;
                            const lines = [
                              row.projectName,
                              crewName ? `Crew: ${crewName}` : null,
                              `Status: ${formatStatusLabel(row.status)}`,
                              `Duration: ${row.durationLabel}`,
                              `Start: ${formatShortDate(row.startDate)}`,
                              `End: ${formatShortDate(row.endDate)}`,
                            ].filter((line): line is string => Boolean(line));
                            return lines.join('\n');
                          })()}
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`);
                          }}
                        >
                          {row.barWidthPx >= GANTT_BAR_LABEL_MIN_PX ? (
                            <span className={styles.ganttBarText}>{row.projectName}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
	                  </div>
	                </div>
	              </div>
            ) : (
              <div className={styles.lanes} ref={boardScrollRef}>
                {installers.filter((i) => i.active).map((installer) => {
                  const items = laneItems.get(installer.id) ?? [];
                  const ids = items.map((i) => i.id);
                  const laneIsOver = overLaneId === installer.id && Boolean(activeDragId);
                  const insertionAtEnd = overId === `lane:${installer.id}` && Boolean(activeDragId);
                  let maxEnd: string | null = null;
                  for (const id of ids) {
                    const dates = barsByScheduleId.get(id);
                    if (!dates) continue;
                    const end = dates.endDate;
                    if (!maxEnd || end > maxEnd) maxEnd = end;
                  }
                  const nextAvailableCandidate = maxEnd ? nextWorkdayAfter(maxEnd) : null;
                  const nextAvailable = nextAvailableCandidate && nextAvailableCandidate < today ? today : nextAvailableCandidate;

                  const cards: React.ReactNode[] = [];
                  for (const id of ids) {
                    const showInsertBefore = overId === id && activeDragId !== id && Boolean(activeDragId);
                    if (showInsertBefore) cards.push(<div key={`insert-${id}`} className={styles.insertionMarker} aria-hidden="true" />);

                    const job = schedulable.jobsById.get(id) ?? null;
                    const dates = barsByScheduleId.get(id);
                    const dateLine = dates ? formatDateRange(dates.startDate, dates.endDate) : undefined;
                    const scheduleItem = scheduleItemById.get(id) ?? null;
                    const scheduleStatus = scheduleItem ? deriveScheduleStatus(scheduleItem, today) : 'TENTATIVE';
                    const locked = isLockedScheduleStatus(scheduleStatus);
                    cards.push(
                      <ScheduledJobCard
                        key={id}
                        id={id}
                        job={job}
                        scheduleStatus={scheduleStatus}
                        dateLine={dateLine}
                        dropTarget={overId === id && activeDragId !== id}
                        onUnschedule={() => void handleUnschedule(id)}
                        onQuickEdit={locked ? undefined : () => openQuickEdit(id)}
                        onConfirm={scheduleStatus === 'TENTATIVE' ? () => void handleConfirmSchedule(id) : undefined}
                        onUnlock={locked ? () => void handleUnlockSchedule(id) : undefined}
                        issueLevel={issueLevelByScheduleId.get(id)}
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

      {quickEdit ? (
        <Modal
          open
          ariaLabel="Quick edit scheduled job"
          onClose={() => setQuickEdit(null)}
          maxWidthPx={520}
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Quick edit</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setQuickEdit(null)}>
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              Overrides apply to this job only. Changing start/duration recalculates downstream jobs for the crew.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Start date override
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={quickEdit.startDateOverride}
                  onChange={(e) => setQuickEdit((prev) => (prev ? { ...prev, startDateOverride: e.target.value } : prev))}
                />
                <p className={styles.hint} style={{ marginTop: 6 }}>
                  Leave blank to auto-calculate from lane availability.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Duration (days)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step={0.5}
                  min={0.5}
                  className={styles.input}
                  value={quickEdit.durationDays}
                  onChange={(e) => setQuickEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
                <p className={styles.hint} style={{ marginTop: 6 }}>
                  1 day = {WORK_HOURS_PER_DAY}h. Use 0.5 increments.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setQuickEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                style={{ background: '#813f39', borderColor: 'rgba(129, 63, 57, 0.6)', color: '#fff' }}
                onClick={() => {
                  const item = scheduleItems.find((i) => i.id === quickEdit.id) ?? null;
                  if (!item) {
                    setQuickEdit(null);
                    return;
                  }

                  const start = quickEdit.startDateOverride.trim();
                  const daysRaw = quickEdit.durationDays.trim();
                  const days = daysRaw ? Number(daysRaw) : NaN;
                  const durationHoursOverride = Number.isFinite(days) && days > 0 ? days * WORK_HOURS_PER_DAY : null;

                  const nextItems = scheduleItems.map((i) => {
                    if (i.id !== item.id) return i;
                    return {
                      ...i,
                      startDateOverride: start ? start : undefined,
                      durationHoursOverride: durationHoursOverride ?? undefined,
                      updatedAt: new Date().toISOString(),
                    };
                  });

                  void persist(nextItems, { successToast: 'Job updated.' }).then((ok) => {
                    if (ok) setQuickEdit(null);
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
      </div>
    </main>
  );
}
