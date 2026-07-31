'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import type { SchedulableJob } from './ScheduleClientModel';
import styles from './scheduleBoard.module.css';

export type ScheduleBoardMenuAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

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

export function formatScheduleBoardStatusLabel(status: string): string {
  if (!status) return '—';
  if (status.toUpperCase() === 'DOWNTIME') return 'Downtime';
  const normalized = normalizeProjectStatus(status);
  return projectStatusLabel(normalized.status);
}

function scheduleStatusLabel(status: ScheduleItemStatus): string {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'COMPLETED') return 'Completed';
  return 'Tentative';
}

function isLockedScheduleStatus(status: ScheduleItemStatus): boolean {
  return status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED';
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}

function JobActionsMenu({
  actions,
  ariaLabel,
}: {
  actions: ScheduleBoardMenuAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const items = actions.filter((action) => action && typeof action.onClick === 'function');

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target || !ref.current) return;
      if (!ref.current.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div
      ref={ref}
      className={styles.menuWrap}
      data-no-dnd="true"
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={styles.kebab}
        data-no-dnd="true"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Job actions'}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        title={ariaLabel ?? 'Job actions'}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className={styles.menu}
          data-no-dnd="true"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((action, index) => (
            <button
              key={`${action.label}-${index}`}
              type="button"
              role="menuitem"
              data-no-dnd="true"
              className={cx(styles.menuItem, action.tone === 'danger' && styles.menuItemDanger)}
              disabled={Boolean(action.disabled)}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (action.disabled) return;
                setOpen(false);
                window.setTimeout(() => action.onClick(), 0);
              }}
              onClick={(event) => {
                event.stopPropagation();
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
  dragId,
  title,
  identityDetail,
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
  dragHandleRef,
  style,
  dropTarget,
}: {
  dragId?: string;
  title: string;
  identityDetail?: string | null;
  descriptor: string;
  statusLabel: string;
  durationLabel: string;
  durationTitle: string;
  scheduleStatus?: ScheduleItemStatus;
  pinned?: boolean;
  onOpen?: () => void;
  dateLine?: string;
  extraBadges?: ReactNode;
  warning?: boolean;
  issueLevel?: 'warning' | 'error';
  dragProps?: Record<string, unknown>;
  draggable?: boolean;
  dragging?: boolean;
  menu?: ReactNode;
  cardRef: (node: HTMLElement | null) => void;
  dragHandleRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dropTarget?: boolean;
}) {
  const identity = (
    <>
      <span className={styles.jobTitle} title={title}>
        {title}
      </span>
      {identityDetail ? (
        <span className={styles.jobIdentityDetail} title={identityDetail}>
          {identityDetail}
        </span>
      ) : null}
      {descriptor && descriptor !== identityDetail ? (
        <span className={styles.jobDescriptor} title={descriptor}>
          {descriptor}
        </span>
      ) : null}
    </>
  );
  const hasAttention = Boolean(extraBadges || warning || issueLevel);

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
    >
      <div className={styles.jobTopRow}>
        <div className={styles.jobMain}>
          {onOpen ? (
            <button
              type="button"
              className={styles.projectOpenButton}
              data-no-dnd="true"
              aria-label={`Open project ${title}`}
              onClick={onOpen}
            >
              {identity}
            </button>
          ) : (
            <div className={styles.jobIdentity}>{identity}</div>
          )}
        </div>

        <div className={styles.jobRight}>
          {draggable ? (
            <button
              ref={dragHandleRef}
              type="button"
              className={styles.dragHandle}
              data-dragging={dragging ? 'true' : undefined}
              {...(dragProps as any)}
              aria-label={`Move ${title}`}
              title={`Move ${title}`}
            >
              <span aria-hidden="true">Move</span>
            </button>
          ) : null}
          {menu}
        </div>
      </div>

      <div className={styles.timingRow}>
        {dateLine ? <span>{dateLine}</span> : null}
        {dateLine ? <span className={styles.timingDivider} aria-hidden="true" /> : null}
        <span className={styles.timingDuration} title={durationTitle}>
          {durationLabel}
        </span>
      </div>

      <div className={styles.cardMetaRow}>
        <span className={styles.cardMetaItem}>Stage: {statusLabel}</span>
        {scheduleStatus ? <span className={styles.cardMetaItem}>Job: {scheduleStatusLabel(scheduleStatus)}</span> : null}
        {pinned ? <span className={styles.cardMetaItem}>Timing: Pinned</span> : null}
      </div>

      {hasAttention ? (
        <div className={styles.badgesRow}>
          {extraBadges}
          {issueLevel === 'error' ? (
            <span className={styles.warnBadge}>Conflict</span>
          ) : warning || issueLevel === 'warning' ? (
            <span className={styles.warnBadge}>Warning</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function UnscheduledJobCard({ job }: { job: SchedulableJob }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { kind: 'job' },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  } as CSSProperties;

  return (
    <JobCardShell
      dragId={job.id}
      title={job.projectName}
      identityDetail={job.identityDetail}
      descriptor={job.descriptor}
      statusLabel={formatScheduleBoardStatusLabel(job.status)}
      durationLabel={job.durationLabel}
      durationTitle={job.durationTitle}
      onOpen={() => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`)}
      warning={job.warnings.length > 0}
      dragProps={{ ...attributes, ...listeners }}
      draggable
      dragging={isDragging}
      cardRef={(node) => setNodeRef(node as any)}
      dragHandleRef={setActivatorNodeRef}
      style={style}
    />
  );
}

export function ScheduledJobCard({
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
  menuActions: ScheduleBoardMenuAction[];
  pinned?: boolean;
  extraBadges?: ReactNode;
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
}) {
  const router = useRouter();
  const locked = isLockedScheduleStatus(scheduleStatus);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: locked,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as CSSProperties;

  return (
    <JobCardShell
      dragId={id}
      title={job?.projectName ?? 'Untitled project'}
      identityDetail={job?.identityDetail}
      descriptor={job?.descriptor ?? '—'}
      statusLabel={formatScheduleBoardStatusLabel(job?.status ?? '')}
      durationLabel={job?.durationLabel ?? '—'}
      durationTitle={job?.durationTitle ?? '—'}
      scheduleStatus={scheduleStatus}
      pinned={pinned}
      extraBadges={extraBadges}
      onOpen={job ? () => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`) : undefined}
      dateLine={dateLine}
      warning={Boolean(job?.warnings?.length)}
      issueLevel={issueLevel}
      dragProps={locked ? {} : { ...attributes, ...listeners }}
      draggable={!locked}
      dragging={isDragging}
      menu={<JobActionsMenu actions={menuActions} ariaLabel={`Job actions for ${job?.projectName ?? 'Untitled project'}`} />}
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      dragHandleRef={setActivatorNodeRef}
      style={style}
      dropTarget={dropTarget}
    />
  );
}

export function DowntimeCard({
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
  menuActions: ScheduleBoardMenuAction[];
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as CSSProperties;

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
      dragHandleRef={setActivatorNodeRef}
      style={style}
      dropTarget={dropTarget}
    />
  );
}
