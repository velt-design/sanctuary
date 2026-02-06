import 'server-only';

import { supabaseServer } from '@/lib/supabaseClient';
import { appIdFromUuid, isUuid, uuidFromAppId } from '@/lib/supabase/mappers';
import { normalizeProjectStatus } from '@/lib/types/project';
import type { ProjectActivityItem, ProjectEmailLog, ProjectPageSnapshot } from '@/lib/projects/types';

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

function mapTask(row: any): ProjectPageSnapshot['tasks'][number] {
  const statusRaw = String(row?.status ?? '').toUpperCase();
  return {
    id: String(row?.id ?? ''),
    title: String(row?.title ?? row?.type ?? 'Task'),
    status: statusRaw === 'DONE' ? 'done' : 'todo',
    ...(typeof row?.due_at === 'string' && row.due_at.trim() ? { dueAt: row.due_at } : null),
  };
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

  return {
    id: String(row?.id ?? ''),
    at,
    type: 'note',
    title: typeRaw,
    detail: undefined,
  };
}

export async function getProjectPageSnapshot(projectId: string): Promise<ProjectPageSnapshot | null> {
  const projectUuid = safeUuidFromAppId(projectId, 'proj');
  if (!projectUuid) return null;

  const { data: projectRow, error: projectError } = await supabaseServer
    .from('projects')
    .select('*')
    .eq('id', projectUuid)
    .maybeSingle();

  if (projectError || !projectRow) return null;

  const stage = normalizeProjectStatus(projectRow.pipeline_stage ?? projectRow.status ?? projectRow.legacy_status ?? 'NEW').status;
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

  const [contactRes, tasksRes, emailRes, auditRes] = await Promise.all([
    contactUuid
      ? supabaseServer.from('contacts').select('*').eq('id', contactUuid).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseServer
      .from('tasks')
      .select('id,title,status,due_at,type,created_at')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('email_outbox')
      .select('id,subject,to_email,status,sent_at,created_at,email_type')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false }),
    supabaseServer
      .from('audit_events')
      .select('id,type,payload,created_at')
      .eq('project_id', projectUuid)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  if (emailRes?.error) {
    console.error('[project_snapshot] email_outbox query failed', emailRes.error);
  }
  if (auditRes?.error) {
    console.error('[project_snapshot] audit_events query failed', auditRes.error);
  }

  const contact = contactRes?.data ?? null;
  const contactName = pickString(contact?.name, projectRow.contact_name, projectRow.contactName);
  const contactEmail = pickString(contact?.email, projectRow.contact_email, projectRow.contactEmail);
  const contactPhone = pickString(contact?.phone, projectRow.contact_phone, projectRow.contactPhone);
  const tasks = (Array.isArray(tasksRes?.data) ? tasksRes.data : []).map(mapTask);
  const emails = (Array.isArray(emailRes?.data) ? emailRes.data : []).map(mapEmail);
  const outboxActivity = (Array.isArray(emailRes?.data) ? emailRes.data : [])
    .map(mapOutboxToActivity)
    .filter(Boolean) as ProjectActivityItem[];
  const auditActivity = (Array.isArray(auditRes?.data) ? auditRes.data : [])
    .map(mapAuditToActivity)
    .filter(Boolean) as ProjectActivityItem[];

  const activity = [...outboxActivity, ...auditActivity].sort((a, b) => String(b.at).localeCompare(String(a.at)));

  return {
    project: {
      id: projectIdOut,
      name: projectName,
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
    tasks,
    activity,
    emails,
  };
}
