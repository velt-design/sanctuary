import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import {
  fetchAllPages,
  type ChunkedListFetchResult,
} from '@/lib/list/listLimits';
import { nowIso } from '@/lib/utils/time';

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

/**
 * PR-PG1 (2026-06-16): return shape changed from `Contact[]` to
 * `ListFetchResult<Contact>` so the page can surface the total row
 * count via `ListCountBanner`.
 *
 * PR-PG1c (2026-06-16): now returns `ChunkedListFetchResult<Contact>`
 * (adds `truncated`) and goes through `fetchAllPages()` to defeat the
 * Supabase project-level `db-max-rows` cap that silently clamps every
 * single PostgREST response to 1000 rows regardless of `.range(...)`.
 */
export async function loadContactsIndexData(
  supabase?: SupabaseClient,
): Promise<ChunkedListFetchResult<Contact>> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const result = await fetchAllPages<Record<string, unknown>>((from, to) =>
    client
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to),
  );
  const rows = sortContacts(result.rows.map((row) => mapContactRow(row)));
  return { rows, totalCount: result.totalCount, truncated: result.truncated };
}
