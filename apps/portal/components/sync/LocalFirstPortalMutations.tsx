'use client';

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { qk } from '@/lib/queries/keys';
import { invalidateContactsIndexCaches } from '@/lib/queries/contactsIndex';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { enqueueAndProcessLocalFirstMutation, registerLocalFirstMutationHandler } from '@/lib/localFirst/queue';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  type PortalDesignRequestCreateMutationPayload,
  type PortalEstimateCreateMutationPayload,
  type PortalEstimateNotesMutationPayload,
  type PortalEstimateUpdateMutationPayload,
  type PortalProjectNoteCreateMutationPayload,
  type PortalProjectNoteDeleteMutationPayload,
  type PortalProjectNoteUpdateMutationPayload,
  type PortalQuoteCreateMutationPayload,
  type PortalQuoteUpdateMutationPayload,
  buildDesignRequestEntityKey,
  isLocalProjectNoteId,
  removeProjectNoteFromSnapshot,
  replaceEstimateDetailCache,
  replaceProjectNoteInSnapshot,
  replaceQuoteDetailCache,
  upsertContactCaches,
  upsertEstimateDetailCache,
  upsertQuoteDetailCache,
} from '@/lib/localFirst/portalEntities';
import {
  type PortalContactDetailsUpdateMutationPayload,
} from '@/lib/localFirst/contactDetails';
import {
  patchProjectDetailsCaches,
  type PortalProjectDetailsUpdateMutationPayload,
} from '@/lib/localFirst/projectDetails';
import { registerLocalFirstIdAlias, resolveLocalFirstId } from '@/lib/localFirst/store';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { ProjectNote } from '@/lib/projects/types';
import type { QuoteVersionDetail } from '@/lib/quotes/types';
import type { Contact } from '@/lib/types/contact';

function isEstimateConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function isEstimateBlockedConflict(error: unknown): error is ApiError {
  return (
    isEstimateConflict(error) &&
    typeof (error.body as any)?.code === 'string' &&
    ((error.body as any).code === 'ESTIMATE_LOCKED' || (error.body as any).code === 'ESTIMATE_PRICING_SOURCE_BLOCKED')
  );
}

function isValidationConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 409 || error.status === 423);
}

function isDesignRequestTerminalError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 409 || error.status === 423 || error.status === 501);
}

function isProjectDetailsTerminalError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    (error.status === 400 ||
      error.status === 401 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409 ||
      error.status === 423)
  );
}

function isAccessEndingProjectDetailsError(error: ApiError): boolean {
  return error.status === 401 || error.status === 403 || error.status === 404;
}

const isContactDetailsTerminalError = isProjectDetailsTerminalError;
const isAccessEndingContactDetailsError = isAccessEndingProjectDetailsError;

export default function LocalFirstPortalMutations() {
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  useEffect(() => {
    const unregisterProjectDetailsUpdate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.projectDetailsUpdate,
      async (item) => {
        const payload = item.payload as PortalProjectDetailsUpdateMutationPayload;
        try {
          await apiJson(`/api/projects/${encodeURIComponent(payload.projectId)}/details`, {
            method: 'PATCH',
            body: JSON.stringify({
              project: {
                name: payload.draft.projectName,
                siteAddress: payload.draft.siteAddress,
                region: payload.draft.region,
                quoteRef: payload.draft.quoteRef,
              },
              contact: {
                name: payload.draft.contactName,
                email: payload.draft.contactEmail,
                phone: payload.draft.contactPhone,
              },
              contactId: payload.contactId,
            }),
            skipSaveTracking: true,
          });
          await invalidateProjectReadCaches(queryClient, hostKey, payload.projectId);
          return {
            kind: 'success',
            clearWorkingCopyIfMatches: payload.draft,
          } as const;
        } catch (error) {
          if (isProjectDetailsTerminalError(error)) {
            patchProjectDetailsCaches(queryClient, hostKey, payload.projectId, payload.previousDraft, {
              contactId: payload.contactId,
            });
            if (isAccessEndingProjectDetailsError(error)) {
              await invalidateProjectReadCaches(queryClient, hostKey, payload.projectId);
            }
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
              clientSnapshot: payload.draft,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterContactDetailsUpdate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.contactDetailsUpdate,
      async (item) => {
        const payload = item.payload as PortalContactDetailsUpdateMutationPayload;
        try {
          const response = await apiJson<{ contact: Contact }>(
            `/api/contacts/${encodeURIComponent(payload.contactId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify(payload.draft),
              skipSaveTracking: true,
            },
          );
          if (!response.contact) throw new Error('Contact not saved');
          upsertContactCaches(queryClient, hostKey, response.contact);
          return {
            kind: 'success',
            clearWorkingCopyIfMatches: payload.draft,
          } as const;
        } catch (error) {
          if (isContactDetailsTerminalError(error)) {
            upsertContactCaches(queryClient, hostKey, payload.previousContact);
            if (isAccessEndingContactDetailsError(error)) {
              await Promise.allSettled([
                queryClient.invalidateQueries({ queryKey: qk.contacts.detail(hostKey, payload.contactId) }),
                invalidateContactsIndexCaches(queryClient, hostKey),
              ]);
            }
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
              clientSnapshot: payload.draft,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterEstimateCreate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
      async (item) => {
        const payload = item.payload as PortalEstimateCreateMutationPayload;
        try {
          const res = await apiJson<{ estimate: EstimateDetail }>(
            `/api/projects/${encodeURIComponent(payload.projectId)}/estimates`,
            {
              method: 'POST',
              body: JSON.stringify({
                calculator_snapshot: {
                  inputs: payload.estimatePayload.inputs,
                  outputs: {
                    ...payload.estimatePayload.outputs,
                    derived: payload.estimatePayload.derived ?? {},
                    projectSnapshot: payload.estimatePayload.projectSnapshot ?? null,
                    snapshot: payload.estimatePayload.snapshot ?? null,
                    configVersions: payload.estimatePayload.configVersions ?? null,
                  },
                },
              }),
              skipSaveTracking: true,
            },
          );

          if (!res.estimate) throw new Error('Estimate not created');
          replaceEstimateDetailCache(queryClient, hostKey, payload.projectId, payload.localEstimateId, res.estimate);
          await registerLocalFirstIdAlias(payload.localEstimateId, res.estimate.id);

          if (payload.createDesignRequest) {
            const designRequestPayload: PortalDesignRequestCreateMutationPayload = {
              projectId: payload.projectId,
              estimateId: res.estimate.id,
              requestSource: payload.createDesignRequest.requestSource,
              priorityTier: payload.createDesignRequest.priorityTier,
            };
            await enqueueAndProcessLocalFirstMutation({
              entityKey: buildDesignRequestEntityKey(payload.projectId, res.estimate.id),
              mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.designRequestCreate,
              payload: designRequestPayload,
            });
          }

          void invalidateProjectReadCaches(queryClient, hostKey, payload.projectId, {
            includeEstimates: true,
            includeProjectDetail: false,
          });

          return {
            kind: 'success',
            clearWorkingCopy: true,
          } as const;
        } catch (error) {
          if (isEstimateBlockedConflict(error)) {
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterEstimateUpdate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.estimateUpdate,
      async (item) => {
        const payload = item.payload as PortalEstimateUpdateMutationPayload;
        const resolvedEstimateId = resolveLocalFirstId(payload.estimateId);
        if (!resolvedEstimateId || resolvedEstimateId.startsWith('local-estimate:')) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }
        try {
          const res = await apiJson<{ estimate: EstimateDetail; syncedQuoteVersionIds?: string[] }>(`/api/estimates/${encodeURIComponent(resolvedEstimateId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              estimate_update: payload.estimatePayload,
            }),
            skipSaveTracking: true,
          });

          if (!res.estimate) throw new Error('Estimate not saved');
          upsertEstimateDetailCache(queryClient, hostKey, res.estimate.projectId, res.estimate);
          void invalidateProjectReadCaches(queryClient, hostKey, res.estimate.projectId, {
            includeEstimates: true,
            includeQuotes: true,
            includeProjectDetail: false,
          });
          void queryClient.invalidateQueries({ queryKey: qk.quotes.versionsByProject(hostKey, res.estimate.projectId) });
          void queryClient.invalidateQueries({ queryKey: ['quotes', hostKey] });

          return {
            kind: 'success',
            clearWorkingCopy: true,
          } as const;
        } catch (error) {
          if (isEstimateBlockedConflict(error)) {
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterDesignRequestCreate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.designRequestCreate,
      async (item) => {
        const payload = item.payload as PortalDesignRequestCreateMutationPayload;
        const resolvedEstimateId = resolveLocalFirstId(payload.estimateId);
        if (!resolvedEstimateId || resolvedEstimateId.startsWith('local-estimate:')) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }

        try {
          await apiJson('/api/staff/v1/design-packages/request', {
            method: 'POST',
            body: JSON.stringify({
              projectId: payload.projectId,
              estimateId: resolvedEstimateId,
              requestSource: payload.requestSource,
              priorityTier: payload.priorityTier ?? null,
              requestNote: payload.requestNote ?? null,
            }),
            skipSaveTracking: true,
          });
          void queryClient.invalidateQueries({ queryKey: qk.designPackages.list(hostKey) });

          return {
            kind: 'success',
            clearWorkingCopy: true,
          } as const;
        } catch (error) {
          if (isDesignRequestTerminalError(error)) {
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterQuoteCreate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.quoteCreateFromEstimate,
      async (item) => {
        const payload = item.payload as PortalQuoteCreateMutationPayload;
        const resolvedEstimateId = resolveLocalFirstId(payload.estimateId);
        if (!resolvedEstimateId || resolvedEstimateId.startsWith('local-estimate:')) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }

        const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/projects/${encodeURIComponent(payload.projectId)}/quotes`, {
          method: 'POST',
          body: JSON.stringify({ estimateVersionId: resolvedEstimateId }),
          skipSaveTracking: true,
        });

        if (!res.quoteVersion) throw new Error('Quote not created');
        replaceQuoteDetailCache(queryClient, hostKey, payload.projectId, payload.localQuoteId, res.quoteVersion);
        await registerLocalFirstIdAlias(payload.localQuoteId, res.quoteVersion.id);
        void invalidateProjectReadCaches(queryClient, hostKey, payload.projectId, {
          includeQuotes: true,
          includeEstimates: true,
          includeProjectDetail: false,
        });

        return {
          kind: 'success',
          clearWorkingCopy: true,
        } as const;
      },
    );

    const unregisterQuoteUpdate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.quoteUpdateDraft,
      async (item) => {
        const payload = item.payload as PortalQuoteUpdateMutationPayload;
        const resolvedQuoteVersionId = resolveLocalFirstId(payload.quoteVersionId);
        if (!resolvedQuoteVersionId || resolvedQuoteVersionId.startsWith('local-quote:')) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }
        try {
          const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(resolvedQuoteVersionId)}`, {
            method: 'PATCH',
            body: JSON.stringify(payload.patch),
            skipSaveTracking: true,
          });

          if (!res.quoteVersion) throw new Error('Quote not saved');
          upsertQuoteDetailCache(queryClient, hostKey, res.quoteVersion.projectId, res.quoteVersion);
          return {
            kind: 'success',
            clearWorkingCopy: true,
          } as const;
        } catch (error) {
          if (error instanceof ApiError && (error.status === 409 || error.status === 423)) {
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterEstimateNotesUpdate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.estimateNotesUpdate,
      async (item) => {
        const payload = item.payload as PortalEstimateNotesMutationPayload;
        const resolvedEstimateId = resolveLocalFirstId(payload.estimateId);
        if (!resolvedEstimateId || resolvedEstimateId.startsWith('local-estimate:')) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }
        try {
          const res = await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(resolvedEstimateId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ internal_notes: payload.internalNotes }),
            skipSaveTracking: true,
          });

          if (!res.estimate) throw new Error('Notes not saved');
          upsertEstimateDetailCache(queryClient, hostKey, payload.projectId, res.estimate);

          return {
            kind: 'success',
            clearWorkingCopy: true,
          } as const;
        } catch (error) {
          if (isValidationConflict(error)) {
            return {
              kind: 'conflict',
              message: error.message,
              serverSnapshot: error.body,
            } as const;
          }
          throw error;
        }
      },
    );

    const unregisterProjectNoteCreate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteCreate,
      async (item) => {
        const payload = item.payload as PortalProjectNoteCreateMutationPayload;
        try {
          const res = await apiJson<{ note: ProjectNote }>(
            `/api/staff/v1/projects/${encodeURIComponent(payload.projectId)}/notes`,
            {
              method: 'POST',
              body: JSON.stringify({ body: payload.body }),
              skipSaveTracking: true,
            },
          );
          if (!res.note) throw new Error('Note not created');
          replaceProjectNoteInSnapshot(queryClient, hostKey, payload.projectId, payload.localNoteId, res.note);
          await registerLocalFirstIdAlias(payload.localNoteId, res.note.id);
          return { kind: 'success', clearWorkingCopy: true } as const;
        } catch (error) {
          if (error instanceof ApiError && error.status === 403) {
            removeProjectNoteFromSnapshot(queryClient, hostKey, payload.projectId, payload.localNoteId);
            return { kind: 'conflict', message: error.message, serverSnapshot: error.body } as const;
          }
          if (error instanceof ApiError && (error.status === 400 || error.status === 404)) {
            removeProjectNoteFromSnapshot(queryClient, hostKey, payload.projectId, payload.localNoteId);
            return { kind: 'conflict', message: error.message, serverSnapshot: error.body } as const;
          }
          throw error;
        }
      },
    );

    const unregisterProjectNoteUpdate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteUpdate,
      async (item) => {
        const payload = item.payload as PortalProjectNoteUpdateMutationPayload;
        const resolvedNoteId = resolveLocalFirstId(payload.noteId);
        if (!resolvedNoteId || isLocalProjectNoteId(resolvedNoteId)) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }
        try {
          const res = await apiJson<{ note: ProjectNote }>(
            `/api/staff/v1/projects/${encodeURIComponent(payload.projectId)}/notes/${encodeURIComponent(resolvedNoteId)}`,
            {
              method: 'PATCH',
              body: JSON.stringify({ body: payload.body }),
              skipSaveTracking: true,
            },
          );
          if (!res.note) throw new Error('Note not updated');
          replaceProjectNoteInSnapshot(queryClient, hostKey, payload.projectId, resolvedNoteId, res.note);
          return { kind: 'success', clearWorkingCopy: true } as const;
        } catch (error) {
          if (error instanceof ApiError && (error.status === 403 || error.status === 404 || error.status === 400)) {
            return { kind: 'conflict', message: error.message, serverSnapshot: error.body } as const;
          }
          throw error;
        }
      },
    );

    const unregisterProjectNoteDelete = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.projectNoteDelete,
      async (item) => {
        const payload = item.payload as PortalProjectNoteDeleteMutationPayload;
        const resolvedNoteId = resolveLocalFirstId(payload.noteId);
        if (!resolvedNoteId || isLocalProjectNoteId(resolvedNoteId)) {
          return {
            kind: 'retry',
            status: 'queued',
            retryAt: new Date(Date.now() + 300).toISOString(),
          } as const;
        }
        try {
          await apiJson<{ ok: true }>(
            `/api/staff/v1/projects/${encodeURIComponent(payload.projectId)}/notes/${encodeURIComponent(resolvedNoteId)}`,
            {
              method: 'DELETE',
              skipSaveTracking: true,
            },
          );
          removeProjectNoteFromSnapshot(queryClient, hostKey, payload.projectId, resolvedNoteId);
          return { kind: 'success', clearWorkingCopy: true } as const;
        } catch (error) {
          if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
            return { kind: 'conflict', message: error.message, serverSnapshot: error.body } as const;
          }
          throw error;
        }
      },
    );

    return () => {
      unregisterProjectDetailsUpdate();
      unregisterContactDetailsUpdate();
      unregisterEstimateCreate();
      unregisterEstimateUpdate();
      unregisterDesignRequestCreate();
      unregisterQuoteCreate();
      unregisterQuoteUpdate();
      unregisterEstimateNotesUpdate();
      unregisterProjectNoteCreate();
      unregisterProjectNoteUpdate();
      unregisterProjectNoteDelete();
    };
  }, [hostKey, queryClient]);

  return null;
}
