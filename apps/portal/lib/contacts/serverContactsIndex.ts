import 'server-only';

import { appIdFromUuid } from '@/lib/supabase/mappers';
import { supabaseServer } from '@/lib/supabaseClient';
import type { Contact } from '@/lib/types/contact';
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

export async function loadContactsIndexData(): Promise<Contact[]> {
  const contactsRes = await supabaseServer.from('contacts').select('*').order('name', { ascending: true });
  if (contactsRes.error) throw contactsRes.error;
  return sortContacts((Array.isArray(contactsRes.data) ? contactsRes.data : []).map((row) => mapContactRow(row as Record<string, unknown>)));
}
