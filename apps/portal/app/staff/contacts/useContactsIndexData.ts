'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '@/lib/repo/apiClient';
import { contactsIndexQueryOptions } from '@/lib/queries/contactsIndex';
import type { ContactsIndexParams } from '@/lib/contacts/contactsIndexContract';

type ContactsIndexReadState = 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function useContactsIndexData(params: ContactsIndexParams) {
  const query = useQuery({
    ...contactsIndexQueryOptions(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    retry: (failureCount, error) => !isAccessEndingError(error) && failureCount < 2,
  });

  const unavailable = isAccessEndingError(query.error);
  const responseMatchesRequest = Boolean(
    query.data
      && query.data.query.search === params.search.trim()
      && query.data.query.sort === params.sort
      && query.data.contacts.page === params.page
      && query.data.contacts.pageSize === params.pageSize,
  );
  const knownData = unavailable || !responseMatchesRequest ? undefined : query.data;

  let state: ContactsIndexReadState;
  if (unavailable) state = 'unavailable';
  else if (query.error) state = 'refresh-failed';
  else if (!knownData) state = 'pending';
  else if (query.isFetching || query.isPlaceholderData) state = 'cached';
  else state = 'fresh';

  return {
    state,
    data: knownData,
    error: query.error,
    retry: query.refetch,
    backgroundReady: state === 'fresh',
  };
}
