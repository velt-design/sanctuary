'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import HeaderActions from '@/components/layout/HeaderActions';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransitionContext';
import { ButtonLink } from '@/components/ui/foundation/FoundationControls';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import ContactsImportAction from './ContactsImportAction';
import ContactsIndexFrame from './ContactsIndexFrame';
import {contactsRecordSlots} from './contactsRecordSlots';
import { useContactsIndexWorkspace } from './ContactsIndexWorkspace';
import { useContactsIndexData, type ContactsIndexLoader } from './useContactsIndexData';
import { useDebouncedValue } from '@/lib/list/useDebouncedValue';
import type { ContactsIndexPageSize, ContactsIndexSort } from '@/lib/contacts/contactsIndexContract';

/** Mounted by the selected guarded leaf, never by public code preparation. */
export function ContactsIndexReadOwner({ readLoader, readOnly = false }: { readLoader?: ContactsIndexLoader; readOnly?: boolean } = {}) {
  const workspace = useContactsIndexWorkspace();
  return workspace?.owner ? <ContactsIndexPrivateRead workspace={workspace} readLoader={readLoader} readOnly={readOnly} /> : null;
}

function ContactsIndexPrivateRead({ workspace, readLoader, readOnly }: {
  workspace: NonNullable<ReturnType<typeof useContactsIndexWorkspace>>;
  readLoader?: ContactsIndexLoader;
  readOnly: boolean;
}) {
  const { owner, params, selection, publish } = workspace;
  const result = useContactsIndexData(params, readLoader);
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const read = useMemo(() => ({ state: result.state, data: result.data,
    retry: result.retry, backgroundReady: result.backgroundReady }),
  [result.state, result.data, result.retry, result.backgroundReady]);
  const current=useRef({owner,selection});current.current={owner,selection};
  const alive=useRef(true);useLayoutEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const setPage=workspace.setPage;
  const onPageChange=useCallback((page:number)=>{if(alive.current&&current.current.owner===owner&&current.current.selection===selection)setPage(page);},[owner,selection,setPage]);
  const setQuery=workspace.setQuery;
  const onClear=useCallback(()=>{if(alive.current&&current.current.owner===owner&&current.current.selection===selection)setQuery('');},[owner,selection,setQuery]);
  const slots=useMemo(()=>contactsRecordSlots(read,params.page,params.pageSize,onPageChange,onClear),[read,params.page,params.pageSize,onPageChange,onClear]);
  const actions = useMemo(() => readOnly || read.state === 'unavailable' ? null : <HeaderActions>
    <ContactsImportAction contacts={read.data?.contacts.rows ?? []} host={host} />
    <ButtonLink href="/staff/contacts/new">New Contact</ButtonLink>
  </HeaderActions>, [readOnly, read.state, read.data, host]);
  useLayoutEffect(() => {
    if (!owner) return;
    publish({ owner, selection, read, actions, ...slots });
    return () => publish(current => current?.owner === owner && current.selection === selection ? null : current);
  }, [owner, selection, read, actions, slots, publish]);
  return null;
}

export default function ContactsIndexClient(props: { initialQuery?: string; readLoader?: ContactsIndexLoader; readOnly?: boolean }) {
  const workspace = useContactsIndexWorkspace();
  return workspace ? <ContactsIndexReadOwner readLoader={props.readLoader} readOnly={props.readOnly} /> : <StandaloneContactsIndexClient {...props} />;
}

function StandaloneContactsIndexClient({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<ContactsIndexPageSize>(50);
  const [sort, setSort] = useState<ContactsIndexSort>('name_asc');
  const debouncedQuery = useDebouncedValue(query, 180);
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const contactsIndex = useContactsIndexData({
    search: debouncedQuery,
    page,
    pageSize,
    sort,
  });
  const { finishInstantRoute } = usePortalRouteTransition();
  const contacts = contactsIndex.data?.contacts.rows ?? [];

  useEffect(() => {
    finishInstantRoute('contacts-index');
  }, [finishInstantRoute]);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, pageSize, sort]);

  useEffect(() => {
    const totalPages = contactsIndex.data?.contacts.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [contactsIndex.data?.contacts.totalPages, page]);

  return <ContactsIndexFrame
    query={query}
    debouncedQuery={debouncedQuery}
    page={page}
    pageSize={pageSize}
    sort={sort}
    setQuery={setQuery}
    setPage={setPage}
    setPageSize={setPageSize}
    setSort={setSort}
    {...contactsRecordSlots(contactsIndex,page,pageSize,setPage,()=>setQuery(''))}
    contactsIndex={contactsIndex}
    actions={<HeaderActions>
      <ContactsImportAction contacts={contacts} host={host} />
      <ButtonLink href="/staff/contacts/new">New Contact</ButtonLink>
    </HeaderActions>}
  />;
}
