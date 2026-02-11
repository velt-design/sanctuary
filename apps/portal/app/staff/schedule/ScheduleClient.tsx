'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import styles from './schedule.module.css';
import { listInstallers } from '@/lib/repo/installersRepo';
import { getProject, listProjects } from '@/lib/repo/projectsRepo';
import { listAllEstimates } from '@/lib/repo/estimatesRepo';
import { confirmScheduleItem, deleteScheduleItem, listScheduleItems, normalizeScheduleItemsStarted, replaceScheduleItems, unlockScheduleItem } from '@/lib/repo/scheduleRepo';
import {
  assignJob,
  createDowntime,
  deleteDowntime,
  fetchScheduleGantt,
  markJobDone,
  markJobInProgress,
  pinJob,
  reorderItems as reorderScheduleItemsV2,
  setDaysRemaining,
  setJobDuration,
  unassignJob,
  unpinJob,
  updateDowntime,
} from '@/lib/repo/scheduleV2Repo';
import { qk } from '@/lib/queries/keys';
import { scheduleV2SnapshotQueryOptions, type ScheduleV2Snapshot } from '@/lib/queries/schedule';
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
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { appIdFromUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { ApiError } from '@/lib/repo/apiClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { runScheduleDiagnostics } from '@/lib/queries/scheduleDiagnostics';
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
const USE_SCHEDULE_V2 = true;

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
      isDowntime?: boolean;
      isPinned?: boolean;
      issueLevel?: 'warning' | 'error';
      plannedLeftPx?: number;
      plannedWidthPx?: number;
      plannedStart?: string;
      plannedEnd?: string;
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

function safeProjectName(project: Project | null | undefined): string {
  return project?.projectName ?? project?.name ?? 'Untitled project';
}

function safeProjectStatus(project: Project | null | undefined): string {
  return project?.status ?? 'NEW';
}

function endInclusiveFromExclusive(endExclusive: string, fallback: string): string {
  if (!isYmd(endExclusive)) return fallback;
  return addDaysYmd(endExclusive, -1);
}

function buildScheduleBarsFromForecast(input: {
  scheduleItems: ScheduleItem[];
  projectsById: Map<string, Project>;
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

function mapV2UnscheduledJobs(list: ScheduleV2Snapshot['unscheduledJobs'] | null | undefined): SchedulableJob[] {
  if (!Array.isArray(list)) return [];
  const out: SchedulableJob[] = [];
  for (const job of list) {
    const projectId = typeof job?.projectId === 'string' ? job.projectId : '';
    const estimateId = typeof job?.estimateId === 'string' ? job.estimateId : '';
    if (!projectId || !estimateId) continue;

    const durationDays =
      typeof job?.durationDays === 'number' && Number.isFinite(job.durationDays) && job.durationDays > 0 ? job.durationDays : 1;
    const durationHours = Math.max(0.5, durationDays * WORK_HOURS_PER_DAY);

    out.push({
      id: makeJobId(projectId, estimateId),
      projectId,
      estimateId,
      projectName: (typeof job?.projectName === 'string' ? job.projectName : '').trim() || 'Untitled project',
      descriptor: '',
      status: normalizeProjectStatus(job?.status ?? 'NEW').status,
      durationHours,
      durationLabel: formatDuration(durationHours),
      durationTitle: formatHours(durationHours),
      warnings: [],
    });
  }
  out.sort((a, b) => a.projectName.localeCompare(b.projectName));
  return out;
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

type MenuAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
};

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
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.kebab}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Job actions'}
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
          {items.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              type="button"
              role="menuitem"
              className={cx(styles.menuItem, action.tone === 'danger' && styles.menuItemDanger)}
              disabled={Boolean(action.disabled)}
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

function JobCardShell({
  title,
  descriptor,
  statusLabel,
  durationLabel,
  durationTitle,
  scheduleStatus,
  pinned,
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
  pinned?: boolean;
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
        {pinned ? (
          <span className={styles.pinnedPill}>
            <span className={styles.pinnedDot} aria-hidden="true" />
            Pinned
          </span>
        ) : null}
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
  menuActions,
  pinned,
  issueLevel,
}: {
  id: string;
  job: SchedulableJob | null;
  scheduleStatus: ScheduleItemStatus;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: MenuAction[];
  pinned?: boolean;
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
      pinned={pinned}
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
      menu={<JobActionsMenu actions={menuActions} />}
      cardRef={(node) => setNodeRef(node as any)}
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
}: {
  id: string;
  item: ScheduleItem;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: MenuAction[];
  issueLevel?: 'warning' | 'error';
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
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
      title={reason}
      descriptor={item.downtimeNote ?? 'Crew unavailable'}
      statusLabel="Downtime"
      durationLabel={formatDuration(durationHours)}
      durationTitle={formatHours(durationHours)}
      dateLine={dateLine}
      issueLevel={issueLevel}
      dragHandleRef={(node) => setActivatorNodeRef(node as any)}
      dragHandleProps={{ ...attributes, ...listeners }}
      menu={<JobActionsMenu actions={menuActions} ariaLabel="Downtime actions" />}
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
  const queryClient = useQueryClient();
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const laneBodyRefs = useRef(new Map<string, HTMLDivElement | null>());
  const unscheduledBodyRef = useRef<HTMLDivElement | null>(null);
  const hydratedFromCacheRef = useRef(false);

  const today = useMemo(() => todayYmd(), []);

  const supabaseHost = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()), []);
  const hostKey = supabaseHost || 'unknown';

  const v2SnapshotKey = useMemo(() => qk.schedule.board(hostKey, today), [hostKey, today]);
  const initialV2Snapshot = USE_SCHEDULE_V2 ? (queryClient.getQueryData<ScheduleV2Snapshot>(v2SnapshotKey) ?? null) : null;
  if (initialV2Snapshot) hydratedFromCacheRef.current = true;

  const [hydrated, setHydrated] = useState(() => Boolean(initialV2Snapshot));
  const [loadError, setLoadError] = useState<{ message: string; table?: string; code?: string } | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [installers, setInstallers] = useState<Installer[]>(() => initialV2Snapshot?.installers ?? []);
  const [projects, setProjects] = useState<Project[]>(() => initialV2Snapshot?.projects ?? []);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>(() => initialV2Snapshot?.scheduleItems ?? []);
  const [estimatesById, setEstimatesById] = useState<Map<string, Estimate>>(() => new Map());
  const [unscheduledJobsSeed, setUnscheduledJobsSeed] = useState<SchedulableJob[]>(() => mapV2UnscheduledJobs(initialV2Snapshot?.unscheduledJobs));
  const [scheduleMode, setScheduleMode] = useState<'v2' | 'legacy'>(USE_SCHEDULE_V2 ? 'v2' : 'legacy');
  const [scheduleConflicts, setScheduleConflicts] = useState<any[]>(() => initialV2Snapshot?.conflicts ?? []);
  const [nextAvailableByInstallerId, setNextAvailableByInstallerId] = useState<Map<string, string>>(
    () => new Map(Object.entries(initialV2Snapshot?.nextAvailableByInstallerId ?? {})),
  );
  const [ganttHolidays, setGanttHolidays] = useState<Array<{ date: string; name?: string; kind: 'holiday' | 'closure' }>>([]);
  const [quickEdit, setQuickEdit] = useState<{ id: string; startDateOverride: string; durationDays: string } | null>(null);
  const [durationEdit, setDurationEdit] = useState<{ id: string; durationDays: string } | null>(null);
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rangeWeeks, setRangeWeeks] = useState(12);
  const [showPlanned, setShowPlanned] = useState(false);
  const [hoveredGanttRowId, setHoveredGanttRowId] = useState<string | null>(null);
  const [collapsedCrews, setCollapsedCrews] = useState<Record<string, boolean>>({});
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [diagnosticsBusy, setDiagnosticsBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<{
    host: string | null;
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
  const [ganttDrag, setGanttDrag] = useState<{
    id: string;
    mode: 'move' | 'resize';
    originX: number;
    startDate: string;
    endDate: string;
    durationDays: number;
    barLeftPx: number;
    barWidthPx: number;
  } | null>(null);
  const [ganttDragDelta, setGanttDragDelta] = useState(0);
  const ganttDragDeltaRef = useRef(0);
  const ganttDragMovedRef = useRef(false);
  const ganttClickBlockUntilRef = useRef(0);

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

  const snapshotKey = useMemo(() => qk.schedule.snapshot(hostKey), [hostKey]);
  const { data: cachedSnapshot } = useQuery<ScheduleSnapshotV1 | null>({
    queryKey: snapshotKey,
    queryFn: async () => null,
    enabled: false,
  });

  const v2SnapshotQuery = useQuery({
    ...scheduleV2SnapshotQueryOptions(hostKey, today),
    enabled: scheduleMode === 'v2' && view !== 'site_visits',
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 501) && failureCount < 1,
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);
  const v2ErrorNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;
    const snapshot = v2SnapshotQuery.data;
    if (!snapshot) return;

    hydratedFromCacheRef.current = true;
    setLoadError(null);
    setInstallers(snapshot.installers);
    setProjects(snapshot.projects);
    setScheduleItems(snapshot.scheduleItems);
    setEstimatesById(new Map());
    setUnscheduledJobsSeed(mapV2UnscheduledJobs(snapshot.unscheduledJobs));
    setScheduleConflicts(Array.isArray(snapshot.conflicts) ? snapshot.conflicts : []);
    setNextAvailableByInstallerId(new Map(Object.entries(snapshot.nextAvailableByInstallerId ?? {})));
    setHydrated(true);
  }, [scheduleMode, view, v2SnapshotQuery.data]);

  useEffect(() => {
    if (scheduleMode !== 'v2') return;
    if (view === 'site_visits') return;
    setSyncing(v2SnapshotQuery.isFetching);
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
    projects: Project[];
    scheduleItems: ScheduleItem[];
    estimatesById: Map<string, Estimate>;
  }): void {
    if (scheduleMode !== 'legacy') return;
    try {
      const projectsById = new Map<string, Project>();
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
          name: p.projectName ?? p.name ?? 'Untitled project',
          pipeline_stage: String(p.status ?? 'NEW'),
          site_address: p.siteAddress ?? p.address ?? null,
          created_at: p.createdAt ?? null,
          updated_at: p.updatedAt ?? null,
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
  }, [reloadNonce, toast, view, scheduleMode, today]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (scheduleMode !== 'v2') return;
      if (view !== 'gantt') return;
      const rangeStart = startOfWeekMonday(today);
      const rangeDays = rangeWeeks * 7;
      const rangeEnd = addDaysYmd(rangeStart, rangeDays - 1);
      try {
        const res = await fetchScheduleGantt({ rangeStart, rangeEnd, today });
        if (cancelled) return;
        const holidayBlocks = [
          ...(res.holidays ?? []).map((h) => ({ date: h.date, name: h.name, kind: 'holiday' as const })),
          ...(res.closures ?? []).map((c) => ({ date: c.date, name: c.name, kind: 'closure' as const })),
        ];
        setGanttHolidays(holidayBlocks);
      } catch (err) {
        if (cancelled) return;
        setGanttHolidays([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scheduleMode, view, rangeWeeks, today]);

  const devOnly = process.env.NODE_ENV !== 'production';

  const projectsById = useMemo(() => {
    const map = new Map<string, Project>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  const scheduleItemsRenderable = useMemo(() => {
    return scheduleItems.filter((i) => i.itemType === 'downtime' || projectsById.has(i.projectId));
  }, [projectsById, scheduleItems]);

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

  const schedulable = useMemo(() => {
    if (scheduleMode === 'v2') {
      const jobsById = new Map<string, SchedulableJob>();
      const unscheduledJobs = unscheduledJobsSeed;
      for (const job of unscheduledJobs) jobsById.set(job.id, job);

      const blockingProjectIds = new Set<string>();
      for (const item of scheduleItemsRenderable) {
        if (item.itemType === 'downtime') continue;
        if (item.projectId) blockingProjectIds.add(item.projectId);
      }

      // Scheduled jobs: ensure they have job entries too.
      for (const item of scheduleItemsRenderable) {
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

      const debug = {
        totalProjects: projects.length,
        schedulableProjects: unscheduledJobs.length + blockingProjectIds.size,
        unscheduledJobs: unscheduledJobs.length,
        excluded: {
          noEstimates: 0,
          noApprovedEstimate: 0,
          alreadyScheduled: 0,
        },
        scheduleItems: {
          total: scheduleItems.length,
          blocking: scheduleItemsRenderable.filter((i) => i.itemType !== 'downtime').length,
          missingProject: orphanedScheduleItems.length,
          missingEstimate: 0,
          estimateNotApproved: 0,
        },
      };

      return { jobsById, unscheduledJobs, debug, blockingProjectIds };
    }

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
      if (item.itemType === 'downtime') continue;
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

      if (item.itemType === 'downtime') {
        const durationHours = typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0 ? item.durationHoursOverride : WORK_HOURS_PER_DAY;
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
  }, [estimatesById, orphanedScheduleItems, projects, projectsById, scheduleItems, scheduleItemsRenderable, scheduleMode, unscheduledJobsSeed]);

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
    if (scheduleMode === 'v2') {
      const base = buildScheduleBarsFromForecast({ scheduleItems: scheduleItemsRenderable, projectsById, estimatesById });
      const scheduleItemByJobId = new Map<string, string>();
      for (const item of scheduleItemsRenderable) {
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
      scheduleItems: scheduleItemsRenderable,
      projectsById,
      estimatesById,
    });
  }, [estimatesById, installers, projectsById, scheduleItemsRenderable, scheduleConflicts, scheduleMode, today]);

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

    const holidayBlocks: Array<{ leftPx: number; widthPx: number; label: string }> = [];
    for (const holiday of ganttHolidays) {
      if (!holiday?.date || !isYmd(holiday.date)) continue;
      const offset = diffDaysYmd(rangeStart, holiday.date);
      if (offset < 0 || offset >= rangeDays) continue;
      holidayBlocks.push({
        leftPx: offset * GANTT_DAY_PX,
        widthPx: GANTT_DAY_PX,
        label: holiday.name ? `${holiday.kind === 'closure' ? 'Closure' : 'Holiday'}: ${holiday.name}` : holiday.kind === 'closure' ? 'Company closure' : 'Holiday',
      });
    }

    const barsById = new Map(schedule.bars.map((b) => [b.scheduleItemId, b]));
    const plannedBarsById = new Map<string, { leftPx: number; widthPx: number; startDate: string; endDate: string }>();

    if (showPlanned && scheduleMode === 'v2') {
      for (const item of scheduleItemsRenderable) {
        if (item.itemType === 'downtime') continue;
        if (!item.plannedStart || !isYmd(item.plannedStart)) continue;
        const plannedDays =
          typeof item.plannedDurationDays === 'number' && Number.isFinite(item.plannedDurationDays) && item.plannedDurationDays > 0
            ? item.plannedDurationDays
            : null;
        if (!plannedDays) continue;
        const plannedEndExcl = addDaysYmd(item.plannedStart, plannedDays);
        const plannedEnd = endInclusiveFromExclusive(plannedEndExcl, item.plannedStart);

        const leftDays = diffDaysYmd(rangeStart, item.plannedStart);
        const endDays = diffDaysYmd(rangeStart, plannedEnd) + 1;
        const clampedLeft = Math.max(0, leftDays);
        const clampedRight = Math.min(rangeDays, Math.max(clampedLeft, endDays));
        const visibleWidthDays = Math.max(0, clampedRight - clampedLeft);
        if (visibleWidthDays <= 0) continue;
        plannedBarsById.set(item.id, {
          leftPx: clampedLeft * GANTT_DAY_PX,
          widthPx: Math.max(visibleWidthDays * GANTT_DAY_PX, 6),
          startDate: item.plannedStart,
          endDate: plannedEnd,
        });
      }
    }
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
        const scheduleItem = scheduleItemById.get(item.id) ?? null;
        const isDowntime = scheduleItem?.itemType === 'downtime';
        const isPinned = scheduleItem?.mode === 'pinned';
        const issueLevel = issueLevelByScheduleId.get(item.id);
        const planned = plannedBarsById.get(item.id);

        const leftDays = diffDaysYmd(rangeStart, bar.startDate);
        const endDays = diffDaysYmd(rangeStart, bar.endDate) + 1; // inclusive
        const clampedLeft = Math.max(0, leftDays);
        const clampedRight = Math.min(rangeDays, Math.max(clampedLeft, endDays));

        const visibleWidthDays = Math.max(0, clampedRight - clampedLeft);
        const barWidthPx = visibleWidthDays > 0 ? Math.max(visibleWidthDays * GANTT_DAY_PX, 8) : 0;
        const baseDurationDays = Math.max(1, diffDaysYmd(bar.startDate, bar.endDate) + 1);

        let displayStart = bar.startDate;
        let displayEnd = bar.endDate;
        let displayLeftPx = clampedLeft * GANTT_DAY_PX;
        let displayWidthPx = barWidthPx;

        if (ganttDrag && ganttDrag.id === item.id) {
          if (ganttDrag.mode === 'move') {
            displayStart = addDaysYmd(bar.startDate, ganttDragDelta);
            displayEnd = addDaysYmd(bar.endDate, ganttDragDelta);
            displayLeftPx = displayLeftPx + ganttDragDelta * GANTT_DAY_PX;
          } else if (ganttDrag.mode === 'resize') {
            const nextDuration = Math.max(1, baseDurationDays + ganttDragDelta);
            displayEnd = addDaysYmd(bar.startDate, nextDuration - 1);
            displayWidthPx = Math.max(nextDuration * GANTT_DAY_PX, 8);
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
          startDate: displayStart,
          endDate: displayEnd,
          barLeftPx: displayLeftPx,
          barWidthPx: displayWidthPx,
          barColor: isDowntime ? '#6b7280' : installer.color,
          isDowntime,
          isPinned,
          issueLevel,
          plannedLeftPx: planned?.leftPx,
          plannedWidthPx: planned?.widthPx,
          plannedStart: planned?.startDate,
          plannedEnd: planned?.endDate,
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
      holidayBlocks,
      rows,
    };
  }, [
    collapsedCrews,
    ganttHolidays,
    installers,
    laneItems,
    rangeWeeks,
    schedulable.jobsById,
    schedule.bars,
    scheduleItemById,
    scheduleItemsRenderable,
    showPlanned,
    scheduleMode,
    issueLevelByScheduleId,
    ganttDrag,
    ganttDragDelta,
    today,
  ]);

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
      void queryClient.invalidateQueries({ queryKey: v2SnapshotKey });
      return;
    }
    setReloadNonce((n) => n + 1);
  }

  async function runWithCommitConfirmation(
    run: (force: boolean) => Promise<any>,
    opts?: { successToast?: string; errorToast?: string },
  ): Promise<boolean> {
    try {
      const res = await run(false);
      if (res && res.requires_confirmation) {
        const impacts = Array.isArray(res.impacts) ? res.impacts : [];
        const preview = impacts.length ? `\n\n${formatCommitImpactList(impacts)}` : '';
        const ok = typeof window !== 'undefined' ? window.confirm(`This change impacts jobs inside the next 10 working days.${preview}\n\nProceed?`) : false;
        if (!ok) return false;
        const confirmed = await run(true);
        if (!confirmed?.ok) throw new Error('Failed to apply changes after confirmation.');
      } else if (res && !res.ok) {
        throw new Error('Request failed.');
      }

      if (opts?.successToast) toast.success(opts.successToast);
      refreshSchedule();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update schedule.';
      toast.error(opts?.errorToast ?? msg);
      return false;
    }
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
      if (Math.abs(deltaPx) > 3) ganttDragMovedRef.current = true;
      const nextDelta = Math.round(deltaPx / GANTT_DAY_PX);
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

      if (!moved || deltaDays === 0) return;
      ganttClickBlockUntilRef.current = Date.now() + 250;

      const item = scheduleItemByIdRef.current.get(ganttDrag.id) ?? null;
      if (!item || item.itemType === 'downtime') return;

      const jobUuid = resolveProjectUuidRef.current(item);
      if (!jobUuid) return;

      const todayValue = todayRef.current;

      if (ganttDrag.mode === 'move') {
        const nextStart = addDaysYmd(ganttDrag.startDate, deltaDays);
        void runWithCommitConfirmationRef.current(
          (force) => pinJob({ job_id: jobUuid, requested_start_date: nextStart, force, today: todayValue }),
          { successToast: 'Job pinned.', errorToast: 'Failed to pin job.' },
        );
        return;
      }

      const nextDuration = Math.max(1, ganttDrag.durationDays + deltaDays);
      void (async () => {
        const ok = await runWithCommitConfirmationRef.current(
          (force) => setJobDuration({ job_id: jobUuid, forecast_duration_days: nextDuration, force, today: todayValue }),
          { successToast: 'Duration updated.', errorToast: 'Failed to update duration.' },
        );
        if (!ok) return;
        if (item.mode === 'pinned') return;
        await runWithCommitConfirmationRef.current(
          (force) => pinJob({ job_id: jobUuid, requested_start_date: ganttDrag.startDate, force, today: todayValue }),
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
  }, [ganttDrag]);

  const shouldBlockGanttClick = () => {
    if (typeof window === 'undefined') return false;
    return Date.now() < ganttClickBlockUntilRef.current;
  };

  const beginGanttDrag = (
    row: {
      scheduleItemId: string;
      startDate: string;
      endDate: string;
      barLeftPx: number;
      barWidthPx: number;
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
    const durationDays = Math.max(1, diffDaysYmd(row.startDate, row.endDate) + 1);
    ganttDragDeltaRef.current = 0;
    ganttDragMovedRef.current = false;
    setGanttDragDelta(0);
    setGanttDrag({
      id: row.scheduleItemId,
      mode,
      originX: e.clientX,
      startDate: row.startDate,
      endDate: row.endDate,
      durationDays,
      barLeftPx: row.barLeftPx,
      barWidthPx: row.barWidthPx,
    });
    try {
      const target = e.currentTarget as HTMLElement | null;
      target?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  };

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

  async function handleUnschedule(id: string) {
    if (scheduleMode === 'v2') {
      const item = scheduleItemById.get(id) ?? null;
      if (!item || item.itemType === 'downtime') return;
      const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
      if (isLockedScheduleStatus(status) && typeof window !== 'undefined') {
        const ok = window.confirm(`This job is ${scheduleStatusLabel(status)}. Unschedule anyway?`);
        if (!ok) return;
      }
      let projectUuid: string;
      try {
        projectUuid = uuidFromAppId(item.projectId, 'proj');
      } catch {
        toast.error('Invalid project ID for unscheduling.');
        return;
      }
      await runWithCommitConfirmation((force) => unassignJob({ job_id: projectUuid, force, today }), {
        successToast: 'Job unscheduled.',
        errorToast: 'Failed to unschedule job.',
      });
      return;
    }

    const status = scheduleStatusById.get(id) ?? 'TENTATIVE';
    if (isLockedScheduleStatus(status) && typeof window !== 'undefined') {
      const ok = window.confirm(`This job is ${scheduleStatusLabel(status)}. Unschedule anyway?`);
      if (!ok) return;
    }
    const next = scheduleItems.filter((i) => i.id !== id);
    await persist(next, { successToast: 'Job unscheduled.', errorToast: 'Failed to unschedule job.' });
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
    try {
      const res: any = await markJobDone({ job_id: jobUuid, today });
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
      if (res?.requires_confirmation) {
        const impacts = Array.isArray(res.impacts) ? res.impacts : [];
        const preview = impacts.length ? `\n\n${formatCommitImpactList(impacts)}` : '';
        const ok = typeof window !== 'undefined' ? window.confirm(`This change impacts jobs inside the next 10 working days.${preview}\n\nProceed?`) : false;
        if (!ok) return;
        const confirmed: any = await markJobDone({ job_id: jobUuid, force: true, today });
        if (!confirmed?.ok) throw new Error('Failed to mark job done.');
      } else if (res && !res.ok) {
        throw new Error('Failed to mark job done.');
      }
      toast.success('Job marked done.');
      refreshSchedule();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to mark job done.';
      toast.error(msg);
    }
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

    if (scheduleMode === 'v2') {
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
        const destIndex = overId.startsWith('lane:') ? existing.length : Math.max(0, existing.findIndex((i) => i.id === overId));
        let projectUuid: string;
        let crewUuid: string;
        try {
          projectUuid = uuidFromAppId(job.projectId, 'proj');
          crewUuid = uuidFromAppId(destInstallerId, 'crew');
        } catch {
          toast.error('Failed to map job/crew IDs for scheduling.');
          return;
        }
        void runWithCommitConfirmation(
          (force) => assignJob({ job_id: projectUuid, crew_id: crewUuid, position: destIndex < 0 ? existing.length : destIndex, force, today }),
          { successToast: 'Job scheduled.', errorToast: 'Failed to schedule job.' },
        );
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
        void runWithCommitConfirmation(
          (force) => reorderScheduleItemsV2({ crew_id: crewUuid, ordered_item_ids: ordered, force, today }),
          { successToast: 'Schedule updated.', errorToast: 'Failed to reorder schedule.' },
        );
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
        void runWithCommitConfirmation(
          (force) => assignJob({ job_id: projectUuid, crew_id: crewUuid, position: insertAt, force, today }),
          { successToast: 'Job moved.', errorToast: 'Failed to move job.' },
        );
      }
      return;
    }

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
          <SiteVisitsView />
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
                  {scheduleMode === 'v2' ? (
                    <button
                      type="button"
                      className={styles.buttonSecondary}
                      aria-pressed={showPlanned}
                      onClick={() => setShowPlanned((v) => !v)}
                    >
                      {showPlanned ? 'Hide planned' : 'Show planned'}
                    </button>
                  ) : null}
                </div>

                {scheduleMode === 'v2' ? (
                  <div className={styles.legendRow} aria-label="Gantt legend">
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
                    {gantt.holidayBlocks.map((b, idx) => (
                      <div
                        key={`holiday-${idx}-${b.leftPx}`}
                        className={styles.holidayShade}
                        style={{ left: GANTT_LABEL_PX + b.leftPx, width: b.widthPx }}
                        title={b.label}
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
                              ) : row.isDowntime ? (
                                <span className={styles.ganttProjectText}>{row.projectName}</span>
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
                          role={row.kind === 'item' && !row.isDowntime ? 'link' : undefined}
                          tabIndex={row.kind === 'item' && !row.isDowntime ? 0 : undefined}
                          onClick={
                            row.kind === 'item' && !row.isDowntime
                              ? () => {
                                  if (shouldBlockGanttClick()) return;
                                  router.push(
                                    `/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`,
                                  );
                                }
                              : undefined
                          }
                          onKeyDown={
                            row.kind === 'item' && !row.isDowntime
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
                            if (row.isDowntime) return;
                            if (shouldBlockGanttClick()) return;
                            e.stopPropagation();
                            router.push(`/staff/projects/${encodeURIComponent(row.projectId)}/estimate/${encodeURIComponent(row.estimateId)}`);
                          }}
                        >
                          {row.isPinned ? <span className={styles.ganttPin} aria-hidden="true" /> : null}
                          {row.barWidthPx >= GANTT_BAR_LABEL_MIN_PX ? (
                            <span className={styles.ganttBarText}>{row.projectName}</span>
                          ) : null}
                          {scheduleMode === 'v2' && !row.isDowntime ? (
                            <span
                              className={styles.ganttResizeHandle}
                              role="presentation"
                              onPointerDown={(e) => beginGanttDrag(row, 'resize', e)}
                            />
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
              <>
                {scheduleMode === 'v2' ? (
                  <div className={styles.legendRow} aria-label="Schedule legend">
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
                  </div>
                ) : null}
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
                  const computedNextAvailable = nextAvailableCandidate && nextAvailableCandidate < today ? today : nextAvailableCandidate;
                  const nextAvailable = scheduleMode === 'v2' ? nextAvailableByInstallerId.get(installer.id) ?? computedNextAvailable : computedNextAvailable;

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
                    const issueLevel = issueLevelByScheduleId.get(id);

                    if (scheduleItem?.itemType === 'downtime') {
                      const downtimeActions: MenuAction[] =
                        scheduleMode === 'v2'
                          ? [
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
                            ]
                          : [
                              {
                                label: 'Remove downtime',
                                tone: 'danger',
                                onClick: () => void handleUnschedule(id),
                              },
                            ];

                      cards.push(
                        <DowntimeCard
                          key={id}
                          id={id}
                          item={scheduleItem}
                          dateLine={dateLine}
                          dropTarget={overId === id && activeDragId !== id}
                          menuActions={downtimeActions}
                          issueLevel={issueLevel}
                        />,
                      );
                      continue;
                    }

                    const v2Actions: MenuAction[] = [];
                    const jobStatus = scheduleItem?.jobStatus ?? null;
                    const isInProgress = jobStatus === 'in_progress' || jobStatus === 'paused';
                    const isDone = jobStatus === 'done';
                    const isPinned = scheduleItem?.mode === 'pinned';
                    const baseDurationDays =
                      typeof scheduleItem?.forecastDurationDays === 'number' && Number.isFinite(scheduleItem.forecastDurationDays) && scheduleItem.forecastDurationDays > 0
                        ? scheduleItem.forecastDurationDays
                        : typeof scheduleItem?.durationHoursOverride === 'number' && Number.isFinite(scheduleItem.durationHoursOverride) && scheduleItem.durationHoursOverride > 0
                          ? Math.ceil(scheduleItem.durationHoursOverride / WORK_HOURS_PER_DAY)
                          : job && Number.isFinite(job.durationHours) && job.durationHours > 0
                            ? Math.ceil(job.durationHours / WORK_HOURS_PER_DAY)
                            : 1;

                    if (scheduleMode === 'v2' && scheduleItem) {
                      if (!isInProgress && !isDone) {
                        v2Actions.push({
                          label: isPinned ? 'Unpin' : 'Pin…',
                          onClick: () => {
                            if (isPinned) {
                              const jobUuid = resolveProjectUuid(scheduleItem);
                              if (!jobUuid) return;
                              void runWithCommitConfirmation((force) => unpinJob({ job_id: jobUuid, force, today }), {
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
                            void runWithCommitConfirmation(
                              (force) => setJobDuration({ job_id: jobUuid, forecast_duration_days: nextDays, force, today }),
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
                            void runWithCommitConfirmation(
                              (force) => setJobDuration({ job_id: jobUuid, forecast_duration_days: nextDays, force, today }),
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
                            void runWithCommitConfirmation((force) => markJobInProgress({ job_id: jobUuid, force, today }), {
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
                    }

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

                    const menuActions = scheduleMode === 'v2' ? v2Actions : legacyActions;

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
                        pinned={scheduleMode === 'v2' && scheduleItem?.mode === 'pinned'}
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
                  step={scheduleMode === 'v2' ? 1 : 0.5}
                  min={scheduleMode === 'v2' ? 1 : 0.5}
                  className={styles.input}
                  value={quickEdit.durationDays}
                  onChange={(e) => setQuickEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
                <p className={styles.hint} style={{ marginTop: 6 }}>
                  1 day = {WORK_HOURS_PER_DAY}h. {scheduleMode === 'v2' ? 'Whole days only.' : 'Use 0.5 increments.'}
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
                  if (scheduleMode === 'v2') {
                    if (item.itemType === 'downtime') {
                      setQuickEdit(null);
                      return;
                    }
                    let projectUuid: string;
                    try {
                      projectUuid = uuidFromAppId(item.projectId, 'proj');
                    } catch {
                      toast.error('Invalid project ID for quick edit.');
                      return;
                    }
                    const durationDays = Number.isFinite(days) && days > 0 ? Math.max(1, Math.round(days)) : null;

                    void (async () => {
                      let ok = true;
                      if (durationDays != null) {
                        ok = await runWithCommitConfirmation(
                          (force) => setJobDuration({ job_id: projectUuid, forecast_duration_days: durationDays, force, today }),
                          { successToast: 'Duration updated.', errorToast: 'Failed to update duration.' },
                        );
                        if (!ok) return;
                      }
                      if (start) {
                        ok = await runWithCommitConfirmation(
                          (force) => pinJob({ job_id: projectUuid, requested_start_date: start, force, today }),
                          { successToast: 'Job pinned.', errorToast: 'Failed to pin job.' },
                        );
                        if (!ok) return;
                      } else if (item.mode === 'pinned') {
                        ok = await runWithCommitConfirmation(
                          (force) => unpinJob({ job_id: projectUuid, force, today }),
                          { successToast: 'Job unpinned.', errorToast: 'Failed to unpin job.' },
                        );
                        if (!ok) return;
                      }
                      setQuickEdit(null);
                    })();
                    return;
                  }

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

      {durationEdit ? (
        <Modal open ariaLabel="Set job duration" onClose={() => setDurationEdit(null)} maxWidthPx={480}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Set duration</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDurationEdit(null)}>
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              Duration is stored as whole working days.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Duration (days)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  className={styles.input}
                  value={durationEdit.durationDays}
                  onChange={(e) => setDurationEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDurationEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                style={{ background: '#813f39', borderColor: 'rgba(129, 63, 57, 0.6)', color: '#fff' }}
                onClick={() => {
                  const item = scheduleItemById.get(durationEdit.id) ?? null;
                  if (!item || item.itemType === 'downtime') {
                    toast.error('Scheduled job not found.');
                    return;
                  }
                  const daysRaw = durationEdit.durationDays.trim();
                  const days = Number(daysRaw);
                  if (!Number.isFinite(days) || days <= 0) {
                    toast.error('Enter a valid duration in days.');
                    return;
                  }
                  const jobUuid = resolveProjectUuid(item);
                  if (!jobUuid) return;
                  const durationDays = Math.max(1, Math.round(days));
                  void runWithCommitConfirmation(
                    (force) => setJobDuration({ job_id: jobUuid, forecast_duration_days: durationDays, force, today }),
                    { successToast: 'Duration updated.', errorToast: 'Failed to update duration.' },
                  ).then((ok) => {
                    if (ok) setDurationEdit(null);
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {pinEdit ? (
        <Modal open ariaLabel="Pin job" onClose={() => setPinEdit(null)} maxWidthPx={480}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Pin job</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setPinEdit(null)}>
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              Pinned starts snap forward to the next working day if needed.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Start date
                </label>
                <input
                  type="date"
                  className={styles.input}
                  value={pinEdit.requestedStart}
                  onChange={(e) => setPinEdit((prev) => (prev ? { ...prev, requestedStart: e.target.value } : prev))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setPinEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                style={{ background: '#813f39', borderColor: 'rgba(129, 63, 57, 0.6)', color: '#fff' }}
                onClick={() => {
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
                  void runWithCommitConfirmation(
                    (force) => pinJob({ job_id: jobUuid, requested_start_date: start, force, today }),
                    { successToast: 'Job pinned.', errorToast: 'Failed to pin job.' },
                  ).then((ok) => {
                    if (ok) setPinEdit(null);
                  });
                }}
              >
                Pin job
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {daysRemainingEdit ? (
        <Modal open ariaLabel="Set days remaining" onClose={() => setDaysRemainingEdit(null)} maxWidthPx={480}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Days remaining</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDaysRemainingEdit(null)}>
                Close
              </button>
            </div>

            <p className={styles.hint} style={{ marginTop: 10 }}>
              Updates the forecast duration for this in-progress job.
            </p>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Days remaining
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  className={styles.input}
                  value={daysRemainingEdit.daysRemaining}
                  onChange={(e) => setDaysRemainingEdit((prev) => (prev ? { ...prev, daysRemaining: e.target.value } : prev))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDaysRemainingEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                style={{ background: '#813f39', borderColor: 'rgba(129, 63, 57, 0.6)', color: '#fff' }}
                onClick={() => {
                  const item = scheduleItemById.get(daysRemainingEdit.id) ?? null;
                  if (!item || item.itemType === 'downtime') {
                    toast.error('Scheduled job not found.');
                    return;
                  }
                  const daysRaw = daysRemainingEdit.daysRemaining.trim();
                  const days = Number(daysRaw);
                  if (!Number.isFinite(days) || days <= 0) {
                    toast.error('Enter a valid number of days.');
                    return;
                  }
                  const jobUuid = resolveProjectUuid(item);
                  if (!jobUuid) return;
                  const daysRemaining = Math.max(1, Math.round(days));
                  void runWithCommitConfirmation(
                    (force) => setDaysRemaining({ job_id: jobUuid, days_remaining: daysRemaining, force, today }),
                    { successToast: 'Days remaining updated.', errorToast: 'Failed to update days remaining.' },
                  ).then((ok) => {
                    if (ok) setDaysRemainingEdit(null);
                  });
                }}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {downtimeEdit ? (
        <Modal
          open
          ariaLabel={downtimeEdit.mode === 'create' ? 'Add downtime' : 'Edit downtime'}
          onClose={() => setDowntimeEdit(null)}
          maxWidthPx={520}
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                {downtimeEdit.mode === 'create' ? 'Add downtime' : 'Edit downtime'}
              </h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDowntimeEdit(null)}>
                Close
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Duration (days)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  step={1}
                  min={1}
                  className={styles.input}
                  value={downtimeEdit.durationDays}
                  onChange={(e) => setDowntimeEdit((prev) => (prev ? { ...prev, durationDays: e.target.value } : prev))}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Reason
                </label>
                <select
                  className={styles.input}
                  value={downtimeEdit.reason}
                  onChange={(e) => setDowntimeEdit((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                >
                  <option value="weather">Weather</option>
                  <option value="materials">Materials</option>
                  <option value="site">Site</option>
                  <option value="staff">Staff</option>
                  <option value="travel">Travel</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Note
                </label>
                <textarea
                  className={styles.input}
                  rows={3}
                  value={downtimeEdit.note}
                  onChange={(e) => setDowntimeEdit((prev) => (prev ? { ...prev, note: e.target.value } : prev))}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setDowntimeEdit(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                style={{ background: '#813f39', borderColor: 'rgba(129, 63, 57, 0.6)', color: '#fff' }}
                onClick={() => {
                  const daysRaw = downtimeEdit.durationDays.trim();
                  const days = Number(daysRaw);
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
                }}
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {finishEarlyPrompt ? (
        <Modal
          open
          ariaLabel="Finish early options"
          onClose={() => setFinishEarlyPrompt(null)}
          maxWidthPx={560}
        >
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, letterSpacing: '0.02em', textTransform: 'uppercase' }}>Finished early</h2>
              <button type="button" className={styles.buttonSecondary} onClick={() => setFinishEarlyPrompt(null)}>
                Close
              </button>
            </div>

            {(() => {
              const scheduleItem = scheduleItemById.get(finishEarlyPrompt.scheduleItemId) ?? null;
              const project = scheduleItem?.projectId ? projectsById.get(scheduleItem.projectId) ?? null : null;
              const jobName = scheduleItem?.itemType === 'job' ? safeProjectName(project) : 'Job';
              const endInclusive = finishEarlyPrompt.forecastEndExclusive
                ? endInclusiveFromExclusive(finishEarlyPrompt.forecastEndExclusive, finishEarlyPrompt.forecastEndExclusive)
                : null;
              const forecastLabel = endInclusive ? formatShortDate(endInclusive) : '—';
              return (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontWeight: 700 }}>{jobName}</div>
                  <p className={styles.hint} style={{ marginTop: 6 }}>
                    Finished on {formatShortDate(finishEarlyPrompt.actualFinish)} — {finishEarlyPrompt.freedDays} working day
                    {finishEarlyPrompt.freedDays === 1 ? '' : 's'} freed (forecast end {forecastLabel}).
                  </p>
                </div>
              );
            })()}

            {finishEarlyPrompt.impacts?.length ? (
              <div style={{ marginTop: 12 }}>
                <div className={styles.hint} style={{ fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Pull forward preview
                </div>
                <pre className={styles.note} style={{ marginTop: 6, whiteSpace: 'pre-wrap' }}>
                  {formatCommitImpactList(finishEarlyPrompt.impacts)}
                </pre>
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button type="button" className={styles.buttonSecondary} onClick={() => setFinishEarlyPrompt(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
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
                }}
              >
                Keep schedule as-is
              </button>
              <button
                type="button"
                className={styles.buttonSecondary}
                style={{ background: '#813f39', borderColor: 'rgba(129, 63, 57, 0.6)', color: '#fff' }}
                onClick={() => {
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
                }}
              >
                Pull forward
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
      </div>
    </main>
  );
}
