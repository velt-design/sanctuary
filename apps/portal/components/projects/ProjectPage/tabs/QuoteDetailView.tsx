"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Link from "next/link";
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
  resend: () => void;
  revise: () => void;
  openInvoice: () => void;
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
  resend: handleResendClick,
  revise: handleRevise,
  openInvoice: openInvoiceModal,
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
  decline: handleDecline,
  dialogs,
}: QuoteDetailViewProps) {
  const expired = isExpired(detail.expiresAt);
  const hasNewerEstimate = refreshUsesLatestDesign;

  return (
    <div
      className={styles.wrapper}
      role="region"
      aria-label="Quote detail"
      data-quotes-view="detail"
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
        issues={expired ? `Expired ${detail.expiresAt ?? ""}` : undefined}
      >
        <div className={styles.detailActions}>
          {detail.status === "DRAFT" ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleReviewAndSend()}
              disabled={savingDraft}
            >
              {savingDraft ? "Saving draft..." : "Review & Send"}
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
              <button
                type="button"
                className={styles.primaryButton}
                onClick={openInvoiceModal}
              >
                Create invoice
              </button>
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
                {detail.status === "DRAFT" ? (
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
                      disabled={
                        savingDraft || (draftSyncPending && !draftDirty)
                      }
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
                    {detail.status === "SENT" ||
                    detail.status === "ACCEPTED" ||
                    detail.status === "DECLINED" ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={handleResendClick}
                      >
                        Resend
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={styles.moreActionsItem}
                      onClick={handleRevise}
                    >
                      Create revision
                    </button>
                    {detail.status === "SENT" ||
                    detail.status === "ACCEPTED" ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={openInvoiceModal}
                      >
                        Create invoice
                      </button>
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
                <div className={styles.metaLabel}>Contact</div>
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
                  {detail.status === "DRAFT"
                    ? "Set on send"
                    : formatDateShort(detail.sentAt)}
                </div>
                <div className={styles.metaLabel}>Expiry date</div>
                {detail.status === "DRAFT" ? (
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
                {detail.status === "DRAFT" ? (
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
                {detail.status === "DRAFT" ? (
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
              {detail.status === "DRAFT" ? (
                <div className={styles.metaNote}>
                  Draft quotes are independent once created. Design edits do not
                  overwrite quote wording, pricing, deposit, expiry, or
                  reference unless you explicitly refresh from design.
                </div>
              ) : null}
              {detail.status === "DRAFT" && hasNewerEstimate ? (
                <div className={styles.metaWarning}>
                  A newer design ({refreshEstimateTarget?.versionLabel}) exists.
                  This quote was built from design{" "}
                  {detail.sourceEstimateVersionLabel}.
                </div>
              ) : null}
            </div>
          </section>

          <QuoteLineItemsEditor
            detail={detail}
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
                {detail.status === "DRAFT" ? (
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
                {detail.status === "DRAFT" ? (
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
                  >
                    Mark accepted
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleDecline}
                  >
                    Mark declined
                  </button>
                </div>
              </div>
              <p className={styles.muted}>
                These actions lock the quote and trigger the deposit invoice
                workflow.
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
