'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useDebouncedValue } from '@/lib/list/useDebouncedValue';
import type { ContactsIndexPageSize, ContactsIndexSort } from '@/lib/contacts/contactsIndexContract';
import ContactsIndexFrame, { type ContactsIndexFrameRead } from './ContactsIndexFrame';

type PublishedRead = { owner: object; selection: string; read: ContactsIndexFrameRead; actions: ReactNode; rows:ReactNode; countNotice:ReactNode; pagination:import('@/components/ui/foundation/PaginationSurface').PaginationEvidence };

function useContactsController(initialQuery: string, owner: object | null, entryIdentity: object | string) {
  const [entry, setEntry] = useState(entryIdentity);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ContactsIndexPageSize>(50);
  const [sort, setSort] = useState<ContactsIndexSort>('name_asc');
  if (entry !== entryIdentity) {
    setEntry(entryIdentity); setQuery(initialQuery); setPage(1); setPageSize(50); setSort('name_asc');
  }
  const debouncedQuery = useDebouncedValue(query, 180);
  const [published, setPublished] = useState<PublishedRead | null>(null);
  useEffect(() => { setQuery(initialQuery); }, [initialQuery]);
  useEffect(() => { setPage(1); }, [debouncedQuery, pageSize, sort]);
  const params = useMemo(() => ({ search: debouncedQuery, page, pageSize, sort }),
    [debouncedQuery, page, pageSize, sort]);
  const selection = JSON.stringify(params);
  const evidence = published?.owner === owner && published.selection === selection ? published : null;
  useEffect(() => {
    const totalPages = evidence?.read.data?.contacts.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [evidence?.read.data?.contacts.totalPages, page]);
  return {
    query, debouncedQuery, page, pageSize, sort, setQuery, setPage, setPageSize, setSort,
    params, selection, owner, evidence, publish: setPublished,
  };
}

type ContactsController = ReturnType<typeof useContactsController>;
const ContactsWorkspaceContext = createContext<ContactsController | null>(null);
const PENDING_READ: ContactsIndexFrameRead = {
  state: 'pending', backgroundReady: false, retry: () => undefined,
};

export function ContactsIndexWorkspace({ initialQuery = '', owner, children, visible = true, entryIdentity = '/', unavailable = false, onRetry }: {
  initialQuery?: string; owner: object | null; children: ReactNode; visible?: boolean; entryIdentity?: object | string;
  unavailable?: boolean; onRetry?: () => void;
}) {
  const controller = useContactsController(initialQuery, owner, entryIdentity);
  const evidence=unavailable?null:controller.evidence;
  return <ContactsWorkspaceContext.Provider value={controller}>
    {visible ? <ContactsIndexFrame {...controller}
      contactsIndex={unavailable ? { state: 'unavailable', backgroundReady: false, retry: onRetry ?? PENDING_READ.retry }
        : evidence?.read ?? PENDING_READ}
      rows={evidence?.rows} countNotice={evidence?.countNotice} pagination={evidence?.pagination}
      actions={evidence?.actions} /> : null}
    {children}
  </ContactsWorkspaceContext.Provider>;
}

export function useContactsIndexWorkspace() {
  return useContext(ContactsWorkspaceContext);
}
