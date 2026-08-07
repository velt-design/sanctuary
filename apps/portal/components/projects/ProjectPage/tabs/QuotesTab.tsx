"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { DataStatePanel } from "@/components/ui/foundation/FoundationFeedback";
import { useUnsavedChangesGuard } from "@/components/ui/foundation/useUnsavedChangesGuard";
import styles from "./QuotesTab.module.css";
import QuoteDetailView from "./QuoteDetailView";
import QuoteDetailPendingView from "./QuoteDetailPendingView";
import QuotesListView from "./QuotesListView";
import QuoteWorkflowDialogs from "./QuoteWorkflowDialogs";
import { useQuoteLifecycleActions } from "./useQuoteLifecycleActions";
import { useQuotePdfPreviews } from "./useQuotePdfPreviews";
import { useQuotesTabSelection } from "./useQuotesTabSelection";
import type { EstimateDetail } from "@/lib/estimates/types";
import type {
  PreparedQuoteDeliverySummary,
  QuoteLineItem,
  QuoteVersionDetail,
} from "@/lib/quotes/types";
import {
  getPreparedQuoteDelivery,
  previewQuotePdf,
  resendQuote,
  retryPreparedQuoteDelivery,
  sendQuote,
} from "@/lib/quotes/quotesRepo";
import type {
  QuoteRefreshMode,
  QuoteRefreshPreview,
} from "@/lib/quotes/refresh";
import {
  buildPergolaStructuredDescription,
  parsePergolaStructuredDescription,
  updateSharedPergolaField,
  type PergolaFieldMap,
  type PergolaModuleDraft,
} from "@/lib/quotes/pergolaDraft";
import { estimateDetailQueryOptions } from "@/lib/queries/projectEstimates";
import { qk } from "@/lib/queries/keys";
import {
  PORTAL_LOCAL_FIRST_MUTATIONS,
  applyDraftPatchToQuoteDetail,
  buildOptimisticQuoteDetail,
  buildQuoteEntityKey,
  createLocalQuoteId,
  type PortalQuoteCreateMutationPayload,
  type PortalQuoteUpdateMutationPayload,
  upsertQuoteDetailCache,
} from "@/lib/localFirst/portalEntities";
import { enqueueAndProcessLocalFirstMutation } from "@/lib/localFirst/queue";
import { writeLocalFirstWorkingCopy } from "@/lib/localFirst/store";
import {
  MAX_ATTACHMENTS_TOTAL_BYTES,
  computeLineTotal,
  defaultPersonalNote,
  defaultSubject,
  downloadPdfBytes,
  formatPercentInput,
  isPergolaLineItemDescription,
  parseMoneyInput,
  parsePercentInput,
  quoteDraftFilename,
  validateAttachment,
  type SendEditorMode,
} from "./quotesTabModel";

function newDeliveryIntentId(): string {
  const token =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `quote-delivery:${token}`;
}

function deliveryIntentStorageKey(
  quoteVersionId: string,
  mode: "send" | "resend",
): string {
  return `sanctuary:quote-delivery:${quoteVersionId}:${mode}`;
}

function recoverDeliveryIntentId(
  quoteVersionId: string,
  mode: "send" | "resend",
): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage
        .getItem(deliveryIntentStorageKey(quoteVersionId, mode))
        ?.trim();
      if (stored) return stored;
    } catch {
      // Delivery still works when browser storage is unavailable.
    }
  }
  return newDeliveryIntentId();
}

function rememberDeliveryIntentId(
  quoteVersionId: string,
  mode: "send" | "resend",
  intentId: string,
): void {
  try {
    window.localStorage.setItem(
      deliveryIntentStorageKey(quoteVersionId, mode),
      intentId,
    );
  } catch {
    // The server-side provider idempotency key remains the final duplicate guard.
  }
}

function forgetDeliveryIntentId(
  quoteVersionId: string,
  mode: "send" | "resend",
): void {
  try {
    window.localStorage.removeItem(
      deliveryIntentStorageKey(quoteVersionId, mode),
    );
  } catch {
    // A stale local hint is harmless; a finalised server intent is replay-safe.
  }
}

export default function QuotesTab({
  projectId,
  selectedQuoteId,
  onSelectedQuoteChange,
}: {
  projectId: string;
  selectedQuoteId?: string | null;
  onSelectedQuoteChange?: (quoteId: string | null) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const autoCreateRef = useRef<string | null>(null);
  const {
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
  } = useQuotesTabSelection({
    projectId,
    selectedQuoteId,
    onSelectedQuoteChange,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createEstimateId, setCreateEstimateId] = useState("");

  const [sendOpen, setSendOpen] = useState(false);
  const [sendMode, setSendMode] = useState<"send" | "resend">("send");
  const [sendTo, setSendTo] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendPersonalNote, setSendPersonalNote] = useState("");
  const [sendAttachments, setSendAttachments] = useState<File[]>([]);
  const [sendEditorMode, setSendEditorMode] =
    useState<SendEditorMode>("compose");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendIntentId, setSendIntentId] = useState("");
  const [preparedRetryOpen, setPreparedRetryOpen] = useState(false);
  const [preparedRetryLoading, setPreparedRetryLoading] = useState(false);
  const [preparedRetryBusy, setPreparedRetryBusy] = useState(false);
  const [preparedRetryError, setPreparedRetryError] = useState<string | null>(
    null,
  );
  const [preparedDelivery, setPreparedDelivery] =
    useState<PreparedQuoteDeliverySummary | null>(null);

  const quotePdfPreviewCacheRef = useRef(new Map<string, Uint8Array>());

  const [expiredPromptOpen, setExpiredPromptOpen] = useState(false);
  const [pendingResendId, setPendingResendId] = useState<string | null>(null);
  const [jobPackBusy, setJobPackBusy] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshMode, setRefreshMode] =
    useState<QuoteRefreshMode>("pricing_only");
  const [refreshPreview, setRefreshPreview] =
    useState<QuoteRefreshPreview | null>(null);
  const [refreshPreviewLoading, setRefreshPreviewLoading] = useState(false);
  const [refreshPreviewError, setRefreshPreviewError] = useState<string | null>(
    null,
  );
  const [refreshBusy, setRefreshBusy] = useState(false);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [draftItems, setDraftItems] = useState<QuoteLineItem[]>([]);
  const [draftPergolaOverrideMode, setDraftPergolaOverrideMode] = useState<
    Record<string, boolean>
  >({});
  const [unitInputDrafts, setUnitInputDrafts] = useState<
    Record<string, string>
  >({});
  const [activeUnitInputId, setActiveUnitInputId] = useState<string | null>(
    null,
  );
  const [draftReference, setDraftReference] = useState("");
  const [draftIntro, setDraftIntro] = useState("");
  const [draftTerms, setDraftTerms] = useState("");
  const [draftDepositPercent, setDraftDepositPercent] = useState("50");
  const [draftExpiry, setDraftExpiry] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [downloadingDraftPdf, setDownloadingDraftPdf] = useState(false);

  const resetDraftFormFromDetail = useCallback(
    (quoteDetail: QuoteVersionDetail) => {
      setDraftItems(quoteDetail.lineItems);
      setDraftPergolaOverrideMode({});
      setUnitInputDrafts({});
      setActiveUnitInputId(null);
      setDraftReference(quoteDetail.reference ?? "");
      setDraftIntro(quoteDetail.introText ?? "");
      setDraftTerms(quoteDetail.termsText ?? "");
      setDraftDepositPercent(formatPercentInput(quoteDetail.depositPercent));
      setDraftExpiry(quoteDetail.expiresAt ?? "");
    },
    [],
  );

  useEffect(() => {
    if (!detail) return;
    resetDraftFormFromDetail(detail);
  }, [detail?.id, resetDraftFormFromDetail]);

  const getLiveUnitPriceIncGstCents = useCallback(
    (item: QuoteLineItem): number => {
      const raw = unitInputDrafts[item.id];
      if (typeof raw !== "string") return item.unitPriceIncGstCents;
      return parseMoneyInput(raw);
    },
    [unitInputDrafts],
  );

  const effectiveDraftItems = useMemo(
    () =>
      draftItems.map((item) => {
        const nextUnitPrice = getLiveUnitPriceIncGstCents(item);
        if (nextUnitPrice === item.unitPriceIncGstCents) return item;
        return { ...item, unitPriceIncGstCents: nextUnitPrice };
      }),
    [draftItems, getLiveUnitPriceIncGstCents],
  );

  const parsedPergolaDrafts = useMemo(() => {
    const next = new Map<
      string,
      ReturnType<typeof parsePergolaStructuredDescription>
    >();
    draftItems.forEach((item) => {
      next.set(
        item.id,
        isPergolaLineItemDescription(item.description)
          ? parsePergolaStructuredDescription(item.description)
          : null,
      );
    });
    return next;
  }, [draftItems]);

  const updateDraftItemDescription = useCallback(
    (itemId: string, description: string) => {
      setDraftItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId ? { ...entry, description } : entry,
        ),
      );
    },
    [],
  );

  const updatePergolaModule = useCallback(
    (
      itemId: string,
      moduleIndex: number,
      updater: (module: PergolaModuleDraft) => PergolaModuleDraft,
    ) => {
      const parsed = parsedPergolaDrafts.get(itemId);
      if (!parsed) return;
      const modules = parsed.modules.map((module, index) =>
        index === moduleIndex ? updater(module) : module,
      );
      updateDraftItemDescription(
        itemId,
        buildPergolaStructuredDescription({ ...parsed, modules }),
      );
    },
    [parsedPergolaDrafts, updateDraftItemDescription],
  );

  const updatePergolaSharedField = useCallback(
    (itemId: string, key: keyof PergolaFieldMap, value: string) => {
      const parsed = parsedPergolaDrafts.get(itemId);
      if (!parsed) return;
      updateDraftItemDescription(
        itemId,
        buildPergolaStructuredDescription(
          updateSharedPergolaField(parsed, key, value),
        ),
      );
    },
    [parsedPergolaDrafts, updateDraftItemDescription],
  );

  const commitUnitPriceDraft = useCallback(
    (itemId: string, rawValue: string) => {
      const nextCents = parseMoneyInput(rawValue);
      setDraftItems((prev) => {
        const idx = prev.findIndex((entry) => entry.id === itemId);
        if (idx === -1) return prev;
        if (prev[idx].unitPriceIncGstCents === nextCents) return prev;
        const next = prev.slice();
        next[idx] = { ...next[idx], unitPriceIncGstCents: nextCents };
        return next;
      });
      setUnitInputDrafts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, itemId)) return prev;
        const next = { ...prev };
        delete next[itemId];
        return next;
      });
    },
    [],
  );

  const latestEstimate = useMemo(() => {
    if (!estimates.length) return null;
    return (
      [...estimates].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0] ?? null
    );
  }, [estimates]);
  const preferredQuoteSourceDesign = useMemo(() => {
    if (!estimates.length) return null;
    return (
      estimates.find((estimate) => estimate.isActiveDraft) ??
      latestEstimate ??
      estimates[0] ??
      null
    );
  }, [estimates, latestEstimate]);
  const currentSourceEstimate = useMemo(
    () =>
      detail
        ? (estimates.find(
            (estimate) => estimate.id === detail.sourceEstimateVersionId,
          ) ?? null)
        : null,
    [detail, estimates],
  );
  const refreshEstimateTarget = useMemo(() => {
    if (!detail) return preferredQuoteSourceDesign ?? currentSourceEstimate;
    return preferredQuoteSourceDesign ?? currentSourceEstimate;
  }, [currentSourceEstimate, detail, preferredQuoteSourceDesign]);
  const refreshUsesLatestDesign = Boolean(
    detail &&
    refreshEstimateTarget &&
    refreshEstimateTarget.id !== detail.sourceEstimateVersionId,
  );

  const detailTotals = useMemo(() => {
    if (!detail) return null;
    if (detail.status !== "DRAFT") return detail.totals;
    const totalInc = effectiveDraftItems.reduce(
      (sum, item) => sum + computeLineTotal(item),
      0,
    );
    const totalEx = Math.round(totalInc / 1.15);
    const gst = totalInc - totalEx;
    return {
      totalIncGstCents: totalInc,
      totalExGstCents: totalEx,
      gstCents: gst,
    };
  }, [detail, effectiveDraftItems]);

  const draftDirty = useMemo(() => {
    if (!detail) return false;
    if (detail.status !== "DRAFT") return false;
    const lineMatch =
      detail.lineItems.length === effectiveDraftItems.length &&
      detail.lineItems.every((item, idx) => {
        const next = effectiveDraftItems[idx];
        return (
          item.description === next.description &&
          item.qty === next.qty &&
          item.unitPriceIncGstCents === next.unitPriceIncGstCents
        );
      });
    if (!lineMatch) return true;
    if ((detail.reference ?? "") !== draftReference) return true;
    if ((detail.introText ?? "") !== draftIntro) return true;
    if ((detail.termsText ?? "") !== draftTerms) return true;
    if (
      formatPercentInput(detail.depositPercent) !==
      formatPercentInput(parsePercentInput(draftDepositPercent))
    )
      return true;
    if ((detail.expiresAt ?? "") !== draftExpiry) return true;
    return false;
  }, [
    detail,
    effectiveDraftItems,
    draftReference,
    draftIntro,
    draftTerms,
    draftDepositPercent,
    draftExpiry,
  ]);
  const guardUnsavedDraft = useUnsavedChangesGuard(
    draftDirty,
    "Discard the unsaved quote changes?",
  );

  const previewDetail = useMemo(() => {
    if (!detail) return null;
    if (detail.status !== "DRAFT") return detail;
    return applyDraftPatchToQuoteDetail(detail, {
      reference: draftReference,
      introText: draftIntro,
      termsText: draftTerms,
      depositPercent: parsePercentInput(draftDepositPercent),
      expiresAt: draftExpiry || null,
      lineItems: effectiveDraftItems.map((item) => ({
        description: item.description,
        qty: item.qty,
        unitPriceIncGstCents: item.unitPriceIncGstCents,
      })),
    });
  }, [
    detail,
    draftDepositPercent,
    draftExpiry,
    draftIntro,
    draftReference,
    draftTerms,
    effectiveDraftItems,
  ]);

  const reviewQuoteDetail = useMemo(
    () => (sendMode === "send" ? previewDetail : detail),
    [detail, previewDetail, sendMode],
  );
  const {
    quotePdfPreviewData,
    quotePdfPreviewLoading,
    quotePdfPreviewError,
    quotePdfPreviewKey,
    sendReviewPdfData,
    sendReviewPdfLoading,
    sendReviewPdfError,
    resetSendReviewPdf,
  } = useQuotePdfPreviews({
    pagePreviewFromUrl,
    previewDetail,
    sendOpen,
    sendEditorMode,
    reviewQuoteDetail,
    cacheRef: quotePdfPreviewCacheRef,
  });

  const openCreateModal = () => {
    const defaultId = preferredQuoteSourceDesign?.id ?? "";
    if (!defaultId) {
      toast.error("Create a design first.");
      return;
    }
    setCreateEstimateId(defaultId);
    setCreateOpen(true);
  };

  const createDraftQuoteFromEstimate = useCallback(
    async (estimateId: string, opts?: { closeModal?: boolean }) => {
      if (!estimateId) return;
      try {
        const estimateDetail =
          queryClient.getQueryData<EstimateDetail>(
            qk.estimates.detail(hostKey, estimateId),
          ) ??
          (await queryClient.fetchQuery(
            estimateDetailQueryOptions(hostKey, estimateId),
          ));
        const localQuoteId = createLocalQuoteId();
        const optimisticDetail = buildOptimisticQuoteDetail({
          quoteVersionId: localQuoteId,
          projectId,
          estimateDetail,
          existingQuotes: quotes,
        });

        upsertQuoteDetailCache(
          queryClient,
          hostKey,
          projectId,
          optimisticDetail,
          { prepend: true },
        );
        await writeLocalFirstWorkingCopy({
          entityKey: buildQuoteEntityKey(localQuoteId),
          data: optimisticDetail,
        });

        const mutationPayload: PortalQuoteCreateMutationPayload = {
          localQuoteId,
          projectId,
          estimateId,
        };
        await enqueueAndProcessLocalFirstMutation({
          entityKey: buildQuoteEntityKey(localQuoteId),
          mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.quoteCreateFromEstimate,
          payload: mutationPayload,
        });

        if (opts?.closeModal) setCreateOpen(false);
        selectQuote(localQuoteId, { createFromEstimateId: null });
        toast.success(
          "Draft quote created locally. Syncing in the background.",
        );
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to create quote";
        toast.error(msg);
      }
    },
    [hostKey, projectId, queryClient, selectQuote, toast],
  );

  const handleCreateQuote = async () => {
    if (!createEstimateId) return;
    await createDraftQuoteFromEstimate(createEstimateId, { closeModal: true });
  };

  useEffect(() => {
    if (!createFromEstimateId) {
      autoCreateRef.current = null;
      return;
    }
    if (estimatesLoading) return;
    const token = `${projectId}:${createFromEstimateId}`;
    if (autoCreateRef.current === token) return;
    autoCreateRef.current = token;

    if (!estimates.some((estimate) => estimate.id === createFromEstimateId)) {
      toast.error("Design not found for quote creation.");
      updateParams({ createFromEstimateId: null });
      return;
    }

    void createDraftQuoteFromEstimate(createFromEstimateId).catch((err) => {
      const msg = err instanceof Error ? err.message : "Failed to create quote";
      toast.error(msg);
      updateParams({ createFromEstimateId: null });
    });
  }, [
    createDraftQuoteFromEstimate,
    createFromEstimateId,
    estimates,
    estimatesLoading,
    projectId,
    toast,
    updateParams,
  ]);

  const persistDraft = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!detail || detail.status !== "DRAFT") return detail;
      if (!draftDirty) return detail;
      if (draftSyncPending) {
        if (!opts?.silent) {
          toast.info(
            "Wait for the current draft save to be confirmed before saving more changes.",
          );
        }
        return detail;
      }

      setSavingDraft(true);
      try {
        const patch = {
          reference: draftReference,
          introText: draftIntro,
          termsText: draftTerms,
          depositPercent: parsePercentInput(draftDepositPercent),
          expiresAt: draftExpiry || null,
          lineItems: effectiveDraftItems.map((item) => ({
            description: item.description,
            qty: item.qty,
            unitPriceIncGstCents: item.unitPriceIncGstCents,
          })),
        };
        const updated = applyDraftPatchToQuoteDetail(detail, patch);
        upsertQuoteDetailCache(queryClient, hostKey, projectId, updated);
        await writeLocalFirstWorkingCopy({
          entityKey: buildQuoteEntityKey(detail.id),
          data: updated,
        });

        const mutationPayload: PortalQuoteUpdateMutationPayload = {
          quoteVersionId: detail.id,
          patch,
          expectedCommercialRevision: detail.commercialRevision,
        };
        await enqueueAndProcessLocalFirstMutation({
          entityKey: buildQuoteEntityKey(detail.id),
          mutationKey: PORTAL_LOCAL_FIRST_MUTATIONS.quoteUpdateDraft,
          payload: mutationPayload,
        });

        setDraftItems(updated.lineItems);
        setUnitInputDrafts({});
        setActiveUnitInputId(null);
        setDraftReference(updated.reference ?? "");
        setDraftIntro(updated.introText ?? "");
        setDraftTerms(updated.termsText ?? "");
        setDraftDepositPercent(formatPercentInput(updated.depositPercent));
        setDraftExpiry(updated.expiresAt ?? "");
        if (!opts?.silent) {
          toast.success("Draft saved locally. Syncing in the background.");
        }
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save draft";
        toast.error(msg);
        return null;
      } finally {
        setSavingDraft(false);
      }
    },
    [
      detail,
      draftDepositPercent,
      draftDirty,
      draftExpiry,
      draftIntro,
      draftReference,
      draftTerms,
      draftSyncPending,
      effectiveDraftItems,
      hostKey,
      projectId,
      queryClient,
      toast,
    ],
  );

  const openSendModal = useCallback(
    (
      mode: "send" | "resend",
      editorMode: SendEditorMode = "compose",
      sourceDetail?: QuoteVersionDetail | null,
    ) => {
      const quoteForModal = sourceDetail ?? detail;
      if (!quoteForModal) return;
      const to = quoteForModal.contact?.email ?? "";
      setSendMode(mode);
      setSendTo(to);
      setSendSubject(defaultSubject(quoteForModal.quoteRef));
      setSendPersonalNote(defaultPersonalNote());
      setSendAttachments([]);
      setSendEditorMode(editorMode);
      setSendIntentId(recoverDeliveryIntentId(quoteForModal.id, mode));
      resetSendReviewPdf();
      setSendError(null);
      setSendOpen(true);
      setMoreActionsOpen(false);
    },
    [detail, resetSendReviewPdf],
  );

  const closeSendModal = useCallback(() => {
    setSendAttachments([]);
    setSendEditorMode("compose");
    resetSendReviewPdf();
    setSendError(null);
    setSendIntentId("");
    setSendOpen(false);
  }, [resetSendReviewPdf]);

  const handleReviewAndSend = useCallback(async () => {
    if (!detail) return;
    if (
      detail.id.startsWith("local-quote:") ||
      draftSyncPending ||
      draftDirty
    ) {
      if (draftDirty) {
        await persistDraft({ silent: true });
      }
      toast.info(
        "Saving this draft to the server. Review & Send will be available once sync completes.",
      );
      return;
    }
    if (!detail.isCurrentDraft) {
      toast.error("This draft has been superseded and cannot be sent.");
      return;
    }
    openSendModal("send", "review", detail);
  }, [
    detail,
    draftDirty,
    draftSyncPending,
    openSendModal,
    persistDraft,
    toast,
  ]);

  const handleSend = async () => {
    if (!detail || sendBusy) return;
    if (!sendIntentId) {
      toast.error("Delivery review has expired. Close and reopen it.");
      return;
    }
    if (
      sendMode === "send" &&
      (draftDirty || draftSyncPending || detail.id.startsWith("local-quote:"))
    ) {
      toast.error("Wait for the server-confirmed draft before sending.");
      return;
    }
    const to = sendTo
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (!to.length) {
      toast.error("Recipient email is required.");
      return;
    }
    if (!sendSubject.trim()) {
      toast.error("Subject is required.");
      return;
    }
    let totalBytes = 0;
    for (const file of sendAttachments) {
      const attachmentError = validateAttachment(file);
      if (attachmentError) {
        setSendError(attachmentError);
        toast.error(attachmentError);
        return;
      }
      totalBytes += file.size;
    }
    if (totalBytes > MAX_ATTACHMENTS_TOTAL_BYTES) {
      const message = "Combined attachment size must be 4MB or smaller.";
      setSendError(message);
      toast.error(message);
      return;
    }
    setSendBusy(true);
    setSendError(null);
    rememberDeliveryIntentId(detail.id, sendMode, sendIntentId);
    try {
      const updated =
        sendMode === "send"
          ? await sendQuote(detail.id, {
              intentId: sendIntentId,
              expectedCommercialRevision: detail.commercialRevision,
              to,
              subject: sendSubject,
              personalNote: sendPersonalNote,
              attachments: sendAttachments,
            })
          : await resendQuote(detail.id, {
              intentId: sendIntentId,
              expectedCommercialRevision: detail.commercialRevision,
              to,
              subject: sendSubject,
              personalNote: sendPersonalNote,
              attachments: sendAttachments,
            });
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      setDraftItems(updated.lineItems);
      setUnitInputDrafts({});
      setActiveUnitInputId(null);
      forgetDeliveryIntentId(detail.id, sendMode);
      closeSendModal();
      await refreshQuotes();
      toast.success(sendMode === "send" ? "Quote sent." : "Quote resent.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send quote";
      if (
        msg.includes("changed after this delivery review") ||
        msg.includes("no longer available for delivery") ||
        msg.includes("already prepared") ||
        msg.includes("prior delivery") ||
        msg.includes("superseded")
      ) {
        forgetDeliveryIntentId(detail.id, sendMode);
        setSendIntentId("");
        setSendOpen(false);
        await refreshQuotes();
        toast.error(
          msg.includes("already prepared") || msg.includes("prior delivery")
            ? "A prepared delivery already owns this quote. Review that exact delivery before retrying or resending."
            : "Delivery was cancelled because the server quote changed. Review the current version before sending.",
        );
        return;
      }
      setSendError(msg);
      toast.error(msg);
    } finally {
      setSendBusy(false);
    }
  };

  const openPreparedDeliveryRetry = useCallback(async () => {
    if (!detail) return;
    setPreparedRetryOpen(true);
    setPreparedRetryLoading(true);
    setPreparedRetryError(null);
    setPreparedDelivery(null);
    setMoreActionsOpen(false);
    try {
      setPreparedDelivery(
        await getPreparedQuoteDelivery(
          detail.id,
          detail.unfinishedDelivery?.mode ?? "send",
        ),
      );
    } catch (error) {
      setPreparedRetryError(
        error instanceof Error
          ? error.message
          : "Failed to load the prepared delivery",
      );
    } finally {
      setPreparedRetryLoading(false);
    }
  }, [detail]);

  const closePreparedDeliveryRetry = useCallback(() => {
    if (preparedRetryBusy) return;
    setPreparedRetryOpen(false);
    setPreparedRetryError(null);
    setPreparedDelivery(null);
  }, [preparedRetryBusy]);

  const handlePreparedDeliveryRetry = useCallback(async () => {
    if (!detail || !preparedDelivery?.canRetry || preparedRetryBusy) return;
    setPreparedRetryBusy(true);
    setPreparedRetryError(null);
    try {
      const updated = await retryPreparedQuoteDelivery(
        detail.id,
        preparedDelivery.mode,
        detail.commercialRevision,
      );
      queryClient.setQueryData(qk.quotes.detail(hostKey, updated.id), updated);
      forgetDeliveryIntentId(detail.id, preparedDelivery.mode);
      setPreparedRetryOpen(false);
      setPreparedDelivery(null);
      await refreshQuotes();
      toast.success("Prepared quote delivery completed.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to retry the prepared delivery";
      setPreparedRetryError(message);
      toast.error(message);
      try {
        setPreparedDelivery(
          await getPreparedQuoteDelivery(detail.id, preparedDelivery.mode),
        );
      } catch {
        await refreshQuotes();
      }
    } finally {
      setPreparedRetryBusy(false);
    }
  }, [
    detail,
    hostKey,
    preparedDelivery?.canRetry,
    preparedDelivery?.mode,
    preparedRetryBusy,
    queryClient,
    refreshQuotes,
    toast,
  ]);

  const handleSaveDraft = async () => {
    await persistDraft();
  };

  const handleDownloadDraftPdf = async () => {
    if (
      !detail ||
      detail.status !== "DRAFT" ||
      !previewDetail ||
      downloadingDraftPdf
    )
      return;
    setDownloadingDraftPdf(true);
    try {
      const cachedBytes =
        quotePdfPreviewCacheRef.current.get(quotePdfPreviewKey);
      const bytes = cachedBytes ?? (await previewQuotePdf(previewDetail));
      if (!cachedBytes && quotePdfPreviewKey) {
        quotePdfPreviewCacheRef.current.set(quotePdfPreviewKey, bytes);
      }
      downloadPdfBytes(bytes, quoteDraftFilename(previewDetail));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to download draft PDF";
      toast.error(msg);
    } finally {
      setDownloadingDraftPdf(false);
    }
  };

  const {
    revise: handleRevise,
    resend: handleResendClick,
    resolveExpiredQuote: handleExpiredResend,
    deleteDraft: handleDeleteDraft,
    openRefresh: openRefreshModal,
    refreshFromEstimate: handleRefreshFromEstimate,
    accept: handleAccept,
    acceptBusy,
    decline: handleDecline,
    generateJobPackForQuote: handleGenerateJobPack,
  } = useQuoteLifecycleActions({
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
  });

  const handleAddRow = () => {
    setDraftItems((prev) => [
      ...prev,
      {
        id: `tmp-${Date.now()}`,
        description: "",
        qty: 1,
        unitPriceIncGstCents: 0,
        lineTotalIncGstCents: 0,
        sortOrder: prev.length,
      },
    ]);
  };

  const handleDeleteRow = (idx: number) => {
    const removedId = draftItems[idx]?.id;
    if (removedId) {
      setActiveUnitInputId((prev) => (prev === removedId ? null : prev));
      setUnitInputDrafts((prev) => {
        if (!Object.prototype.hasOwnProperty.call(prev, removedId)) return prev;
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
    }
    setDraftItems((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((item, i) => ({ ...item, sortOrder: i })),
    );
  };

  const handleMoveRow = (idx: number, direction: -1 | 1) => {
    setDraftItems((prev) => {
      const next = prev.slice();
      const target = idx + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next.map((entry, i) => ({ ...entry, sortOrder: i }));
    });
  };

  if (selectedId && detailLoading) {
    return <QuoteDetailPendingView onBack={() => selectQuote(null)} />;
  }

  if (selectedId && quoteDetailQuery.error) {
    const message =
      quoteDetailQuery.error instanceof Error
        ? quoteDetailQuery.error.message
        : String(quoteDetailQuery.error);
    return (
      <div
        className={styles.wrapper}
        role="region"
        aria-label="Quote detail"
        data-quotes-view="detail"
      >
        <button
          type="button"
          className={styles.backButton}
          onClick={() => selectQuote(null)}
        >
          &lt; Back
        </button>
        <DataStatePanel
          state="error"
          title="Could not load this quote"
          description={message}
          onRetry={() => void quoteDetailQuery.refetch()}
        />
      </div>
    );
  }

  if (selectedId && detail) {
    const generatedJobPack =
      generatedJobPacks.find(
        (jobPack) => jobPack.quoteVersionId === detail.id,
      ) ?? null;
    const canGenerateJobPack =
      (detail.status === "SENT" ||
        detail.status === "ACCEPTED" ||
        detail.status === "DECLINED") &&
      !generatedJobPack;
    const openJobPackHref = generatedJobPack
      ? `/staff/projects/${encodeURIComponent(projectId)}?tab=job-packs&estimateId=${encodeURIComponent(
          generatedJobPack.estimateId,
        )}&sheet=materials`
      : null;

    return (
      <QuoteDetailView
        projectId={projectId}
        detail={detail}
        draftDirty={draftDirty}
        draftSyncPending={draftSyncPending}
        guardUnsavedDraft={guardUnsavedDraft}
        selectQuote={(quoteId) => selectQuote(quoteId)}
        savingDraft={savingDraft}
        reviewAndSend={() => void handleReviewAndSend()}
        retryPreparedDelivery={() => void openPreparedDeliveryRetry()}
        resend={handleResendClick}
        revise={() => void handleRevise()}
        moreActionsOpen={moreActionsOpen}
        setMoreActionsOpen={setMoreActionsOpen}
        refreshEstimateTarget={refreshEstimateTarget}
        refreshUsesLatestDesign={refreshUsesLatestDesign}
        refreshBusy={refreshBusy}
        openRefresh={openRefreshModal}
        downloadingDraftPdf={downloadingDraftPdf}
        downloadDraftPdf={() => void handleDownloadDraftPdf()}
        saveDraft={() => void handleSaveDraft()}
        openDeleteConfirm={() => {
          setDeleteConfirmOpen(true);
          setMoreActionsOpen(false);
        }}
        openJobPackHref={openJobPackHref}
        canGenerateJobPack={canGenerateJobPack}
        generateJobPack={() => void handleGenerateJobPack()}
        jobPackBusy={jobPackBusy}
        pagePreviewFromUrl={pagePreviewFromUrl}
        quotePdfPreviewLoading={quotePdfPreviewLoading}
        quotePdfPreviewError={quotePdfPreviewError}
        quotePdfPreviewData={quotePdfPreviewData}
        quotePdfPreviewKey={quotePdfPreviewKey}
        draftExpiry={draftExpiry}
        setDraftExpiry={setDraftExpiry}
        draftReference={draftReference}
        setDraftReference={setDraftReference}
        draftDepositPercent={draftDepositPercent}
        setDraftDepositPercent={setDraftDepositPercent}
        draftItems={draftItems}
        setDraftItems={setDraftItems}
        unitInputDrafts={unitInputDrafts}
        setUnitInputDrafts={setUnitInputDrafts}
        activeUnitInputId={activeUnitInputId}
        setActiveUnitInputId={setActiveUnitInputId}
        getLiveUnitPriceIncGstCents={getLiveUnitPriceIncGstCents}
        parsedPergolaDrafts={parsedPergolaDrafts}
        draftPergolaOverrideMode={draftPergolaOverrideMode}
        setDraftPergolaOverrideMode={setDraftPergolaOverrideMode}
        updateDraftItemDescription={updateDraftItemDescription}
        updatePergolaModule={updatePergolaModule}
        updatePergolaSharedField={updatePergolaSharedField}
        commitUnitPriceDraft={commitUnitPriceDraft}
        moveRow={handleMoveRow}
        deleteRow={handleDeleteRow}
        addRow={handleAddRow}
        detailTotals={detailTotals}
        draftIntro={draftIntro}
        setDraftIntro={setDraftIntro}
        draftTerms={draftTerms}
        setDraftTerms={setDraftTerms}
        accept={() => void handleAccept()}
        acceptBusy={acceptBusy}
        decline={() => void handleDecline()}
        dialogs={
          <QuoteWorkflowDialogs
            detail={detail}
            refreshConfirmOpen={refreshConfirmOpen}
            refreshUsesLatestDesign={refreshUsesLatestDesign}
            refreshEstimateTarget={refreshEstimateTarget}
            refreshBusy={refreshBusy}
            refreshMode={refreshMode}
            setRefreshMode={setRefreshMode}
            refreshPreviewLoading={refreshPreviewLoading}
            refreshPreviewError={refreshPreviewError}
            refreshPreview={refreshPreview}
            closeRefresh={() => setRefreshConfirmOpen(false)}
            confirmRefresh={() => void handleRefreshFromEstimate()}
            preparedRetryOpen={preparedRetryOpen}
            preparedRetryLoading={preparedRetryLoading}
            preparedRetryBusy={preparedRetryBusy}
            preparedRetryError={preparedRetryError}
            preparedDelivery={preparedDelivery}
            closePreparedRetry={closePreparedDeliveryRetry}
            retryPreparedDelivery={() => void handlePreparedDeliveryRetry()}
            sendOpen={sendOpen}
            sendMode={sendMode}
            sendEditorMode={sendEditorMode}
            setSendEditorMode={setSendEditorMode}
            sendTo={sendTo}
            setSendTo={setSendTo}
            sendSubject={sendSubject}
            setSendSubject={setSendSubject}
            sendPersonalNote={sendPersonalNote}
            setSendPersonalNote={setSendPersonalNote}
            sendAttachments={sendAttachments}
            setSendAttachments={setSendAttachments}
            sendError={sendError}
            setSendError={setSendError}
            draftDirty={draftDirty}
            draftSyncPending={draftSyncPending}
            sendReviewPdfLoading={sendReviewPdfLoading}
            sendReviewPdfError={sendReviewPdfError}
            sendReviewPdfData={sendReviewPdfData}
            sendBusy={sendBusy}
            closeSend={closeSendModal}
            sendQuote={() => void handleSend()}
            expiredPromptOpen={expiredPromptOpen}
            closeExpiredPrompt={() => setExpiredPromptOpen(false)}
            resolveExpiredQuote={(mode) => void handleExpiredResend(mode)}
            deleteConfirmOpen={deleteConfirmOpen}
            closeDeleteConfirm={() => setDeleteConfirmOpen(false)}
            deleteDraft={() => void handleDeleteDraft()}
          />
        }
      />
    );
  }

  return (
    <QuotesListView
      quotes={quotes}
      quotesLoading={quotesLoading}
      quotesError={quotesError}
      retryQuotes={() => void quotesQuery.refetch()}
      openCreate={openCreateModal}
      selectQuote={(quoteId) => selectQuote(quoteId)}
      prefetchQuoteDetail={prefetchQuoteDetail}
      createOpen={createOpen}
      closeCreate={() => setCreateOpen(false)}
      createEstimateId={createEstimateId}
      setCreateEstimateId={setCreateEstimateId}
      estimatesLoading={estimatesLoading}
      estimates={estimates}
      createQuote={() => void handleCreateQuote()}
    />
  );
}
