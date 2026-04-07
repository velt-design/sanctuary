import 'server-only';

import { supabaseServer } from '@/lib/supabaseClient';
import { isSupportedSchemaError, missingSchemaFieldFromError } from '@/lib/supabase/schemaGuard';

type SupabaseLikeError = { code?: unknown; message?: unknown };

function toStr(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function isUniqueViolation(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message);
  return code === '23505' || /duplicate key value/i.test(msg) || /unique constraint/i.test(msg);
}

export function isMissingColumnError(error: unknown): boolean {
  return isSupportedSchemaError(error);
}

export function isUuidInputSyntaxError(error: unknown): boolean {
  const e = error as SupabaseLikeError;
  const code = toStr(e?.code).trim();
  const msg = toStr(e?.message).toLowerCase();
  return (code === '22P02' || code === 'PGRST102') && msg.includes('invalid input syntax') && msg.includes('type uuid');
}

export function salespersonSchemaMismatchMessage(error: unknown): string | null {
  if (!isUuidInputSyntaxError(error)) return null;
  return 'Database schema mismatch: site_visit_events salesperson assignment columns are UUID, but the app uses string IDs (e.g. "bruce"). Run supabase/site_visits.sql (and/or automation_phase_a.sql) to cast assigned_sales_owner_id/assigned_sales_owner to text.';
}

export function missingColumnFromError(error: unknown): string | null {
  return missingSchemaFieldFromError(error);
}

export function parseIso(value: unknown): string | null {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toISOString();
}

export function makeIdempotencyKey(parts: Array<string | null | undefined>): string {
  return parts
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(':');
}

export async function loadProjectAndContact(projectUuid: string): Promise<{
  projectName: string;
  contactId: string | null;
  contactName: string;
  contactEmail: string | null;
}> {
  const projectRes = await supabaseServer
    .from('projects')
    .select('id, name, contact_id, contacts ( id, name, email )')
    .eq('id', projectUuid)
    .single();
  if (projectRes.error || !projectRes.data) {
    return { projectName: '', contactId: null, contactName: '', contactEmail: null };
  }

  const project: any = projectRes.data;
  const contactObj = Array.isArray(project?.contacts) ? project.contacts[0] : project?.contacts ?? null;

  return {
    projectName: typeof project?.name === 'string' ? project.name : '',
    contactId: typeof project?.contact_id === 'string' ? project.contact_id : typeof contactObj?.id === 'string' ? contactObj.id : null,
    contactName: typeof contactObj?.name === 'string' ? contactObj.name : '',
    contactEmail: typeof contactObj?.email === 'string' && contactObj.email.trim() ? contactObj.email.trim() : null,
  };
}

export async function loadEmailTemplateSubject(templateId: string): Promise<string | null> {
  const res = await supabaseServer.from('email_templates').select('id, subject').eq('id', templateId).single();
  if (res.error || !res.data) return null;
  return typeof (res.data as any)?.subject === 'string' ? ((res.data as any).subject as string) : null;
}
