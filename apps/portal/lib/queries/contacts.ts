import { queryOptions } from '@tanstack/react-query';
import { qk } from './keys';
import { getContact, listContacts } from '@/lib/repo/contactsRepo';

const ONE_DAY = 1000 * 60 * 60 * 24;
const THIRTY_MINUTES = 1000 * 60 * 30;
const TEN_MINUTES = 1000 * 60 * 10;

export const contactsListQueryOptions = (host: string) =>
  queryOptions({
    queryKey: qk.contacts.list(host),
    queryFn: listContacts,
    staleTime: THIRTY_MINUTES,
    gcTime: ONE_DAY,
  });

export const contactDetailQueryOptions = (host: string, contactId: string) =>
  queryOptions({
    queryKey: qk.contacts.detail(host, contactId),
    queryFn: () => getContact(contactId),
    staleTime: TEN_MINUTES,
    gcTime: ONE_DAY,
  });
