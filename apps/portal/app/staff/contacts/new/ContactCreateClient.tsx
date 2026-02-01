'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { createContact } from '@/lib/repo/contactsRepo';
import styles from '../../projects/projects.module.css';
import SupabaseEnvStatus from '@/components/diagnostics/SupabaseEnvStatus';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';

type Draft = {
  displayName: string;
  email: string;
  phone: string;
};

function isValidOptionalEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

export default function ContactCreateClient() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ displayName: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return draft.displayName.trim().length > 0 && isValidOptionalEmail(draft.email);
  }, [draft.displayName, draft.email]);

  return (
    <main className={styles.page}>
      <PageHeader
        title="New Contact"
        right={
          <HeaderActions>
            <Link className={styles.buttonSecondary} href="/staff/contacts">
              Contacts
            </Link>
          </HeaderActions>
        }
      />

      <section className={styles.section} aria-label="Contact form">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Contact Details</h2>
        </div>
        <div className={styles.sectionBody}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!canSubmit) return;
              setError(null);
              try {
                const contact = await createContact({
                  displayName: draft.displayName.trim(),
                  email: draft.email.trim(),
                  phone: draft.phone.trim(),
                });
                router.push(`/staff/contacts/${encodeURIComponent(contact.id)}`);
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Failed to create contact';
                setError(msg);
              }
            }}
          >
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="displayName">Name *</label>
                <input
                  id="displayName"
                  value={draft.displayName}
                  onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="email">Email</label>
                <input id="email" value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} />
                {!isValidOptionalEmail(draft.email) ? <p className={styles.error}>Email must include "@".</p> : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="phone">Phone</label>
                <input id="phone" value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} />
              </div>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}

            <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 14 }}>
              <button className={styles.button} type="submit" disabled={!canSubmit}>
                Create Contact
              </button>
              <Link className={styles.buttonSecondary} href="/staff/contacts">
                Cancel
              </Link>
            </div>
          </form>

          <SupabaseEnvStatus />
        </div>
      </section>
    </main>
  );
}
