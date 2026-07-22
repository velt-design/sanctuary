'use client';

import Link from 'next/link';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import styles from './ProjectsIndexPendingFrame.module.css';

export default function ContactsIndexPendingFrame() {
  return (
    <main
      className={styles.page}
      data-contacts-index-state="pending"
      data-ui-foundation-consumer="contacts-pending"
      data-contacts-index-background-ready="false"
      aria-label="Opening contacts"
    >
      <StaffPageHeader
        title="Contacts"
        right={
          <HeaderActions className={styles.actions}>
            <button type="button" className={styles.action} disabled>Import CSV</button>
            <Link className={styles.action} href="/staff/contacts/new">New Contact</Link>
          </HeaderActions>
        }
      />
      <div className={styles.stack}>
        <section className={styles.section} aria-label="Search contacts">
          <div className={styles.sectionHeader}><h2 className={styles.sectionTitle}>Search</h2></div>
          <div className={styles.sectionBody}>
            <div className={styles.field} aria-busy="true">
              <label htmlFor="contactSearchPending">Search</label>
              <input id="contactSearchPending" placeholder="Name, email, phone..." disabled />
            </div>
          </div>
        </section>
        <section className={styles.section} aria-label="Contacts list" aria-busy="true">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Contacts</h2>
            <span className={styles.muted}>Updating...</span>
          </div>
          <div className={styles.sectionBody}><p className={styles.note}>Updating contacts...</p></div>
        </section>
      </div>
    </main>
  );
}
