'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import styles from '../../projects/projects.module.css';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import PageHeader from '@/components/layout/PageHeader';
import HeaderActions from '@/components/layout/HeaderActions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contactDetailQueryOptions } from '@/lib/queries/contacts';
import { projectsByContactQueryOptions } from '@/lib/queries/projects';
import { qk } from '@/lib/queries/keys';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import { discardLocalFirstEntityQueue } from '@/lib/localFirst/store';
import { useEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  buildContactDraftEntityKey,
  buildContactEntityKey,
  upsertContactCaches,
  type PortalContactDraft,
  type PortalContactUpdateMutationPayload,
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

function syncLabel(status: ReturnType<typeof useEntitySyncState>, dirty: boolean): string | null {
  if (status.status === 'conflict') return status.lastError ?? 'Needs review';
  if (status.status === 'offline') return 'Offline. Changes will sync when reconnected.';
  if (status.status === 'error') return status.lastError ?? 'Sync failed. Retrying…';
  if (status.pendingCount > 0 || status.status === 'syncing' || status.status === 'queued') return 'Syncing…';
  if (dirty) return 'Unsaved local edits';
  if (status.lastSyncedAt) return 'Saved';
  return null;
}

export default function ContactDetailClient({ contactId }: { contactId: string }) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PortalContactDraft>({ displayName: '', email: '', phone: '' });
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastQueuedRef = useRef('');
  const draftRef = useRef(draft);

  const queryClient = useQueryClient();
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const entityKey = useMemo(() => buildContactEntityKey(contactId), [contactId]);
  const draftEntityKey = useMemo(() => buildContactDraftEntityKey(contactId), [contactId]);
  const syncState = useEntitySyncState(entityKey);

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

  const workingCopy = useLocalWorkingCopy<PortalContactDraft>(draftEntityKey, contact ? toDraft(contact) : { displayName: '', email: '', phone: '' });
  const serverDraft = useMemo(() => (contact ? normalizeDraft(toDraft(contact)) : { displayName: '', email: '', phone: '' }), [contact]);

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
    if (!workingCopy.hydrated) return;
    if (workingCopy.hasLocalCopy) {
      setDraft(workingCopy.value);
      setIsEditing(true);
      return;
    }
    if (!isEditing) {
      setDraft(serverDraft);
      lastQueuedRef.current = JSON.stringify(serverDraft);
    }
  }, [isEditing, serverDraft, workingCopy.hasLocalCopy, workingCopy.hydrated, workingCopy.value]);

  useEffect(() => {
    if (!workingCopy.hasLocalCopy) return;
    if (syncState.pendingCount > 0) return;
    if (!sameDraft(workingCopy.value, serverDraft)) return;
    void workingCopy.clearWorkingCopy();
  }, [serverDraft, syncState.pendingCount, workingCopy]);

  useEffect(() => {
    if (syncState.status !== 'conflict') return;
    if (syncState.lastError) setError(syncState.lastError);
    void discardLocalFirstEntityQueue(entityKey);
  }, [entityKey, syncState.lastError, syncState.status]);

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

  const dirty = useMemo(() => !sameDraft(draft, serverDraft), [draft, serverDraft]);

  const flushDraft = useCallback(async () => {
    if (!contact) return false;
    const nextDraft = normalizeDraft(draftRef.current);
    if (!nextDraft.displayName.trim()) return false;
    if (!isValidOptionalEmail(nextDraft.email)) return false;

    const serialized = JSON.stringify(nextDraft);
    if (serialized === JSON.stringify(serverDraft)) {
      lastQueuedRef.current = serialized;
      if (workingCopy.hasLocalCopy && syncState.pendingCount === 0) {
        await workingCopy.clearWorkingCopy();
      }
      return true;
    }

    if (serialized === lastQueuedRef.current && syncState.pendingCount > 0) {
      return true;
    }

    lastQueuedRef.current = serialized;
    setError(null);
    upsertContactCaches(queryClient, host, {
      ...contact,
      displayName: nextDraft.displayName,
      email: nextDraft.email,
      phone: nextDraft.phone,
      updatedAt: new Date().toISOString(),
    });
    await workingCopy.setWorkingCopy(nextDraft);

    const mutationPayload: PortalContactUpdateMutationPayload = {
      contactId,
      draft: nextDraft,
    };
    await enqueueAndProcessLocalFirstMutation({
      entityKey,
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.contactUpdate,
      payload: mutationPayload,
    });
    return true;
  }, [contact, contactId, entityKey, host, queryClient, serverDraft, syncState.pendingCount, workingCopy]);

  useEffect(() => {
    if (!isEditing || !workingCopy.hydrated || !dirty || !canSave) return;
    if (timerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void flushDraft().catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to update contact';
        setError(msg);
      });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [canSave, dirty, flushDraft, isEditing, workingCopy.hydrated]);

  const updateDraftField = useCallback(
    (field: keyof PortalContactDraft, value: string) => {
      setError(null);
      setDraft((prev) => {
        const next = { ...prev, [field]: value };
        void workingCopy.setWorkingCopy(next);
        return next;
      });
    },
    [workingCopy],
  );

  const handleDone = async () => {
    if (!canSave) return;
    try {
      await flushDraft();
      setIsEditing(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update contact';
      setError(msg);
    }
  };

  const handleReset = async () => {
    if (syncState.pendingCount > 0) return;
    setError(null);
    setDraft(serverDraft);
    lastQueuedRef.current = JSON.stringify(serverDraft);
    await workingCopy.clearWorkingCopy();
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

  const statusText = syncLabel(syncState, dirty);
  const displayed = workingCopy.hasLocalCopy ? draft : serverDraft;

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
                  disabled={!canSave}
                  onClick={handleDone}
                >
                  Done
                </button>
                <button
                  type="button"
                  className={styles.buttonSecondary}
                  disabled={syncState.pendingCount > 0}
                  onClick={() => void handleReset()}
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
