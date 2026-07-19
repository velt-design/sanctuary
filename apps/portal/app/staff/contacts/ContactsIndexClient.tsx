'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import ListCountBanner from '@/components/ui/listBanner/ListCountBanner';
import PageMessagePanel from '@/components/page-state/PageMessagePanel';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import stateStyles from '@/components/page-state/PageState.module.css';
import ContactsImportAction from './ContactsImportAction';
import { useContactsIndexData } from './useContactsIndexData';

export default function ContactsIndexClient() {
  const [query, setQuery] = useState('');
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

  if (contactsIndex.state === 'unavailable') {
    return (
      <PageMessagePanel
        title="Contacts unavailable"
        description="Your current session cannot access the Contacts list."
      />
    );
  }

  return (
    <main
      className={styles.page}
      data-contacts-index-state={contactsIndex.state}
      data-contacts-index-background-ready={contactsIndex.backgroundReady ? 'true' : 'false'}
    >
      <PageHeader
        title="Contacts"
        right={
          <HeaderActions>
            <ContactsImportAction contacts={contacts} host={host} />
            <Link className={styles.button} href="/staff/contacts/new">New Contact</Link>
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

      <div className="sp-page-stack">
        <section className={styles.section} aria-label="Search contacts">
          <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Search</h2></div>
          <div className={styles.sectionBody}>
            <div className={styles.field}>
              <label htmlFor="contactSearch">Search</label>
              <input
                id="contactSearch"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, email, phone..."
              />
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Contacts list" aria-busy={contactsIndex.state === 'pending' || contactsIndex.state === 'cached'}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Contacts</h2>
            <span className={styles.muted}>
              {contactsIndex.state === 'pending' || contactsIndex.state === 'cached' ? 'Updating...' : `${filtered.length} total`}
            </span>
          </div>
          <div className={styles.sectionBody}>
            {contactsIndex.state === 'refresh-failed' ? (
              <div className={stateStyles.inlineNotice} role="status">
                <span>Could not refresh contacts. Showing the last saved list.</span>
                <button type="button" className={stateStyles.secondaryAction} onClick={() => void contactsIndex.retry()}>Retry</button>
              </div>
            ) : null}

            {filtered.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Created</th><th /></tr></thead>
                  <tbody>
                    {filtered.map((contact) => (
                      <tr key={contact.id}>
                        <td>{contact.displayName}</td>
                        <td className={styles.muted}>{contact.email || '—'}</td>
                        <td className={styles.muted}>{contact.phone || '—'}</td>
                        <td className={styles.muted}>{formatPortalDateTime(contact.createdAt)}</td>
                        <td><Link className={styles.link} href={`/staff/contacts/${encodeURIComponent(contact.id)}`}>Open</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : contactsIndex.state === 'fresh' ? (
              <p className={styles.note}>{query.trim() ? 'No contacts match your search.' : 'No contacts found.'}</p>
            ) : (
              <p className={styles.note}>Updating contacts...</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
