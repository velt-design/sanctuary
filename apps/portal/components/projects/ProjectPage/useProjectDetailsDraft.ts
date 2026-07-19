'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
} from '@/lib/localFirst/portalEntities';
import {
  buildProjectDetailsEntityKey,
  normalizeProjectDetailsDraft,
  patchProjectDetailsCaches,
  type PortalProjectDetailsDraft,
  type PortalProjectDetailsUpdateMutationPayload,
} from '@/lib/localFirst/projectDetails';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import { useAliasedEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import {
  enqueueAndProcessLocalFirstMutation,
  retryLocalFirstEntityMutation,
} from '@/lib/localFirst/queue';

const PROJECT_DETAILS_AUTOSAVE_DELAY_MS = 700;

function toDraft(project: ProjectPageSnapshot['project']): PortalProjectDetailsDraft {
  return normalizeProjectDetailsDraft({
    contactName: project.contactName ?? '',
    contactEmail: project.contactEmail ?? '',
    contactPhone: project.contactPhone ?? '',
    projectName: project.name ?? '',
    siteAddress: project.siteAddress ?? '',
    region: project.region ?? '',
    quoteRef: project.quoteRef ?? '',
    nextActionDate: project.nextActionDate ?? '',
  });
}

export function isValidProjectDetailsYmd(value: string): boolean {
  if (!value.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

function sameDraft(a: PortalProjectDetailsDraft, b: PortalProjectDetailsDraft): boolean {
  return JSON.stringify(normalizeProjectDetailsDraft(a)) === JSON.stringify(normalizeProjectDetailsDraft(b));
}

function syncLabel(args: {
  status: 'idle' | 'queued' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
  dirty: boolean;
  lastSyncedAt?: string;
}): string | null {
  if (args.status === 'queued' || args.status === 'syncing') return 'Saving…';
  if (args.status === 'offline') return 'Saved on this device';
  if (args.status === 'error' || args.status === 'conflict') return 'Save needs attention';
  if (args.dirty) return 'Unsaved edits';
  if (args.status === 'synced' || args.lastSyncedAt) return 'Saved';
  return null;
}

export function useProjectDetailsDraft(project: ProjectPageSnapshot['project']) {
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const entityKey = useMemo(() => buildProjectDetailsEntityKey(project.id), [project.id]);
  const serverDraft = useMemo(
    () => toDraft(project),
    [project.contactEmail, project.contactName, project.contactPhone, project.name, project.nextActionDate, project.quoteRef, project.region, project.siteAddress],
  );
  const workingCopy = useLocalWorkingCopy<PortalProjectDetailsDraft>(entityKey, serverDraft);
  const syncState = useAliasedEntitySyncState(project.id, buildProjectDetailsEntityKey, entityKey);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PortalProjectDetailsDraft>(serverDraft);
  const [confirmedDraft, setConfirmedDraft] = useState<PortalProjectDetailsDraft>(serverDraft);
  const [hasLocalIntent, setHasLocalIntent] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const lastQueuedDraftRef = useRef(serverDraft);
  const lastEnqueuedSerializedRef = useRef<string | null>(null);
  const hydratedEntityRef = useRef<string | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    setConfirmedDraft(serverDraft);
    if (!isEditing && !workingCopy.hasLocalCopy && syncState.pendingCount === 0) {
      setDraft(serverDraft);
      draftRef.current = serverDraft;
      lastQueuedDraftRef.current = serverDraft;
      setHasLocalIntent(false);
    }
  }, [isEditing, serverDraft, syncState.pendingCount, workingCopy.hasLocalCopy]);

  useEffect(() => {
    if (!workingCopy.hydrated || hydratedEntityRef.current === entityKey) return;
    hydratedEntityRef.current = entityKey;
    if (!workingCopy.hasLocalCopy) return;
    const restored = normalizeProjectDetailsDraft(workingCopy.value);
    setDraft(restored);
    draftRef.current = restored;
    lastQueuedDraftRef.current = restored;
    setHasLocalIntent(true);
  }, [entityKey, workingCopy.hasLocalCopy, workingCopy.hydrated, workingCopy.value]);

  useEffect(() => {
    if (syncState.status !== 'synced' || syncState.pendingCount !== 0) return;
    const confirmed = lastQueuedDraftRef.current;
    setConfirmedDraft(confirmed);
    if (!workingCopy.hasLocalCopy) {
      setHasLocalIntent(false);
      if (!isEditing) {
        setDraft(confirmed);
        draftRef.current = confirmed;
      }
    }
  }, [isEditing, syncState.pendingCount, syncState.status, workingCopy.hasLocalCopy]);

  useEffect(() => () => {
    if (timerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerRef.current);
    }
  }, []);

  const canSave = useMemo(
    () => Boolean(draft.projectName.trim()) && isValidProjectDetailsYmd(draft.nextActionDate),
    [draft],
  );
  const dirty = useMemo(() => !sameDraft(draft, confirmedDraft), [confirmedDraft, draft]);

  const persistDraft = useCallback(async (candidate: PortalProjectDetailsDraft) => {
    const nextDraft = normalizeProjectDetailsDraft(candidate);
    if (!nextDraft.projectName || !isValidProjectDetailsYmd(nextDraft.nextActionDate)) return false;

    const serialized = JSON.stringify(nextDraft);
    if (serialized === lastEnqueuedSerializedRef.current) return true;
    if (sameDraft(nextDraft, confirmedDraft) && syncState.pendingCount === 0) {
      await workingCopy.clearWorkingCopy();
      setHasLocalIntent(false);
      return true;
    }

    const previousDraft = lastQueuedDraftRef.current;
    lastQueuedDraftRef.current = nextDraft;
    lastEnqueuedSerializedRef.current = serialized;
    setEnqueueError(null);
    setHasLocalIntent(true);
    patchProjectDetailsCaches(queryClient, hostKey, project.id, nextDraft, {
      contactId: project.contactId ?? null,
    });

    try {
      await workingCopy.setWorkingCopy(nextDraft);
      const payload: PortalProjectDetailsUpdateMutationPayload = {
        projectId: project.id,
        contactId: project.contactId ?? null,
        draft: nextDraft,
        previousDraft,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey,
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.projectDetailsUpdate,
        payload,
      });
      return true;
    } catch (error) {
      if (sameDraft(lastQueuedDraftRef.current, nextDraft)) {
        lastQueuedDraftRef.current = previousDraft;
      }
      if (lastEnqueuedSerializedRef.current === serialized) {
        lastEnqueuedSerializedRef.current = null;
      }
      setEnqueueError(error instanceof Error ? error.message : 'Could not queue project details.');
      return false;
    }
  }, [confirmedDraft, entityKey, hostKey, project.contactId, project.id, queryClient, syncState.pendingCount, workingCopy]);

  useEffect(() => {
    if (!isEditing || !dirty || !canSave) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void persistDraft(draftRef.current);
    }, PROJECT_DETAILS_AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canSave, dirty, isEditing, persistDraft]);

  const updateDraftField = useCallback((field: keyof PortalProjectDetailsDraft, value: string) => {
    const nextDraft = { ...draftRef.current, [field]: value };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setHasLocalIntent(true);
    setEnqueueError(null);
    void workingCopy.setWorkingCopy(normalizeProjectDetailsDraft(nextDraft));
  }, [workingCopy]);

  const finishEditing = useCallback(() => {
    if (!canSave) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsEditing(false);
    void persistDraft(draftRef.current);
  }, [canSave, persistDraft]);

  const saveCurrentDraft = useCallback(() => {
    if (!canSave) return;
    void persistDraft(draftRef.current);
  }, [canSave, persistDraft]);

  const resetEditing = useCallback(() => {
    if (syncState.status === 'syncing') return;
    setEnqueueError(null);
    const resetDraft = syncState.pendingCount > 0 || workingCopy.hasLocalCopy
      ? normalizeProjectDetailsDraft(workingCopy.value)
      : confirmedDraft;
    setDraft(resetDraft);
    draftRef.current = resetDraft;
    setIsEditing(false);
    if (syncState.pendingCount === 0 && !workingCopy.hasLocalCopy) {
      setHasLocalIntent(false);
    }
  }, [confirmedDraft, syncState.pendingCount, syncState.status, workingCopy.hasLocalCopy, workingCopy.value]);

  const retry = useCallback(async () => {
    setEnqueueError(null);
    const retryDraft = normalizeProjectDetailsDraft(workingCopy.value);
    setDraft(retryDraft);
    draftRef.current = retryDraft;
    setHasLocalIntent(true);
    patchProjectDetailsCaches(queryClient, hostKey, project.id, retryDraft, {
      contactId: project.contactId ?? null,
    });
    const retried = await retryLocalFirstEntityMutation(entityKey);
    if (!retried) {
      lastEnqueuedSerializedRef.current = null;
      await persistDraft(retryDraft);
    }
  }, [entityKey, hostKey, persistDraft, project.contactId, project.id, queryClient, workingCopy.value]);

  const reviewLocalDraft = useCallback(() => {
    const localDraft = normalizeProjectDetailsDraft(workingCopy.value);
    setDraft(localDraft);
    draftRef.current = localDraft;
    setIsEditing(true);
  }, [workingCopy.value]);

  const hasTerminalConflict = syncState.status === 'conflict';
  const displayed = isEditing
    ? draft
    : hasTerminalConflict
      ? confirmedDraft
      : hasLocalIntent || workingCopy.hasLocalCopy
        ? draft
        : confirmedDraft;
  const error = enqueueError ?? syncState.lastError ?? null;
  const canRetry = Boolean(enqueueError) || syncState.status === 'offline' || syncState.status === 'error' || hasTerminalConflict;

  return {
    canRetry,
    canSave,
    dirty,
    displayed,
    draft,
    error,
    finishEditing,
    isEditing,
    isSaving: syncState.status === 'queued' || syncState.status === 'syncing',
    resetEditing,
    retry,
    reviewLocalDraft,
    saveCurrentDraft,
    setIsEditing,
    statusText: syncLabel({ status: syncState.status, dirty, lastSyncedAt: syncState.lastSyncedAt }),
    updateDraftField,
  };
}
