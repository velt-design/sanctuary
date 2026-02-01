import type { AuditEvent, DesignTicket, EmailOutboxItem, FollowupTask, Task } from '@/lib/types/automation';
import { uuidFromAppId } from '@/lib/supabase/mappers';
import { getSupabaseBrowser, supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function hostSuffix(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host ? ` (host: ${host})` : '';
}

function mapTask(row: any): Task {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    type: String(row.type ?? '') as any,
    status: String(row.status ?? 'OPEN') as any,
    title: String(row.title ?? ''),
    details: typeof row.details === 'string' ? row.details : null,
    dueAt: typeof row.due_at === 'string' ? row.due_at : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
    meta: row.meta && typeof row.meta === 'object' ? (row.meta as any) : {},
  };
}

function mapDesignTicket(row: any): DesignTicket {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    tier: String(row.tier ?? 'TIER_2') as any,
    status: String(row.status ?? 'OPEN') as any,
    dueAt: typeof row.due_at === 'string' ? row.due_at : null,
    notes: typeof row.notes === 'string' ? row.notes : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
  };
}

function mapFollowupTask(row: any): FollowupTask {
  return {
    id: String(row.id ?? ''),
    planId: String(row.plan_id ?? ''),
    projectId: String(row.project_id ?? ''),
    type: String(row.type ?? '') as any,
    status: String(row.status ?? 'OPEN') as any,
    dueAt: typeof row.due_at === 'string' ? row.due_at : '',
    outcomeNote: typeof row.outcome_note === 'string' ? row.outcome_note : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : null,
  };
}

function mapOutbox(row: any): EmailOutboxItem {
  return {
    id: String(row.id ?? ''),
    projectId: String(row.project_id ?? ''),
    contactId: typeof row.contact_id === 'string' ? row.contact_id : null,
    emailType: String(row.email_type ?? ''),
    toEmail: String(row.to_email ?? ''),
    subject: String(row.subject ?? ''),
    templateId: String(row.template_id ?? ''),
    variables: row.variables && typeof row.variables === 'object' ? (row.variables as any) : {},
    status: String(row.status ?? 'QUEUED') as any,
    error: typeof row.error === 'string' ? row.error : null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
    sentAt: typeof row.sent_at === 'string' ? row.sent_at : null,
  };
}

function mapAuditEvent(row: any): AuditEvent {
  return {
    id: String(row.id ?? ''),
    projectId: typeof row.project_id === 'string' ? row.project_id : null,
    type: String(row.type ?? ''),
    idempotencyKey: String(row.idempotency_key ?? ''),
    payload: row.payload ?? null,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase.from('tasks').select('*').eq('project_id', projectUuid).order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load tasks${hostSuffix()}`);
  return (Array.isArray(data) ? data : []).map(mapTask);
}

export async function setTaskDone(taskId: string, done: boolean): Promise<void> {
  const supabase = getSupabaseBrowser();
  const patch: any = done
    ? { status: 'DONE', completed_at: new Date().toISOString() }
    : { status: 'OPEN', completed_at: null };
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
  if (error) throw new Error(`Failed to update task${hostSuffix()}`);
}

export async function getDesignTicket(projectId: string): Promise<DesignTicket | null> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase.from('design_package_tickets').select('*').eq('project_id', projectUuid).maybeSingle();
  if (error) throw new Error(`Failed to load design ticket${hostSuffix()}`);
  return data ? mapDesignTicket(data) : null;
}

export async function listFollowupTasks(projectId: string): Promise<FollowupTask[]> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase.from('followup_tasks').select('*').eq('project_id', projectUuid).order('due_at', { ascending: true });
  if (error) throw new Error(`Failed to load follow-ups${hostSuffix()}`);
  return (Array.isArray(data) ? data : []).map(mapFollowupTask);
}

export async function setFollowupTaskDone(taskId: string, done: boolean): Promise<void> {
  const supabase = getSupabaseBrowser();
  const patch: any = done
    ? { status: 'DONE', completed_at: new Date().toISOString() }
    : { status: 'OPEN', completed_at: null };
  const { error } = await supabase.from('followup_tasks').update(patch).eq('id', taskId);
  if (error) throw new Error(`Failed to update follow-up${hostSuffix()}`);
}

export async function listEmailOutbox(projectId: string): Promise<EmailOutboxItem[]> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase.from('email_outbox').select('*').eq('project_id', projectUuid).order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load outbox${hostSuffix()}`);
  return (Array.isArray(data) ? data : []).map(mapOutbox);
}

export async function listAuditEvents(projectId: string, limit = 30): Promise<AuditEvent[]> {
  const supabase = getSupabaseBrowser();
  const projectUuid = uuidFromAppId(projectId, 'proj');
  const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('project_id', projectUuid)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to load automation log${hostSuffix()}`);
  return (Array.isArray(data) ? data : []).map(mapAuditEvent);
}

