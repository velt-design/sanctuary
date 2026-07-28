"use client";

import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { EstimateMeta } from "@/lib/estimates/types";
import {
  isLocalQuoteId,
  upsertQuoteDetailCache,
} from "@/lib/localFirst/portalEntities";
import { qk } from "@/lib/queries/keys";
import { invalidateProjectReadCaches } from "@/lib/queries/projectCache";
import {
  deleteDraftQuoteVersion,
  markQuoteAccepted,
  markQuoteDeclined,
  previewDraftQuoteRefreshFromEstimate,
  refreshDraftQuoteFromEstimate,
  reviseQuote,
} from "@/lib/quotes/quotesRepo";
import type {
  QuoteRefreshMode,
  QuoteRefreshPreview,
} from "@/lib/quotes/refresh";
import type { QuoteVersionDetail } from "@/lib/quotes/types";
import { generateJobPack } from "@/lib/repo/jobPacksRepo";
import {
  formatRefreshModeLabel,
  isExpired,
  type SendEditorMode,
} from "./quotesTabModel";

type Setter<T> = Dispatch<SetStateAction<T>>;
type OpenSendModal = (
  mode: "send" | "resend",
  editorMode?: SendEditorMode,
  sourceDetail?: QuoteVersionDetail | null,
) => void;

type UseQuoteLifecycleActionsInput = {
  projectId: string;
  hostKey: string;
  detail: QuoteVersionDetail | null;
  draftSyncPending: boolean;
  refreshEstimateTarget: EstimateMeta | null;
  refreshUsesLatestDesign: boolean;
  refreshQuotes: (options?: { includeEstimates?: boolean }) => Promise<void>;
  selectQuote: (
    quoteId: string | null,
    options?: { createFromEstimateId?: string | null },
  ) => void;
  openSendModal: OpenSendModal;
  resetDraftFormFromDetail: (detail: QuoteVersionDetail) => void;
  setMoreActionsOpen: Setter<boolean>;
  pendingResendId: string | null;
  setPendingResendId: Setter<string | null>;
  setExpiredPromptOpen: Setter<boolean>;
  refreshConfirmOpen: boolean;
  setRefreshConfirmOpen: Setter<boolean>;
  refreshMode: QuoteRefreshMode;
  setRefreshMode: Setter<QuoteRefreshMode>;
  setRefreshPreview: Setter<QuoteRefreshPreview | null>;
  setRefreshPreviewLoading: Setter<boolean>;
  setRefreshPreviewError: Setter<string | null>;
  refreshBusy: boolean;
  setRefreshBusy: Setter<boolean>;
  setDeleteConfirmOpen: Setter<boolean>;
  jobPackBusy: boolean;
  setJobPackBusy: Setter<boolean>;
};

export function useQuoteLifecycleActions({
  projectId,
  hostKey,
  detail,
  draftSyncPending,
  refreshEstimateTarget,
  refreshUsesLatestDesign,
  refreshQuotes,
  selectQuote,
  openSendModal,
  resetDraftFormFromDetail,
  setMoreActionsOpen,
  pendingResendId,
  setPendingResendId,
  setExpiredPromptOpen,
  refreshConfirmOpen,
  setRefreshConfirmOpen,
  refreshMode,
  setRefreshMode,
  setRefreshPreview,
  setRefreshPreviewLoading,
  setRefreshPreviewError,
  refreshBusy,
  setRefreshBusy,
  setDeleteConfirmOpen,
  jobPackBusy,
  setJobPackBusy,
}: UseQuoteLifecycleActionsInput) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [acceptBusy, setAcceptBusy] = useState(false);

  const revise = useCallback(async () => {
    if (!detail) return;
    try {
      const revised = await reviseQuote(detail.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, revised.id), revised);
      await refreshQuotes({ includeEstimates: true });
      selectQuote(revised.id);
      toast.success("Draft revision created.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to revise quote";
      toast.error(message);
    }
  }, [detail, hostKey, queryClient, refreshQuotes, selectQuote, toast]);

  const resend = useCallback(() => {
    if (!detail) return;
    if (isExpired(detail.expiresAt)) {
      setPendingResendId(detail.id);
      setExpiredPromptOpen(true);
      return;
    }
    openSendModal("resend", "review");
  }, [detail, openSendModal, setExpiredPromptOpen, setPendingResendId]);

  const resolveExpiredQuote = useCallback(
    async (mode: "resend" | "revise") => {
      setExpiredPromptOpen(false);
      if (!detail || !pendingResendId) return;
      if (mode === "revise") {
        await revise();
        return;
      }
      openSendModal("resend", "review");
    },
    [detail, openSendModal, pendingResendId, revise, setExpiredPromptOpen],
  );

  const deleteDraft = useCallback(async () => {
    if (!detail) return;
    if (isLocalQuoteId(detail.id) || draftSyncPending) {
      toast.error("Wait for the draft to finish syncing before deleting.");
      return;
    }
    try {
      await deleteDraftQuoteVersion(detail.id);
      queryClient.removeQueries({
        queryKey: qk.quotes.detail(hostKey, detail.id),
      });
      setDeleteConfirmOpen(false);
      selectQuote(null);
      await refreshQuotes();
      toast.success("Draft deleted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete draft";
      toast.error(message);
    }
  }, [
    detail,
    draftSyncPending,
    hostKey,
    queryClient,
    refreshQuotes,
    selectQuote,
    setDeleteConfirmOpen,
    toast,
  ]);

  const openRefresh = useCallback(() => {
    setRefreshMode("pricing_only");
    setRefreshPreview(null);
    setRefreshPreviewError(null);
    setRefreshConfirmOpen(true);
    setMoreActionsOpen(false);
  }, [
    setMoreActionsOpen,
    setRefreshConfirmOpen,
    setRefreshMode,
    setRefreshPreview,
    setRefreshPreviewError,
  ]);

  useEffect(() => {
    if (
      !refreshConfirmOpen ||
      !detail ||
      detail.status !== "DRAFT" ||
      !refreshEstimateTarget
    )
      return;
    if (isLocalQuoteId(detail.id) || draftSyncPending) return;

    const abortController = new AbortController();
    setRefreshPreviewLoading(true);
    setRefreshPreviewError(null);
    void (async () => {
      try {
        const preview = await previewDraftQuoteRefreshFromEstimate(
          detail.id,
          refreshEstimateTarget.id,
          refreshMode,
        );
        if (!abortController.signal.aborted) setRefreshPreview(preview);
      } catch (error) {
        if (abortController.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to preview quote refresh";
        setRefreshPreview(null);
        setRefreshPreviewError(message);
      } finally {
        if (!abortController.signal.aborted) setRefreshPreviewLoading(false);
      }
    })();
    return () => {
      abortController.abort();
    };
  }, [
    detail,
    draftSyncPending,
    refreshConfirmOpen,
    refreshEstimateTarget,
    refreshMode,
    setRefreshPreview,
    setRefreshPreviewError,
    setRefreshPreviewLoading,
  ]);

  const refreshFromEstimate = useCallback(async () => {
    if (
      !detail ||
      detail.status !== "DRAFT" ||
      !refreshEstimateTarget ||
      refreshBusy
    )
      return;
    if (isLocalQuoteId(detail.id) || draftSyncPending) {
      toast.error(
        "Wait for the draft to finish syncing before refreshing from design.",
      );
      return;
    }
    setRefreshBusy(true);
    try {
      const updated = await refreshDraftQuoteFromEstimate(
        detail.id,
        refreshEstimateTarget.id,
        refreshMode,
      );
      upsertQuoteDetailCache(queryClient, hostKey, projectId, updated);
      resetDraftFormFromDetail(updated);
      setRefreshConfirmOpen(false);
      await refreshQuotes({ includeEstimates: true });
      toast.success(
        refreshUsesLatestDesign
          ? `${formatRefreshModeLabel(refreshMode)} applied from ${refreshEstimateTarget.versionLabel}.`
          : `${formatRefreshModeLabel(refreshMode)} applied from the current design.`,
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to refresh quote from design";
      toast.error(message);
    } finally {
      setRefreshBusy(false);
    }
  }, [
    detail,
    draftSyncPending,
    hostKey,
    projectId,
    queryClient,
    refreshBusy,
    refreshEstimateTarget,
    refreshMode,
    refreshQuotes,
    refreshUsesLatestDesign,
    resetDraftFormFromDetail,
    setRefreshBusy,
    setRefreshConfirmOpen,
    toast,
  ]);

  const accept = useCallback(async () => {
    if (!detail || acceptBusy) return;
    setAcceptBusy(true);
    try {
      const result = await markQuoteAccepted(detail.id);
      const updated = result.quoteVersion;
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      await Promise.allSettled([
        refreshQuotes(),
        queryClient.invalidateQueries({
          queryKey: qk.invoices.byProject(hostKey, projectId),
        }),
      ]);
      if (result.invoice?.sent) {
        toast.success(
          `Quote accepted. Email provider confirmed invoice ${result.invoice.invoiceRef}.`,
        );
      } else if (result.invoice) {
        const action =
          result.invoice.deliveryState === "needs_attention"
            ? "Delivery needs staff attention in the Invoices tab."
            : "Delivery is not confirmed; a safe retry is available in the Invoices tab.";
        toast.error(`Quote accepted. Invoice ${result.invoice.invoiceRef} was prepared. ${action}`);
      } else {
        toast.success("Quote accepted.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark accepted";
      toast.error(message);
    } finally {
      setAcceptBusy(false);
    }
  }, [
    acceptBusy,
    detail,
    hostKey,
    projectId,
    queryClient,
    refreshQuotes,
    toast,
  ]);

  const decline = useCallback(async () => {
    if (!detail) return;
    try {
      const updated = await markQuoteDeclined(detail.id);
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      await refreshQuotes();
      toast.success("Quote marked declined.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to mark declined";
      toast.error(message);
    }
  }, [detail, hostKey, queryClient, refreshQuotes, toast]);

  const generateJobPackForQuote = useCallback(async () => {
    if (!detail || jobPackBusy) return;
    setJobPackBusy(true);
    try {
      const jobPack = await generateJobPack({
        projectId,
        quoteVersionId: detail.id,
      });
      await Promise.allSettled([
        queryClient.invalidateQueries({
          queryKey: qk.jobPacks.list(hostKey, projectId),
        }),
        invalidateProjectReadCaches(queryClient, hostKey, projectId, {
          includeEstimates: true,
          includeQuotes: false,
        }),
      ]);
      toast.success("Job pack generated.");
      router.replace(
        `/staff/projects/${encodeURIComponent(projectId)}?tab=job-packs&estimateId=${encodeURIComponent(
          jobPack.estimateId,
        )}&sheet=materials`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate job pack";
      toast.error(message);
    } finally {
      setJobPackBusy(false);
    }
  }, [
    detail,
    hostKey,
    jobPackBusy,
    projectId,
    queryClient,
    router,
    setJobPackBusy,
    toast,
  ]);

  return {
    revise,
    resend,
    resolveExpiredQuote,
    deleteDraft,
    openRefresh,
    refreshFromEstimate,
    accept,
    acceptBusy,
    decline,
    generateJobPackForQuote,
  };
}
