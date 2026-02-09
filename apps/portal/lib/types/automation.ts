export type TaskStatus = 'OPEN' | 'DONE' | 'SKIPPED' | 'RESCHEDULED';

export type TaskType =
  | 'CREATE_DESIGN_PACKAGE'
  | 'REVIEW_NEW_LEAD'
  | 'BOOK_SITE_VISIT'
  | 'ATTEND_SITE_VISIT'
  | 'FINALIZE_SEND_QUOTE'
  | 'CREATE_INVOICE_XERO'
  | 'FOLLOWUP_CALL'
  | 'FOLLOWUP_EMAIL'
  | 'SCHEDULE_INSTALL_WINDOW'
  | 'CONFIRM_FINAL_SCHEDULE'
  | 'UPLOAD_COMPLETION_PHOTOS'
  | 'RESEND_EMAIL';

export type Task = {
  id: string; // uuid
  projectId: string; // uuid
  type: TaskType;
  status: TaskStatus;
  title: string;
  details: string | null;
  dueAt: string | null;
  createdAt: string;
  completedAt: string | null;
  meta: Record<string, unknown>;
};

export type DesignTier = 'TIER_1' | 'TIER_2' | 'TIER_3' | 'TIER_4';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED';

export type DesignTicket = {
  id: string; // uuid
  projectId: string; // uuid
  tier: DesignTier;
  status: TicketStatus;
  dueAt: string | null;
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type FollowupPlanStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETE';

export type FollowupPlan = {
  id: string; // uuid
  projectId: string; // uuid
  status: FollowupPlanStatus;
  createdAt: string;
  updatedAt: string;
};

export type FollowupTaskStatus = TaskStatus;
export type FollowupTaskType = 'FOLLOWUP_CALL' | 'FOLLOWUP_EMAIL';

export type FollowupTask = {
  id: string; // uuid
  planId: string; // uuid
  projectId: string; // uuid
  type: FollowupTaskType;
  status: FollowupTaskStatus;
  dueAt: string;
  outcomeNote: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type EmailOutboxStatus = 'QUEUED' | 'CANCELLED' | 'SENT' | 'FAILED';

export type EmailOutboxItem = {
  id: string; // uuid
  projectId: string; // uuid
  contactId: string | null; // uuid
  emailType: string;
  toEmail: string;
  subject: string;
  templateId: string;
  variables: Record<string, unknown>;
  status: EmailOutboxStatus;
  error: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type AuditEvent = {
  id: string; // uuid
  projectId: string | null; // uuid
  type: string;
  idempotencyKey: string;
  payload: unknown;
  createdAt: string;
};
