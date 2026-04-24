'use client';

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { qk } from '@/lib/queries/keys';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { enqueueAndProcessLocalFirstMutation, registerLocalFirstMutationHandler } from '@/lib/localFirst/queue';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  type PortalDesignRequestCreateMutationPayload,
  type PortalEstimateCreateMutationPayload,
  type PortalEstimateNotesMutationPayload,
  type PortalEstimateUpdateMutationPayload,
  type PortalQuoteCreateMutationPayload,
  type PortalQuoteUpdateMutationPayload,
  buildDesignRequestEntityKey,
  replaceEstimateDetailCache,
  replaceQuoteDetailCache,
  upsertEstimateDetailCache,
  upsertQuoteDetailCache,
} from '@/lib/localFirst/portalEntities';
import { registerLocalFirstIdAlias, resolveLocalFirstId } from '@/lib/localFirst/store';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { QuoteVersionDetail } from '@/lib/quotes/types';

function isEstimateConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
}

function isValidationConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 409 || error.status === 423);
}

function isDesignRequestTerminalError(error: unknown): error is ApiError {
  return error instanceof ApiError && (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 409 || error.status === 423 || error.status === 501);
}

export default function LocalFirstPortalMutations() {
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);

  useEffect(() => {
    const unregisterEstimateCreate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.estimateCreate,
      async (item) => {
        const payload = item.payload as PortalEstimateCreateMutationPayload;
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
          if (
            isEstimateConflict(error) &&
            typeof (error.body as any)?.code === 'string' &&
            (error.body as any).code === 'ESTIMATE_LOCKED'
          ) {
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

    return () => {
      unregisterEstimateCreate();
      unregisterEstimateUpdate();
      unregisterDesignRequestCreate();
      unregisterQuoteCreate();
      unregisterQuoteUpdate();
      unregisterEstimateNotesUpdate();
    };
  }, [hostKey, queryClient]);

  return null;
}
