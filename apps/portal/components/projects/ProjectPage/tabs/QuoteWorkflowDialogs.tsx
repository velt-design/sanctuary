"use client";

import type { Dispatch, SetStateAction } from "react";
import { useToast } from "@/components/ui/toast/ToastProvider";
import type { EstimateMeta } from "@/lib/estimates/types";
import type {
  PreparedQuoteDeliverySummary,
  QuoteVersionDetail,
} from "@/lib/quotes/types";
import type {
  QuoteRefreshMode,
  QuoteRefreshPreview,
} from "@/lib/quotes/refresh";
import styles from "./QuotesTab.module.css";
import QuotePdfInlinePreview from "./QuotePdfInlinePreview";
import QuoteEmailPreviewPanel from "./QuoteEmailPreviewPanel";
import QuoteModal from "./QuoteWorkflowModal";
import CommercialFinalFailureGuidance from "@/components/commercial/CommercialFinalFailureGuidance";
import {
  ATTACHMENT_INPUT_ACCEPT,
  MAX_ATTACHMENT_COUNT,
  MAX_ATTACHMENTS_TOTAL_BYTES,
  formatFileSize,
  formatDateTime,
  formatRefreshModeLabel,
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
  preparedRetryOpen: boolean;
  preparedRetryLoading: boolean;
  preparedRetryBusy: boolean;
  preparedRetryError: string | null;
  preparedDelivery: PreparedQuoteDeliverySummary | null;
  closePreparedRetry: () => void;
  retryPreparedDelivery: () => void;
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
  preparedRetryOpen,
  preparedRetryLoading,
  preparedRetryBusy,
  preparedRetryError,
  preparedDelivery,
  closePreparedRetry,
  retryPreparedDelivery,
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

      {preparedRetryOpen ? (
        <QuoteModal
          label="Review prepared delivery"
          onClose={closePreparedRetry}
        >
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>Review prepared delivery</h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closePreparedRetry}
              disabled={preparedRetryBusy}
            >
              Close
            </button>
          </div>
          <div className={styles.modalBody}>
            <p className={styles.modalBodyText}>
              This retry reuses the exact recipients, content, token, PDF and
              attachments frozen before the first provider attempt. Nothing
              below can be edited.
            </p>
            {preparedRetryLoading ? (
              <p className={styles.note}>Loading prepared delivery...</p>
            ) : null}
            {preparedDelivery ? (
              <>
                <div className={styles.previewMetaGrid}>
                  <div className={styles.previewMetaItem}>
                    <div className={styles.metaLabel}>To</div>
                    <div className={styles.previewMetaValue}>
                      {preparedDelivery.to.join(", ") || "—"}
                    </div>
                  </div>
                  <div className={styles.previewMetaItem}>
                    <div className={styles.metaLabel}>Subject</div>
                    <div className={styles.previewMetaValue}>
                      {preparedDelivery.subject}
                    </div>
                  </div>
                  <div className={styles.previewMetaItem}>
                    <div className={styles.metaLabel}>Prepared</div>
                    <div className={styles.previewMetaValue}>
                      {formatDateTime(preparedDelivery.preparedAt)}
                    </div>
                  </div>
                  <div className={styles.previewMetaItem}>
                    <div className={styles.metaLabel}>Action / state</div>
                    <div className={styles.previewMetaValue}>
                      {preparedDelivery.mode === "send"
                        ? "Initial send"
                        : "Resend"}{" "}
                      · {preparedDelivery.status.replaceAll("_", " ")}
                    </div>
                  </div>
                </div>
                {preparedDelivery.cc.length || preparedDelivery.bcc.length ? (
                  <div className={styles.previewMetaGrid}>
                    {preparedDelivery.cc.length ? (
                      <div className={styles.previewMetaItem}>
                        <div className={styles.metaLabel}>CC</div>
                        <div className={styles.previewMetaValue}>
                          {preparedDelivery.cc.join(", ")}
                        </div>
                      </div>
                    ) : null}
                    {preparedDelivery.bcc.length ? (
                      <div className={styles.previewMetaItem}>
                        <div className={styles.metaLabel}>BCC</div>
                        <div className={styles.previewMetaValue}>
                          {preparedDelivery.bcc.join(", ")}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.previewMetaItem}>
                  <div className={styles.metaLabel}>Attachments</div>
                  <div className={styles.previewMetaValue}>
                    {preparedDelivery.attachmentNames.join(", ") || "—"}
                  </div>
                </div>
                {preparedDelivery.bodyText ? (
                  <>
                    <label className={styles.metaLabel} htmlFor="preparedBody">
                      Frozen plain-text email
                    </label>
                    <textarea
                      id="preparedBody"
                      className={styles.textarea}
                      value={preparedDelivery.bodyText}
                      readOnly
                      rows={9}
                    />
                  </>
                ) : null}
                {!preparedDelivery.canRetry ? (
                  <CommercialFinalFailureGuidance
                    artifact="quote"
                    reference={detail.quoteRef}
                    evidence="the prepared time above"
                    errorReference={preparedDelivery.lastErrorCode || "DELIVERY_NEEDS_ATTENTION"}
                    className={styles.errorText}
                  />
                ) : null}
              </>
            ) : null}
            {preparedRetryError ? (
              <div className={styles.errorText}>{preparedRetryError}</div>
            ) : null}
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closePreparedRetry}
              disabled={preparedRetryBusy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={retryPreparedDelivery}
              disabled={
                preparedRetryBusy ||
                preparedRetryLoading ||
                !preparedDelivery?.canRetry
              }
            >
              {preparedRetryBusy
                ? "Retrying..."
                : "Retry exact prepared delivery"}
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
                  <div className={styles.metaLabel}>Prepared for</div>
                  <div className={styles.previewMetaValue}>
                    {detail.customerName || "Customer"}
                  </div>
                  <div className={styles.metaValueMuted}>
                    Snapshot preserved on this quote version
                  </div>
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
                  Sending is blocked until this draft is confirmed by the
                  server. Close this review, wait for sync, then review again.
                </div>
              ) : null}
              <QuoteEmailPreviewPanel
                active={sendOpen && sendEditorMode === "review"}
                quoteVersionId={detail.id}
                mode={sendMode}
                to={sendTo}
                subject={sendSubject}
                personalNote={sendPersonalNote}
                attachmentNames={sendAttachments.map((file) => file.name)}
              />
              <div className={styles.quotePdfPreviewHeader}>
                <div className={styles.metaLabel}>Attached quote PDF</div>
                <p className={styles.emailPreviewHint}>
                  The PDF below is attached automatically.
                </p>
              </div>
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
                  disabled={
                    sendBusy ||
                    (sendMode === "send" &&
                      (draftDirty || draftSyncPending))
                  }
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

    </>
  );
}
