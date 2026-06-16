import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { normalizeProjectStatus } from '@/lib/types/project';
import {
  fetchAllPages,
  type ChunkedListFetchResult,
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
 * `ListCountBanner`.
 *
 * PR-PG1c (2026-06-16): both queries go through `fetchAllPages()` to
 * defeat Supabase's project-level `db-max-rows` cap. Return shapes
 * gain `truncated`. The `archived_at`-missing fallback branch goes
 * through the same helper so it can't silently truncate either.
 */
export async function loadProjectsIndexData(
  supabase?: SupabaseClient,
  options?: LoadProjectsIndexOptions,
): Promise<{
  projects: ChunkedListFetchResult<Project>;
  contacts: ChunkedListFetchResult<Contact>;
}> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const archiveFilter = options?.archiveFilter ?? 'active';

  const buildProjectsPage = (from: number, to: number) => {
    const base = client.from('projects').select('*', { count: 'exact' });
    const ordered =
      archiveFilter === 'active'
        ? base.is('archived_at', null).order('created_at', { ascending: false })
        : archiveFilter === 'archived'
          ? base.not('archived_at', 'is', null).order('created_at', { ascending: false })
          : base.order('created_at', { ascending: false });
    return ordered.range(from, to);
  };

  let projectsResult: ChunkedListFetchResult<Record<string, unknown>>;
  try {
    projectsResult = await fetchAllPages<Record<string, unknown>>(buildProjectsPage);
  } catch (err) {
    if (missingColumnFromError(err) === 'archived_at') {
      // archived_at column absent → no archived projects can exist.
      projectsResult =
        archiveFilter === 'archived'
          ? { rows: [], totalCount: 0, truncated: false }
          : await fetchAllPages<Record<string, unknown>>((from, to) =>
              client
                .from('projects')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to),
            );
    } else {
      throw err;
    }
  }

  const contactsResult = await fetchAllPages<Record<string, unknown>>((from, to) =>
    client
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to),
  );

  return {
    projects: {
      rows: projectsResult.rows.map((row) => mapProjectRow(row)),
      totalCount: projectsResult.totalCount,
      truncated: projectsResult.truncated,
    },
    contacts: {
      rows: sortContacts(contactsResult.rows.map((row) => mapContactRow(row))),
      totalCount: contactsResult.totalCount,
      truncated: contactsResult.truncated,
    },
  };
}
