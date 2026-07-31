import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { qk } from './keys';
import {
  CONTACTS_INDEX_QUERY_SCOPE,
  contactsIndexQueryOptions,
  patchContactAcrossIndexCaches,
  upsertContactAcrossIndexCaches,
  type ContactsIndexResponse,
} from './contactsIndex';
import { PROJECTS_INDEX_QUERY_SCOPE, type ProjectsIndexResponse } from './projectsIndex';

const contact = { id: 'ct_1', displayName: 'Alex', email: '', phone: '' } as any;
const updatedContact = { ...contact, phone: '021' };
const params = { search: 'alex', page: 2, pageSize: 25, sort: 'name_desc' } as const;

function contactsResponse(): ContactsIndexResponse {
  return {
    contacts: { rows: [contact], totalCount: 51, truncated: false, page: 2, pageSize: 25, totalPages: 3 },
    query: { search: 'alex', sort: 'name_desc' },
    generatedAt: 'cached',
  };
}

function projectsResponse(): ProjectsIndexResponse {
  return {
    archive: 'active',
    projects: { rows: [], totalCount: 0, truncated: false, page: 1, pageSize: 50, totalPages: 1 },
    contacts: { rows: [contact], totalCount: null, truncated: false },
    query: { search: '', status: 'all', journey: 'all', state: 'all', sort: 'newest' },
    generatedAt: 'cached',
  };
}

describe('contacts index query cache', () => {
  it('keys and requests each bounded server page independently', () => {
    const options = contactsIndexQueryOptions(params);
    expect(options.queryKey).toEqual(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, params));
    expect(String(options.queryFn)).toContain('apiJson');
  });

  it('patches every cached Contacts and Projects page without adding a row to unrelated pages', () => {
    const client = new QueryClient();
    client.setQueryData(qk.contacts.list('host'), [contact]);
    client.setQueryData(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, params), contactsResponse());
    client.setQueryData(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, { ...params, page: 3 }), {
      ...contactsResponse(),
      contacts: { ...contactsResponse().contacts, rows: [] },
    });
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active', { page: 1 }), projectsResponse());

    upsertContactAcrossIndexCaches(client, 'host', updatedContact);
    expect(client.getQueryData<any[]>(qk.contacts.list('host'))?.[0].phone).toBe('021');
    expect(client.getQueryData<ContactsIndexResponse>(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, params))?.contacts.rows[0].phone).toBe('021');
    expect(client.getQueryData<ContactsIndexResponse>(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, { ...params, page: 3 }))?.contacts.rows).toEqual([]);
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active', { page: 1 }))?.contacts.rows[0].phone).toBe('021');

    patchContactAcrossIndexCaches(client, 'host', contact.id, (entry) => ({ ...entry, displayName: 'Alex Mason' }));
    expect(client.getQueryData<ContactsIndexResponse>(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE, params))?.contacts.rows[0].displayName).toBe('Alex Mason');
  });
});
