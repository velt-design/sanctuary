'use client';

import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { invalidateProjectReadCaches } from '@/lib/queries/projectCache';
import { registerLocalFirstMutationHandler } from '@/lib/localFirst/queue';
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  type PortalEstimateCreateMutationPayload,
  type PortalEstimateUpdateMutationPayload,
  type PortalQuoteCreateMutationPayload,
  type PortalQuoteUpdateMutationPayload,
  replaceEstimateDetailCache,
  replaceQuoteDetailCache,
  upsertEstimateDetailCache,
  upsertQuoteDetailCache,
} from '@/lib/localFirst/portalEntities';
import type { EstimateDetail } from '@/lib/estimates/types';
import type { QuoteVersionDetail } from '@/lib/quotes/types';

function isEstimateConflict(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 409;
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

        if (payload.createDesignRequest) {
          try {
            await apiJson('/api/staff/v1/design-packages/request', {
              method: 'POST',
              body: JSON.stringify({
                projectId: payload.projectId,
                estimateId: res.estimate.id,
                requestSource: payload.createDesignRequest.requestSource,
                priorityTier: payload.createDesignRequest.priorityTier,
              }),
              skipSaveTracking: true,
            });
          } catch (error) {
            console.error('[localFirst] design request creation failed after estimate sync', {
              projectId: payload.projectId,
              estimateId: res.estimate.id,
              error,
            });
          }
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
        try {
          const res = await apiJson<{ estimate: EstimateDetail }>(`/api/estimates/${encodeURIComponent(payload.estimateId)}`, {
            method: 'PATCH',
            body: JSON.stringify({
              estimate_update: payload.estimatePayload,
              acknowledgeDraftQuoteStaleness: payload.acknowledgeDraftQuoteStaleness,
            }),
            skipSaveTracking: true,
          });

          if (!res.estimate) throw new Error('Estimate not saved');
          upsertEstimateDetailCache(queryClient, hostKey, res.estimate.projectId, res.estimate);
          void invalidateProjectReadCaches(queryClient, hostKey, res.estimate.projectId, {
            includeEstimates: true,
            includeProjectDetail: false,
          });

          return {
            kind: 'success',
            clearWorkingCopy: true,
          } as const;
        } catch (error) {
          if (
            isEstimateConflict(error) &&
            typeof (error.body as any)?.code === 'string' &&
            ((error.body as any).code === 'ESTIMATE_LOCKED' || (error.body as any).code === 'ESTIMATE_DRAFT_QUOTES_REQUIRE_ACK')
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

    const unregisterQuoteCreate = registerLocalFirstMutationHandler(
      PORTAL_LOCAL_FIRST_MUTATIONS.quoteCreateFromEstimate,
      async (item) => {
        const payload = item.payload as PortalQuoteCreateMutationPayload;
        const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/projects/${encodeURIComponent(payload.projectId)}/quotes`, {
          method: 'POST',
          body: JSON.stringify({ estimateVersionId: payload.estimateId }),
          skipSaveTracking: true,
        });

        if (!res.quoteVersion) throw new Error('Quote not created');
        replaceQuoteDetailCache(queryClient, hostKey, payload.projectId, payload.localQuoteId, res.quoteVersion);
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
        try {
          const res = await apiJson<{ quoteVersion: QuoteVersionDetail }>(`/api/quotes/${encodeURIComponent(payload.quoteVersionId)}`, {
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

    return () => {
      unregisterEstimateCreate();
      unregisterEstimateUpdate();
      unregisterQuoteCreate();
      unregisterQuoteUpdate();
    };
  }, [hostKey, queryClient]);

  return null;
}
