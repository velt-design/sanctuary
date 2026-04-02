'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '@/lib/types/contact';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactDetailQueryOptions } from '@/lib/queries/contacts';
import { projectsByContactQueryOptions } from '@/lib/queries/projects';
import { qk } from '@/lib/queries/keys';
import { apiJson } from '@/lib/repo/apiClient';
import {
  upsertContactCaches,
  type PortalContactDraft,
} from '@/lib/localFirst/portalEntities';

const AUTOSAVE_DELAY_MS = 700;

function toDraft(contact: Contact): PortalContactDraft {
  return {
    displayName: contact.displayName,
    email: contact.email,
    phone: contact.phone,
  };
}

function normalizeDraft(draft: PortalContactDraft): PortalContactDraft {
  return {
    displayName: draft.displayName.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
  };
}

function isValidOptionalEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

function sameDraft(a: PortalContactDraft, b: PortalContactDraft): boolean {
  return JSON.stringify(normalizeDraft(a)) === JSON.stringify(normalizeDraft(b));
}

function saveLabel(args: { dirty: boolean; isSaving: boolean; lastSavedAt: string | null }): string | null {
  if (args.isSaving) return 'Saving…';
  if (args.dirty) return 'Unsaved edits';
  if (args.lastSavedAt) return 'Saved';
  return null;
}

export function buildContactUpdateRequest(contactId: string, draft: PortalContactDraft) {
  return {
    path: `/api/contacts/${encodeURIComponent(contactId)}`,
    body: JSON.stringify(normalizeDraft(draft)),
  };
}

const EMPTY_CONTACT_DRAFT: PortalContactDraft = { displayName: '', email: '', phone: '' };

export default function ContactDetailClient({ contactId }: { contactId: string }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PortalContactDraft>(EMPTY_CONTACT_DRAFT);
  const [savedDraft, setSavedDraft] = useState<PortalContactDraft>(EMPTY_CONTACT_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const inFlightSerializedRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  const queryClient = useQueryClient();
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  const cachedContacts = queryClient.getQueryData<Contact[]>(qk.contacts.list(host));
  const cachedContact = useMemo(
    () => (Array.isArray(cachedContacts) ? cachedContacts.find((c) => c.id === contactId) ?? null : null),
    [cachedContacts, contactId],
  );

  const {
    data: contact,
    error: contactError,
  } = useQuery({
    ...contactDetailQueryOptions(host, contactId),
    initialData: cachedContact ?? undefined,
  });

  const { data: projectsData, error: projectsError } = useQuery(projectsByContactQueryOptions(host, contactId));
  const projects = projectsData ?? [];

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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

  useEffect(() => {
    const nextSavedDraft = contact ? normalizeDraft(toDraft(contact)) : EMPTY_CONTACT_DRAFT;
    setSavedDraft(nextSavedDraft);
    if (!isEditing) {
      setDraft(nextSavedDraft);
    }
  }, [contact, isEditing]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null && typeof window !== 'undefined') {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const canSave = useMemo(() => {
    if (!draft.displayName.trim()) return false;
    if (!isValidOptionalEmail(draft.email)) return false;
    return true;
  }, [draft]);

  const dirty = useMemo(() => !sameDraft(draft, savedDraft), [draft, savedDraft]);

  const flushDraft = useCallback(async () => {
    if (!contact) return false;
    const nextDraft = normalizeDraft(draftRef.current);
    if (!nextDraft.displayName.trim()) return false;
    if (!isValidOptionalEmail(nextDraft.email)) return false;

    const serialized = JSON.stringify(nextDraft);
    const savedSerialized = JSON.stringify(savedDraft);
    if (serialized === savedSerialized) {
      return true;
    }

    if (inFlightSerializedRef.current === serialized && savePromiseRef.current) {
      return savePromiseRef.current;
    }

    const previousContact = contact;
    const request = buildContactUpdateRequest(contactId, nextDraft);

    upsertContactCaches(queryClient, host, {
      ...contact,
      displayName: nextDraft.displayName,
      email: nextDraft.email,
      phone: nextDraft.phone,
      updatedAt: new Date().toISOString(),
    });

    setError(null);
    setIsSaving(true);

    const savePromise = apiJson<{ contact: Contact }>(request.path, {
      method: 'PATCH',
      body: request.body,
    })
      .then((res) => {
        if (!res.contact) throw new Error('Contact not saved');
        upsertContactCaches(queryClient, host, res.contact);
        setSavedDraft(nextDraft);
        setLastSavedAt(new Date().toISOString());
        return true;
      })
      .catch((err) => {
        upsertContactCaches(queryClient, host, previousContact);
        const msg = err instanceof Error ? err.message : 'Failed to update contact';
        setError(msg);
        throw err;
      })
      .finally(() => {
        setIsSaving(false);
        if (inFlightSerializedRef.current === serialized) {
          inFlightSerializedRef.current = null;
          savePromiseRef.current = null;
        }
      });

    inFlightSerializedRef.current = serialized;
    savePromiseRef.current = savePromise;
    return savePromise;
  }, [contact, contactId, host, queryClient, savedDraft]);

  useEffect(() => {
    if (!isEditing || !dirty || !canSave) return;
    if (timerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void flushDraft().catch(() => undefined);
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [canSave, dirty, flushDraft, isEditing]);

  const updateDraftField = useCallback((field: keyof PortalContactDraft, value: string) => {
    setError(null);
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleDone = async () => {
    if (!canSave) return;
    try {
      await flushDraft();
      setIsEditing(false);
    } catch {
      // Error state is already set in flushDraft.
    }
  };

  const handleReset = () => {
    if (isSaving) return;
    setError(null);
    setDraft(savedDraft);
    setIsEditing(false);
  };

  if (typeof contact === 'undefined') {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Contact"
          right={
            <HeaderActions>
              <Link className={styles.buttonSecondary} href="/staff/contacts">
                Contacts
              </Link>
            </HeaderActions>
          }
        />
        <p className={styles.note}>Loading contact details…</p>
      </main>
    );
  }

  if (!contact) {
    return (
      <main className={styles.page}>
        <PageHeader
          title="Contact"
          right={
            <HeaderActions>
              <Link className={styles.buttonSecondary} href="/staff/contacts">
                Contacts
              </Link>
            </HeaderActions>
          }
        />
        <p className={styles.note}>This contact doesn’t exist in the portal database.</p>
      </main>
    );
  }

  const statusText = saveLabel({ dirty, isSaving, lastSavedAt });
  const displayed = isEditing ? draft : savedDraft;

  return (
    <main className={styles.page}>
      <PageHeader
        title={contact.displayName}
        right={
          <HeaderActions>
            <Link className={styles.buttonSecondary} href="/staff/contacts">
              Contacts
            </Link>
            <Link className={styles.button} href={`/staff/projects/new?contactId=${encodeURIComponent(contact.id)}`}>
              Create Project
            </Link>
          </HeaderActions>
        }
      />
      <div className="mt-1 mb-3 text-xs text-zinc-500">Contact ID: {contact.id}</div>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.section} aria-label="Contact info">
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Contact Info</h2>
          <div className={styles.actions}>
            {statusText ? <span className={styles.note}>{statusText}</span> : null}
            {isEditing ? (
              <>
                <button
                  type="button"
                  className={styles.button}
                  disabled={!canSave || isSaving}
                  onClick={handleDone}
                >
                  {isSaving ? 'Saving…' : 'Done'}
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={isSaving}
                  onClick={handleReset}
                >
                  Reset
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.buttonSecondary}
                onClick={() => {
                  setError(null);
                  setIsEditing(true);
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
                        value={draft.displayName}
                        onChange={(e) => updateDraftField('displayName', e.target.value)}
                        onBlur={() => void flushDraft().catch(() => undefined)}
                        required
                      />
                    ) : (
                      displayed.displayName
                    )}
                  </td>
                </tr>
                <tr>
                  <th>Email</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft.email}
                        onChange={(e) => updateDraftField('email', e.target.value)}
                        onBlur={() => void flushDraft().catch(() => undefined)}
                      />
                    ) : (
                      displayed.email || '—'
                    )}
                    {isEditing && !isValidOptionalEmail(draft.email) ? <p className={styles.error}>Email must include "@".</p> : null}
                  </td>
                </tr>
                <tr>
                  <th>Phone</th>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.inlineInput}
                        value={draft.phone}
                        onChange={(e) => updateDraftField('phone', e.target.value)}
                        onBlur={() => void flushDraft().catch(() => undefined)}
                      />
                    ) : (
                      displayed.phone || '—'
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
