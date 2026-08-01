'use client';

import { useRouter } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import type { SchedulableJob } from './ScheduleClientModel';
import { ScheduleBoardActions, type ScheduleBoardMenuAction } from './ScheduleBoardActions';
import type { ScheduleBoardMutationNotice } from './useScheduleBoardMutationNotice';
import type { ScheduleAttentionPresentation } from './ScheduleOperationalPresentation';
import styles from './scheduleBoard.module.css';

export type { ScheduleBoardMenuAction } from './ScheduleBoardActions';

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
  planLabel,
  planCommitted,
  attention,
  clientContacted,
  warning,
  issueLevel,
  dragProps,
  draggable,
  moveDisabled,
  moveDisabledReason,
  dragging,
  menu,
  cardRef,
  dragHandleRef,
  style,
  dropTarget,
  mutationNotice,
  sequencePosition,
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
  planLabel?: string;
  planCommitted?: boolean;
  attention?: ScheduleAttentionPresentation;
  clientContacted?: boolean;
  warning?: boolean;
  issueLevel?: 'warning' | 'error';
  dragProps?: Record<string, unknown>;
  draggable?: boolean;
  moveDisabled?: boolean;
  moveDisabledReason?: string;
  dragging?: boolean;
  menu?: ReactNode;
  cardRef: (node: HTMLElement | null) => void;
  dragHandleRef?: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dropTarget?: boolean;
  mutationNotice?: ScheduleBoardMutationNotice | null;
  sequencePosition?: number;
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
  const hasAttention = Boolean(attention?.signals.length || clientContacted || (!attention && (warning || issueLevel)));

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
      data-mutation-notice={mutationNotice?.tone}
    >
      <div className={styles.jobTopRow}>
        <div className={styles.jobMain}>
          {sequencePosition ? (
            <span className={styles.sequencePosition} data-schedule-position={sequencePosition}>
              Position {sequencePosition}
            </span>
          ) : null}
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
              {...(moveDisabled ? {} : (dragProps as any))}
              disabled={moveDisabled}
              aria-label={moveDisabled ? `Move ${title} unavailable` : `Move ${title}`}
              title={moveDisabledReason ?? `Move ${title}`}
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
        {planLabel ? (
          <span className={styles.planRow} data-committed={planCommitted ? 'true' : 'false'}>
            Plan: {planLabel}
          </span>
        ) : null}
      </div>

      {mutationNotice ? (
        <div className={styles.cardMutationNotice} data-tone={mutationNotice.tone} role="alert">
          <span>{mutationNotice.message}</span>
          <button
            type="button"
            className={styles.cardMutationAction}
            data-no-dnd="true"
            onClick={mutationNotice.onAction}
          >
            {mutationNotice.actionLabel}
          </button>
        </div>
      ) : null}

      {hasAttention ? (
        <div className={styles.badgesRow}>
          {attention?.signals.map((signal) => (
            <span key={signal.key} className={styles.attentionBadge} data-tone={signal.tone} title={signal.detail}>
              {signal.label}
            </span>
          ))}
          {clientContacted ? <span className={styles.clientAckPill}>Client contacted</span> : null}
          {!attention && issueLevel === 'error' ? (
            <span className={styles.warnBadge}>Conflict</span>
          ) : !attention && (warning || issueLevel === 'warning') ? (
            <span className={styles.warnBadge}>Warning</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function UnscheduledJobCard({
  job,
  interactionDisabled = false,
  interactionDisabledReason,
  mutationNotice,
}: {
  job: SchedulableJob;
  interactionDisabled?: boolean;
  interactionDisabledReason?: string;
  mutationNotice?: ScheduleBoardMutationNotice | null;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: job.id,
    data: { kind: 'job' },
    disabled: interactionDisabled,
  });
  const style = {
    opacity: isDragging ? 0.35 : 1,
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
      moveDisabled={interactionDisabled}
      moveDisabledReason={interactionDisabledReason}
      dragging={isDragging}
      mutationNotice={mutationNotice}
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
  planLabel,
  planCommitted,
  attention,
  clientContacted,
  issueLevel,
  onMount,
  interactionDisabled = false,
  interactionDisabledReason,
  mutationNotice,
  sequencePosition,
}: {
  id: string;
  job: SchedulableJob | null;
  scheduleStatus: ScheduleItemStatus;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: ScheduleBoardMenuAction[];
  pinned?: boolean;
  planLabel?: string;
  planCommitted?: boolean;
  attention?: ScheduleAttentionPresentation;
  clientContacted?: boolean;
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
  interactionDisabled?: boolean;
  interactionDisabledReason?: string;
  mutationNotice?: ScheduleBoardMutationNotice | null;
  sequencePosition?: number;
}) {
  const router = useRouter();
  const locked = isLockedScheduleStatus(scheduleStatus);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id,
    disabled: locked || interactionDisabled,
  });
  const style = {
    opacity: isDragging ? 0.35 : 1,
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
      planLabel={planLabel}
      planCommitted={planCommitted}
      attention={attention}
      clientContacted={clientContacted}
      onOpen={job ? () => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`) : undefined}
      dateLine={dateLine}
      warning={Boolean(job?.warnings?.length)}
      issueLevel={issueLevel}
      dragProps={locked ? {} : { ...attributes, ...listeners }}
      draggable={!locked}
      moveDisabled={interactionDisabled}
      moveDisabledReason={interactionDisabledReason}
      dragging={isDragging}
      menu={
        <ScheduleBoardActions
          actions={menuActions}
          projectName={job?.projectName ?? 'Untitled project'}
          disabled={interactionDisabled}
          disabledReason={interactionDisabledReason}
        />
      }
      mutationNotice={mutationNotice}
      sequencePosition={sequencePosition}
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
  interactionDisabled = false,
  interactionDisabledReason,
  sequencePosition,
}: {
  id: string;
  item: ScheduleItem;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: ScheduleBoardMenuAction[];
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
  interactionDisabled?: boolean;
  interactionDisabledReason?: string;
  sequencePosition?: number;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id, disabled: interactionDisabled });
  const style = {
    opacity: isDragging ? 0.35 : 1,
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
      moveDisabled={interactionDisabled}
      moveDisabledReason={interactionDisabledReason}
      dragging={isDragging}
      menu={
        <ScheduleBoardActions
          actions={menuActions}
          projectName={reason}
          disabled={interactionDisabled}
          disabledReason={interactionDisabledReason}
        />
      }
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      dragHandleRef={setActivatorNodeRef}
      style={style}
      dropTarget={dropTarget}
      sequencePosition={sequencePosition}
    />
  );
}
