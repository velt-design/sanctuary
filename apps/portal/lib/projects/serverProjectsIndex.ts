import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import { nowIso } from '@/lib/utils/time';

function toPostgrestError(value: unknown): { code?: string; message?: string } | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as { code?: string; message?: string };
  return {
    code: v.code,
    message: v.message,
  };
}

function missingColumnFromError(error: unknown): string | null {
  const pg = toPostgrestError(error);
  if (!pg || pg.code?.trim() !== 'PGRST204') return null;
  const match = (pg.message ?? '').match(/'([^']+)' column/i);
  return match ? match[1] : null;
}

function sortContacts(contacts: Contact[]): Contact[] {
  return contacts
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

function mapContactRow(row: Record<string, unknown>): Contact {
  const id = typeof row.id === 'string' ? row.id : '';
  const createdAt = typeof row.created_at === 'string' ? row.created_at : nowIso();
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt;
  const displayName = typeof row.name === 'string' ? row.name.trim() : '';

  return {
    id: appIdFromUuid('ct', id),
    displayName,
    email: typeof row.email === 'string' ? row.email : '',
    phone: typeof row.phone === 'string' ? row.phone : '',
    createdAt,
    updatedAt,
  };
}

function mapProjectRow(row: Record<string, unknown>): Project {
  const createdAt = typeof row.created_at === 'string' ? row.created_at : nowIso();
  const updatedAt = typeof row.updated_at === 'string' ? row.updated_at : createdAt;
  const normalized = normalizeProjectStatus(row.pipeline_stage ?? row.status ?? row.legacy_status ?? 'NEW');
  const projectName = typeof row.name === 'string' ? row.name : '';
  const siteAddress = typeof row.site_address === 'string' ? row.site_address : '';
  const followUpDate = typeof row.follow_up_date === 'string' ? row.follow_up_date : null;
  const contactId = typeof row.contact_id === 'string' ? appIdFromUuid('ct', row.contact_id) : undefined;

  return {
    id: appIdFromUuid('proj', typeof row.id === 'string' ? row.id : ''),
    createdAt,
    updatedAt,
    ...(contactId ? { contactId } : null),
    projectName,
    name: projectName,
    region: typeof row.region === 'string' ? row.region : undefined,
    quoteRef: typeof row.quote_ref === 'string' ? row.quote_ref : undefined,
    siteAddress: siteAddress || undefined,
    address: siteAddress || undefined,
    status: normalized.status,
    isLost: normalized.isLost,
    isArchived: typeof row.archived_at === 'string' ? true : normalized.isArchived,
    legacyStatus: normalized.legacyStatus,
    nextActionDate: followUpDate,
    followUpDate,
    nextActionType: typeof row.next_action_type === 'string' ? (row.next_action_type as Project['nextActionType']) : null,
    depositAmountCents:
      typeof row.deposit_amount_cents === 'number' && Number.isFinite(row.deposit_amount_cents) ? row.deposit_amount_cents : null,
    depositPaidDate: typeof row.deposit_paid_date === 'string' ? row.deposit_paid_date : null,
    finalPaymentDate: typeof row.final_payment_date === 'string' ? row.final_payment_date : null,
    notes: typeof row.notes === 'string' ? row.notes : '',
  };
}

export async function loadProjectsIndexData(supabase?: SupabaseClient): Promise<{
  projects: Project[];
  contacts: Contact[];
}> {
  const client = supabase ?? (await getSupabaseServerAuth());
  let projectsRes = await client.from('projects').select('*').is('archived_at', null).order('created_at', { ascending: false });
  if (projectsRes.error && missingColumnFromError(projectsRes.error) === 'archived_at') {
    projectsRes = await client.from('projects').select('*').order('created_at', { ascending: false });
  }
  if (projectsRes.error) throw projectsRes.error;

  const contactsRes = await client.from('contacts').select('*').order('name', { ascending: true });
  if (contactsRes.error) throw contactsRes.error;

  return {
    projects: (Array.isArray(projectsRes.data) ? projectsRes.data : []).map((row) => mapProjectRow(row as Record<string, unknown>)),
    contacts: sortContacts((Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(row as Record<string, unknown>))),
  };
}
