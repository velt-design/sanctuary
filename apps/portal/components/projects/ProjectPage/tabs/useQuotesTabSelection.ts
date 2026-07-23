"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast/ToastProvider";
import {
  buildQuoteEntityKey,
  isLocalQuoteId,
} from "@/lib/localFirst/portalEntities";
import { useAliasedEntitySyncState } from "@/lib/localFirst/useEntitySyncState";
import { useResolvedLocalFirstId } from "@/lib/localFirst/useResolvedLocalFirstId";
import { generatedJobPacksByProjectQueryOptions } from "@/lib/queries/jobPacks";
import { estimateMetasByProjectQueryOptions } from "@/lib/queries/projectEstimates";
import { invalidateProjectReadCaches } from "@/lib/queries/projectCache";
import {
  quoteVersionDetailQueryOptions,
  quoteVersionsByProjectQueryOptions,
} from "@/lib/queries/quotes";
import {
  supabaseHostFromUrl,
  supabaseRuntimeUrl,
} from "@/lib/supabase/browserClient";

type UseQuotesTabSelectionInput = {
  projectId: string;
  selectedQuoteId?: string | null;
  onSelectedQuoteChange?: (quoteId: string | null) => void;
};

export function useQuotesTabSelection({
  projectId,
  selectedQuoteId,
  onSelectedQuoteChange,
}: UseQuotesTabSelectionInput) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const hostKey = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || "unknown",
    [],
  );
  const didAutoSelectInitialQuoteRef = useRef(false);
  const prefetchedQuoteDetailsRef = useRef(new Set<string>());
  const detailErrorNotifiedRef = useRef<string | null>(null);

  const selectedFromUrl = useMemo(() => {
    const raw = searchParams.get("quoteId") ?? "";
    const trimmed = raw.trim();
    if (!trimmed || isLocalQuoteId(trimmed)) return null;
    return trimmed;
  }, [searchParams]);
  const createFromEstimateId = useMemo(() => {
    const raw = searchParams.get("createFromEstimateId") ?? "";
    return raw.trim() || null;
  }, [searchParams]);
  const pagePreviewFromUrl = useMemo(
    () => searchParams.get("quotePreview") === "1",
    [searchParams],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    selectedQuoteId ?? selectedFromUrl,
  );
  const resolvedSelectedId = useResolvedLocalFirstId(selectedId);

  const quotesQuery = useQuery(
    quoteVersionsByProjectQueryOptions(hostKey, projectId),
  );
  const estimatesQuery = useQuery(
    estimateMetasByProjectQueryOptions(hostKey, projectId),
  );
  const jobPacksQuery = useQuery(
    generatedJobPacksByProjectQueryOptions(hostKey, projectId),
  );
  const quoteDetailQuery = useQuery({
    ...quoteVersionDetailQueryOptions(hostKey, selectedId || ""),
    enabled: Boolean(selectedId),
  });

  const quotes = quotesQuery.data ?? [];
  const quotesLoading = quotesQuery.isPending;
  const quotesError =
    quotesQuery.error instanceof Error
      ? quotesQuery.error.message
      : quotesQuery.error
        ? String(quotesQuery.error)
        : null;
  const estimates = estimatesQuery.data ?? [];
  const estimatesLoading = estimatesQuery.isPending;
  const generatedJobPacks = jobPacksQuery.data ?? [];
  const detailLoading = Boolean(selectedId) && quoteDetailQuery.isPending;
  const detail = quoteDetailQuery.data ?? null;
  const detailSyncState = useAliasedEntitySyncState(
    detail?.id,
    buildQuoteEntityKey,
    "quote:detail:__quote-none__",
  );
  const draftSyncPending = Boolean(
    detail && detail.status === "DRAFT" && detailSyncState.pendingCount > 0,
  );

  const refreshQuotes = useCallback(
    async (options?: { includeEstimates?: boolean }) => {
      await invalidateProjectReadCaches(queryClient, hostKey, projectId, {
        includeQuotes: true,
        includeEstimates: options?.includeEstimates,
      });
    },
    [hostKey, projectId, queryClient],
  );

  const prefetchQuoteDetail = useCallback(
    (quoteVersionId: string) => {
      const token = `${hostKey}:${quoteVersionId}`;
      if (prefetchedQuoteDetailsRef.current.has(token)) return;
      prefetchedQuoteDetailsRef.current.add(token);
      void queryClient.prefetchQuery(
        quoteVersionDetailQueryOptions(hostKey, quoteVersionId),
      );
    },
    [hostKey, queryClient],
  );

  const updateParams = useCallback(
    (next: {
      quoteId?: string | null;
      createFromEstimateId?: string | null;
    }) => {
      const query = new URLSearchParams(searchParams.toString());
      if (Object.prototype.hasOwnProperty.call(next, "quoteId")) {
        if (!next.quoteId) {
          query.delete("quoteId");
          query.delete("quotePreview");
        } else {
          query.set("quoteId", next.quoteId);
        }
      }
      if (Object.prototype.hasOwnProperty.call(next, "createFromEstimateId")) {
        if (!next.createFromEstimateId) query.delete("createFromEstimateId");
        else query.set("createFromEstimateId", next.createFromEstimateId);
      }
      const queryString = query.toString();
      router.replace(queryString ? `?${queryString}` : "?");
    },
    [router, searchParams],
  );

  const selectQuote = useCallback(
    (
      quoteId: string | null,
      options?: { createFromEstimateId?: string | null },
    ) => {
      if (quoteId) didAutoSelectInitialQuoteRef.current = true;
      setSelectedId(quoteId);
      onSelectedQuoteChange?.(quoteId);
      updateParams({
        quoteId: quoteId && !isLocalQuoteId(quoteId) ? quoteId : null,
        createFromEstimateId: options?.createFromEstimateId,
      });
    },
    [onSelectedQuoteChange, updateParams],
  );

  useEffect(() => {
    if (!selectedId) {
      detailErrorNotifiedRef.current = null;
      return;
    }
    if (!quoteDetailQuery.error) {
      detailErrorNotifiedRef.current = null;
      return;
    }
    const message =
      quoteDetailQuery.error instanceof Error
        ? quoteDetailQuery.error.message
        : String(quoteDetailQuery.error);
    if (!message || detailErrorNotifiedRef.current === message) return;
    detailErrorNotifiedRef.current = message;
    toast.error(message);
  }, [quoteDetailQuery.error, selectedId, toast]);

  useEffect(() => {
    let nextSelectedId: string | null | undefined;
    if (selectedFromUrl) {
      didAutoSelectInitialQuoteRef.current = true;
      nextSelectedId = selectedFromUrl;
    } else if (!quotes.length) {
      nextSelectedId = quotesLoading ? undefined : null;
    } else if (selectedId && quotes.some((quote) => quote.id === selectedId)) {
      nextSelectedId = undefined;
    } else if (!didAutoSelectInitialQuoteRef.current) {
      didAutoSelectInitialQuoteRef.current = true;
      nextSelectedId = quotes[0]?.id ?? null;
    } else {
      nextSelectedId = null;
    }
    if (nextSelectedId === undefined || nextSelectedId === selectedId) return;
    setSelectedId(nextSelectedId);
    onSelectedQuoteChange?.(nextSelectedId);
  }, [
    onSelectedQuoteChange,
    quotes,
    quotesLoading,
    selectedFromUrl,
    selectedId,
  ]);

  useEffect(() => {
    if (!selectedId || !resolvedSelectedId || resolvedSelectedId === selectedId)
      return;
    selectQuote(resolvedSelectedId, { createFromEstimateId: null });
  }, [resolvedSelectedId, selectQuote, selectedId]);

  return {
    hostKey,
    selectedId,
    createFromEstimateId,
    pagePreviewFromUrl,
    quotesQuery,
    quoteDetailQuery,
    quotes,
    quotesLoading,
    quotesError,
    estimates,
    estimatesLoading,
    generatedJobPacks,
    detailLoading,
    detail,
    draftSyncPending,
    refreshQuotes,
    prefetchQuoteDetail,
    selectQuote,
    updateParams,
  };
}
