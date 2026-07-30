const PROJECT_OPERATIONAL_STATES = ['ACTIVE', 'WAITING', 'CLOSED'] as const;
export type ProjectOperationalState = (typeof PROJECT_OPERATIONAL_STATES)[number];

export const PROJECT_CLOSED_OUTCOMES = [
  'LOST_NO_RESPONSE',
  'LOST_BUDGET_PRICE',
  'LOST_OTHER_SUPPLIER',
  'LOST_TIMING_DEFERRED',
  'LOST_NOT_SUITABLE',
  'CANCELLED',
  'COMPLETE',
] as const;
export type ProjectClosedOutcome = (typeof PROJECT_CLOSED_OUTCOMES)[number];

export const PROJECT_LOST_OUTCOMES = [
  'LOST_NO_RESPONSE',
  'LOST_BUDGET_PRICE',
  'LOST_OTHER_SUPPLIER',
  'LOST_TIMING_DEFERRED',
  'LOST_NOT_SUITABLE',
  'CANCELLED',
] as const satisfies readonly ProjectClosedOutcome[];

const PROJECT_WORK_ITEM_STATUSES = ['OPEN', 'BLOCKED', 'DONE', 'CANCELLED'] as const;
export type ProjectWorkItemStatus = (typeof PROJECT_WORK_ITEM_STATUSES)[number];

export const PROJECT_WORK_RESPONSIBILITY_AREAS = [
  'CUSTOMER',
  'DESIGN',
  'COMMERCIAL',
  'OPERATIONS',
  'ADMIN',
] as const;
export type ProjectWorkResponsibilityArea = (typeof PROJECT_WORK_RESPONSIBILITY_AREAS)[number];

const PROJECT_WORK_ITEM_PRIORITIES = ['NORMAL', 'CRITICAL'] as const;
export type ProjectWorkItemPriority = (typeof PROJECT_WORK_ITEM_PRIORITIES)[number];

const PROJECT_WORK_ITEM_ORIGINS = ['MANUAL', 'AUTOMATION', 'REVIEWED_MIGRATION'] as const;
export type ProjectWorkItemOrigin = (typeof PROJECT_WORK_ITEM_ORIGINS)[number];

const PROJECT_WORK_ITEM_SOURCE_TYPES = [
  'LEAD_CADENCE',
  'QUOTE_CADENCE',
  'MANUAL',
  'LEGACY_REVIEW',
] as const;
export type ProjectWorkItemSourceType = (typeof PROJECT_WORK_ITEM_SOURCE_TYPES)[number];

const PROJECT_CONFIRMATION_TYPES = [
  'FIRST_ENQUIRY_EMAIL_SENT',
  'ENQUIRY_FOLLOW_UP_EMAIL_SENT',
  'ENQUIRY_CUSTOMER_REPLY_RECEIVED',
  'QUOTE_FOLLOW_UP_EMAIL_SENT',
  'QUOTE_CUSTOMER_REPLY_RECEIVED',
  'SITE_VISIT_COMPLETED',
] as const;
export type ProjectConfirmationType = (typeof PROJECT_CONFIRMATION_TYPES)[number];

export type ProjectWorkEffectiveAssignee =
  | { kind: 'staff'; userId: string }
  | { kind: 'projectOwner'; ownerKey: string }
  | { kind: 'unassigned' };

export type ProjectWorkItem = {
  id: string;
  projectId: string;
  title: string;
  responsibilityArea: ProjectWorkResponsibilityArea;
  status: ProjectWorkItemStatus;
  dueAt: string;
  slaBreachAt: string | null;
  deadlinePolicy: string | null;
  calendarRevision: string | null;
  assigneeUserId: string | null;
  effectiveAssignee: ProjectWorkEffectiveAssignee;
  priority: ProjectWorkItemPriority;
  priorityReason: string | null;
  blockedReason: string | null;
  origin: ProjectWorkItemOrigin;
  sourceType: ProjectWorkItemSourceType;
  sourceKey: string | null;
  seriesKey: string | null;
  subjectKind: string | null;
  subjectId: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  outcome: string | null;
  cancellationReason: string | null;
};

export type ProjectWorkConfirmationFact = {
  id: string;
  type: ProjectConfirmationType;
  subjectKind: 'PROJECT' | 'QUOTE_VERSION' | 'ENQUIRY_REQUEST' | null;
  subjectId: string | null;
  occurredAt: string;
  recordedAt: string;
};

export type ProjectWorkPrimaryCandidate =
  | {
      kind: 'recovery';
      key: string;
      title: string;
      reason: string;
      href: string | null;
    }
  | {
      kind: 'workItem';
      item: ProjectWorkItem;
      dueState: 'critical' | 'overdue' | 'today' | 'future';
    }
  | {
      kind: 'specialist';
      key: string;
      title: string;
      reason: string;
      owner: string;
      expectedResult: string;
      href: string | null;
    }
  | {
      kind: 'needsTriage';
      title: 'Needs triage';
      reason: string;
    }
  | {
      kind: 'stateReview';
      key: 'waiting-review';
      title: 'Review waiting project';
      reason: string;
      dueAt: string;
    }
  | {
      kind: 'none';
      title: string;
      reason: string;
    };

export type ProjectWorkProjection = {
  projectId: string;
  modelVersion: 2;
  operationalState: ProjectOperationalState;
  effectiveState: ProjectOperationalState | 'ARCHIVED';
  waitingUntil: string | null;
  waitingReason: string | null;
  closedOutcome: ProjectClosedOutcome | null;
  stateRowVersion: number;
  primaryAction: ProjectWorkPrimaryCandidate;
  openItems: ProjectWorkItem[];
  blockedItems: ProjectWorkItem[];
  confirmedFacts: ProjectWorkConfirmationFact[];
  generatedAt: string;
};

export type ProjectWorkQueueGroup =
  | 'overdue'
  | 'today'
  | 'nextSevenBusinessDays'
  | 'blocked'
  | 'needsTriage';

export type ProjectWorkQueueActionKind =
  | 'recovery'
  | 'workItem'
  | 'specialist'
  | 'stateReview'
  | 'needsTriage';

export type ProjectWorkQueueEntry = {
  projectId: string;
  projectName: string;
  stage: string;
  group: ProjectWorkQueueGroup;
  actionKind: ProjectWorkQueueActionKind;
  title: string;
  reason: string;
  dueAt: string | null;
  priority: ProjectWorkItemPriority | null;
  blockedReason: string | null;
  effectiveAssignee: ProjectWorkEffectiveAssignee;
  workItemId: string | null;
  workItemRowVersion: number | null;
  stateRowVersion: number | null;
  sourceType: ProjectWorkItemSourceType | null;
  sourceKey: string | null;
  subjectKind: string | null;
  subjectId: string | null;
  repairSignalId?: string | null;
  repairSignalRowVersion?: number | null;
  href: string;
};
