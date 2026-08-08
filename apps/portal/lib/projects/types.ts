import type { PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import type { ProjectOwnerKey } from '@/lib/projects/commandCentre/types';
import type { ProjectWorkProjection } from '@/lib/projects/workItems/types';
import type { ProjectCommandCentreResponse } from '@/lib/projects/commandCentre/types';

export type ProjectStage = PipelineStageKey;

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
    | 'quote_sent'
    | 'quote_resent'
    | 'quote_revised'
    | 'quote_accepted'
    | 'quote_declined'
    | 'quote_deleted';
  title: string;
  detail?: string;
};

export type ProjectNote = {
  id: string;
  body: string;
  authorId: string;
  authorEmail: string;
  authorDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  isOwn: boolean;
};

export type ProjectPageSnapshot = {
  workModel: 'legacy' | 'v2';
  projectWork?: ProjectWorkProjection;
  commandCentre?: ProjectCommandCentreResponse;
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
    hasJobPacks?: boolean;
    owner?: {
      key: ProjectOwnerKey;
      displayName: string;
    };
  };
  pipeline: {
    stage: ProjectStage;
  };
  // System-generated event feed (stage changes, emails sent, quote events). Distinct from
  // the user-authored Activity tab notes, which live in `notes`.
  activity: ProjectActivityItem[];
  emails: ProjectEmailLog[]; // may be empty for now
  notes: ProjectNote[];
};

export type ProjectPageSnapshotResponse = {
  snapshot: ProjectPageSnapshot;
  generatedAt: string;
};

export type ProjectSnapshotLoadState =
  | 'pending'
  | 'summary'
  | 'fresh'
  | 'refresh-failed'
  | 'unavailable';
