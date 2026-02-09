import type { PipelineStageKey, TaskKey, TaskKind } from '@/lib/projects/pipelineDefinition';

export type ProjectStage = PipelineStageKey;

export type ProjectTaskItem = {
  key: TaskKey;
  label: string;
  kind: TaskKind;
  isDone: boolean;
  isManualDone?: boolean;
  cta?: { label: string; href: string };
};

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
  pipeline: {
    stage: ProjectStage;
  };
  tasks: {
    stage: ProjectStage;
    items: ProjectTaskItem[];
  };
  activity: ProjectActivityItem[];
  emails: ProjectEmailLog[]; // may be empty for now
};
