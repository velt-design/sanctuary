export type ProjectStage =
  | 'NEW'
  | 'CONTACTED'
  | 'SITE_VISIT'
  | 'QUOTING'
  | 'SENT'
  | 'DEPOSIT'
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'PAID';

export type ProjectEmailLog = {
  id: string;
  sentAt: string; // ISO
  toEmail: string;
  subject: string;
  status?: 'sent' | 'failed';
  kind?: 'indicative_estimate' | 'quote_sent' | 'other'; // optional
  previewText?: string; // optional
  bodyHtml?: string; // optional (if stored)
};

export type ProjectActivityItem = {
  id: string;
  at: string; // ISO
  type:
    | 'stage_changed'
    | 'note'
    | 'task_created'
    | 'task_completed'
    | 'email_sent'
    | 'file_uploaded'
    | 'quote_created'
    | 'quote_sent';
  title: string;
  detail?: string;
};

export type ProjectPageSnapshot = {
  project: {
    id: string;
    name: string;
    stage: ProjectStage;
    contactId?: string;
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
    siteAddress?: string;
    region?: string;
    quoteRef?: string;
    nextActionDate?: string;
  };
  tasks: Array<{
    id: string;
    title: string;
    status: 'todo' | 'done';
    dueAt?: string;
  }>;
  activity: ProjectActivityItem[];
  emails: ProjectEmailLog[]; // may be empty for now
};
