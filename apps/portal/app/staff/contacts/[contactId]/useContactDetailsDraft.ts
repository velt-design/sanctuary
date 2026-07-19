'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  buildContactDetailsEntityKey,
  normalizeContactDetailsDraft,
  patchContactDetailsCaches,
  type PortalContactDetailsDraft,
  type PortalContactDetailsUpdateMutationPayload,
} from '@/lib/localFirst/contactDetails';
import { PORTAL_LOCAL_FIRST_MUTATIONS } from '@/lib/localFirst/portalEntities';
import {
  enqueueAndProcessLocalFirstMutation,
  retryLocalFirstEntityMutation,
} from '@/lib/localFirst/queue';
import { useAliasedEntitySyncState } from '@/lib/localFirst/useEntitySyncState';
import { useLocalWorkingCopy } from '@/lib/localFirst/useLocalWorkingCopy';
import type { Contact } from '@/lib/types/contact';

const CONTACT_DETAILS_AUTOSAVE_DELAY_MS = 700;

function toDraft(contact: Contact): PortalContactDetailsDraft {
  return normalizeContactDetailsDraft({
    displayName: contact.displayName,
    email: contact.email,
    phone: contact.phone,
  });
}

export function isValidOptionalContactEmail(email: string): boolean {
  if (!email.trim()) return true;
  return email.includes('@');
}

function sameDraft(left: PortalContactDetailsDraft, right: PortalContactDetailsDraft): boolean {
  return JSON.stringify(normalizeContactDetailsDraft(left)) === JSON.stringify(normalizeContactDetailsDraft(right));
}

function syncLabel(args: {
  status: 'idle' | 'queued' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';
  dirty: boolean;
  lastSyncedAt?: string;
}): string | null {
  if (args.status === 'queued' || args.status === 'syncing') return 'Saving...';
  if (args.status === 'offline') return 'Saved on this device';
  if (args.status === 'error' || args.status === 'conflict') return 'Save needs attention';
  if (args.dirty) return 'Unsaved edits';
  if (args.status === 'synced' || args.lastSyncedAt) return 'Saved';
  return null;
}

export function useContactDetailsDraft(contact: Contact, hostKey: string) {
  const queryClient = useQueryClient();
  const entityKey = useMemo(() => buildContactDetailsEntityKey(contact.id), [contact.id]);
  const serverDraft = useMemo(
    () => toDraft(contact),
    [contact.displayName, contact.email, contact.phone],
  );
  const workingCopy = useLocalWorkingCopy<PortalContactDetailsDraft>(entityKey, serverDraft);
  const syncState = useAliasedEntitySyncState(contact.id, buildContactDetailsEntityKey, entityKey);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<PortalContactDetailsDraft>(serverDraft);
  const [confirmedDraft, setConfirmedDraft] = useState<PortalContactDetailsDraft>(serverDraft);
  const [hasLocalIntent, setHasLocalIntent] = useState(false);
  const [enqueueError, setEnqueueError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const draftRef = useRef(draft);
  const lastQueuedContactRef = useRef(contact);
  const lastQueuedDraftRef = useRef(serverDraft);
  const lastEnqueuedSerializedRef = useRef<string | null>(null);
  const hydratedEntityRef = useRef<string | null>(null);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (workingCopy.hasLocalCopy || syncState.pendingCount > 0 || syncState.status === 'conflict') return;
    setConfirmedDraft(serverDraft);
    lastQueuedContactRef.current = contact;
    lastQueuedDraftRef.current = serverDraft;
    if (!isEditing) {
      setDraft(serverDraft);
      draftRef.current = serverDraft;
      setHasLocalIntent(false);
    }
  }, [contact, isEditing, serverDraft, syncState.pendingCount, syncState.status, workingCopy.hasLocalCopy]);

  useEffect(() => {
    if (!workingCopy.hydrated || hydratedEntityRef.current === entityKey) return;
    hydratedEntityRef.current = entityKey;
    if (!workingCopy.hasLocalCopy) return;
    const restored = normalizeContactDetailsDraft(workingCopy.value);
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
    () => Boolean(draft.displayName.trim()) && isValidOptionalContactEmail(draft.email),
    [draft],
  );
  const dirty = useMemo(() => !sameDraft(draft, confirmedDraft), [confirmedDraft, draft]);

  const persistDraft = useCallback(async (candidate: PortalContactDetailsDraft) => {
    const nextDraft = normalizeContactDetailsDraft(candidate);
    if (!nextDraft.displayName || !isValidOptionalContactEmail(nextDraft.email)) return false;

    const serialized = JSON.stringify(nextDraft);
    if (serialized === lastEnqueuedSerializedRef.current) return true;
    if (sameDraft(nextDraft, confirmedDraft) && syncState.pendingCount === 0) {
      await workingCopy.clearWorkingCopy();
      setHasLocalIntent(false);
      return true;
    }

    const previousContact = lastQueuedContactRef.current;
    const optimisticContact = patchContactDetailsCaches(queryClient, hostKey, previousContact, nextDraft);
    lastQueuedContactRef.current = optimisticContact;
    lastQueuedDraftRef.current = nextDraft;
    lastEnqueuedSerializedRef.current = serialized;
    setEnqueueError(null);
    setHasLocalIntent(true);

    try {
      await workingCopy.setWorkingCopy(nextDraft);
      const payload: PortalContactDetailsUpdateMutationPayload = {
        contactId: contact.id,
        draft: nextDraft,
        previousContact,
      };
      await enqueueAndProcessLocalFirstMutation({
        entityKey,
        mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.contactDetailsUpdate,
        payload,
      });
      return true;
    } catch (error) {
      if (sameDraft(lastQueuedDraftRef.current, nextDraft)) {
        lastQueuedContactRef.current = previousContact;
        lastQueuedDraftRef.current = toDraft(previousContact);
      }
      if (lastEnqueuedSerializedRef.current === serialized) {
        lastEnqueuedSerializedRef.current = null;
      }
      setEnqueueError(error instanceof Error ? error.message : 'Could not queue contact details.');
      return false;
    }
  }, [confirmedDraft, contact.id, entityKey, hostKey, queryClient, syncState.pendingCount, workingCopy]);

  useEffect(() => {
    if (!isEditing || !dirty || !canSave) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void persistDraft(draftRef.current);
    }, CONTACT_DETAILS_AUTOSAVE_DELAY_MS);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canSave, dirty, isEditing, persistDraft]);

  const updateDraftField = useCallback((field: keyof PortalContactDetailsDraft, value: string) => {
    const nextDraft = { ...draftRef.current, [field]: value };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setHasLocalIntent(true);
    setEnqueueError(null);
    void workingCopy.setWorkingCopy(normalizeContactDetailsDraft(nextDraft));
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
      ? normalizeContactDetailsDraft(workingCopy.value)
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
    const retryDraft = normalizeContactDetailsDraft(workingCopy.value);
    setDraft(retryDraft);
    draftRef.current = retryDraft;
    setHasLocalIntent(true);
    patchContactDetailsCaches(queryClient, hostKey, lastQueuedContactRef.current, retryDraft);
    const retried = await retryLocalFirstEntityMutation(entityKey);
    if (!retried) {
      lastEnqueuedSerializedRef.current = null;
      await persistDraft(retryDraft);
    }
  }, [entityKey, hostKey, persistDraft, queryClient, workingCopy.value]);

  const reviewLocalDraft = useCallback(() => {
    const localDraft = normalizeContactDetailsDraft(workingCopy.value);
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
