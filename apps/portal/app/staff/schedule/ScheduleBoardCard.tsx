'use client';

import type { CSSProperties, ReactNode } from 'react';
import type { ScheduleItemStatus } from '@/lib/types/scheduling';
import type { ScheduleBoardMutationNotice } from './useScheduleBoardMutationNotice';
import type { ScheduleAttentionPresentation } from './ScheduleOperationalPresentation';
import styles from './scheduleBoard.module.css';

function scheduleStatusLabel(status: ScheduleItemStatus): string {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'COMPLETED') return 'Completed';
  return 'Tentative';
}

export default function JobCardShell({
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

