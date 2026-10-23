'use client';

import type { ReactNode } from 'react';
import StaffPageHeader from '@/components/layout/StaffPageHeaderSurface';
import { Input, Select } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationDataState';
import {
  Card,
  PageLayout,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import styles from './contacts.module.css';
import type {
  ContactsIndexPageSize,
  ContactsIndexSort,
} from '@/lib/contacts/contactsIndexContract';


/** Public controls and the actual table have one owner throughout a read. */
export type ContactsIndexFrameRead = {
  state: 'pending' | 'cached' | 'fresh' | 'refresh-failed' | 'unavailable';
  data?: import('@/lib/contacts/contactsIndexContract').ContactsIndexResponse;
  backgroundReady: boolean;
  retry: () => unknown;
};

export type ContactsIndexFrameProps = {
  query: string;
  debouncedQuery: string;
  page: number;
  pageSize: ContactsIndexPageSize;
  sort: ContactsIndexSort;
  setQuery: (value: string) => void;
  setPage: (value: number) => void;
  setPageSize: (value: ContactsIndexPageSize) => void;
  setSort: (value: ContactsIndexSort) => void;
  contactsIndex: ContactsIndexFrameRead;
  actions?: ReactNode;
  rows?:ReactNode;countNotice?:ReactNode;pagination?:ReactNode;
};

export default function ContactsIndexFrame({
  query, debouncedQuery, page, pageSize, sort,
  setQuery, setPage, setPageSize, setSort, contactsIndex, actions, rows, countNotice, pagination,
}: ContactsIndexFrameProps) {
  const contacts = contactsIndex.data?.contacts.rows ?? [];
  const totalCount = contactsIndex.data?.contacts.totalCount ?? 0;
  const rangeStart = totalCount ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <PageLayout
      className={styles.page}
      data-contacts-index-state={contactsIndex.state}
      data-contacts-index-background-ready={contactsIndex.backgroundReady ? 'true' : 'false'}
    >
      <StaffPageHeader
        variant="index"
        title="Contacts"
        description="Search customer records, review linked projects, or add a new enquiry contact."
        count={contactsIndex.data?.contacts.totalCount ?? undefined}
        right={
          actions
        }
      />

      {countNotice}

      <div className={styles.stack}>
        <Card title="Find contacts" aria-label="Search contacts" padding="compact">
          <div role="search" aria-label="Search and filter" className={styles.listControls}>
            <Input
              id="contactSearch"
              label="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, phone..."
            />
            <Select
              id="contactSort"
              label="Sort"
              value={sort}
              onChange={(event) => setSort(event.target.value as ContactsIndexSort)}
            >
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
              <option value="created_desc">Newest first</option>
              <option value="created_asc">Oldest first</option>
            </Select>
            <Select
              id="contactPageSize"
              label="Rows per page"
              value={String(pageSize)}
              onChange={(event) => setPageSize(Number(event.target.value) as ContactsIndexPageSize)}
            >
              <option value="25">25 rows</option>
              <option value="50">50 rows</option>
              <option value="100">100 rows</option>
            </Select>
          </div>
        </Card>

        <Card
          title="All contacts"
          action={(
            <span className={styles.muted}>
              {contactsIndex.state === 'pending' || contactsIndex.state === 'cached'
                ? 'Updating...'
                : contactsIndex.state === 'refresh-failed'
                  ? contacts.length ? `Refresh failed · ${rangeStart}–${rangeEnd} of ${totalCount}` : 'Refresh failed'
                  : contactsIndex.state==='unavailable'?'Access unavailable':`${rangeStart}–${rangeEnd} of ${totalCount}`}
            </span>
          )}
          aria-label="Contacts list"
          aria-busy={contactsIndex.state === 'pending' || contactsIndex.state === 'cached'}
          padding="none"
        >
          {contactsIndex.state==='refresh-failed'?<DataStatePanel state="stale" title="Could not refresh contacts" description={contacts.length?'Showing the last saved list.':'No saved list is available. Retry the request.'} onRetry={()=>void contactsIndex.retry()}/>:null}
                  <Table className={styles.responsiveTable}>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className={styles.mobileOptional}>Email</TableHead><TableHead className={styles.mobileOptional}>Phone</TableHead><TableHead className={styles.mobileOptional}>Created</TableHead><TableHead><span className="visually-hidden">Actions</span></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {rows}
                      {!contacts.length&&<TableRow><TableCell colSpan={5}>{contactsIndex.state==='pending'||contactsIndex.state==='cached'?<p role="status">Reading contacts…</p>:contactsIndex.state==='unavailable'?<DataStatePanel state="unavailable" title="Contacts unavailable" description="Your current session cannot access the Contacts list." onRetry={()=>void contactsIndex.retry()}/>:contactsIndex.state==='fresh'?<DataStatePanel state={debouncedQuery.trim()?'filtered-empty':'empty'} title={debouncedQuery.trim()?'No contacts match your search.':'No contacts found.'} description={debouncedQuery.trim()?'Clear or adjust the search.':'Create the first contact to begin.'} onClear={debouncedQuery.trim()?()=>setQuery(''):undefined}/>:null}</TableCell></TableRow>}
                    </TableBody>
                  </Table>
          {pagination}

        </Card>
      </div>
    </PageLayout>
  );
}
