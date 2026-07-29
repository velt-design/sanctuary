import { queryOptions, type QueryClient } from '@tanstack/react-query';
import {
  DEFAULT_CONTACTS_INDEX_PARAMS,
  type ContactsIndexParams,
  type ContactsIndexResponse,
} from '@/lib/contacts/contactsIndexContract';
import type { Contact } from '@/lib/types/contact';
import { apiJson } from '@/lib/repo/apiClient';
import { qk } from './keys';
import { invalidatePortalSearchQueries } from './portalSearch';
import {
  PROJECTS_INDEX_QUERY_SCOPE,
  type ProjectsIndexResponse,
} from './projectsIndex';

export type { ContactsIndexResponse } from '@/lib/contacts/contactsIndexContract';

const ONE_DAY = 1000 * 60 * 60 * 24;
const FIVE_MINUTES = 1000 * 60 * 5;
export const CONTACTS_INDEX_QUERY_SCOPE = 'staff-api';

function stableParams(params: ContactsIndexParams) {
  return {
    search: params.search.trim(),
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
  };
}

export function contactsIndexQueryOptions(
  params: ContactsIndexParams = DEFAULT_CONTACTS_INDEX_PARAMS,
) {
  const stable = stableParams(params);
  const searchParams = new URLSearchParams({
    q: stable.search,
    page: String(stable.page),
    pageSize: String(stable.pageSize),
    sort: stable.sort,
  });
  return queryOptions({
    queryKey: qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, stable),
    queryFn: () =>
      apiJson<ContactsIndexResponse>(
        `/api/staff/v1/contacts/index?${searchParams.toString()}`,
        { cache: 'no-store' },
      ),
    staleTime: FIVE_MINUTES,
    gcTime: ONE_DAY,
  });
}

function patchRows(rows: Contact[], contactId: string, updater: (contact: Contact) => Contact) {
  return rows.map((contact) => contact.id === contactId ? { ...updater(contact) } : contact);
}

export function upsertContactAcrossIndexCaches(
  queryClient: QueryClient,
  host: string,
  contact: Contact,
) {
  queryClient.setQueryData<Contact[] | undefined>(qk.contacts.list(host), (current) => {
    if (!Array.isArray(current)) return current;
    const exists = current.some((entry) => entry.id === contact.id);
    return exists
      ? current.map((entry) => entry.id === contact.id ? contact : entry)
      : [...current, contact].sort((a, b) => a.displayName.localeCompare(b.displayName));
  });
  queryClient.setQueriesData<ContactsIndexResponse>(
    { queryKey: qk.contacts.indexPrefix(CONTACTS_INDEX_QUERY_SCOPE) },
    (current) => {
      if (!current) return current;
      const exists = current.contacts.rows.some((entry) => entry.id === contact.id);
      return {
        ...current,
        contacts: {
          ...current.contacts,
          rows: exists
            ? current.contacts.rows.map((entry) => entry.id === contact.id ? contact : entry)
            : current.contacts.rows,
        },
      };
    },
  );
  queryClient.setQueriesData<ProjectsIndexResponse>(
    { queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) },
    (current) => {
      if (!current) return current;
      const exists = current.contacts.rows.some((entry) => entry.id === contact.id);
      return exists
        ? {
            ...current,
            contacts: {
              ...current.contacts,
              rows: current.contacts.rows.map((entry) => entry.id === contact.id ? contact : entry),
            },
          }
        : current;
    },
  );
  void invalidatePortalSearchQueries(queryClient, 'none');
}

export function patchContactAcrossIndexCaches(
  queryClient: QueryClient,
  host: string,
  contactId: string,
  updater: (contact: Contact) => Contact,
) {
  queryClient.setQueryData<Contact[] | undefined>(qk.contacts.list(host), (current) =>
    Array.isArray(current) ? patchRows(current, contactId, updater) : current,
  );
  queryClient.setQueriesData<ContactsIndexResponse>(
    { queryKey: qk.contacts.indexPrefix(CONTACTS_INDEX_QUERY_SCOPE) },
    (current) => current
      ? {
          ...current,
          contacts: {
            ...current.contacts,
            rows: patchRows(current.contacts.rows, contactId, updater),
          },
        }
      : current,
  );
  queryClient.setQueriesData<ProjectsIndexResponse>(
    { queryKey: qk.projects.indexPrefix(PROJECTS_INDEX_QUERY_SCOPE) },
    (current) => current
      ? {
          ...current,
          contacts: {
            ...current.contacts,
            rows: patchRows(current.contacts.rows, contactId, updater),
          },
        }
      : current,
  );
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
