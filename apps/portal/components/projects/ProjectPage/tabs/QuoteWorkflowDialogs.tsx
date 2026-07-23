"use client";

import type { Dispatch, SetStateAction } from "react";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { EstimateMeta } from "@/lib/estimates/types";
import type { QuoteVersionDetail } from "@/lib/quotes/types";
import type {
  QuoteRefreshMode,
  QuoteRefreshPreview,
} from "@/lib/quotes/refresh";
import styles from "./QuotesTab.module.css";
import QuotePdfInlinePreview from "./QuotePdfInlinePreview";
import QuoteModal from "./QuoteWorkflowModal";
import {
  ATTACHMENT_INPUT_ACCEPT,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  formatFileSize,
  formatPercentInput,
  formatRefreshModeLabel,
  normalizePercentInput,
  parsePercentInput,
  renderPersonalNoteSummary,
  validateAttachment,
  type SendEditorMode,
} from "./quotesTabModel";

type SendMode = "send" | "resend";
type ExpiredQuoteMode = "resend" | "revise";

type QuoteWorkflowDialogsProps = {
  detail: QuoteVersionDetail;
  refreshConfirmOpen: boolean;
  refreshUsesLatestDesign: boolean;
  refreshEstimateTarget: EstimateMeta | null;
  refreshBusy: boolean;
  refreshMode: QuoteRefreshMode;
  setRefreshMode: Dispatch<SetStateAction<QuoteRefreshMode>>;
  refreshPreviewLoading: boolean;
  refreshPreviewError: string | null;
  refreshPreview: QuoteRefreshPreview | null;
  closeRefresh: () => void;
  confirmRefresh: () => void;
  invoiceOpen: boolean;
  invoiceBusy: boolean;
  invoiceDepositPercent: string;
  setInvoiceDepositPercent: Dispatch<SetStateAction<string>>;
  invoiceDueDate: string;
  setInvoiceDueDate: Dispatch<SetStateAction<string>>;
  invoiceReference: string;
  setInvoiceReference: Dispatch<SetStateAction<string>>;
  invoiceError: string | null;
  closeInvoice: () => void;
  createInvoice: (sendNow: boolean) => void;
  sendOpen: boolean;
  sendMode: SendMode;
  sendEditorMode: SendEditorMode;
  setSendEditorMode: Dispatch<SetStateAction<SendEditorMode>>;
  sendTo: string;
  setSendTo: Dispatch<SetStateAction<string>>;
  sendSubject: string;
  setSendSubject: Dispatch<SetStateAction<string>>;
  sendPersonalNote: string;
  setSendPersonalNote: Dispatch<SetStateAction<string>>;
  sendAttachments: File[];
  setSendAttachments: Dispatch<SetStateAction<File[]>>;
  sendError: string | null;
  setSendError: Dispatch<SetStateAction<string | null>>;
  draftDirty: boolean;
  draftSyncPending: boolean;
  sendReviewPdfLoading: boolean;
  sendReviewPdfError: string | null;
  sendReviewPdfData: Uint8Array | null;
  sendBusy: boolean;
  closeSend: () => void;
  sendQuote: () => void;
  expiredPromptOpen: boolean;
  closeExpiredPrompt: () => void;
  resolveExpiredQuote: (mode: ExpiredQuoteMode) => void;
  deleteConfirmOpen: boolean;
  closeDeleteConfirm: () => void;
  deleteDraft: () => void;
};

export default function QuoteWorkflowDialogs({
  detail,
  refreshConfirmOpen,
  refreshUsesLatestDesign,
  refreshEstimateTarget,
  refreshBusy,
  refreshMode,
  setRefreshMode,
  refreshPreviewLoading,
  refreshPreviewError,
  refreshPreview,
  closeRefresh,
  confirmRefresh,
  invoiceOpen,
  invoiceBusy,
  invoiceDepositPercent,
  setInvoiceDepositPercent,
  invoiceDueDate,
  setInvoiceDueDate,
  invoiceReference,
  setInvoiceReference,
  invoiceError,
  closeInvoice,
  createInvoice,
  sendOpen,
  sendMode,
  sendEditorMode,
  setSendEditorMode,
  sendTo,
  setSendTo,
  sendSubject,
  setSendSubject,
  sendPersonalNote,
  setSendPersonalNote,
  sendAttachments,
  setSendAttachments,
  sendError,
  setSendError,
  draftDirty,
  draftSyncPending,
  sendReviewPdfLoading,
  sendReviewPdfError,
  sendReviewPdfData,
  sendBusy,
  closeSend,
  sendQuote,
  expiredPromptOpen,
  closeExpiredPrompt,
  resolveExpiredQuote,
  deleteConfirmOpen,
  closeDeleteConfirm,
  deleteDraft,
}: QuoteWorkflowDialogsProps) {
  const toast = useToast();

  return (
    <>
      {refreshConfirmOpen ? (
        <QuoteModal
          label={
            refreshUsesLatestDesign
              ? "Refresh quote from latest design"
              : "Refresh quote from current design"
          }
          onClose={() => {
            if (!refreshBusy) closeRefresh();
          }}
        >
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>
              {refreshUsesLatestDesign
                ? "Refresh from latest design"
                : "Refresh from current design"}
            </h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeRefresh}
              disabled={refreshBusy}
            >
              Close
            </button>
          </div>
          <div className={styles.modalBody}>
            <p className={styles.modalBodyText}>
              {refreshUsesLatestDesign
                ? `Choose how to refresh this draft from ${refreshEstimateTarget?.versionLabel}.`
                : "Choose how to refresh this draft from the current design snapshot."}
            </p>
            <div className={styles.refreshModeList}>
              {(
                ["pricing_only", "generated_content", "full_rebuild"] as const
              ).map((modeValue) => (
                <label key={modeValue} className={styles.refreshModeOption}>
                  <input
                    type="radio"
                    name="refresh-mode"
                    checked={refreshMode === modeValue}
                    onChange={() => setRefreshMode(modeValue)}
                  />
                  <span>
                    <strong>{formatRefreshModeLabel(modeValue)}</strong>
                    <span className={styles.refreshModeDescription}>
                      {modeValue === "pricing_only"
                        ? "Update generated pricing and totals, keep wording and quote metadata."
                        : modeValue === "generated_content"
                          ? "Update generated wording, pricing, and totals, keep intro, terms, deposit, expiry, and reference."
                          : "Replace generated content and reset intro, terms, deposit, expiry, and reference to design defaults."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {refreshPreviewLoading ? (
              <p className={styles.note}>Loading refresh summary...</p>
            ) : null}
            {refreshPreviewError ? (
              <div className={styles.errorText}>{refreshPreviewError}</div>
            ) : null}
            {refreshPreview?.summary.length ? (
              <div className={styles.refreshSummaryCard}>
                <div className={styles.pergolaSectionTitle}>Change summary</div>
                <ul className={styles.refreshSummaryList}>
                  {refreshPreview.summary.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeRefresh}
              disabled={refreshBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={confirmRefresh}
              disabled={refreshBusy || refreshPreviewLoading}
            >
              {refreshBusy
                ? "Refreshing..."
                : formatRefreshModeLabel(refreshMode)}
            </button>
          </div>
        </QuoteModal>
      ) : null}

      {invoiceOpen ? (
        <QuoteModal
          label="Create invoice"
          onClose={() => {
            if (!invoiceBusy) closeInvoice();
          }}
        >
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>Create invoice</h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeInvoice}
            >
              Close
            </button>
          </div>
          <div className={styles.modalBody}>
            <p className={styles.modalBodyText}>
              Create a deposit invoice from this quote now, or create it first
              and send it later from the Invoices tab.
            </p>
            <label className={styles.metaLabel} htmlFor="invoiceDepositPercent">
              Deposit %
            </label>
            <input
              id="invoiceDepositPercent"
              className={styles.metaInput}
              inputMode="decimal"
              value={invoiceDepositPercent}
              onChange={(event) =>
                setInvoiceDepositPercent(
                  normalizePercentInput(event.target.value),
                )
              }
              onBlur={(event) =>
                setInvoiceDepositPercent(
                  formatPercentInput(parsePercentInput(event.target.value)),
                )
              }
            />
            <label className={styles.metaLabel} htmlFor="invoiceDueDate">
              Due date
            </label>
            <input
              id="invoiceDueDate"
              className={styles.metaInput}
              type="date"
              value={invoiceDueDate}
              onChange={(event) => setInvoiceDueDate(event.target.value)}
            />
            <label className={styles.metaLabel} htmlFor="invoiceReference">
              Reference
            </label>
            <input
              id="invoiceReference"
              className={styles.metaInput}
              value={invoiceReference}
              onChange={(event) => setInvoiceReference(event.target.value)}
            />
            {invoiceError ? (
              <div className={styles.errorText}>{invoiceError}</div>
            ) : null}
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeInvoice}
              disabled={invoiceBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => createInvoice(false)}
              disabled={invoiceBusy}
            >
              {invoiceBusy ? "Working..." : "Create only"}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => createInvoice(true)}
              disabled={invoiceBusy}
            >
              {invoiceBusy ? "Working..." : "Create & send"}
            </button>
          </div>
        </QuoteModal>
      ) : null}

      {sendOpen ? (
        <QuoteModal
          label={sendMode === "send" ? "Send quote" : "Resend quote"}
          onClose={closeSend}
          panelClassName={`${styles.modal} ${styles.modalWide} ${styles.sendModal}`}
          maxWidthPx={1120}
        >
          <div className={styles.sendModalTop}>
            <div className={styles.modalHeader}>
              <h4 className={styles.cardTitle}>
                {sendMode === "send" ? "Send quote" : "Resend quote"}
              </h4>
              <button
                type="button"
                className={styles.modalClose}
                onClick={closeSend}
              >
                Close
              </button>
            </div>
            <div
              className={styles.modalModeSwitch}
              role="tablist"
              aria-label="Email editor mode"
            >
              <button
                type="button"
                role="tab"
                aria-selected={sendEditorMode === "compose"}
                className={`${styles.modalModeButton} ${sendEditorMode === "compose" ? styles.modalModeButtonActive : ""}`}
                onClick={() => setSendEditorMode("compose")}
              >
                Edit email
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sendEditorMode === "review"}
                className={`${styles.modalModeButton} ${sendEditorMode === "review" ? styles.modalModeButtonActive : ""}`}
                onClick={() => setSendEditorMode("review")}
              >
                Review
              </button>
            </div>
          </div>
          {sendEditorMode === "compose" ? (
            <div className={`${styles.modalBody} ${styles.sendModalBody}`}>
              <label className={styles.metaLabel} htmlFor="sendTo">
                To
              </label>
              <input
                id="sendTo"
                className={styles.metaInput}
                value={sendTo}
                onChange={(event) => setSendTo(event.target.value)}
              />
              <label className={styles.metaLabel} htmlFor="sendSubject">
                Subject
              </label>
              <input
                id="sendSubject"
                className={styles.metaInput}
                value={sendSubject}
                onChange={(event) => setSendSubject(event.target.value)}
              />
              <label className={styles.metaLabel} htmlFor="sendBody">
                Personal note (optional)
              </label>
              <textarea
                id="sendBody"
                className={styles.textarea}
                value={sendPersonalNote}
                onChange={(event) => setSendPersonalNote(event.target.value)}
                rows={6}
                placeholder="Optional custom note to include in the template."
              />
              <label className={styles.metaLabel} htmlFor="sendAttachments">
                Attachments (optional)
              </label>
              <input
                id="sendAttachments"
                className={styles.fileInput}
                type="file"
                multiple
                accept={ATTACHMENT_INPUT_ACCEPT}
                onChange={(event) => {
                  const picked = Array.from(event.currentTarget.files ?? []);
                  event.currentTarget.value = "";
                  if (!picked.length) return;
                  const next: File[] = [...sendAttachments];
                  let runningTotal = sendAttachments.reduce(
                    (sum, file) => sum + file.size,
                    0,
                  );
                  for (const file of picked) {
                    if (next.length >= MAX_ATTACHMENT_COUNT) {
                      const message = `A quote email can include at most ${MAX_ATTACHMENT_COUNT} attachments.`;
                      setSendError(message);
                      toast.error(message);
                      break;
                    }
                    const validation = validateAttachment(file);
                    if (validation) {
                      setSendError(validation);
                      toast.error(validation);
                      continue;
                    }
                    if (
                      runningTotal + file.size >
                      MAX_ATTACHMENTS_TOTAL_BYTES
                    ) {
                      const message =
                        "Combined attachment size must be 4MB or smaller.";
                      setSendError(message);
                      toast.error(message);
                      break;
                    }
                    next.push(file);
                    runningTotal += file.size;
                  }
                  setSendAttachments(next);
                  if (next.length && !sendError) setSendError(null);
                }}
              />
              {sendAttachments.length ? (
                <ul className={styles.attachmentsList}>
                  {sendAttachments.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className={styles.attachmentRow}
                    >
                      <span className={styles.attachmentName}>
                        {file.name}{" "}
                        <span className={styles.attachmentSize}>
                          ({formatFileSize(file.size)})
                        </span>
                      </span>
                      <button
                        type="button"
                        className={styles.attachmentRemove}
                        onClick={() =>
                          setSendAttachments((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.attachmentsHint}>
                Quote PDF is attached automatically. You can add up to{" "}
                {MAX_ATTACHMENT_COUNT} additional files (PDF, JPG, PNG, WEBP),
                4MB combined. Larger files need to be hosted separately for now.
              </div>
              {sendError ? (
                <div className={styles.errorText}>{sendError}</div>
              ) : null}
            </div>
          ) : (
            <div
              className={`${styles.modalBody} ${styles.sendModalBody} ${styles.sendPreviewBody}`}
            >
              <div className={styles.previewMetaGrid}>
                <div className={styles.previewMetaItem}>
                  <div className={styles.metaLabel}>To</div>
                  <div className={styles.previewMetaValue}>{sendTo || "—"}</div>
                </div>
                <div className={styles.previewMetaItem}>
                  <div className={styles.metaLabel}>Subject</div>
                  <div className={styles.previewMetaValue}>
                    {sendSubject || "—"}
                  </div>
                </div>
              </div>
              <div className={styles.previewMetaGrid}>
                <div className={styles.previewMetaItem}>
                  <div className={styles.metaLabel}>Personal note</div>
                  <div className={styles.previewMetaValue}>
                    {renderPersonalNoteSummary(sendPersonalNote)}
                  </div>
                </div>
                <div className={styles.previewMetaItem}>
                  <div className={styles.metaLabel}>Attachments</div>
                  <div className={styles.previewMetaValue}>
                    Quote PDF
                    {sendAttachments.length
                      ? `, ${sendAttachments.map((file) => file.name).join(", ")}`
                      : ""}
                  </div>
                </div>
              </div>
              {sendMode === "send" && (draftDirty || draftSyncPending) ? (
                <div className={styles.metaWarning}>
                  This review is based on your current local draft changes.
                </div>
              ) : null}
              {sendReviewPdfLoading ? (
                <p className={styles.note}>Loading quote PDF...</p>
              ) : null}
              {sendReviewPdfError ? (
                <div className={styles.errorText}>{sendReviewPdfError}</div>
              ) : null}
              {!sendReviewPdfLoading &&
              !sendReviewPdfError &&
              !sendReviewPdfData ? (
                <p className={styles.note}>No PDF preview available.</p>
              ) : null}
              {!sendReviewPdfError && sendReviewPdfData ? (
                <div className={styles.quotePreviewFrameWrap}>
                  <QuotePdfInlinePreview data={sendReviewPdfData} />
                </div>
              ) : null}
            </div>
          )}
          <div className={`${styles.modalFooter} ${styles.sendModalFooter}`}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeSend}
            >
              Cancel
            </button>
            {sendEditorMode === "compose" ? (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => setSendEditorMode("review")}
              >
                Continue to review
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => setSendEditorMode("compose")}
                >
                  Back to edit
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={sendQuote}
                  disabled={sendBusy}
                >
                  {sendBusy
                    ? "Sending..."
                    : sendMode === "send"
                      ? "Send quote"
                      : "Resend quote"}
                </button>
              </>
            )}
          </div>
        </QuoteModal>
      ) : null}

      {expiredPromptOpen ? (
        <QuoteModal label="Quote expired" onClose={closeExpiredPrompt}>
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>Quote expired</h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeExpiredPrompt}
            >
              Close
            </button>
          </div>
          <p className={styles.modalBodyText}>
            This quote expired on {detail.expiresAt ?? "—"}. How would you like
            to proceed?
          </p>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => resolveExpiredQuote("resend")}
            >
              Resend as-is
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => resolveExpiredQuote("revise")}
            >
              Revise to extend expiry
            </button>
          </div>
        </QuoteModal>
      ) : null}

      {deleteConfirmOpen ? (
        <QuoteModal label="Delete draft quote" onClose={closeDeleteConfirm}>
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>Delete draft?</h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeDeleteConfirm}
            >
              Close
            </button>
          </div>
          <p className={styles.modalBodyText}>
            This will remove the draft quote version. Sent quotes cannot be
            deleted.
          </p>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeDeleteConfirm}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.dangerButton}
              onClick={deleteDraft}
            >
              Delete draft
            </button>
          </div>
        </QuoteModal>
      ) : null}
    </>
  );
}
