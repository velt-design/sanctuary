'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import { apiJson } from '@/lib/repo/apiClient';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import {
  normalizeProjectDetailsDraft,
  patchProjectDetailsCaches,
  type PortalProjectDetailsDraft,
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

function saveLabel(args: { dirty: boolean; isSaving: boolean; lastSavedAt: string | null }): string | null {
  if (args.isSaving) return 'Saving…';
  if (args.dirty) return 'Unsaved edits';
  if (args.lastSavedAt) return 'Saved';
  return null;
}

export function buildProjectDetailsRequest(projectId: string, contactId: string | null, draft: PortalProjectDetailsDraft) {
  return {
    path: `/api/projects/${encodeURIComponent(projectId)}/details`,
    body: JSON.stringify({
      project: {
        name: draft.projectName,
        siteAddress: draft.siteAddress,
        region: draft.region,
        quoteRef: draft.quoteRef,
        nextActionDate: draft.nextActionDate,
      },
      contact: {
        name: draft.contactName,
        email: draft.contactEmail,
        phone: draft.contactPhone,
      },
      contactId,
    }),
  };
}

export default function ProjectDetailsSidebarClient({ project }: { project: ProjectPageSnapshot['project'] }) {
  const queryClient = useQueryClient();
  const hostKey = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PortalProjectDetailsDraft>(() => toDraft(project));
  const [savedDraft, setSavedDraft] = useState<PortalProjectDetailsDraft>(() => normalizeProjectDetailsDraft(toDraft(project)));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const inFlightSerializedRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const nextSavedDraft = normalizeProjectDetailsDraft(toDraft(project));
    setSavedDraft(nextSavedDraft);
    if (!isEditing) {
      setDraft(nextSavedDraft);
    }
  }, [isEditing, project]);

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

  const dirty = useMemo(() => !sameDraft(draft, savedDraft), [draft, savedDraft]);

  const flushDraft = useCallback(async () => {
    const nextDraft = normalizeProjectDetailsDraft(draftRef.current);
    if (!nextDraft.projectName.trim()) return false;
    if (!isValidYmd(nextDraft.nextActionDate)) return false;

    const serialized = JSON.stringify(nextDraft);
    const savedSerialized = JSON.stringify(savedDraft);
    if (serialized === savedSerialized) {
      return true;
    }

    if (inFlightSerializedRef.current === serialized && savePromiseRef.current) {
      return savePromiseRef.current;
    }

    const previousSavedDraft = savedDraft;
    const request = buildProjectDetailsRequest(project.id, project.contactId ?? null, nextDraft);
    patchProjectDetailsCaches(queryClient, hostKey, project.id, nextDraft, {
      contactId: project.contactId ?? null,
    });

    setError(null);
    setIsSaving(true);

    const savePromise = apiJson(request.path, {
      method: 'PATCH',
      body: request.body,
    })
      .then(async () => {
        setSavedDraft(nextDraft);
        setLastSavedAt(new Date().toISOString());
        await invalidateProjectReadCaches(queryClient, hostKey, project.id);
        return true;
      })
      .catch((err) => {
        patchProjectDetailsCaches(queryClient, hostKey, project.id, previousSavedDraft, {
          contactId: project.contactId ?? null,
        });
        const msg = err instanceof Error ? err.message : 'Failed to save project details';
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
  }, [hostKey, project.contactId, project.id, queryClient, savedDraft]);

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

  const updateDraftField = useCallback((field: keyof PortalProjectDetailsDraft, value: string) => {
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

  const statusText = saveLabel({ dirty, isSaving, lastSavedAt });
  const displayed = isEditing ? draft : savedDraft;

  return (
    <section className={legacy.section} aria-label="Project details">
      <div className={legacy.sectionHeader}>
        <h2 className={legacy.sectionTitle}>Details</h2>
        <div className={legacy.actions}>
          {statusText ? <span className={legacy.note}>{statusText}</span> : null}
          {isEditing ? (
            <>
              <button type="button" className={legacy.button} disabled={!canSave || isSaving} onClick={handleDone}>
                {isSaving ? 'Saving…' : 'Done'}
              </button>
              <button type="button" className={legacy.buttonSecondary} disabled={isSaving} onClick={handleReset}>
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
