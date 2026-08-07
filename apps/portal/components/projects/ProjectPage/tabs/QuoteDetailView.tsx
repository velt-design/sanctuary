"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Link from '@/components/navigation/PortalRouteLink';
import { QuoteStatusBadge } from "@/components/ui/foundation/SanctuaryStatus";
import { StickyActionBar } from "@/components/ui/foundation/FoundationSurfaces";
import type { EstimateMeta } from "@/lib/estimates/types";
import {
  buildPergolaStructuredDescription,
  parsePergolaStructuredDescription,
  type PergolaFieldMap,
  type PergolaModuleDraft,
} from "@/lib/quotes/pergolaDraft";
import { quotePdfUrl } from "@/lib/quotes/quotesRepo";
import type { QuoteLineItem, QuoteVersionDetail } from "@/lib/quotes/types";
import { isLocalQuoteId } from "@/lib/localFirst/portalEntities";
import styles from "./QuotesTab.module.css";
import QuoteLineItemsEditor from "./QuoteLineItemsEditor";
import QuotePdfInlinePreview from "./QuotePdfInlinePreview";
import {
  formatDateShort,
  formatDateTime,
  formatMoneyFromCents,
  formatMoneyInputValue,
  formatPercentInput,
  isPergolaLineItemDescription,
  normalizePercentInput,
  parsePercentInput,
  parseQtyInput,
  sanitizeMoneyInput,
} from "./quotesTabModel";

type Setter<T> = Dispatch<SetStateAction<T>>;

type QuoteDetailViewProps = {
  projectId: string;
  detail: QuoteVersionDetail;
  draftDirty: boolean;
  draftSyncPending: boolean;
  guardUnsavedDraft: (action: () => void) => void;
  selectQuote: (quoteId: string | null) => void;
  savingDraft: boolean;
  reviewAndSend: () => void;
  retryPreparedDelivery: () => void;
  resend: () => void;
  revise: () => void;
  moreActionsOpen: boolean;
  setMoreActionsOpen: Setter<boolean>;
  refreshEstimateTarget: EstimateMeta | null;
  refreshUsesLatestDesign: boolean;
  refreshBusy: boolean;
  openRefresh: () => void;
  downloadingDraftPdf: boolean;
  downloadDraftPdf: () => void;
  saveDraft: () => void;
  openDeleteConfirm: () => void;
  openJobPackHref: string | null;
  canGenerateJobPack: boolean;
  generateJobPack: () => void;
  jobPackBusy: boolean;
  pagePreviewFromUrl: boolean;
  quotePdfPreviewLoading: boolean;
  quotePdfPreviewError: string | null;
  quotePdfPreviewData: Uint8Array | null;
  quotePdfPreviewKey: string | null;
  draftExpiry: string;
  setDraftExpiry: Setter<string>;
  draftReference: string;
  setDraftReference: Setter<string>;
  draftDepositPercent: string;
  setDraftDepositPercent: Setter<string>;
  draftItems: QuoteLineItem[];
  setDraftItems: Setter<QuoteLineItem[]>;
  unitInputDrafts: Record<string, string>;
  setUnitInputDrafts: Setter<Record<string, string>>;
  activeUnitInputId: string | null;
  setActiveUnitInputId: Setter<string | null>;
  getLiveUnitPriceIncGstCents: (item: QuoteLineItem) => number;
  parsedPergolaDrafts: Map<
    string,
    ReturnType<typeof parsePergolaStructuredDescription>
  >;
  draftPergolaOverrideMode: Record<string, boolean>;
  setDraftPergolaOverrideMode: Setter<Record<string, boolean>>;
  updateDraftItemDescription: (itemId: string, description: string) => void;
  updatePergolaModule: (
    itemId: string,
    moduleIndex: number,
    updater: (module: PergolaModuleDraft) => PergolaModuleDraft,
  ) => void;
  updatePergolaSharedField: (
    itemId: string,
    key: keyof PergolaFieldMap,
    value: string,
  ) => void;
  commitUnitPriceDraft: (itemId: string, rawValue: string) => void;
  moveRow: (index: number, direction: -1 | 1) => void;
  deleteRow: (index: number) => void;
  addRow: () => void;
  detailTotals: {
    totalIncGstCents: number;
    totalExGstCents: number;
    gstCents: number;
  } | null;
  draftIntro: string;
  setDraftIntro: Setter<string>;
  draftTerms: string;
  setDraftTerms: Setter<string>;
  accept: () => void;
  acceptBusy: boolean;
  decline: () => void;
  dialogs: ReactNode;
};

export default function QuoteDetailView({
  projectId,
  detail,
  draftDirty,
  draftSyncPending,
  guardUnsavedDraft,
  selectQuote,
  savingDraft,
  reviewAndSend: handleReviewAndSend,
  retryPreparedDelivery: handlePreparedDeliveryRetry,
  resend: handleResendClick,
  revise: handleRevise,
  moreActionsOpen,
  setMoreActionsOpen,
  refreshEstimateTarget,
  refreshUsesLatestDesign,
  refreshBusy,
  openRefresh: openRefreshModal,
  downloadingDraftPdf,
  downloadDraftPdf: handleDownloadDraftPdf,
  saveDraft: handleSaveDraft,
  openDeleteConfirm,
  openJobPackHref,
  canGenerateJobPack,
  generateJobPack: handleGenerateJobPack,
  jobPackBusy,
  pagePreviewFromUrl,
  quotePdfPreviewLoading,
  quotePdfPreviewError,
  quotePdfPreviewData,
  quotePdfPreviewKey,
  draftExpiry,
  setDraftExpiry,
  draftReference,
  setDraftReference,
  draftDepositPercent,
  setDraftDepositPercent,
  draftItems,
  setDraftItems,
  unitInputDrafts,
  setUnitInputDrafts,
  activeUnitInputId,
  setActiveUnitInputId,
  getLiveUnitPriceIncGstCents,
  parsedPergolaDrafts,
  draftPergolaOverrideMode,
  setDraftPergolaOverrideMode,
  updateDraftItemDescription,
  updatePergolaModule,
  updatePergolaSharedField,
  commitUnitPriceDraft,
  moveRow: handleMoveRow,
  deleteRow: handleDeleteRow,
  addRow: handleAddRow,
  detailTotals,
  draftIntro,
  setDraftIntro,
  draftTerms,
  setDraftTerms,
  accept: handleAccept,
  acceptBusy,
  decline: handleDecline,
  dialogs,
}: QuoteDetailViewProps) {
  const expired = isExpired(detail.expiresAt);
  const hasNewerEstimate = refreshUsesLatestDesign;
  const commercialWorkflowReady = detail.commercialWorkflowReady !== false;
  const unfinishedDelivery = Boolean(detail.unfinishedDelivery);
  const editableDraft =
    commercialWorkflowReady &&
    detail.status === "DRAFT" &&
    detail.isCurrentDraft &&
    !unfinishedDelivery;
  const deliveryPreparedVersion =
    commercialWorkflowReady &&
    (unfinishedDelivery ||
      (detail.status === "DRAFT" &&
        !detail.isCurrentDraft &&
        Boolean(detail.deliveryPreparedAt)));

  return (
    <div
      className={styles.wrapper}
      role="region"
      aria-label="Quote detail"
      data-quotes-view="detail"
      data-portal-page-shell="quote-detail"
      data-portal-page-shell-ready="true"
    >
      <div className={styles.detailHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => guardUnsavedDraft(() => selectQuote(null))}
        >
          &lt; Back
        </button>
      </div>
      <StickyActionBar
        className={styles.quoteActionBar}
        status={
          <QuoteStatusBadge
            status={detail.status}
            detail={
              draftDirty
                ? "Unsaved changes"
                : draftSyncPending
                  ? "Syncing"
                  : undefined
            }
          />
        }
        meta={`${detail.quoteRef} · v${detail.versionNumber}`}
        issues={
          !commercialWorkflowReady
            ? "Commercial actions unavailable"
            : !detail.isCurrentDraft && detail.status === "DRAFT"
            ? deliveryPreparedVersion
              ? "Delivery prepared"
              : "Superseded draft"
            : unfinishedDelivery
              ? "Delivery finalisation incomplete"
              : expired
                ? `Expired ${detail.expiresAt ?? ""}`
                : undefined
        }
      >
        <div className={styles.detailActions}>
          {!commercialWorkflowReady && detail.status !== "ACCEPTED" ? (
            <button
              type="button"
              className={styles.primaryButton}
              disabled
            >
              Commercial actions unavailable
            </button>
          ) : editableDraft ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleReviewAndSend()}
              disabled={savingDraft}
            >
              {savingDraft ? "Saving draft..." : "Review & Send"}
            </button>
          ) : deliveryPreparedVersion ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handlePreparedDeliveryRetry}
            >
              Review prepared delivery
            </button>
          ) : detail.status === "SENT" ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleResendClick}
            >
              Resend
            </button>
          ) : detail.status === "ACCEPTED" ? (
            openJobPackHref ? (
              <Link className={styles.primaryButton} href={openJobPackHref}>
                Open Job Pack
              </Link>
            ) : (
              <Link
                className={styles.primaryButton}
                href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}
              >
                Open deposit invoice
              </Link>
            )
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleRevise}
            >
              Create revision
            </button>
          )}

          <div className={styles.moreActionsWrap}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setMoreActionsOpen((prev) => !prev)}
            >
              More actions
            </button>
            {moreActionsOpen ? (
              <div className={styles.moreActionsMenu}>
                {editableDraft ? (
                  <>
                    {refreshEstimateTarget ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={openRefreshModal}
                        disabled={
                          refreshBusy ||
                          isLocalQuoteId(detail.id) ||
                          draftSyncPending
                        }
                      >
                        {refreshUsesLatestDesign
                          ? `Refresh from latest design (${refreshEstimateTarget.versionLabel})`
                          : "Regenerate from current design"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.moreActionsItem}
                      onClick={handleDownloadDraftPdf}
                      disabled={downloadingDraftPdf}
                    >
                      {downloadingDraftPdf
                        ? "Preparing PDF..."
                        : "Download PDF"}
                    </button>
                    <button
                      type="button"
                      className={styles.moreActionsItem}
                      onClick={() => void handleSaveDraft()}
                      disabled={savingDraft || draftSyncPending}
                    >
                      {savingDraft || draftSyncPending
                        ? "Syncing..."
                        : "Save draft"}
                    </button>
                    <button
                      type="button"
                      className={`${styles.moreActionsItem} ${styles.moreActionsDanger}`}
                      onClick={openDeleteConfirm}
                      disabled={isLocalQuoteId(detail.id) || draftSyncPending}
                    >
                      Delete draft
                    </button>
                  </>
                ) : (
                  <>
                    {deliveryPreparedVersion ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={handlePreparedDeliveryRetry}
                      >
                        Review prepared delivery
                      </button>
                    ) : null}
                    {!unfinishedDelivery &&
                    commercialWorkflowReady &&
                    (detail.status === "SENT" ||
                      detail.status === "ACCEPTED" ||
                      detail.status === "DECLINED") ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={handleResendClick}
                      >
                        Resend
                      </button>
                    ) : null}
                    {commercialWorkflowReady ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={handleRevise}
                      >
                        Create revision
                      </button>
                    ) : null}
                    {detail.status === "ACCEPTED" ? (
                      <Link
                        className={styles.moreActionsItemLink}
                        href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}
                      >
                        Open deposit invoice
                      </Link>
                    ) : null}
                    {openJobPackHref ? (
                      <Link
                        className={styles.moreActionsItemLink}
                        href={openJobPackHref}
                      >
                        Open Job Pack
                      </Link>
                    ) : null}
                    {canGenerateJobPack ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={handleGenerateJobPack}
                        disabled={jobPackBusy}
                      >
                        {jobPackBusy
                          ? "Generating job pack..."
                          : "Generate Job Pack"}
                      </button>
                    ) : null}
                    <a
                      className={styles.moreActionsItemLink}
                      href={quotePdfUrl(detail.id)}
                    >
                      Download PDF
                    </a>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </StickyActionBar>

      {expired ? (
        <div className={styles.expiredBanner}>
          Expired on {detail.expiresAt ?? "—"}
        </div>
      ) : null}

      {!commercialWorkflowReady ? (
        <div className={styles.workflowWarning} role="status">
          <strong>Commercial actions are temporarily unavailable.</strong>{" "}
          This quote is available read-only, but delivery, revision, and
          acceptance actions require the pending database upgrade. PDF review
          and historical records remain available.
        </div>
      ) : null}

      {deliveryPreparedVersion ? (
        <div className={styles.expiredBanner}>
          Delivery prepared from this exact version. It is read-only while the
          frozen email is delivered or safely retried. Create a revision for
          further changes.
        </div>
      ) : !detail.isCurrentDraft && detail.status === "DRAFT" ? (
        <div className={styles.expiredBanner}>
          Superseded draft — preserved for history and read-only. Create a
          revision to continue.
        </div>
      ) : null}

      {pagePreviewFromUrl ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Quote preview</h4>
          </div>
          {detail.status === "DRAFT" && draftDirty ? (
            <div className={styles.metaWarning}>
              Preview includes your current local draft edits before sync
              completes.
            </div>
          ) : null}
          {detail.status === "DRAFT" && !draftDirty && draftSyncPending ? (
            <div className={styles.metaWarning}>
              Preview is rendered from the current local draft while background
              sync completes.
            </div>
          ) : null}
          {quotePdfPreviewLoading ? (
            <p className={styles.note}>Rendering quote preview...</p>
          ) : null}
          {quotePdfPreviewError ? (
            <div className={styles.errorText}>
              {quotePdfPreviewError}{" "}
              {detail.status === "DRAFT" ||
              isLocalQuoteId(detail.id) ||
              draftSyncPending ? null : (
                <a href={quotePdfUrl(detail.id)}>Download PDF</a>
              )}
            </div>
          ) : null}
          {!quotePdfPreviewLoading &&
          !quotePdfPreviewError &&
          quotePdfPreviewData ? (
            <div className={styles.quotePreviewFrameWrap}>
              <QuotePdfInlinePreview
                key={quotePdfPreviewKey}
                data={quotePdfPreviewData}
              />
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Quote details</h4>
              <QuoteStatusBadge status={detail.status} />
            </div>
            <div className={styles.metaGrid}>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Prepared for (snapshot)</div>
                <div className={styles.metaValue}>
                  {detail.customerName || "Customer"}
                </div>
                <div className={styles.metaValueMuted}>
                  Preserved with this quote version
                </div>
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Current contact</div>
                <div className={styles.metaValue}>
                  {detail.contact.name || "—"}
                </div>
                <div className={styles.metaValueMuted}>
                  {detail.contact.email || "—"}
                </div>
                {detail.contact.phone ? (
                  <div className={styles.metaValueMuted}>
                    {detail.contact.phone}
                  </div>
                ) : null}
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Quote number</div>
                <div className={styles.metaValue}>{detail.quoteRef}</div>
                <div className={styles.metaValueMuted}>
                  v{detail.versionNumber}
                </div>
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Issue date</div>
                <div className={styles.metaValue}>
                  {editableDraft
                    ? "Set on send"
                    : formatDateShort(detail.sentAt)}
                </div>
                <div className={styles.metaLabel}>Expiry date</div>
                {editableDraft ? (
                  <input
                    className={styles.metaInput}
                    type="date"
                    value={draftExpiry}
                    onChange={(e) => setDraftExpiry(e.target.value)}
                    placeholder="30 days from send"
                  />
                ) : (
                  <div className={styles.metaValue}>
                    {detail.expiresAt ?? "—"}
                  </div>
                )}
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Reference</div>
                {editableDraft ? (
                  <input
                    className={styles.metaInput}
                    value={draftReference}
                    onChange={(e) => setDraftReference(e.target.value)}
                    placeholder="Optional reference"
                  />
                ) : (
                  <div className={styles.metaValue}>
                    {detail.reference || "—"}
                  </div>
                )}
              </div>
              <div className={styles.metaBlock}>
                <div className={styles.metaLabel}>Deposit %</div>
                {editableDraft ? (
                  <input
                    className={styles.metaInput}
                    inputMode="decimal"
                    value={draftDepositPercent}
                    onChange={(e) =>
                      setDraftDepositPercent(
                        normalizePercentInput(e.target.value),
                      )
                    }
                    onBlur={(e) =>
                      setDraftDepositPercent(
                        formatPercentInput(parsePercentInput(e.target.value)),
                      )
                    }
                    placeholder="50"
                  />
                ) : (
                  <div className={styles.metaValue}>
                    {formatPercentInput(detail.depositPercent)}%
                  </div>
                )}
              </div>
            </div>

            <div className={styles.metaBlock}>
              <div className={styles.metaLabel}>Provenance</div>
              <div className={styles.metaValue}>
                <Link
                  href={`/staff/projects/${encodeURIComponent(projectId)}?tab=estimates&estimateId=${encodeURIComponent(detail.sourceEstimateVersionId)}`}
                >
                  Built from design {detail.sourceEstimateVersionLabel}
                </Link>
              </div>
              <div className={styles.metaValueMuted}>
                Pricing source:{" "}
                {detail.pricingSource === "workbench_solved"
                  ? "Solved design snapshot"
                  : "Calculator estimate snapshot"}
              </div>
              {editableDraft ? (
                <div className={styles.metaNote}>
                  Draft quotes are independent once created. Design edits do not
                  overwrite quote wording, pricing, deposit, expiry, or
                  reference unless you explicitly refresh from design.
                </div>
              ) : null}
              {editableDraft && hasNewerEstimate ? (
                <div className={styles.metaWarning}>
                  A newer design ({refreshEstimateTarget?.versionLabel}) exists.
                  This quote was built from design{" "}
                  {detail.sourceEstimateVersionLabel}.
                </div>
              ) : null}
            </div>
          </section>

          <QuoteLineItemsEditor
            editable={editableDraft}
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
          />

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Totals</h4>
            </div>
            <div className={styles.totalsGrid}>
              <div className={styles.totalItem}>
                <div className={styles.metaLabel}>Total (inc GST)</div>
                <div className={styles.totalValue}>
                  {detailTotals
                    ? formatMoneyFromCents(detailTotals.totalIncGstCents)
                    : "—"}
                </div>
              </div>
              <div className={styles.totalItem}>
                <div className={styles.metaLabel}>Total (ex GST)</div>
                <div className={styles.totalValue}>
                  {detailTotals
                    ? formatMoneyFromCents(detailTotals.totalExGstCents)
                    : "—"}
                </div>
              </div>
              <div className={styles.totalItem}>
                <div className={styles.metaLabel}>GST</div>
                <div className={styles.totalValue}>
                  {detailTotals
                    ? formatMoneyFromCents(detailTotals.gstCents)
                    : "—"}
                </div>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Intro & Terms</h4>
            </div>
            <div className={styles.splitGrid}>
              <div>
                <div className={styles.metaLabel}>Intro</div>
                {editableDraft ? (
                  <textarea
                    className={styles.textarea}
                    value={draftIntro}
                    onChange={(e) => setDraftIntro(e.target.value)}
                    rows={5}
                  />
                ) : (
                  <div className={styles.readonlyBlock}>
                    {detail.introText || "—"}
                  </div>
                )}
              </div>
              <div>
                <div className={styles.metaLabel}>Terms</div>
                {editableDraft ? (
                  <textarea
                    className={styles.textarea}
                    value={draftTerms}
                    onChange={(e) => setDraftTerms(e.target.value)}
                    rows={5}
                  />
                ) : (
                  <div className={styles.readonlyBlock}>
                    {detail.termsText || "—"}
                  </div>
                )}
              </div>
            </div>
          </section>

          {detail.status === "SENT" ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Decision</h4>
                <div className={styles.cardActionsInline}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleAccept}
                    disabled={
                      expired || acceptBusy || !commercialWorkflowReady
                    }
                  >
                    {acceptBusy ? "Accepting..." : "Mark accepted"}
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleDecline}
                    disabled={!commercialWorkflowReady}
                  >
                    Mark declined
                  </button>
                </div>
              </div>
              <p className={styles.muted}>
                {!commercialWorkflowReady
                  ? "The database upgrade must be applied before recording a decision or preparing the deposit invoice."
                  : expired
                  ? "This quote has expired. Create and send a current revision before accepting it."
                  : "Acceptance locks this version, prepares its deposit invoice, and attempts email delivery."}
              </p>
            </section>
          ) : null}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Send log</h4>
            </div>
            {detail.sendLogs.length ? (
              <div className={styles.tableWrap}>
                <table className={styles.logTable}>
                  <thead>
                    <tr>
                      <th>Sent to</th>
                      <th>Subject</th>
                      <th>When</th>
                      <th>Status</th>
                      <th>Attachments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.sendLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{log.to.join(", ") || "—"}</td>
                        <td>{log.subject || "—"}</td>
                        <td>{formatDateTime(log.sentAt ?? log.createdAt)}</td>
                        <td>{log.status}</td>
                        <td>
                          {log.attachments.length
                            ? `${log.attachments.length} file${log.attachments.length === 1 ? "" : "s"}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className={styles.muted}>No send attempts yet.</p>
            )}
          </section>
        </>
      )}
      {dialogs}
    </div>
  );
}

function isExpired(value: string | null | undefined): boolean {
  if (!value) return false;
  const expiry = new Date(value + "T23:59:59");
  return Number.isFinite(expiry.getTime()) && expiry.getTime() < Date.now();
}
