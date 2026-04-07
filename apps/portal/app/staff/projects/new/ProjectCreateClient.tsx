'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { listContacts } from '@/lib/repo/contactsRepo';
import { createProject } from '@/lib/repo/projectsRepo';
import type { Contact } from '@/lib/types/contact';
import styles from '../projects.module.css';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { SupabaseRepoError } from '@/lib/supabase/repoError';
import { apiJson } from '@/lib/repo/apiClient';

type Draft = {
  contactId: string;
  projectName: string;
  quoteRef: string;
  region: string;
  siteAddress: string;
};

type ContactDraft = {
  displayName: string;
  email: string;
  phone: string;
};

function isValidOptionalEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

function upsertCreatedContact(list: Contact[], contact: Contact): Contact[] {
  const next = list.filter((entry) => entry.id !== contact.id);
  next.push(contact);
  next.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
  return next;
}

export default function ProjectCreateClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [draft, setDraft] = useState<Draft>({
    contactId: '',
    projectName: '',
    quoteRef: '',
    region: '',
    siteAddress: '',
  });
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [contactDraft, setContactDraft] = useState<ContactDraft>({ displayName: '', email: '', phone: '' });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [debugInsert, setDebugInsert] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await listContacts();
        if (cancelled) return;
        setContacts(next);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Failed to load contacts.';
        setSubmitError(msg);
        toast.error(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    const q = searchParams.get('contactId');
    if (!q) return;
    setDraft((prev) => ({ ...prev, contactId: q }));
  }, [searchParams]);

  const canSubmit = useMemo(() => draft.projectName.trim().length > 0 && draft.contactId.trim().length > 0, [draft.projectName, draft.contactId]);

  const setField = <K extends keyof Draft>(key: K, value: string) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const run = async (key: string, fn: () => void | Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="New Project"
        right={
          <HeaderActions>
            <Link className={styles.buttonSecondary} href="/staff/projects">
              Projects
            </Link>
          </HeaderActions>
        }
      />

      <section className={styles.section} aria-label="Project form">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Project Details</h2>
        </div>
        <div className={styles.sectionBody}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit) return;
              setSubmitError(null);

              run('createProject', () => {
                return (async () => {
                  try {
                    const project = await createProject({
                    contactId: draft.contactId.trim(),
                    projectName: draft.projectName.trim(),
                    quoteRef: draft.quoteRef.trim() || undefined,
                    region: draft.region.trim() || undefined,
                    siteAddress: draft.siteAddress.trim() || undefined,
                    });
                    await apiJson(`/api/staff/v1/projects/${encodeURIComponent(project.id)}/action/created`, { method: 'POST' }).catch(() => null);
                    toast.success('Project created.');
                    router.push(`/staff/projects/${encodeURIComponent(project.id)}`);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to create project';
                    setSubmitError(msg);
                    if (process.env.NODE_ENV !== 'production') {
                      const dbg = (globalThis as any).__SP_PROJECT_INSERT_DEBUG__ ?? null;
                      if (err instanceof SupabaseRepoError) {
                        setDebugInsert({
                          host: err.supabaseHost || supabaseHostFromUrl(supabaseRuntimeUrl()),
                          table: err.table,
                          postgrestUrl: err.postgrestUrl,
                          postgrestError: err.postgrestError,
                          payload: dbg?.payload ?? null,
                        });
                      } else {
                        setDebugInsert({
                          host: supabaseHostFromUrl(supabaseRuntimeUrl()),
                          payload: dbg?.payload ?? null,
                          error: err instanceof Error ? { message: err.message } : err,
                        });
                      }
                    }
                    toast.error(msg);
                  }
                })();
              });
            }}
          >
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label htmlFor="contactId">Primary contact *</label>
                <select
                  id="contactId"
                  value={draft.contactId}
                  onChange={(e) => setField('contactId', e.target.value)}
                  required
                >
                  <option value="">Select a contact…</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName}
                      {c.email ? ` (${c.email})` : ''}
                    </option>
                  ))}
                </select>

                <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 10 }}>
                  <button
                    type="button"
                    className={styles.buttonSecondary}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      setNewContactOpen((v) => !v);
                      setSubmitError(null);
                    }}
                  >
                    {newContactOpen ? 'Cancel new contact' : 'Create new contact'}
                  </button>
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="projectName">Project name *</label>
                <input id="projectName" value={draft.projectName} onChange={(e) => setField('projectName', e.target.value)} required />
              </div>
              <div className={styles.field}>
                <label htmlFor="quoteRef">Quote ref</label>
                <input id="quoteRef" value={draft.quoteRef} onChange={(e) => setField('quoteRef', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="region">Region</label>
                <input id="region" value={draft.region} onChange={(e) => setField('region', e.target.value)} />
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="siteAddress">Site address</label>
                <input id="siteAddress" value={draft.siteAddress} onChange={(e) => setField('siteAddress', e.target.value)} />
              </div>
            </div>

            {newContactOpen ? (
              <div className={styles.section} style={{ marginTop: 14 }}>
                <div className={styles.sectionHeader}>
                  <h3 className={styles.sectionTitle}>New Contact</h3>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.formGrid}>
                    <div className={styles.field}>
                      <label htmlFor="newContactName">Name *</label>
                      <input
                        id="newContactName"
                        value={contactDraft.displayName}
                        onChange={(e) => setContactDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="newContactEmail">Email</label>
                      <input
                        id="newContactEmail"
                        value={contactDraft.email}
                        onChange={(e) => setContactDraft((prev) => ({ ...prev, email: e.target.value }))}
                      />
                      {!isValidOptionalEmail(contactDraft.email) ? <p className={styles.error}>Email must include "@".</p> : null}
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="newContactPhone">Phone</label>
                      <input
                        id="newContactPhone"
                        value={contactDraft.phone}
                        onChange={(e) => setContactDraft((prev) => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 14 }}>
                    <button
                      type="button"
                      className={styles.button}
                      disabled={Boolean(busy) || !contactDraft.displayName.trim() || !isValidOptionalEmail(contactDraft.email)}
                      onClick={() => {
                        run('createContact', () => {
                          setSubmitError(null);
                          return (async () => {
                            try {
                              const res = await apiJson<{ contact: Contact }>('/api/contacts', {
                                method: 'POST',
                                body: JSON.stringify({
                                  displayName: contactDraft.displayName.trim(),
                                  email: contactDraft.email.trim(),
                                  phone: contactDraft.phone.trim(),
                                }),
                              });
                              setContacts((prev) => upsertCreatedContact(prev, res.contact));
                              setDraft((prev) => ({ ...prev, contactId: res.contact.id }));
                              setNewContactOpen(false);
                              setContactDraft({ displayName: '', email: '', phone: '' });
                              toast.success('Contact created.');
                            } catch (err) {
                              const msg = err instanceof Error ? err.message : 'Failed to create contact';
                              setSubmitError(msg);
                              toast.error(msg);
                            }
                          })();
                        });
                      }}
                    >
                      Create contact
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {submitError ? <p className={styles.error}>{submitError}</p> : null}
            {process.env.NODE_ENV !== 'production' && debugInsert ? (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer' }}>Project insert diagnostics (dev only)</summary>
                <pre style={{ marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, lineHeight: 1.4 }}>
                  {JSON.stringify(debugInsert, null, 2)}
                </pre>
              </details>
            ) : null}

            <div className={styles.actions} style={{ justifyContent: 'flex-start', marginTop: 14 }}>
              <button className={styles.button} type="submit" disabled={Boolean(busy) || !canSubmit}>
                {busy === 'createProject' ? 'Creating…' : 'Create Project'}
              </button>
              <Link className={styles.buttonSecondary} href="/staff/projects">
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
