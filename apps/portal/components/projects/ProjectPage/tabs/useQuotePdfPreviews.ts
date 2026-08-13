"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MutableRefObject,
} from "react";
import { previewQuotePdf, quotePdfUrl } from "@/lib/quotes/quotesRepo";
import type { QuoteVersionDetail } from "@/lib/quotes/types";
import {
  QUOTE_PREVIEW_DEBOUNCE_MS,
  readErrorMessage,
  validateQuotePreviewPdf,
  type SendEditorMode,
} from "./quotesTabModel";

type UseQuotePdfPreviewsInput = {
  pagePreviewFromUrl: boolean;
  previewDetail: QuoteVersionDetail | null;
  sendOpen: boolean;
  sendEditorMode: SendEditorMode;
  reviewQuoteDetail: QuoteVersionDetail | null;
  cacheRef: MutableRefObject<Map<string, Uint8Array>>;
};

export function useQuotePdfPreviews({
  pagePreviewFromUrl,
  previewDetail,
  sendOpen,
  sendEditorMode,
  reviewQuoteDetail,
  cacheRef,
}: UseQuotePdfPreviewsInput) {
  const [quotePdfPreviewData, setQuotePdfPreviewData] =
    useState<Uint8Array | null>(null);
  const [quotePdfPreviewLoading, setQuotePdfPreviewLoading] = useState(false);
  const [quotePdfPreviewError, setQuotePdfPreviewError] = useState<
    string | null
  >(null);
  const [sendReviewPdfData, setSendReviewPdfData] = useState<Uint8Array | null>(
    null,
  );
  const [sendReviewPdfLoading, setSendReviewPdfLoading] = useState(false);
  const [sendReviewPdfError, setSendReviewPdfError] = useState<string | null>(
    null,
  );

  const quotePdfPreviewSrc = useMemo(
    () =>
      previewDetail && previewDetail.status !== "DRAFT"
        ? quotePdfUrl(previewDetail.id, { inline: true })
        : "",
    [previewDetail],
  );

  const quotePdfPreviewKey = useMemo(() => {
    if (!previewDetail) return "";
    if (
      typeof previewDetail.renderHash === "string" &&
      previewDetail.renderHash.trim()
    ) {
      return previewDetail.renderHash.trim();
    }
    const lineSignature = previewDetail.lineItems
      .map(
        (item) =>
          `${item.description}:${item.qty}:${item.unitPriceIncGstCents}`,
      )
      .join("|");
    return [
      previewDetail.id,
      previewDetail.status,
      previewDetail.sentAt ?? "",
      previewDetail.expiresAt ?? "",
      previewDetail.reference ?? "",
      previewDetail.depositPercent,
      previewDetail.introText ?? "",
      previewDetail.termsText ?? "",
      previewDetail.totals.totalIncGstCents,
      lineSignature,
    ].join("::");
  }, [previewDetail]);

  useEffect(() => {
    return () => {
      cacheRef.current.clear();
    };
  }, [cacheRef]);

  useEffect(() => {
    if (!pagePreviewFromUrl || !previewDetail) {
      setQuotePdfPreviewLoading(false);
      setQuotePdfPreviewError(null);
      setQuotePdfPreviewData(null);
      return;
    }

    const abortController = new AbortController();
    setQuotePdfPreviewLoading(true);
    setQuotePdfPreviewError(null);

    const cachedData = cacheRef.current.get(quotePdfPreviewKey);
    if (cachedData) {
      setQuotePdfPreviewLoading(false);
      setQuotePdfPreviewError(null);
      setQuotePdfPreviewData(cachedData);
      return () => {
        abortController.abort();
      };
    }

    const loadPreview = async () => {
      try {
        let contentType: string | null = "application/pdf";
        let bytes: Uint8Array;

        if (previewDetail.status === "DRAFT") {
          bytes = await previewQuotePdf(previewDetail, {
            signal: abortController.signal,
          });
        } else {
          const response = await fetch(quotePdfPreviewSrc, {
            method: "GET",
            credentials: "same-origin",
            signal: abortController.signal,
          });
          if (!response.ok) {
            const message = await readErrorMessage(
              response,
              `Failed to load quote preview (${response.status})`,
            );
            throw new Error(message);
          }
          contentType = response.headers.get("content-type");
          bytes = new Uint8Array(await response.arrayBuffer());
        }
        if (abortController.signal.aborted) return;
        const validationError = validateQuotePreviewPdf(contentType, bytes);
        if (validationError) throw new Error(validationError);
        if (
          contentType &&
          !contentType.toLowerCase().includes("application/pdf")
        ) {
          console.warn("[quote_preview] unexpected PDF content type", {
            contentType,
            byteLength: bytes.byteLength,
          });
        }
        if (quotePdfPreviewKey) cacheRef.current.set(quotePdfPreviewKey, bytes);
        setQuotePdfPreviewData(bytes);
      } catch (error) {
        if (abortController.signal.aborted) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load quote preview";
        console.error("[quote_preview] failed to fetch preview PDF", {
          error,
          quoteVersionId: previewDetail.id,
        });
        setQuotePdfPreviewError(message);
        setQuotePdfPreviewData(null);
      } finally {
        if (!abortController.signal.aborted) setQuotePdfPreviewLoading(false);
      }
    };

    const timeout = window.setTimeout(
      () => void loadPreview(),
      previewDetail.status === "DRAFT" ? QUOTE_PREVIEW_DEBOUNCE_MS : 0,
    );
    return () => {
      abortController.abort();
      window.clearTimeout(timeout);
    };
  }, [
    cacheRef,
    pagePreviewFromUrl,
    previewDetail,
    quotePdfPreviewKey,
    quotePdfPreviewSrc,
  ]);

  useEffect(() => {
    if (!sendOpen || sendEditorMode !== "review" || !reviewQuoteDetail) {
      setSendReviewPdfData(null);
      setSendReviewPdfError(null);
      setSendReviewPdfLoading(false);
      return;
    }

    const abortController = new AbortController();
    const cacheKey = [
      reviewQuoteDetail.id,
      reviewQuoteDetail.status,
      reviewQuoteDetail.expiresAt ?? "",
      reviewQuoteDetail.reference ?? "",
      reviewQuoteDetail.depositPercent,
      reviewQuoteDetail.totals.totalIncGstCents,
      reviewQuoteDetail.lineItems
        .map(
          (item) =>
            `${item.description}:${item.qty}:${item.unitPriceIncGstCents}`,
        )
        .join("|"),
    ].join("::review::");
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setSendReviewPdfData(cached);
      setSendReviewPdfError(null);
      setSendReviewPdfLoading(false);
      return () => {
        abortController.abort();
      };
    }

    setSendReviewPdfLoading(true);
    setSendReviewPdfError(null);
    setSendReviewPdfData(null);

    void (async () => {
      try {
        let bytes: Uint8Array;
        if (reviewQuoteDetail.status === "DRAFT") {
          bytes = await previewQuotePdf(reviewQuoteDetail, {
            signal: abortController.signal,
          });
        } else {
          const response = await fetch(
            quotePdfUrl(reviewQuoteDetail.id, { inline: true }),
            {
              method: "GET",
              credentials: "same-origin",
              signal: abortController.signal,
            },
          );
          if (!response.ok) {
            throw new Error(await readErrorMessage(
              response,
              `Failed to load quote PDF (${response.status})`,
            ));
          }
          bytes = new Uint8Array(await response.arrayBuffer());
        }
        if (abortController.signal.aborted) return;
        cacheRef.current.set(cacheKey, bytes);
        setSendReviewPdfData(bytes);
      } catch (error) {
        if (abortController.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Failed to load quote PDF";
        setSendReviewPdfError(message);
        setSendReviewPdfData(null);
      } finally {
        if (!abortController.signal.aborted) setSendReviewPdfLoading(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [cacheRef, reviewQuoteDetail, sendEditorMode, sendOpen]);

  const resetSendReviewPdf = useCallback(() => {
    setSendReviewPdfData(null);
    setSendReviewPdfError(null);
    setSendReviewPdfLoading(false);
  }, []);

  return {
    quotePdfPreviewData,
    quotePdfPreviewLoading,
    quotePdfPreviewError,
    quotePdfPreviewKey,
    sendReviewPdfData,
    sendReviewPdfLoading,
    sendReviewPdfError,
    resetSendReviewPdf,
  };
}
