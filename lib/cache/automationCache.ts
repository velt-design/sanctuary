import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

function supabaseHostKey(): string {
  const host = supabaseHostFromUrl(supabaseRuntimeUrl());
  return host || 'unknown';
}

export function projectTasksSWRKey(projectId: string): readonly ['project_tasks', string, string] {
  return ['project_tasks', supabaseHostKey(), projectId] as const;
}

export function projectDesignTicketSWRKey(projectId: string): readonly ['project_design_ticket', string, string] {
  return ['project_design_ticket', supabaseHostKey(), projectId] as const;
}

export function projectFollowupTasksSWRKey(projectId: string): readonly ['project_followup_tasks', string, string] {
  return ['project_followup_tasks', supabaseHostKey(), projectId] as const;
}

export function projectOutboxSWRKey(projectId: string): readonly ['project_email_outbox', string, string] {
  return ['project_email_outbox', supabaseHostKey(), projectId] as const;
}

export function projectAuditEventsSWRKey(projectId: string): readonly ['project_audit_events', string, string] {
  return ['project_audit_events', supabaseHostKey(), projectId] as const;
}

