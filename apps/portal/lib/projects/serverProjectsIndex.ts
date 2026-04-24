import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import { nowIso } from '@/lib/utils/time';

const PROJECT_INDEX_SELECT =
  'id,name,created_at,updated_at,contact_id,region,quote_ref,site_address,pipeline_stage,archived_at,follow_up_date,next_action_type,deposit_amount_cents,deposit_paid_date,final_payment_date,notes';
const PROJECT_INDEX_FALLBACK_SELECT =
  'id,name,created_at,updated_at,contact_id,region,quote_ref,site_address,pipeline_stage,follow_up_date,next_action_type,deposit_amount_cents,deposit_paid_date,final_payment_date,notes';
const CONTACT_INDEX_SELECT = 'id,name,email,phone,created_at,updated_at';

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

async function loadProjects(client: SupabaseClient): Promise<Project[]> {
  const initialProjectsRes = await client
    .from('projects')
    .select(PROJECT_INDEX_SELECT)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  let projectsData = Array.isArray(initialProjectsRes.data)
    ? (initialProjectsRes.data as Record<string, unknown>[])
    : null;
  let projectsError = initialProjectsRes.error;
  if (projectsError && missingColumnFromError(projectsError) === 'archived_at') {
    const fallbackProjectsRes = await client
      .from('projects')
      .select(PROJECT_INDEX_FALLBACK_SELECT)
      .order('created_at', { ascending: false });
    projectsData = Array.isArray(fallbackProjectsRes.data)
      ? (fallbackProjectsRes.data as Record<string, unknown>[])
      : null;
    projectsError = fallbackProjectsRes.error;
  }
  if (projectsError) throw projectsError;
  return (projectsData ?? []).map((row) => mapProjectRow(row));
}

async function loadContacts(client: SupabaseClient): Promise<Contact[]> {
  const contactsRes = await client.from('contacts').select(CONTACT_INDEX_SELECT).order('name', { ascending: true });
  if (contactsRes.error) throw contactsRes.error;
  return sortContacts((Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(row as Record<string, unknown>)));
}

export async function loadProjectsIndexData(supabase?: SupabaseClient): Promise<{
  projects: Project[];
  contacts: Contact[];
}> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const [projects, contacts] = await Promise.all([loadProjects(client), loadContacts(client)]);

  return {
    projects,
    contacts,
  };
}
