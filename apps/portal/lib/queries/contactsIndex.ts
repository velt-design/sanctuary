import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { ContactsIndexResponse } from '@/lib/contacts/contactsIndexContract';
import type { Contact } from '@/lib/types/contact';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';
import { invalidatePortalSearchQueries } from './portalSearch';
import {
  PROJECTS_INDEX_QUERY_SCOPE,
  type ProjectsIndexArchiveFilter,
  type ProjectsIndexResponse,
} from './projectsIndex';

export type { ContactsIndexResponse } from '@/lib/contacts/contactsIndexContract';

const ONE_DAY = 1000 * 60 * 60 * 24;
const FIVE_MINUTES = 1000 * 60 * 5;
export const CONTACTS_INDEX_QUERY_SCOPE = 'staff-api';
const PROJECT_ARCHIVES = ['active', 'archived', 'all'] as const satisfies readonly ProjectsIndexArchiveFilter[];

export function contactsIndexQueryOptions() {
  return queryOptions({
    queryKey: qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE),
    queryFn: () =>
      apiJson<ContactsIndexResponse>('/api/staff/v1/contacts/index', { cache: 'no-store' }),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });
}

function sortContacts(contacts: Contact[]): Contact[] {
  return contacts
    .slice()
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
}

function upsertRows(rows: Contact[], contact: Contact): { rows: Contact[]; added: boolean } {
  const added = !rows.some((entry) => entry.id === contact.id);
  return {
    rows: sortContacts([...rows.filter((entry) => entry.id !== contact.id), contact]),
    added,
  };
}

function withUpsertedContact(
  current: ContactsIndexResponse['contacts'],
  contact: Contact,
): ContactsIndexResponse['contacts'] {
  const next = upsertRows(current.rows, contact);
  return {
    ...current,
    rows: next.rows,
    totalCount:
      next.added && current.totalCount !== null ? current.totalCount + 1 : current.totalCount,
  };
}

function firstProjectsContacts(queryClient: QueryClient): ContactsIndexResponse['contacts'] | undefined {
  for (const archive of PROJECT_ARCHIVES) {
    const response = queryClient.getQueryData<ProjectsIndexResponse>(
      qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
    );
    if (response?.contacts) return response.contacts;
  }
  return undefined;
}

export function contactsIndexPlaceholderFromCaches(
  queryClient: QueryClient,
  host: string,
): ContactsIndexResponse | undefined {
  const index = queryClient.getQueryData<ContactsIndexResponse>(
    qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE),
  );
  if (index) return index;

  const projectContacts = firstProjectsContacts(queryClient);
  if (projectContacts) {
    return { contacts: projectContacts, generatedAt: 'cached' };
  }

  const contacts = queryClient.getQueryData<Contact[]>(qk.contacts.list(host));
  if (!contacts) return undefined;
  return {
    contacts: { rows: contacts, totalCount: null, truncated: false },
    generatedAt: 'cached',
  };
}

export function seedContactsIndexCanonicalCaches(
  queryClient: QueryClient,
  host: string,
  response: ContactsIndexResponse,
) {
  queryClient.setQueryData<ContactsIndexResponse>(
    qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE),
    response,
  );
  queryClient.setQueryData<Contact[]>(qk.contacts.list(host), response.contacts.rows);
  for (const archive of PROJECT_ARCHIVES) {
    queryClient.setQueryData<ProjectsIndexResponse | undefined>(
      qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
      (current) => current ? { ...current, contacts: response.contacts } : current,
    );
  }
}

export function upsertContactAcrossIndexCaches(
  queryClient: QueryClient,
  host: string,
  contact: Contact,
) {
  queryClient.setQueryData<Contact[] | undefined>(qk.contacts.list(host), (current) =>
    Array.isArray(current) ? upsertRows(current, contact).rows : current,
  );
  queryClient.setQueryData<ContactsIndexResponse | undefined>(
    qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE),
    (current) => current
      ? { ...current, contacts: withUpsertedContact(current.contacts, contact) }
      : current,
  );
  for (const archive of PROJECT_ARCHIVES) {
    queryClient.setQueryData<ProjectsIndexResponse | undefined>(
      qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
      (current) => current
        ? { ...current, contacts: withUpsertedContact(current.contacts, contact) }
        : current,
    );
  }
  void invalidatePortalSearchQueries(queryClient, 'none');
}

export function patchContactAcrossIndexCaches(
  queryClient: QueryClient,
  host: string,
  contactId: string,
  updater: (contact: Contact) => Contact,
) {
  const patchRows = (rows: Contact[]) => rows.map((contact) =>
    contact.id === contactId ? { ...updater(contact) } : contact,
  );
  queryClient.setQueryData<Contact[] | undefined>(qk.contacts.list(host), (current) =>
    Array.isArray(current) ? patchRows(current) : current,
  );
  queryClient.setQueryData<ContactsIndexResponse | undefined>(
    qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE),
    (current) => current
      ? { ...current, contacts: { ...current.contacts, rows: patchRows(current.contacts.rows) } }
      : current,
  );
  for (const archive of PROJECT_ARCHIVES) {
    queryClient.setQueryData<ProjectsIndexResponse | undefined>(
      qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, archive),
      (current) => current
        ? { ...current, contacts: { ...current.contacts, rows: patchRows(current.contacts.rows) } }
        : current,
    );
  }
  void invalidatePortalSearchQueries(queryClient, 'none');
}

export async function invalidateContactsIndexCaches(queryClient: QueryClient, host: string) {
  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: qk.contacts.indexPrefix(CONTACTS_INDEX_QUERY_SCOPE) }),
    queryClient.invalidateQueries({ queryKey: qk.contacts.list(host) }),
    queryClient.invalidateQueries({ queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) }),
    invalidatePortalSearchQueries(queryClient),
  ]);
}
