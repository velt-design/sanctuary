import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { qk } from './keys';
import {
  CONTACTS_INDEX_QUERY_SCOPE,
  contactsIndexPlaceholderFromCaches,
  seedContactsIndexCanonicalCaches,
  upsertContactAcrossIndexCaches,
  type ContactsIndexResponse,
} from './contactsIndex';
import { PROJECTS_INDEX_QUERY_SCOPE, type ProjectsIndexResponse } from './projectsIndex';

const contact = { id: 'ct_1', displayName: 'Alex', email: '', phone: '' } as any;
const updatedContact = { ...contact, phone: '021' };

function projectsResponse(): ProjectsIndexResponse {
  return {
    archive: 'active',
    projects: { rows: [], totalCount: 0, truncated: false },
    contacts: { rows: [contact], totalCount: 1, truncated: false },
    generatedAt: 'cached',
  };
}

describe('contacts index query cache', () => {
  it('bootstraps from the canonical contact cache without crossing users or hosts', () => {
    const userA = new QueryClient();
    const userB = new QueryClient();
    userA.setQueryData(qk.contacts.list('host-a'), [contact]);

    expect(contactsIndexPlaceholderFromCaches(userA, 'host-a')?.contacts.rows).toEqual([contact]);
    expect(contactsIndexPlaceholderFromCaches(userA, 'host-b')).toBeUndefined();
    expect(contactsIndexPlaceholderFromCaches(userB, 'host-a')).toBeUndefined();
  });

  it('reuses complete contact metadata already held by the Projects index', () => {
    const client = new QueryClient();
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'), projectsResponse());
    expect(contactsIndexPlaceholderFromCaches(client, 'host')).toEqual({
      contacts: { rows: [contact], totalCount: 1, truncated: false },
      generatedAt: 'cached',
    });
  });

  it('seeds the canonical list and every existing Projects-index scope from fresh data', () => {
    const client = new QueryClient();
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'), projectsResponse());
    const response: ContactsIndexResponse = {
      contacts: { rows: [updatedContact], totalCount: 1, truncated: false },
      generatedAt: 'fresh',
    };
    seedContactsIndexCanonicalCaches(client, 'host', response);

    expect(client.getQueryData(qk.contacts.list('host'))).toEqual([updatedContact]);
    expect(client.getQueryData<ContactsIndexResponse>(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE))).toEqual(response);
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.contacts.rows).toEqual([updatedContact]);
  });

  it('keeps contact, Contacts-index, and Projects-index caches coherent after an upsert', () => {
    const client = new QueryClient();
    client.setQueryData(qk.contacts.list('host'), [contact]);
    client.setQueryData(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE), {
      contacts: { rows: [contact], totalCount: 1, truncated: false },
      generatedAt: 'cached',
    } satisfies ContactsIndexResponse);
    client.setQueryData(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'), projectsResponse());

    upsertContactAcrossIndexCaches(client, 'host', updatedContact);
    expect(client.getQueryData<any[]>(qk.contacts.list('host'))?.[0].phone).toBe('021');
    expect(client.getQueryData<ContactsIndexResponse>(qk.contacts.index(CONTACTS_INDEX_QUERY_SCOPE))?.contacts.rows[0].phone).toBe('021');
    expect(client.getQueryData<ProjectsIndexResponse>(qk.projects.index(PROJECTS_INDEX_QUERY_SCOPE, 'active'))?.contacts.rows[0].phone).toBe('021');
  });
});
