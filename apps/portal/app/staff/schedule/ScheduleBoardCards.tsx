'use client';

import { useRouter } from 'next/navigation';
import JobCardShell from './ScheduleBoardCard';
import { useDraggable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import type { SchedulableJob } from './ScheduleClientModel';
import { ScheduleBoardActions, type ScheduleBoardMenuAction } from './ScheduleBoardActions';
import type { ScheduleBoardMutationNotice } from './useScheduleBoardMutationNotice';
import type { ScheduleAttentionPresentation } from './ScheduleOperationalPresentation';

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

function formatScheduleBoardStatusLabel(status: string): string {
  if (!status) return '—';
  if (status.toUpperCase() === 'DOWNTIME') return 'Downtime';
  const normalized = normalizeProjectStatus(status);
  return projectStatusLabel(normalized.status);
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
  actionDisabled = false,
  actionDisabledReason,
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
  actionDisabled?: boolean;
  actionDisabledReason?: string;
  mutationNotice?: ScheduleBoardMutationNotice | null;
  sequencePosition?: number;
}) {
  const router = useRouter();
  const locked = isLockedScheduleStatus(scheduleStatus);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({
    id,
    disabled: locked || interactionDisabled,
  });

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
          disabled={actionDisabled}
          disabledReason={actionDisabledReason}
        />
      }
      mutationNotice={mutationNotice}
      sequencePosition={sequencePosition}
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      dragHandleRef={setActivatorNodeRef}
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
  actionDisabled = false,
  actionDisabledReason,
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
  actionDisabled?: boolean;
  actionDisabledReason?: string;
  sequencePosition?: number;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useSortable({ id, disabled: interactionDisabled });

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
          disabled={actionDisabled}
          disabledReason={actionDisabledReason}
        />
      }
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      dragHandleRef={setActivatorNodeRef}
      dropTarget={dropTarget}
      sequencePosition={sequencePosition}
    />
  );
}
