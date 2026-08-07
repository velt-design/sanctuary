'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { ButtonLink, Input, Select } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import {
  Card,
  PageLayout,
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import { Pagination } from '@/components/ui/foundation/FoundationPagination';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import ContactsImportAction from './ContactsImportAction';
import styles from './contacts.module.css';
import { useContactsIndexData } from './useContactsIndexData';
import { useDebouncedValue } from '@/lib/list/useDebouncedValue';
import type {
  ContactsIndexPageSize,
  ContactsIndexSort,
} from '@/lib/contacts/contactsIndexContract';
import { ContactsIndexPendingTable, ContactsIndexTableHeader } from './ContactsIndexTable';

export default function ContactsIndexClient({ initialQuery = '' }: { initialQuery?: string }) {
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
    setPage(1);
  }, [debouncedQuery, pageSize, sort]);

  useEffect(() => {
    const totalPages = contactsIndex.data?.contacts.totalPages;
    if (totalPages && page > totalPages) setPage(totalPages);
  }, [contactsIndex.data?.contacts.totalPages, page]);

  const totalCount = contactsIndex.data?.contacts.totalCount ?? 0;
  const rangeStart = totalCount ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, totalCount);

  return (
    <PageLayout
      className={styles.page}
      data-portal-page-shell="contacts"
      data-portal-page-shell-ready="true"
      data-contacts-index-state={contactsIndex.state}
      data-contacts-index-background-ready={contactsIndex.backgroundReady ? 'true' : 'false'}
    >
      <StaffPageHeader
        variant="index"
        title="Contacts"
        description="Search customer records, review linked projects, or add a new enquiry contact."
        count={contactsIndex.data?.contacts.totalCount ?? undefined}
        right={
          <HeaderActions>
            <ContactsImportAction contacts={contacts} host={host} />
            <ButtonLink href="/staff/contacts/new">New Contact</ButtonLink>
          </HeaderActions>
        }
      />

      <ListCountBanner
        totalCount={contactsIndex.data?.contacts.totalCount ?? null}
        visibleCount={contacts.length}
        entityLabelSingular="contact"
        entityLabelPlural="contacts"
        truncated={contactsIndex.data?.contacts.truncated ?? false}
      />

      <div className={styles.stack}>
        <Card
          title="Find contacts"
          aria-label="Search contacts"
          padding="compact"
          data-portal-page-region="contacts-filters"
        >
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
                  : `${rangeStart}–${rangeEnd} of ${totalCount}`}
            </span>
          )}
          aria-label="Contacts list"
          data-portal-page-region="contacts-list"
          aria-busy={contactsIndex.state === 'pending' || contactsIndex.state === 'cached'}
          padding="none"
        >
          {contactsIndex.state === 'unavailable' ? (
            <DataStatePanel
              state="unavailable"
              title="Contacts unavailable"
              description="Your current session cannot access the Contacts list."
            />
          ) : (
            <>
              {contactsIndex.state === 'refresh-failed' ? (
                <DataStatePanel
                  state="stale"
                  title="Could not refresh contacts"
                  description={contacts.length
                    ? 'Showing the last saved list.'
                    : 'No saved list is available. Retry the request.'}
                  onRetry={() => void contactsIndex.retry()}
                />
              ) : null}

              {contacts.length ? (
                <>
                  <Table className={styles.responsiveTable} aria-label="Contacts">
                    <ContactsIndexTableHeader />
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell><strong>{contact.displayName}</strong></TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{contact.email || '\u2014'}</TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{contact.phone || '\u2014'}</TableCell>
                          <TableCell className={`${styles.muted} ${styles.mobileOptional}`}>{formatPortalDateTime(contact.createdAt)}</TableCell>
                          <TableCell className={styles.rowAction}><ButtonLink variant="quiet" size="small" href={`/staff/contacts/${encodeURIComponent(contact.id)}`}>Open</ButtonLink></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Pagination
                    currentPage={page}
                    totalPages={contactsIndex.data?.contacts.totalPages ?? 1}
                    itemSummary={`${rangeStart}–${rangeEnd} of ${totalCount} contacts`}
                    onPageChange={setPage}
                  />
                </>
              ) : contactsIndex.state === 'fresh' ? (
                <DataStatePanel
                  state={debouncedQuery.trim() ? 'filtered-empty' : 'empty'}
                  title={debouncedQuery.trim() ? 'No contacts match your search.' : 'No contacts found.'}
                  description={debouncedQuery.trim() ? 'Clear or adjust the search.' : 'Create the first contact to begin.'}
                  onClear={debouncedQuery.trim() ? () => setQuery('') : undefined}
                />
              ) : contactsIndex.state === 'pending' || contactsIndex.state === 'cached' ? (
                <>
                  <ContactsIndexPendingTable />
                  <span className="visually-hidden" role="status">Updating contacts...</span>
                </>
              ) : null}
            </>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
