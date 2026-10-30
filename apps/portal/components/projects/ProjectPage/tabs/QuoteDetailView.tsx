"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import Link from "next/link";
import QuoteStudioDesign from "./QuoteStudioDesign";
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
import type { QuotePaymentTerm } from "@/lib/quotes/paymentSchedule";
import type { QuoteLineItem, QuoteVersionDetail } from "@/lib/quotes/types";
import { isLocalQuoteId } from "@/lib/localFirst/portalEntities";
import styles from "./QuotesTab.module.css";
import QuoteMetadata from "./QuoteMetadata";
import QuoteLineItemsEditor from "./QuoteLineItemsEditor";
import QuotePaymentTermsEditor from "./QuotePaymentTermsEditor";
import QuotePdfInlinePreview from "./QuotePdfInlinePreview";
import { useProjectCommercialContext } from '../ProjectCommercialContext';
import { useProjectViewDraftGuard } from '../projectViewNavigation';
import {
  formatDateShort,
  formatDateTime,
  formatMoneyFromCents,
  formatMoneyInputValue,
  isPergolaLineItemDescription,
  parseQtyInput,
  sanitizeMoneyInput,
} from "./quotesTabModel";

type Setter<T> = Dispatch<SetStateAction<T>>;

type QuoteDetailViewProps = {
  projectId: string;
  detail: QuoteVersionDetail|null;
  pending?:boolean;readError?:string;onRetry?:()=>void;
  draftDirty: boolean;
  draftSyncPending: boolean;
  guardUnsavedDraft: (action: () => void) => void;
  selectQuote: (quoteId: string | null) => void;
  savingDraft: boolean;
  reviewAndSend: () => void;
  retryPreparedDelivery: () => void;
  resend: () => void;
  revise: () => void;
  reviseBusy: boolean;
  moreActionsOpen: boolean;
  setMoreActionsOpen: Setter<boolean>;
  refreshEstimateTarget: EstimateMeta | null;
  refreshUsesLatestDesign: boolean;
  refreshBusy: boolean;
  openRefresh: () => void;
  downloadingDraftPdf: boolean;
  downloadDraftPdf: () => void;
  saveDraft: () => void;
  canDeleteQuote: boolean;
  openDeleteConfirm: () => void;
  canSupersedeQuote: boolean;
  supersedeQuote: () => void;
  supersedeBusy: boolean;
  openJobPackHref: string | null;
  canGenerateJobPack: boolean;
  generateJobPack: () => void;
  jobPackBusy: boolean;
  pagePreviewFromUrl: boolean;
  quotePdfPreviewLoading: boolean;
  quotePdfPreviewError: string | null;
  quotePdfPreviewData: Uint8Array | null;
  draftExpiry: string;
  setDraftExpiry: Setter<string>;
  draftReference: string;
  setDraftReference: Setter<string>;
  draftPaymentTerms: QuotePaymentTerm[];
  setDraftPaymentTerms: Setter<QuotePaymentTerm[]>;
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
  declineBusy: boolean;
  dialogs: ReactNode;
};

export default function QuoteDetailView({
  projectId,
  detail,pending=false,readError='',onRetry,
  draftDirty,
  draftSyncPending,
  guardUnsavedDraft,
  selectQuote,
  savingDraft,
  reviewAndSend: handleReviewAndSend,
  retryPreparedDelivery: handlePreparedDeliveryRetry,
  resend: handleResendClick,
  revise: handleRevise,
  reviseBusy,
  moreActionsOpen,
  setMoreActionsOpen,
  refreshEstimateTarget,
  refreshUsesLatestDesign,
  refreshBusy,
  openRefresh: openRefreshModal,
  downloadingDraftPdf,
  downloadDraftPdf: handleDownloadDraftPdf,
  saveDraft: handleSaveDraft,
  canDeleteQuote,
  openDeleteConfirm,
  canSupersedeQuote,
  supersedeQuote,
  supersedeBusy,
  openJobPackHref,
  canGenerateJobPack,
  generateJobPack: handleGenerateJobPack,
  jobPackBusy,
  pagePreviewFromUrl,
  quotePdfPreviewLoading,
  quotePdfPreviewError,
  quotePdfPreviewData,
  draftExpiry,
  setDraftExpiry,
  draftReference,
  setDraftReference,
  draftPaymentTerms,
  setDraftPaymentTerms,
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
  declineBusy,
  dialogs,
}: QuoteDetailViewProps) {
  const commercial = useProjectCommercialContext();
  useProjectViewDraftGuard(Boolean(detail&&draftDirty));
  const unknown=pending?'Reading…':'Unavailable';
  const expired = detail?.status !== "ACCEPTED" && isExpired(detail?.expiresAt);
  const hasNewerEstimate = refreshUsesLatestDesign;
  const commercialWorkflowReady = Boolean(detail&&!pending&&!readError&&detail.commercialWorkflowReady !== false);
  const unfinishedDelivery = Boolean(detail?.unfinishedDelivery);
  const editableDraft =
    Boolean(detail)&&!pending&&!readError&&commercial.actionsAvailable &&
    commercialWorkflowReady &&
    detail?.status === "DRAFT" &&
    detail?.isCurrentDraft &&
    !unfinishedDelivery;
  const deliveryPreparedVersion =
    commercialWorkflowReady &&
    (unfinishedDelivery ||
      (detail?.status === "DRAFT" &&
        !detail?.isCurrentDraft &&
        Boolean(detail?.deliveryPreparedAt)));

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
          &larr; Back to quotes
        </button>
      </div>
      {(!detail||readError)&&<p role={pending?'status':'alert'}>{readError||(pending?'Reading verified quote version…':'Quote version unavailable.')} {readError&&detail?'Earlier verified version remains read-only.':''} {readError&&onRetry&&<button type="button" onClick={onRetry}>Retry quote</button>}</p>}
      {detail&&pending&&<p role="status">Updating quote version. Earlier verified details remain read-only.</p>}
      <StickyActionBar
        className={styles.quoteActionBar}
        status={
          detail?<QuoteStatusBadge
            status={detail.status}
            detail={
              draftDirty
                ? "Unsaved changes"
                : draftSyncPending
                  ? "Syncing"
                  : undefined
            }
          />:<span>{unknown}</span>
        }
        meta={detail?`${detail.commercialScopeKind === "add_on" ? "Add-on · " : ""}${detail.quoteRef} · v${detail.versionNumber}`:unknown}
        issues={
          !commercialWorkflowReady
            ? "Commercial actions unavailable"
            : !detail?.isCurrentDraft && detail?.status === "DRAFT"
            ? deliveryPreparedVersion
              ? "Delivery prepared"
              : "Superseded draft"
            : unfinishedDelivery
              ? "Delivery finalisation incomplete"
              : expired
                ? `Expired ${detail?.expiresAt ?? ""}`
                : undefined
        }
      >
        {detail&&!pending&&!readError&&commercial.actionsAvailable ? <div className={styles.detailActions}>
          {!commercialWorkflowReady && detail?.status !== "ACCEPTED" ? (
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
          ) : detail?.status === "SENT" && !expired ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleResendClick}
            >
              Resend
            </button>
          ) : detail?.status === "ACCEPTED" ? (
            openJobPackHref ? (
              <Link className={styles.primaryButton} href={openJobPackHref}>
                Open Job Pack
              </Link>
            ) : (
              <Link
                className={styles.primaryButton}
                href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}
              >
                Open invoices
              </Link>
            )
          ) : (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleRevise}
              disabled={reviseBusy}
            >
              {reviseBusy ? "Creating revision..." : "Create revision"}
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
                          (!detail||isLocalQuoteId(detail.id)) ||
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
                    {canDeleteQuote ? (
                      <button
                        type="button"
                        className={`${styles.moreActionsItem} ${styles.moreActionsDanger}`}
                        onClick={openDeleteConfirm}
                        disabled={(!detail||isLocalQuoteId(detail.id)) || draftSyncPending}
                      >
                        Delete draft
                      </button>
                    ) : null}
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
                    (detail?.status === "SENT" ||
                      detail?.status === "ACCEPTED" ||
                      detail?.status === "DECLINED") ? (
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
                        disabled={reviseBusy}
                      >
                        {reviseBusy ? "Creating revision..." : "Create revision"}
                      </button>
                    ) : null}
                    {detail?.status === "ACCEPTED" ? (
                      <Link
                        className={styles.moreActionsItemLink}
                        href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}
                      >
                        Open invoices
                      </Link>
                    ) : null}
                    {canSupersedeQuote &&
                    (detail?.status === "SENT" || detail?.status === "ACCEPTED") ? (
                      <button
                        type="button"
                        className={styles.moreActionsItem}
                        onClick={supersedeQuote}
                        disabled={supersedeBusy}
                      >
                        {supersedeBusy ? "Marking superseded..." : "Mark superseded"}
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
                      href={quotePdfUrl(detail!.id)}
                    >
                      Download PDF
                    </a>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div> : <Link className={styles.secondaryButton} href={`/staff/projects/${encodeURIComponent(projectId)}?tab=invoices`}>Review invoices & payments</Link>}
      </StickyActionBar>

      {expired ? (
        <div className={styles.expiredBanner}>
          Expired on {detail?detail.expiresAt??"—":unknown}
        </div>
      ) : null}

      {detail?.commercialWorkflowReady===false ? (
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
      ) : !detail?.isCurrentDraft && detail?.status === "DRAFT" ? (
        <div className={styles.expiredBanner}>
          Superseded draft — preserved for history and read-only. Create a
          revision to continue.
        </div>
      ) : null}

      {detail?.studioDesign && <QuoteStudioDesign design={detail?.studioDesign} className={styles.card}/> }
      {pagePreviewFromUrl ? (
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h4 className={styles.cardTitle}>Quote preview</h4>
          </div>
          {detail?.status === "DRAFT" && draftDirty ? (
            <div className={styles.metaWarning}>
              Preview includes your current local draft edits before sync
              completes.
            </div>
          ) : null}
          {detail?.status === "DRAFT" && !draftDirty && draftSyncPending ? (
            <div className={styles.metaWarning}>
              Preview is rendered from the current local draft while background
              sync completes.
            </div>
          ) : null}
          {quotePdfPreviewError && detail && detail.status !== "DRAFT" && !isLocalQuoteId(detail.id) && !draftSyncPending ? <a href={quotePdfUrl(detail.id)}>Download PDF</a> : null}
          <div className={styles.quotePreviewFrameWrap}>
            <QuotePdfInlinePreview
              data={detail && !quotePdfPreviewError ? quotePdfPreviewData : null}
              pending={!detail ? pending : quotePdfPreviewLoading || (!quotePdfPreviewData && !quotePdfPreviewError)}
              readError={quotePdfPreviewError ?? (!detail && !pending ? "Quote PDF unavailable." : undefined)}
            />
          </div>
        </section>
      ) : (
        <>
          <QuoteMetadata projectId={projectId} detail={detail} editableDraft={editableDraft} draftExpiry={draftExpiry} setDraftExpiry={setDraftExpiry} draftReference={draftReference} setDraftReference={setDraftReference} hasNewerEstimate={hasNewerEstimate} refreshEstimateTarget={refreshEstimateTarget} unknown={unknown}/>

          <QuoteLineItemsEditor
            structuredPergolas={!detail?.studioDesign}
            editable={editableDraft}
            draftItems={detail?draftItems:[]}
            readState={detail?'ready':pending?'pending':'error'}
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
                  {detail&&detailTotals
                    ? formatMoneyFromCents(detailTotals.totalIncGstCents)
                    : unknown}
                </div>
              </div>
              <div className={styles.totalItem}>
                <div className={styles.metaLabel}>Total (ex GST)</div>
                <div className={styles.totalValue}>
                  {detail&&detailTotals
                    ? formatMoneyFromCents(detailTotals.totalExGstCents)
                    : unknown}
                </div>
              </div>
              <div className={styles.totalItem}>
                <div className={styles.metaLabel}>GST</div>
                <div className={styles.totalValue}>
                  {detail&&detailTotals
                    ? formatMoneyFromCents(detailTotals.gstCents)
                    : unknown}
                </div>
              </div>
            </div>
          </section>

          <QuotePaymentTermsEditor
            editable={editableDraft}
            quoteTotalIncGstCents={detail?(detailTotals?.totalIncGstCents??detail.totals.totalIncGstCents):null}
            pending={pending}
            terms={detail?draftPaymentTerms:[]}
            setTerms={setDraftPaymentTerms}
          />

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
                    {detail?detail.introText||"—":unknown}
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
                    {detail?detail.termsText||"—":unknown}
                  </div>
                )}
              </div>
            </div>
          </section>

          {detail?.status === "SENT" ? (
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h4 className={styles.cardTitle}>Decision</h4>
                {commercial.actionsAvailable && <div className={styles.cardActionsInline}>
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
                    disabled={!commercialWorkflowReady || declineBusy || acceptBusy}
                  >
                    {declineBusy ? "Marking declined..." : "Mark declined"}
                  </button>
                </div>}
              </div>
              <p className={styles.muted}>
                {!commercialWorkflowReady
                  ? "The database upgrade must be applied before recording a decision or preparing the first invoice."
                  : expired
                  ? "This quote has expired. Create and send a current revision before accepting it."
                  : "Acceptance locks this version. If payments already fund this quote, no invoice is created or emailed; create a custom progress invoice next. Otherwise, the first scheduled invoice is prepared and email delivery is attempted."}
              </p>
            </section>
          ) : null}

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Send log</h4>
            </div>
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
                    {(!detail||!detail.sendLogs.length)&&<tr><td colSpan={5} role={pending?'status':undefined}>{detail?'No send attempts yet.':unknown}</td></tr>}
                    {detail?.sendLogs.map((log) => (
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
          </section>
        </>
      )}
      {detail&&dialogs}
    </div>
  );
}

function isExpired(value: string | null | undefined): boolean {
  if (!value) return false;
  const expiry = new Date(value + "T23:59:59");
  return Number.isFinite(expiry.getTime()) && expiry.getTime() < Date.now();
}
