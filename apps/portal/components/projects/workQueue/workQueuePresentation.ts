import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import {
  formatAucklandDateTimeLocal,
  parseAucklandDateTimeLocal,
} from '@/lib/time/aucklandDateTime';

type WorkQueueGroup = ProjectWorkQueueEntry['group'];

export const WORK_QUEUE_GROUPS: ReadonlyArray<{
  key: WorkQueueGroup;
  label: string;
  description: string;
}> = [
  { key: 'overdue', label: 'Overdue', description: 'Do these first.' },
  { key: 'today', label: 'Today', description: 'Due or ready now.' },
  {
    key: 'nextSevenBusinessDays',
    label: 'Next 7 business days',
    description: 'Upcoming work that needs preparation.',
  },
  { key: 'blocked', label: 'Blocked', description: 'Resolve the reason before work can continue.' },
  { key: 'needsTriage', label: 'Needs triage', description: 'A staff decision is required.' },
];

export type WorkQueueEntryView = ProjectWorkQueueEntry & {
  pipelineStage?: string;
};

export function queueEntryStage(entry: WorkQueueEntryView): string {
  return entry.pipelineStage?.trim() || entry.stage?.trim() || '';
}

export function queueEntryReason(entry: WorkQueueEntryView): string {
  return (
    entry.reason?.trim()
    || entry.blockedReason?.trim()
    || (entry.actionKind === 'specialist'
      ? 'This action is ready in its specialist workspace.'
      : 'This is the current server-confirmed project obligation.')
  );
}

export function queueDueLabel(
  entry: WorkQueueEntryView,
  now = new Date(),
): string {
  if (entry.actionKind === 'specialist') return 'Ready now';
  if (entry.group === 'blocked') return 'Blocked';
  if (entry.actionKind === 'stateReview') return 'Wake-up due';
  if (entry.group === 'needsTriage') return 'Decision needed';
  if (!entry.dueAt) return 'No due time';
  const due = new Date(entry.dueAt);
  if (!Number.isFinite(due.valueOf())) return 'Due time unavailable';
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dueDate = date.format(due);
  const today = date.format(now);
  if (dueDate < today) {
    return `Overdue - ${new Intl.DateTimeFormat('en-NZ', {
      timeZone: 'Pacific/Auckland',
      day: 'numeric',
      month: 'short',
    }).format(due)}`;
  }
  if (dueDate === today) return 'Due today';
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(due);
}

export function effectiveAssigneeLabel(
  entry: WorkQueueEntryView,
  staff: ProjectCommandStaffSummary[],
): string {
  const assignee = entry.effectiveAssignee;
  if (assignee.kind === 'staff') {
    return staff.find((person) => person.userId === assignee.userId)?.displayName ?? 'Assigned staff';
  }
  if (assignee.kind === 'projectOwner') {
    return projectOwnerOption(assignee.ownerKey)?.displayName ?? 'Project owner';
  }
  return 'Unassigned';
}

export function sentConfirmationCommand(entry: WorkQueueEntryView): string | null {
  if (entry.sourceKey?.startsWith('lead:first-email:')) {
    return 'RECORD_FIRST_ENQUIRY_EMAIL_SENT';
  }
  if (entry.sourceKey?.startsWith('lead:follow-up:')) {
    return 'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT';
  }
  if (entry.sourceKey?.startsWith('quote:follow-up:')) {
    return 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT';
  }
  return null;
}

export function replyConfirmationCommand(entry: WorkQueueEntryView): string | null {
  if (entry.sourceType === 'QUOTE_CADENCE') return 'RECORD_QUOTE_CUSTOMER_REPLY';
  if (entry.sourceType === 'LEAD_CADENCE') return 'RECORD_ENQUIRY_CUSTOMER_REPLY';
  return null;
}

export function isManualCompletable(entry: WorkQueueEntryView): boolean {
  return (
    entry.actionKind === 'workItem'
    && (entry.sourceType === 'MANUAL' || entry.sourceType === 'LEGACY_REVIEW')
  );
}

export function canManageQueueWorkItem(entry: WorkQueueEntryView): boolean {
  return Boolean(
    entry.actionKind === 'workItem'
    && entry.workItemId
    && entry.workItemRowVersion,
  );
}

export function toLocalDateTimeValue(value: string | null): string {
  return formatAucklandDateTimeLocal(value);
}

export function aucklandLocalDateTimeToIso(value: string): string | null {
  return parseAucklandDateTimeLocal(value);
}
