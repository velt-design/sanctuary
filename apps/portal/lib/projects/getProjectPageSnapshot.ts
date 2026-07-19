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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
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

function mapAuditToActivity(row: any): ProjectActivityItem | null {
  const at = typeof row?.created_at === 'string' ? row.created_at : '';
  if (!at) return null;

  const typeRaw = typeof row?.type === 'string' ? row.type : 'note';
  const payload = isRecord(row?.payload) ? (row.payload as Record<string, unknown>) : {};

  if (typeRaw === 'email_sent' || typeRaw === 'email_failed') {
    const title = typeRaw === 'email_failed' ? 'Email failed' : 'Email sent';
    const to = typeof payload.to === 'string' ? payload.to : '';
    const subject = typeof payload.subject === 'string' ? payload.subject : '';
    return {
      id: String(row?.id ?? ''),
      at,
      type: 'email_sent',
      title,
      detail: [to ? `To: ${to}` : '', subject].filter(Boolean).join(' — ') || undefined,
    };
  }

  if (typeRaw === 'dashboard.next_action_note') {
    const note = typeof payload.note === 'string' ? payload.note : '';
    return {
      id: String(row?.id ?? ''),
      at,
      type: 'note',
      title: 'Note added',
      detail: note || undefined,
    };
  }

  if (typeRaw.startsWith('quote.')) {
    const toList = Array.isArray(payload.to) ? payload.to : typeof payload.to === 'string' ? [payload.to] : [];
    const toDetail = toList.length ? `To: ${toList.join(', ')}` : undefined;

    switch (typeRaw) {
      case 'quote.created':
        return { id: String(row?.id ?? ''), at, type: 'quote_created', title: 'Quote created' };
      case 'quote.sent':
        return { id: String(row?.id ?? ''), at, type: 'quote_sent', title: 'Quote sent', detail: toDetail };
      case 'quote.resent':
        return { id: String(row?.id ?? ''), at, type: 'quote_resent', title: 'Quote resent', detail: toDetail };
      case 'quote.revised':
        return { id: String(row?.id ?? ''), at, type: 'quote_revised', title: 'Quote revised' };
      case 'quote.accepted':
        return { id: String(row?.id ?? ''), at, type: 'quote_accepted', title: 'Quote accepted' };
      case 'quote.declined':
        return { id: String(row?.id ?? ''), at, type: 'quote_declined', title: 'Quote declined' };
      case 'quote.deleted':
        return { id: String(row?.id ?? ''), at, type: 'quote_deleted', title: 'Quote deleted' };
      default:
        break;
    }
  }

  if (typeRaw.startsWith('invoice.')) {
    switch (typeRaw) {
      case 'invoice.created':
        return { id: String(row?.id ?? ''), at, type: 'note', title: 'Deposit invoice created' };
      case 'invoice.sent':
        return { id: String(row?.id ?? ''), at, type: 'note', title: 'Deposit invoice sent' };
      case 'invoice.voided':
        return { id: String(row?.id ?? ''), at, type: 'note', title: 'Deposit invoice voided' };
      case 'invoice.send_failed':
      case 'invoice.send_failed_final':
        return { id: String(row?.id ?? ''), at, type: 'note', title: 'Deposit invoice send failed' };
      default:
        break;
    }
  }

  return {
    id: String(row?.id ?? ''),
    at,
    type: 'note',
    title: typeRaw,
    detail: undefined,
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

export async function getProjectPageSnapshot(
  projectId: string,
  diagnostics?: PortalServerLogContext,
  supabase?: SupabaseClient,
  authenticatedUserId?: string | null,
): Promise<ProjectPageSnapshot | null> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const projectUuid = safeUuidFromAppId(projectId, 'proj');
  if (!projectUuid) return null;

  // Every read below is scoped by the same project id and auth-bound RLS
  // client, so start them together. The contact relation is included with the
  // project row to avoid a second dependent database round trip.
  const [projectRes, siteVisitRes, estimateRes, scheduleRes, acceptedQuoteRes, openInvoiceRes, manualRes, emailRes, auditRes, jobPackRes, notesRes] = await Promise.all([
    client
      .from('projects')
      .select('*,contact:contacts(*)')
      .eq('id', projectUuid)
      .maybeSingle(),
    client
      .from('site_visit_events')
      .select('id,status,scheduled_start')
      .eq('project_id', projectUuid)
      .maybeSingle(),
    client
      .from('estimates')
      .select('id')
      .eq('project_id', projectUuid)
      .limit(1),
    client
      .from('schedule_items')
      .select('id,start_date')
      .eq('project_id', projectUuid)
      .limit(1),
    client
      .from('quote_versions')
      .select('id, quotes!inner(project_id)')
      .eq('status', 'ACCEPTED')
      .eq('quotes.project_id', projectUuid)
      .limit(1),
    client
      .from('deposit_invoices')
      .select('id')
      .eq('project_id', projectUuid)
      .eq('status', 'OPEN')
      .limit(1)
      .maybeSingle(),
    client
      .from('project_task_checks')
      .select('task_key')
      .eq('project_id', projectUuid),
    client
      .from('email_outbox')
      .select('id,subject,to_email,status,sent_at,created_at,email_type')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false }),
    client
      .from('audit_events')
      .select('id,type,payload,created_at')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false })
      .limit(50),
    client.from('job_pack_generations').select('id').eq('project_id', projectUuid).limit(1).maybeSingle(),
    client
      .from('project_notes')
      .select('id,body,author_id,author_email,author_display_name,created_at,updated_at')
      .eq('project_id', projectUuid)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(PROJECT_NOTES_SNAPSHOT_LIMIT),
  ]);

  const projectRow = projectRes?.data ?? null;
  if (projectRes?.error || !projectRow) return null;

  const normalizedStage = normalizeProjectStatus(projectRow.pipeline_stage ?? projectRow.status ?? projectRow.legacy_status ?? 'NEW').status;
  const stage = normalizePipelineStageKey(normalizedStage) ?? 'new';
  const contactIdRaw = pickString(projectRow.contact_id, projectRow.contactId);
  const contactUuid = contactIdRaw ? safeUuidFromAppId(contactIdRaw, 'ct') : null;
  const projectIdOut = (() => {
    const raw = String(projectRow.id ?? projectId);
    if (raw.startsWith('proj_')) return raw;
    if (isUuid(raw)) return appIdFromUuid('proj', raw);
    return projectId;
  })();
  const projectName = pickString(projectRow.projectName, projectRow.project_name, projectRow.name, 'Project') ?? 'Project';
  const siteAddress = pickString(projectRow.site_address, projectRow.siteAddress, projectRow.address);
  const region = pickString(projectRow.region);
  const quoteRef = pickString(projectRow.quote_ref, projectRow.quoteRef);
  const nextActionDate = pickString(
    projectRow.next_action_date,
    projectRow.nextActionDate,
    projectRow.follow_up_date,
    projectRow.followUpDate,
  );

  const currentUserId = authenticatedUserId === undefined
    ? (await client.auth.getUser())?.data?.user?.id ?? null
    : authenticatedUserId;

  if (emailRes?.error) {
    logSnapshotError(diagnostics, 'email_outbox query failed', emailRes.error, 'email_outbox');
  }
  if (auditRes?.error) {
    logSnapshotError(diagnostics, 'audit_events query failed', auditRes.error, 'audit_events');
  }
  if (siteVisitRes?.error) {
    logSnapshotError(diagnostics, 'site_visit_events query failed', siteVisitRes.error, 'site_visit_events');
  }
  if (estimateRes?.error) {
    logSnapshotError(diagnostics, 'estimates query failed', estimateRes.error, 'estimates');
  }
  if (scheduleRes?.error) {
    logSnapshotError(diagnostics, 'schedule_items query failed', scheduleRes.error, 'schedule_items');
  }
  if (acceptedQuoteRes?.error) {
    logSnapshotError(diagnostics, 'accepted quote query failed', acceptedQuoteRes.error, 'quote_versions');
  }
  if (openInvoiceRes?.error) {
    logSnapshotError(diagnostics, 'open deposit invoice query failed', openInvoiceRes.error, 'deposit_invoices');
  }
  if (manualRes?.error) {
    logSnapshotError(diagnostics, 'project_task_checks query failed', manualRes.error, 'project_task_checks');
  }
  if (jobPackRes?.error) {
    logSnapshotError(diagnostics, 'job_pack_generations query failed', jobPackRes.error, 'job_pack_generations');
  }
  if (notesRes?.error) {
    logSnapshotError(diagnostics, 'project_notes query failed', notesRes.error, 'project_notes');
  }

  const contactRaw = projectRow.contact;
  const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw ?? null;
  const contactName = pickString(contact?.name, projectRow.contact_name, projectRow.contactName);
  const contactEmail = pickString(contact?.email, projectRow.contact_email, projectRow.contactEmail);
  const contactPhone = pickString(contact?.phone, projectRow.contact_phone, projectRow.contactPhone);
  const emails = (Array.isArray(emailRes?.data) ? emailRes.data : []).map(mapEmail);
  const outboxActivity = (Array.isArray(emailRes?.data) ? emailRes.data : [])
    .map(mapOutboxToActivity)
    .filter(Boolean) as ProjectActivityItem[];
  const auditActivity = (Array.isArray(auditRes?.data) ? auditRes.data : [])
    .map(mapAuditToActivity)
    .filter(Boolean) as ProjectActivityItem[];

  const activity = [...outboxActivity, ...auditActivity].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  const siteVisitRow = siteVisitRes?.data ?? null;
  const siteVisitStatus = typeof (siteVisitRow as any)?.status === 'string' ? String((siteVisitRow as any).status).toUpperCase() : '';
  const hasBookedSiteVisit =
    Boolean((siteVisitRow as any)?.scheduled_start) &&
    ['TENTATIVE', 'CONFIRMED', 'COMPLETED', 'RESCHEDULED'].includes(siteVisitStatus);

  const hasGeneratedCosting = Array.isArray(estimateRes?.data) ? estimateRes.data.length > 0 : Boolean(estimateRes?.data);
  const hasScheduledInstall = Array.isArray(scheduleRes?.data) ? scheduleRes.data.length > 0 : Boolean(scheduleRes?.data);
  const hasAcceptedQuote = Array.isArray(acceptedQuoteRes?.data)
    ? acceptedQuoteRes.data.length > 0
    : Boolean(acceptedQuoteRes?.data);
  const hasJobPacks = Boolean(jobPackRes?.data);
  const hasOpenDepositInvoice = Boolean(openInvoiceRes?.data);

  const manualCompleted = new Set<TaskKey>();
  for (const row of Array.isArray(manualRes?.data) ? manualRes.data : []) {
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

  const notes = (Array.isArray(notesRes?.data) ? notesRes.data : [])
    .map((row) => mapProjectNote(row, currentUserId))
    .filter((value): value is ProjectNote => value !== null);

  return {
    project: {
      id: projectIdOut,
      name: projectName,
      stage: finalStage,
      ...(contactUuid ? { contactId: appIdFromUuid('ct', contactUuid) } : null),
      ...(contactName ? { contactName } : null),
      ...(contactEmail ? { contactEmail } : null),
      ...(contactPhone ? { contactPhone } : null),
      ...(siteAddress ? { siteAddress } : null),
      ...(region ? { region } : null),
      ...(quoteRef ? { quoteRef } : null),
      ...(nextActionDate ? { nextActionDate } : null),
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
