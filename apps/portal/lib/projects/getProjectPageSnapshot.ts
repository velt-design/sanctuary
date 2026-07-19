import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logPortalServerError, type PortalServerLogContext } from '@/lib/api/routeDiagnostics';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid, isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import {
  isManualTaskKey,
  normalizePipelineStageKey,
  resolveStageTasks,
  type TaskContext,
  type TaskKey,
} from '@/lib/projects/pipelineDefinition';
import type { ProjectActivityItem, ProjectEmailLog, ProjectNote, ProjectPageSnapshot } from '@/lib/projects/types';

const PROJECT_NOTES_SNAPSHOT_LIMIT = 50;

const PROJECT_RELATED_SNAPSHOT_SELECT = `
  id,
  siteVisits:site_visit_events(id,status,scheduled_start),
  estimates(id),
  scheduleItems:schedule_items(id,start_date),
  quotes(id,acceptedVersions:quote_versions(id,status)),
  openInvoices:deposit_invoices(id,status),
  manualChecks:project_task_checks(task_key),
  emails:email_outbox(id,subject,to_email,status,sent_at,created_at,email_type),
  jobPacks:job_pack_generations(id),
  notes:project_notes(id,body,author_id,author_email,author_display_name,created_at,updated_at,deleted_at)
`;

function mapProjectNote(row: any, currentUserId: string | null): ProjectNote | null {
  const id = typeof row?.id === 'string' ? row.id : null;
  const body = typeof row?.body === 'string' ? row.body : null;
  const authorId = typeof row?.author_id === 'string' ? row.author_id : null;
  const createdAt = typeof row?.created_at === 'string' ? row.created_at : null;
  if (!id || !body || !authorId || !createdAt) return null;
  const updatedAt = typeof row?.updated_at === 'string' ? row.updated_at : createdAt;
  const authorEmail = typeof row?.author_email === 'string' ? row.author_email : '';
  const authorDisplayName =
    typeof row?.author_display_name === 'string' && row.author_display_name.trim()
      ? row.author_display_name
      : null;
  return {
    id,
    body,
    authorId,
    authorEmail,
    authorDisplayName,
    createdAt,
    updatedAt,
    isOwn: currentUserId !== null && authorId === currentUserId,
  };
}

function pickString(...values: Array<unknown>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function safeUuidFromAppId(value: string, prefix: string): string | null {
  try {
    return uuidFromAppId(value, prefix);
  } catch {
    return null;
  }
}

function mapEmailStatus(status: string): ProjectEmailLog['status'] {
  const raw = status.toUpperCase();
  if (raw === 'SENT' || raw === 'DELIVERED') return 'sent';
  if (raw === 'FAILED' || raw === 'ERROR') return 'failed';
  return undefined;
}

function mapEmailKind(kindRaw: string): ProjectEmailLog['kind'] {
  const raw = kindRaw.toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('estimate')) return 'indicative_estimate';
  if (raw.includes('quote')) return 'quote_sent';
  return 'other';
}

function mapEmail(row: any): ProjectEmailLog {
  const status = typeof row?.status === 'string' ? mapEmailStatus(row.status) : undefined;
  const kind = typeof row?.email_type === 'string' ? mapEmailKind(row.email_type) : undefined;
  const sentAt =
    typeof row?.sent_at === 'string'
      ? row.sent_at
      : typeof row?.created_at === 'string'
        ? row.created_at
        : '';

  return {
    id: String(row?.id ?? ''),
    sentAt,
    toEmail: String(row?.to_email ?? ''),
    subject: String(row?.subject ?? ''),
    ...(status ? { status } : null),
    ...(kind ? { kind } : null),
  };
}

function mapOutboxToActivity(row: any): ProjectActivityItem | null {
  const at =
    typeof row?.sent_at === 'string'
      ? row.sent_at
      : typeof row?.created_at === 'string'
        ? row.created_at
        : '';
  if (!at) return null;

  const statusRaw = typeof row?.status === 'string' ? row.status.toUpperCase() : '';
  const title = statusRaw === 'FAILED' ? 'Email failed' : statusRaw === 'QUEUED' ? 'Email queued' : 'Email sent';

  const toEmail = typeof row?.to_email === 'string' ? row.to_email : '';
  const subject = typeof row?.subject === 'string' ? row.subject : '';
  const detailParts = [];
  if (toEmail) detailParts.push(`To: ${toEmail}`);
  if (subject) detailParts.push(subject);

  return {
    id: `outbox:${String(row?.id ?? '')}`,
    at,
    type: 'email_sent',
    title,
    detail: detailParts.length ? detailParts.join(' — ') : undefined,
  };
}

function logSnapshotError(context: PortalServerLogContext | undefined, message: string, error: unknown, query?: string) {
  logPortalServerError(
    context ?? { route: 'project_snapshot', method: 'GET' },
    {
      event: 'project_snapshot.query_failed',
      message,
      error,
      extra: query ? { query } : undefined,
    },
  );
}

function relationRows(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function mapProjectSummary(projectRow: any, fallbackProjectId: string): {
  project: ProjectPageSnapshot['project'];
  stage: ProjectPageSnapshot['pipeline']['stage'];
  nextActionDate: string | null;
} {
  const normalizedStage = normalizeProjectStatus(
    projectRow.pipeline_stage ?? projectRow.status ?? projectRow.legacy_status ?? 'NEW',
  ).status;
  const stage = normalizePipelineStageKey(normalizedStage) ?? 'new';
  const contactIdRaw = pickString(projectRow.contact_id, projectRow.contactId);
  const contactUuid = contactIdRaw ? safeUuidFromAppId(contactIdRaw, 'ct') : null;
  const projectId = (() => {
    const raw = String(projectRow.id ?? fallbackProjectId);
    if (raw.startsWith('proj_')) return raw;
    if (isUuid(raw)) return appIdFromUuid('proj', raw);
    return fallbackProjectId;
  })();
  const contactRaw = projectRow.contact;
  const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw ?? null;
  const name = pickString(projectRow.projectName, projectRow.project_name, projectRow.name, 'Project') ?? 'Project';
  const contactName = pickString(contact?.name, projectRow.contact_name, projectRow.contactName);
  const contactEmail = pickString(contact?.email, projectRow.contact_email, projectRow.contactEmail);
  const contactPhone = pickString(contact?.phone, projectRow.contact_phone, projectRow.contactPhone);
  const siteAddress = pickString(projectRow.site_address, projectRow.siteAddress, projectRow.address);
  const region = pickString(projectRow.region);
  const quoteRef = pickString(projectRow.quote_ref, projectRow.quoteRef);
  const nextActionDate = pickString(
    projectRow.next_action_date,
    projectRow.nextActionDate,
    projectRow.follow_up_date,
    projectRow.followUpDate,
  );

  return {
    project: {
      id: projectId,
      name,
      stage,
      ...(contactUuid ? { contactId: appIdFromUuid('ct', contactUuid) } : null),
      ...(contactName ? { contactName } : null),
      ...(contactEmail ? { contactEmail } : null),
      ...(contactPhone ? { contactPhone } : null),
      ...(siteAddress ? { siteAddress } : null),
      ...(region ? { region } : null),
      ...(quoteRef ? { quoteRef } : null),
      ...(nextActionDate ? { nextActionDate } : null),
    },
    stage,
    nextActionDate,
  };
}

export async function getProjectPageSummary(
  projectId: string,
  diagnostics?: PortalServerLogContext,
  supabase?: SupabaseClient,
): Promise<ProjectPageSnapshot | null> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const projectUuid = safeUuidFromAppId(projectId, 'proj');
  if (!projectUuid) return null;

  const projectRes = await client
    .from('projects')
    .select('*,contact:contacts(*)')
    .eq('id', projectUuid)
    .maybeSingle();
  if (projectRes?.error) {
    logSnapshotError(diagnostics, 'project summary query failed', projectRes.error, 'projects');
    throw new Error('Failed to load project summary');
  }
  if (!projectRes?.data) return null;

  const summary = mapProjectSummary(projectRes.data, projectId);
  return {
    project: summary.project,
    pipeline: { stage: summary.stage },
    tasks: { stage: summary.stage, items: [] },
    activity: [],
    emails: [],
    notes: [],
  };
}

export async function getProjectPageSnapshot(
  projectId: string,
  diagnostics?: PortalServerLogContext,
  supabase?: SupabaseClient,
  authenticatedUserId?: string | null,
): Promise<ProjectPageSnapshot | null> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const projectUuid = safeUuidFromAppId(projectId, 'proj');
  if (!projectUuid) return null;

  // Keep the access-defining project row independent so an optional related
  // read failure cannot hide a project the user may access. All subordinate
  // rows are embedded through their declared foreign keys in one PostgREST
  // request, avoiding a browser-open path with many HTTP round trips while
  // retaining auth-bound RLS on every relation.
  const [projectRes, relatedRes] = await Promise.all([
    client
      .from('projects')
      .select('*,contact:contacts(*)')
      .eq('id', projectUuid)
      .maybeSingle(),
    client
      .from('projects')
      .select(PROJECT_RELATED_SNAPSHOT_SELECT)
      .eq('id', projectUuid)
      .eq('quotes.acceptedVersions.status', 'ACCEPTED')
      .eq('openInvoices.status', 'OPEN')
      .is('notes.deleted_at', null)
      .order('created_at', { referencedTable: 'emails', ascending: false })
      .order('created_at', { referencedTable: 'notes', ascending: false })
      .limit(1, { referencedTable: 'siteVisits' })
      .limit(1, { referencedTable: 'estimates' })
      .limit(1, { referencedTable: 'scheduleItems' })
      .limit(1, { referencedTable: 'openInvoices' })
      .limit(1, { referencedTable: 'jobPacks' })
      .limit(PROJECT_NOTES_SNAPSHOT_LIMIT, { referencedTable: 'notes' })
      .maybeSingle(),
  ]);

  const projectRow = projectRes?.data ?? null;
  if (projectRes?.error) {
    logSnapshotError(diagnostics, 'project query failed', projectRes.error, 'projects');
    throw new Error('Failed to load project snapshot');
  }
  if (!projectRow) return null;
  if (relatedRes?.error) {
    logSnapshotError(diagnostics, 'project related snapshot query failed', relatedRes.error, 'projects+relations');
    throw new Error('Failed to load complete project snapshot');
  }

  const summary = mapProjectSummary(projectRow, projectId);
  const stage = summary.stage;
  const projectIdOut = summary.project.id;
  const nextActionDate = summary.nextActionDate;

  const currentUserId = authenticatedUserId === undefined
    ? (await client.auth.getUser())?.data?.user?.id ?? null
    : authenticatedUserId;

  const relatedRow = relatedRes?.data ?? null;
  const emailRows = relationRows(relatedRow?.emails);
  const emails = emailRows.map(mapEmail);
  const outboxActivity = emailRows
    .map(mapOutboxToActivity)
    .filter(Boolean) as ProjectActivityItem[];
  const activity = outboxActivity.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const siteVisitRow = relationRows(relatedRow?.siteVisits)[0] ?? null;
  const siteVisitStatus = typeof (siteVisitRow as any)?.status === 'string' ? String((siteVisitRow as any).status).toUpperCase() : '';
  const hasBookedSiteVisit =
    Boolean((siteVisitRow as any)?.scheduled_start) &&
    ['TENTATIVE', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'].includes(siteVisitStatus);

  const hasGeneratedCosting = relationRows(relatedRow?.estimates).length > 0;
  const hasScheduledInstall = relationRows(relatedRow?.scheduleItems).length > 0;
  const hasAcceptedQuote = relationRows(relatedRow?.quotes)
    .some((quote) => relationRows(quote?.acceptedVersions).length > 0);
  const hasJobPacks = relationRows(relatedRow?.jobPacks).length > 0;
  const hasOpenDepositInvoice = relationRows(relatedRow?.openInvoices).length > 0;

  const manualCompleted = new Set<TaskKey>();
  for (const row of relationRows(relatedRow?.manualChecks)) {
    const key = typeof (row as any)?.task_key === 'string' ? String((row as any).task_key) : '';
    if (isManualTaskKey(key)) manualCompleted.add(key);
  }

  const taskContext: TaskContext = {
    projectId: projectIdOut,
    manualDone: manualCompleted,
    hasBookedSiteVisit,
    hasGeneratedCosting,
    hasScheduledInstall,
    hasAcceptedQuote,
    hasOpenDepositInvoice,
    nextActionDate,
  };

  const taskItems = resolveStageTasks(stage, taskContext, manualCompleted);
  const finalStage = stage;

  const notes = relationRows(relatedRow?.notes)
    .map((row) => mapProjectNote(row, currentUserId))
    .filter((value): value is ProjectNote => value !== null);

  return {
    project: {
      ...summary.project,
      ...(hasJobPacks ? { hasJobPacks } : null),
    },
    pipeline: {
      stage: finalStage,
    },
    tasks: {
      stage: finalStage,
      items: taskItems,
    },
    activity,
    emails,
    notes,
  };
}
