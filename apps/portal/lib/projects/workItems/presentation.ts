import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import type {
  ProjectClosedOutcome,
  ProjectWorkEffectiveAssignee,
  ProjectWorkQueueActionKind,
  ProjectWorkQueueGroup,
  ProjectWorkResponsibilityArea,
} from './types';

const CLOSED_OUTCOME_LABELS: Record<ProjectClosedOutcome, string> = {
  LOST_NO_RESPONSE: 'Lost - No response',
  LOST_BUDGET_PRICE: 'Lost - Budget or price',
  LOST_OTHER_SUPPLIER: 'Lost - Chose another supplier',
  LOST_TIMING_DEFERRED: 'Lost - Timing deferred',
  LOST_NOT_SUITABLE: 'Lost - Not suitable',
  CANCELLED: 'Cancelled',
  COMPLETE: 'Complete',
};

const RESPONSIBILITY_LABELS: Record<ProjectWorkResponsibilityArea, string> = {
  CUSTOMER: 'Customer follow-up',
  DESIGN: 'Design',
  COMMERCIAL: 'Commercial',
  OPERATIONS: 'Delivery',
  ADMIN: 'Administration',
};

export function projectClosedOutcomeLabel(
  outcome: ProjectClosedOutcome | null | undefined,
): string {
  return outcome ? CLOSED_OUTCOME_LABELS[outcome] : 'Not recorded';
}

export function projectWorkResponsibilityLabel(
  responsibility: ProjectWorkResponsibilityArea,
): string {
  return RESPONSIBILITY_LABELS[responsibility];
}

export function projectWorkEffectiveAssigneeLabel(
  assignee: ProjectWorkEffectiveAssignee,
  staff: readonly ProjectCommandStaffSummary[] = [],
): string {
  if (assignee.kind === 'staff') {
    return staff.find((person) => person.userId === assignee.userId)?.displayName
      ?? 'Assigned staff';
  }
  if (assignee.kind === 'projectOwner') {
    return projectOwnerOption(assignee.ownerKey)?.displayName ?? 'Project owner';
  }
  return 'Unassigned';
}

export function projectWorkDueLabel(
  input: {
    actionKind: ProjectWorkQueueActionKind;
    group: ProjectWorkQueueGroup;
    dueAt: string | null;
  },
  now = new Date(),
): string {
  if (input.actionKind === 'specialist') return 'Ready now';
  if (input.group === 'blocked') return 'Blocked';
  if (input.actionKind === 'stateReview') return 'Wake-up due';
  if (input.group === 'needsTriage') return 'Decision needed';
  if (!input.dueAt) return 'No due time';

  const due = new Date(input.dueAt);
  if (!Number.isFinite(due.valueOf())) return 'Due time unavailable';
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Pacific/Auckland',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dueDate = localDate.format(due);
  const today = localDate.format(now);
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
