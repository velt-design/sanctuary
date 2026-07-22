'use client';

import { useEffect, useMemo, useState } from 'react';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { ButtonLink, Input } from '@/components/ui/foundation/FoundationControls';
import { DataStatePanel } from '@/components/ui/foundation/FoundationFeedback';
import {
  Card,
  LoadingSkeleton,
  PageLayout,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation/FoundationSurfaces';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import ContactsImportAction from './ContactsImportAction';
import styles from './contacts.module.css';
import { useContactsIndexData } from './useContactsIndexData';

export default function ContactsIndexClient({ initialQuery = '' }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const contactsIndex = useContactsIndexData(host);
  const { finishInstantRoute } = usePortalRouteTransition();
  const contacts = contactsIndex.data?.contacts.rows ?? [];

  useEffect(() => {
    finishInstantRoute('contacts-index');
  }, [finishInstantRoute]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return contacts;
    return contacts.filter((contact) =>
      contact.displayName.toLowerCase().includes(normalized) ||
      contact.email.toLowerCase().includes(normalized) ||
      contact.phone.toLowerCase().includes(normalized),
    );
  }, [contacts, query]);

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
        count={contactsIndex.data?.contacts.totalCount ?? contacts.length}
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
        <Card title="Find contacts" aria-label="Search contacts" padding="compact">
          <div role="search" aria-label="Search and filter" className={styles.searchField}>
            <Input
              id="contactSearch"
              label="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, email, phone..."
            />
          </div>
        </Card>

        <Card
          title="All contacts"
          action={<span className={styles.muted}>{contactsIndex.state === 'pending' || contactsIndex.state === 'cached' ? 'Updating...' : `${filtered.length} shown`}</span>}
          aria-label="Contacts list"
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
                  description="Showing the last saved list."
                  onRetry={() => void contactsIndex.retry()}
                />
              ) : null}

              {filtered.length ? (
                <Table className={styles.responsiveTable}>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className={styles.mobileOptional}>Email</TableHead><TableHead className={styles.mobileOptional}>Phone</TableHead><TableHead className={styles.mobileOptional}>Created</TableHead><TableHead><span className="visually-hidden">Actions</span></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filtered.map((contact) => (
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
              ) : contactsIndex.state === 'fresh' ? (
                <DataStatePanel
                  state={query.trim() ? 'filtered-empty' : 'empty'}
                  title={query.trim() ? 'No contacts match your search.' : 'No contacts found.'}
                  description={query.trim() ? 'Clear or adjust the search.' : 'Create the first contact to begin.'}
                  onClear={query.trim() ? () => setQuery('') : undefined}
                />
              ) : (
                <LoadingSkeleton rows={5} columns={5} label="Updating contacts..." />
              )}
            </>
          )}
        </Card>
      </div>
    </PageLayout>
  );
}
