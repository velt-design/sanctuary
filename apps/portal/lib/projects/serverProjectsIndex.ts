import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import {
  MAX_LIST_FETCH_ROWS,
  type ListFetchResult,
} from '@/lib/list/listLimits';
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

export type LoadProjectsIndexOptions = {
  archiveFilter?: 'active' | 'archived' | 'all';
};

/**
 * PR-PG1 (2026-06-16): return shape changed from
 * `{ projects: Project[]; contacts: Contact[] }` to
 * `{ projects: ListFetchResult<Project>; contacts: ListFetchResult<Contact> }`
 * so the projects index page can surface the row count via
 * `ListCountBanner`. Both branches of the `archived_at`-missing
 * fallback (line ~107-111) get the same `.range()` + `count: 'exact'`
 * treatment so neither path silently truncates.
 */
export async function loadProjectsIndexData(
  supabase?: SupabaseClient,
  options?: LoadProjectsIndexOptions,
): Promise<{
  projects: ListFetchResult<Project>;
  contacts: ListFetchResult<Contact>;
}> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const archiveFilter = options?.archiveFilter ?? 'active';

  const buildProjectsQuery = () => {
    const base = client.from('projects').select('*', { count: 'exact' });
    if (archiveFilter === 'active') {
      return base
        .is('archived_at', null)
        .order('created_at', { ascending: false })
        .range(0, MAX_LIST_FETCH_ROWS - 1);
    }
    if (archiveFilter === 'archived') {
      return base
        .not('archived_at', 'is', null)
        .order('created_at', { ascending: false })
        .range(0, MAX_LIST_FETCH_ROWS - 1);
    }
    return base.order('created_at', { ascending: false }).range(0, MAX_LIST_FETCH_ROWS - 1);
  };

  let projectsRes = await buildProjectsQuery();
  if (projectsRes.error && missingColumnFromError(projectsRes.error) === 'archived_at') {
    projectsRes =
      archiveFilter === 'archived'
        ? // archived_at column is absent, so no archived projects can exist.
          ({ data: [], error: null, count: 0 } as unknown as typeof projectsRes)
        : await client
            .from('projects')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(0, MAX_LIST_FETCH_ROWS - 1);
  }
  if (projectsRes.error) throw projectsRes.error;

  const contactsRes = await client
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(0, MAX_LIST_FETCH_ROWS - 1);
  if (contactsRes.error) throw contactsRes.error;

  return {
    projects: {
      rows: (Array.isArray(projectsRes.data) ? projectsRes.data : []).map((row) => mapProjectRow(row as Record<string, unknown>)),
      totalCount: typeof projectsRes.count === 'number' ? projectsRes.count : null,
    },
    contacts: {
      rows: sortContacts((Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(row as Record<string, unknown>))),
      totalCount: typeof contactsRes.count === 'number' ? contactsRes.count : null,
    },
  };
}
