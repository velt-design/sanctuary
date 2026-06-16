import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { appIdFromUuid } from '@/lib/supabase/mappers';
import type { Contact } from '@/lib/types/contact';
import {
  MAX_LIST_FETCH_ROWS,
  type ListFetchResult,
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
 * count via `ListCountBanner`. Single page-level caller updated in
 * the same PR; not used outside `app/staff/contacts/page.tsx`.
 */
export async function loadContactsIndexData(
  supabase?: SupabaseClient,
): Promise<ListFetchResult<Contact>> {
  const client = supabase ?? (await getSupabaseServerAuth());
  const contactsRes = await client
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('name', { ascending: true })
    .range(0, MAX_LIST_FETCH_ROWS - 1);
  if (contactsRes.error) throw contactsRes.error;
  const rows = sortContacts(
    (Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(row as Record<string, unknown>)),
  );
  return { rows, totalCount: typeof contactsRes.count === 'number' ? contactsRes.count : null };
}
