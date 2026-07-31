import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import type { ProjectWorkQueueEntry } from '@/lib/projects/workItems/types';
import { isGenericCompletableWorkSource } from '@/lib/projects/workItems/workItemCapabilities';
import {
  projectWorkDueLabel,
  projectWorkEffectiveAssigneeLabel,
} from '@/lib/projects/workItems/presentation';
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
  return projectWorkDueLabel(entry, now);
}

export function effectiveAssigneeLabel(
  entry: WorkQueueEntryView,
  staff: ProjectCommandStaffSummary[],
): string {
  return projectWorkEffectiveAssigneeLabel(entry.effectiveAssignee, staff);
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

export function isGenericCompletable(entry: WorkQueueEntryView): boolean {
  return (
    entry.actionKind === 'workItem'
    && isGenericCompletableWorkSource(entry.sourceType)
  );
}

export function canManageQueueWorkItem(entry: WorkQueueEntryView): boolean {
  return Boolean(
    entry.actionKind === 'workItem'
    && entry.sourceType !== 'LEGACY_REVIEW'
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
