import { PIPELINE_STAGES, normalizePipelineStageKey, type PipelineStageKey } from '@/lib/projects/pipelineDefinition';
import { warnOnce } from '@/lib/utils/warnOnce';

export type ProjectStatus = Uppercase<PipelineStageKey>;

export const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = PIPELINE_STAGES.map(
  (stage) => stage.key.toUpperCase() as ProjectStatus,
);

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = Object.fromEntries(
  PIPELINE_STAGES.map((stage) => [stage.key.toUpperCase(), stage.label]),
) as Record<ProjectStatus, string>;

export function projectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_LABELS[status] ?? status;
}

export type LegacyProjectStatus =
  | 'new'
  | 'contacted'
  | 'site_visit'
  | 'quoting'
  | 'sent'
  | 'follow_up'
  | 'won'
  | 'lost'
  | 'archived';

export type NormalizedProjectStatus = {
  status: ProjectStatus;
  isLost: boolean;
  isArchived: boolean;
  legacyStatus?: string;
};

export function normalizeProjectStatus(raw: unknown): NormalizedProjectStatus {
  const statusRaw = typeof raw === 'string' ? raw.trim() : '';
  const key = statusRaw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

  if (!key) return { status: 'NEW', isLost: false, isArchived: false };

  if (key === 'lost') {
    return { status: 'SENT', isLost: true, isArchived: false, legacyStatus: statusRaw };
  }

  if (key === 'archived') {
    return { status: 'SENT', isLost: false, isArchived: true, legacyStatus: statusRaw };
  }

  const stageKey = normalizePipelineStageKey(statusRaw);
  if (stageKey) {
    const status = stageKey.toUpperCase() as ProjectStatus;
    return {
      status,
      isLost: false,
      isArchived: false,
      ...(statusRaw && statusRaw.toUpperCase() !== status ? { legacyStatus: statusRaw } : null),
    };
  }

  if (statusRaw) {
    warnOnce(`legacy_project_status:${statusRaw}`, `Unknown legacy project status '${statusRaw}', defaulting to NEW.`);
  }
  return { status: 'NEW', isLost: false, isArchived: false, legacyStatus: statusRaw || undefined };
}

export type ActivityEventType =
  | 'note'
  | 'status_change'
  | 'estimate_generated'
  | 'estimate_approved'
  | 'quote_created'
  | 'quote_duplicated'
  | 'quote_sent'
  | 'quote_paid'
  | 'quote_deleted'
  | 'export'
  | 'project_updated';

export type ActivityEvent = {
  id: string;
  createdAt: string;
  type: ActivityEventType;
  message: string;
  meta?: unknown;
};

export type NextActionType = 'call' | 'site_visit' | 'send_quote' | 'book_install' | 'invoice' | 'chase_payment';

export const NEXT_ACTION_TYPE_ORDER: readonly NextActionType[] = [
  'call',
  'site_visit',
  'send_quote',
  'book_install',
  'invoice',
  'chase_payment',
] as const;

export function nextActionTypeLabel(type: NextActionType): string {
  switch (type) {
    case 'call':
      return 'Call';
    case 'site_visit':
      return 'Site visit';
    case 'send_quote':
      return 'Send quote';
    case 'book_install':
      return 'Book install';
    case 'invoice':
      return 'Invoice';
    case 'chase_payment':
      return 'Chase payment';
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

export type Project = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  version?: number;

  // v1.5+ canonical fields
  contactId?: string;
  projectName?: string;
  region?: string;
  siteAddress?: string;
  quoteRef?: string;
  status?: ProjectStatus;
  isLost?: boolean;
  isArchived?: boolean;
  legacyStatus?: string;
  nextActionDate?: string | null; // YYYY-MM-DD
  nextActionType?: NextActionType | null;
  followUpDate?: string | null; // legacy alias for nextActionDate

  depositAmountCents?: number | null;
  depositPaidDate?: string | null; // YYYY-MM-DD
  finalPaymentDate?: string | null; // YYYY-MM-DD
  notes?: string;
  activity?: ActivityEvent[];

  // legacy fields (kept for backwards compatibility with stored data)
  name?: string;
  clientName?: string;
  email?: string;
  phone?: string;
  address?: string;
};
