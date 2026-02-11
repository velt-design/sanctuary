import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { getContact, listContacts } from '@/lib/repo/contactsRepo';

export const contactsListQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.contacts.list(host),
    queryFn: listContacts,
  });

export const contactDetailQueryOptions = (host: string, contactId: string) =>
  queryOptions({
    queryKey: qk.contacts.detail(host, contactId),
    queryFn: () => getContact(contactId),
  });
