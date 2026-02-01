'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getContact, updateContact } from '@/lib/repo/contactsRepo';
import { listProjectsForContact } from '@/lib/repo/projectsRepo';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import styles from '../../projects/projects.module.css';
import { useToast } from '@/components/ui/toast/ToastProvider';
import useSWR from 'swr';
import { contactsSWRKey } from '@/lib/cache/contactsCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

type Draft = {
  displayName: string;
  email: string;
  phone: string;
};

function isValidOptionalEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

export default function ContactDetailClient({ contactId }: { contactId: string }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const cachedContactsKey = useMemo(() => contactsSWRKey(), []);
  const { data: cachedContacts } = useSWR<Contact[]>(cachedContactsKey, null);
  const cachedContact = useMemo(() => (Array.isArray(cachedContacts) ? cachedContacts.find((c) => c.id === contactId) ?? null : null), [cachedContacts, contactId]);

  const contactKey = useMemo(() => ['contact_detail', host, contactId] as const, [contactId, host]);
  const {
    data: contact,
    error: contactError,
    mutate: mutateContact,
  } = useSWR<Contact | null>(contactKey, () => getContact(contactId), {
    fallbackData: cachedContact ?? undefined,
    revalidateOnMount: true,
  });

  const projectsKey = useMemo(() => ['contact_projects', host, contactId] as const, [contactId, host]);
  const {
    data: projectsData,
    error: projectsError,
  } = useSWR<Project[]>(projectsKey, () => listProjectsForContact(contactId), {
    revalidateOnMount: true,
  });

  const projects = projectsData ?? [];

  useEffect(() => {
    if (!contactError) return;
    const msg = contactError instanceof Error ? contactError.message : 'Failed to load contact.';
    setError(msg);
    toast.error(msg);
  }, [contactError, toast]);

  useEffect(() => {
    if (!projectsError) return;
    const msg = projectsError instanceof Error ? projectsError.message : 'Failed to load projects.';
    toast.error(msg);
  }, [projectsError, toast]);

  const canSave = useMemo(() => {
    if (!draft) return false;
    if (!draft.displayName.trim()) return false;
    if (!isValidOptionalEmail(draft.email)) return false;
    return true;
  }, [draft]);

  if (typeof contact === 'undefined') {
    return (
      <main className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Contact</h1>
            <p className={styles.subtitle}>Loading…</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.buttonSecondary} href="/staff/contacts">
              Back
            </Link>
          </div>
        </div>
        <p className={styles.note}>Loading contact details…</p>
      </main>
    );
  }

  if (!contact) {
    return (
      <main className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Contact</h1>
            <p className={styles.subtitle}>Not found.</p>
          </div>
          <div className={styles.actions}>
            <Link className={styles.buttonSecondary} href="/staff/contacts">
              Back
            </Link>
          </div>
        </div>
        <p className={styles.note}>This contact doesn’t exist in the portal database.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{contact.displayName}</h1>
          <p className={styles.subtitle}>Contact ID: {contact.id}</p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.buttonSecondary} href="/staff/contacts">
            Contacts
          </Link>
          <Link className={styles.button} href={`/staff/projects/new?contactId=${encodeURIComponent(contact.id)}`}>
            Create Project
          </Link>
        </div>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.section} aria-label="Contact info">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Contact Info</h2>
          <div className={styles.actions}>
            {isEditing ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!canSave}
                  onClick={async () => {
                    if (!draft) return;
                    setError(null);
                    try {
                      const updated = await updateContact(contactId, {
                        displayName: draft.displayName.trim(),
                        email: draft.email.trim(),
                        phone: draft.phone.trim(),
                      });
                      await mutateContact(updated, { revalidate: false });
                      setIsEditing(false);
                      setDraft(null);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to update contact';
                      setError(msg);
                    }
                  }}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  onClick={() => {
                    setIsEditing(false);
                    setDraft(null);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  setError(null);
                  setIsEditing(true);
                  setDraft({ displayName: contact.displayName, email: contact.email, phone: contact.phone });
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <th style={{ width: 180 }}>Name</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.displayName ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? { displayName: '', email: '', phone: '' }), displayName: e.target.value }))}
                        required
                      />
                    ) : (
                      contact.displayName
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.email ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? { displayName: '', email: '', phone: '' }), email: e.target.value }))}
                      />
                    ) : (
                      contact.email || '—'
                    )}
                    {isEditing && draft && !isValidOptionalEmail(draft.email) ? <p className={styles.error}>Email must include "@".</p> : null}
                  </td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft?.phone ?? ''}
                        onChange={(e) => setDraft((prev) => ({ ...(prev ?? { displayName: '', email: '', phone: '' }), phone: e.target.value }))}
                      />
                    ) : (
                      contact.phone || '—'
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Created</th>
                  <td>{new Date(contact.createdAt).toLocaleString()}</td>
                </tr>
                <tr>
                  <th>Updated</th>
                  <td>{new Date(contact.updatedAt).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-label="Projects for contact" style={{ marginTop: 14 }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Projects</h2>
        </div>
        <div className={styles.sectionBody}>
          {typeof projectsData === 'undefined' ? (
            <p className={styles.note}>Loading projects…</p>
          ) : projects.length ? (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Region</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id}>
                      <td>{p.projectName ?? p.name ?? '—'}</td>
                      <td className={styles.muted}>{p.region ?? '—'}</td>
                      <td className={styles.muted}>{new Date(p.createdAt).toLocaleString()}</td>
                      <td>
                        <Link className={styles.link} href={`/staff/projects/${encodeURIComponent(p.id)}`}>
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.note}>{projectsError ? 'Could not load projects.' : 'No projects linked to this contact yet.'}</p>
          )}
        </div>
      </section>
    </main>
  );
}
