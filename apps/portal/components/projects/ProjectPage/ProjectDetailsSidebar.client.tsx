'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { enqueueAndProcessLocalFirstMutation } from '@/lib/localFirst/queue';
import { discardLocalFirstEntityQueue } from '@/lib/localFirst/store';
import { useEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  buildProjectDetailsDraftEntityKey,
  buildProjectDetailsEntityKey,
  normalizeProjectDetailsDraft,
  patchProjectDetailsCaches,
  type PortalProjectDetailsDraft,
  type PortalProjectDetailsMutationPayload,
} from '@/lib/localFirst/portalEntities';

const AUTOSAVE_DELAY_MS = 700;

function toDraft(project: ProjectPageSnapshot['project']): PortalProjectDetailsDraft {
  return {
    contactName: project.contactName ?? '',
    contactEmail: project.contactEmail ?? '',
    contactPhone: project.contactPhone ?? '',
    projectName: project.name ?? '',
    siteAddress: project.siteAddress ?? '',
    region: project.region ?? '',
    quoteRef: project.quoteRef ?? '',
    nextActionDate: project.nextActionDate ?? '',
  };
}

function isValidYmd(value: string): boolean {
  if (!value.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function sameDraft(a: PortalProjectDetailsDraft, b: PortalProjectDetailsDraft): boolean {
  return JSON.stringify(normalizeProjectDetailsDraft(a)) === JSON.stringify(normalizeProjectDetailsDraft(b));
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

export default function ProjectDetailsSidebarClient({ project }: { project: ProjectPageSnapshot['project'] }) {
  const queryClient = useQueryClient();
  const hostKey = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PortalProjectDetailsDraft>(() => toDraft(project));
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastQueuedRef = useRef('');
  const draftRef = useRef(draft);

  const entityKey = useMemo(() => buildProjectDetailsEntityKey(project.id), [project.id]);
  const draftEntityKey = useMemo(() => buildProjectDetailsDraftEntityKey(project.id), [project.id]);
  const syncState = useEntitySyncState(entityKey);
  const workingCopy = useLocalWorkingCopy<PortalProjectDetailsDraft>(draftEntityKey, toDraft(project));
  const serverDraft = useMemo(() => normalizeProjectDetailsDraft(toDraft(project)), [project]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

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
    if (!draft.projectName.trim()) return false;
    if (!isValidYmd(draft.nextActionDate)) return false;
    return true;
  }, [draft]);

  const dirty = useMemo(() => !sameDraft(draft, serverDraft), [draft, serverDraft]);

  const flushDraft = useCallback(async () => {
    const nextDraft = normalizeProjectDetailsDraft(draftRef.current);
    if (!nextDraft.projectName.trim()) return false;
    if (!isValidYmd(nextDraft.nextActionDate)) return false;

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
    patchProjectDetailsCaches(queryClient, hostKey, project.id, nextDraft, {
      contactId: project.contactId ?? null,
    });
    await workingCopy.setWorkingCopy(nextDraft);

    const mutationPayload: PortalProjectDetailsMutationPayload = {
      projectId: project.id,
      contactId: project.contactId ?? null,
      draft: nextDraft,
    };
    await enqueueAndProcessLocalFirstMutation({
      entityKey,
      mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.projectDetailsUpdate,
      payload: mutationPayload,
    });
    return true;
  }, [entityKey, hostKey, project.contactId, project.id, queryClient, serverDraft, syncState.pendingCount, workingCopy]);

  useEffect(() => {
    if (!isEditing || !workingCopy.hydrated || !dirty || !canSave) return;
    if (timerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      void flushDraft().catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to save project details';
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
    (field: keyof PortalProjectDetailsDraft, value: string) => {
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
      const msg = err instanceof Error ? err.message : 'Failed to save project details';
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

  const statusText = syncLabel(syncState, dirty);
  const displayed = workingCopy.hasLocalCopy ? draft : serverDraft;

  return (
    <section className={legacy.section} aria-label="Project details">
      <div className={legacy.sectionHeader}>
        <h2 className={legacy.sectionTitle}>Details</h2>
        <div className={legacy.actions}>
          {statusText ? <span className={legacy.note}>{statusText}</span> : null}
          {isEditing ? (
            <>
              <button type="button" className={legacy.button} disabled={!canSave} onClick={handleDone}>
                Done
              </button>
              <button type="button" className={legacy.buttonSecondary} disabled={syncState.pendingCount > 0} onClick={handleReset}>
                Reset
              </button>
            </>
          ) : (
            <button type="button" className={legacy.buttonSecondary} onClick={() => setIsEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
      <div className={legacy.sectionBody}>
        {error ? <p className={legacy.error}>{error}</p> : null}

        {isEditing ? (
          <div className={legacy.formGrid}>
            <div className={legacy.field}>
              <label htmlFor="contactName">Contact</label>
              <input
                id="contactName"
                value={draft.contactName}
                onChange={(e) => updateDraftField('contactName', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="contactEmail">Email</label>
              <input
                id="contactEmail"
                value={draft.contactEmail}
                onChange={(e) => updateDraftField('contactEmail', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="contactPhone">Phone</label>
              <input
                id="contactPhone"
                value={draft.contactPhone}
                onChange={(e) => updateDraftField('contactPhone', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="projectName">Project name</label>
              <input
                id="projectName"
                value={draft.projectName}
                onChange={(e) => updateDraftField('projectName', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="siteAddress">Site address</label>
              <input
                id="siteAddress"
                value={draft.siteAddress}
                onChange={(e) => updateDraftField('siteAddress', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="region">Region</label>
              <input
                id="region"
                value={draft.region}
                onChange={(e) => updateDraftField('region', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="quoteRef">Quote ref</label>
              <input
                id="quoteRef"
                value={draft.quoteRef}
                onChange={(e) => updateDraftField('quoteRef', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
            </div>
            <div className={legacy.field}>
              <label htmlFor="nextActionDate">Next action date (YYYY-MM-DD)</label>
              <input
                id="nextActionDate"
                value={draft.nextActionDate}
                onChange={(e) => updateDraftField('nextActionDate', e.target.value)}
                onBlur={() => void flushDraft().catch(() => undefined)}
              />
              {!isValidYmd(draft.nextActionDate) ? <p className={legacy.error}>Invalid date format.</p> : null}
            </div>
          </div>
        ) : (
          <table className={legacy.table}>
            <tbody>
              <tr>
                <th>Contact</th>
                <td>{displayed.contactName || '—'}</td>
              </tr>
              <tr>
                <th>Email</th>
                <td className={`${legacy.muted} ${legacy.cellWrap}`}>{displayed.contactEmail || '—'}</td>
              </tr>
              <tr>
                <th>Phone</th>
                <td className={legacy.muted}>{displayed.contactPhone || '—'}</td>
              </tr>
              <tr>
                <th>Project name</th>
                <td>{displayed.projectName || '—'}</td>
              </tr>
              <tr>
                <th>Site address</th>
                <td className={legacy.cellWrap}>{displayed.siteAddress || '—'}</td>
              </tr>
              <tr>
                <th>Region</th>
                <td>{displayed.region || '—'}</td>
              </tr>
              <tr>
                <th>Quote ref</th>
                <td>{displayed.quoteRef || '—'}</td>
              </tr>
              <tr>
                <th>Next action</th>
                <td className={legacy.muted}>{displayed.nextActionDate || '—'}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
