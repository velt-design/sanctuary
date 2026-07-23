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

export type QuoteDetailViewProps = {
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

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h4 className={styles.cardTitle}>Line items</h4>
              {detail.status === "DRAFT" ? (
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleAddRow}
                >
                  Add row
                </button>
              ) : null}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.lineTable}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit (inc GST)</th>
                    <th>Amount</th>
                    {detail.status === "DRAFT" ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((item, idx) => {
                    const unitInputValue =
                      unitInputDrafts[item.id] ??
                      (activeUnitInputId === item.id
                        ? formatMoneyInputValue(item.unitPriceIncGstCents)
                        : formatMoneyFromCents(
                            item.unitPriceIncGstCents,
                          ).replace("$", ""));
                    const liveUnitPriceIncGstCents =
                      detail.status === "DRAFT"
                        ? getLiveUnitPriceIncGstCents(item)
                        : item.unitPriceIncGstCents;
                    const lineTotal = Math.round(
                      (Number.isFinite(item.qty) ? item.qty : 0) *
                        liveUnitPriceIncGstCents,
                    );
                    const parsedPergola =
                      parsedPergolaDrafts.get(item.id) ?? null;
                    const pergolaOverride = Boolean(
                      draftPergolaOverrideMode[item.id],
                    );
                    const canUseStructuredPergola =
                      detail.status === "DRAFT" &&
                      parsedPergola &&
                      !pergolaOverride;
                    return (
                      <tr key={item.id}>
                        <td>
                          {detail.status === "DRAFT" ? (
                            <div className={styles.lineEditorCell}>
                              {canUseStructuredPergola ? (
                                <div className={styles.structuredPergolaEditor}>
                                  <div
                                    className={styles.structuredPergolaToolbar}
                                  >
                                    <span
                                      className={styles.structuredPergolaLabel}
                                    >
                                      Structured pergola editor
                                    </span>
                                    <button
                                      type="button"
                                      className={styles.rowButton}
                                      onClick={() =>
                                        setDraftPergolaOverrideMode((prev) => ({
                                          ...prev,
                                          [item.id]: true,
                                        }))
                                      }
                                    >
                                      Advanced text override
                                    </button>
                                  </div>
                                  <label className={styles.metaLabel}>
                                    Pergola heading
                                  </label>
                                  <input
                                    className={styles.metaInput}
                                    value={parsedPergola.heading}
                                    onChange={(e) =>
                                      updateDraftItemDescription(
                                        item.id,
                                        buildPergolaStructuredDescription({
                                          ...parsedPergola,
                                          heading: e.target.value,
                                        }),
                                      )
                                    }
                                  />
                                  {parsedPergola.modules.length > 1 ? (
                                    <>
                                      <label className={styles.metaLabel}>
                                        Configuration
                                      </label>
                                      <input
                                        className={styles.metaInput}
                                        value={parsedPergola.configuration}
                                        onChange={(e) =>
                                          updateDraftItemDescription(
                                            item.id,
                                            buildPergolaStructuredDescription({
                                              ...parsedPergola,
                                              configuration: e.target.value,
                                            }),
                                          )
                                        }
                                      />
                                      <div
                                        className={styles.pergolaSectionCard}
                                      >
                                        <div
                                          className={styles.pergolaSectionTitle}
                                        >
                                          Shared specification
                                        </div>
                                        <div
                                          className={styles.pergolaFieldGrid}
                                        >
                                          {(
                                            [
                                              "roof",
                                              "colour",
                                              "houseConnection",
                                              "postFixings",
                                            ] as const
                                          ).map((fieldKey) => (
                                            <label
                                              key={fieldKey}
                                              className={styles.pergolaField}
                                            >
                                              <span
                                                className={styles.metaLabel}
                                              >
                                                {fieldKey === "houseConnection"
                                                  ? "House connection"
                                                  : fieldKey === "postFixings"
                                                    ? "Post fixings"
                                                    : fieldKey
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                      fieldKey.slice(1)}
                                              </span>
                                              <input
                                                className={styles.metaInput}
                                                value={
                                                  parsedPergola.shared[fieldKey]
                                                }
                                                onChange={(e) =>
                                                  updatePergolaSharedField(
                                                    item.id,
                                                    fieldKey,
                                                    e.target.value,
                                                  )
                                                }
                                              />
                                            </label>
                                          ))}
                                        </div>
                                      </div>
                                    </>
                                  ) : null}
                                  <div className={styles.pergolaModuleList}>
                                    {parsedPergola.modules.map(
                                      (module, moduleIndex) => (
                                        <div
                                          key={`${item.id}:module:${moduleIndex}`}
                                          className={styles.pergolaSectionCard}
                                        >
                                          <div
                                            className={
                                              styles.pergolaSectionTitle
                                            }
                                          >
                                            {module.title ||
                                              `Module ${moduleIndex + 1}`}
                                          </div>
                                          <div
                                            className={styles.pergolaFieldGrid}
                                          >
                                            <label
                                              className={styles.pergolaField}
                                            >
                                              <span
                                                className={styles.metaLabel}
                                              >
                                                Type / style
                                              </span>
                                              <input
                                                className={styles.metaInput}
                                                value={module.style}
                                                onChange={(e) =>
                                                  updatePergolaModule(
                                                    item.id,
                                                    moduleIndex,
                                                    (current) => ({
                                                      ...current,
                                                      style: e.target.value,
                                                    }),
                                                  )
                                                }
                                              />
                                            </label>
                                            <label
                                              className={styles.pergolaField}
                                            >
                                              <span
                                                className={styles.metaLabel}
                                              >
                                                Size
                                              </span>
                                              <input
                                                className={styles.metaInput}
                                                value={module.size}
                                                onChange={(e) =>
                                                  updatePergolaModule(
                                                    item.id,
                                                    moduleIndex,
                                                    (current) => ({
                                                      ...current,
                                                      size: e.target.value,
                                                    }),
                                                  )
                                                }
                                              />
                                            </label>
                                            <label
                                              className={styles.pergolaField}
                                            >
                                              <span
                                                className={styles.metaLabel}
                                              >
                                                Pitch / slope
                                              </span>
                                              <input
                                                className={styles.metaInput}
                                                value={module.pitch}
                                                onChange={(e) =>
                                                  updatePergolaModule(
                                                    item.id,
                                                    moduleIndex,
                                                    (current) => ({
                                                      ...current,
                                                      pitch: e.target.value,
                                                    }),
                                                  )
                                                }
                                              />
                                            </label>
                                            <label
                                              className={styles.pergolaField}
                                            >
                                              <span
                                                className={styles.metaLabel}
                                              >
                                                Posts
                                              </span>
                                              <input
                                                className={styles.metaInput}
                                                value={module.posts}
                                                onChange={(e) =>
                                                  updatePergolaModule(
                                                    item.id,
                                                    moduleIndex,
                                                    (current) => ({
                                                      ...current,
                                                      posts: e.target.value,
                                                    }),
                                                  )
                                                }
                                              />
                                            </label>
                                            {!parsedPergola.shared.roof.trim() ? (
                                              <label
                                                className={styles.pergolaField}
                                              >
                                                <span
                                                  className={styles.metaLabel}
                                                >
                                                  Roof
                                                </span>
                                                <input
                                                  className={styles.metaInput}
                                                  value={module.roof}
                                                  onChange={(e) =>
                                                    updatePergolaModule(
                                                      item.id,
                                                      moduleIndex,
                                                      (current) => ({
                                                        ...current,
                                                        roof: e.target.value,
                                                      }),
                                                    )
                                                  }
                                                />
                                              </label>
                                            ) : null}
                                            {!parsedPergola.shared.colour.trim() ? (
                                              <label
                                                className={styles.pergolaField}
                                              >
                                                <span
                                                  className={styles.metaLabel}
                                                >
                                                  Colour
                                                </span>
                                                <input
                                                  className={styles.metaInput}
                                                  value={module.colour}
                                                  onChange={(e) =>
                                                    updatePergolaModule(
                                                      item.id,
                                                      moduleIndex,
                                                      (current) => ({
                                                        ...current,
                                                        colour: e.target.value,
                                                      }),
                                                    )
                                                  }
                                                />
                                              </label>
                                            ) : null}
                                            {!parsedPergola.shared.houseConnection.trim() ? (
                                              <label
                                                className={styles.pergolaField}
                                              >
                                                <span
                                                  className={styles.metaLabel}
                                                >
                                                  House connection
                                                </span>
                                                <input
                                                  className={styles.metaInput}
                                                  value={module.houseConnection}
                                                  onChange={(e) =>
                                                    updatePergolaModule(
                                                      item.id,
                                                      moduleIndex,
                                                      (current) => ({
                                                        ...current,
                                                        houseConnection:
                                                          e.target.value,
                                                      }),
                                                    )
                                                  }
                                                />
                                              </label>
                                            ) : null}
                                            {!parsedPergola.shared.postFixings.trim() ? (
                                              <label
                                                className={styles.pergolaField}
                                              >
                                                <span
                                                  className={styles.metaLabel}
                                                >
                                                  Post fixings
                                                </span>
                                                <input
                                                  className={styles.metaInput}
                                                  value={module.postFixings}
                                                  onChange={(e) =>
                                                    updatePergolaModule(
                                                      item.id,
                                                      moduleIndex,
                                                      (current) => ({
                                                        ...current,
                                                        postFixings:
                                                          e.target.value,
                                                      }),
                                                    )
                                                  }
                                                />
                                              </label>
                                            ) : null}
                                          </div>
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {isPergolaLineItemDescription(
                                    item.description,
                                  ) ? (
                                    <div
                                      className={
                                        styles.structuredPergolaToolbar
                                      }
                                    >
                                      <span
                                        className={
                                          styles.structuredPergolaLabel
                                        }
                                      >
                                        {parsedPergola
                                          ? "Advanced text override"
                                          : "Manual pergola text"}
                                      </span>
                                      {parsedPergola ? (
                                        <button
                                          type="button"
                                          className={styles.rowButton}
                                          onClick={() =>
                                            setDraftPergolaOverrideMode(
                                              (prev) => {
                                                const next = { ...prev };
                                                delete next[item.id];
                                                return next;
                                              },
                                            )
                                          }
                                        >
                                          Return to structured editor
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <textarea
                                    className={styles.textarea}
                                    value={item.description}
                                    onChange={(e) =>
                                      updateDraftItemDescription(
                                        item.id,
                                        e.target.value,
                                      )
                                    }
                                    rows={6}
                                  />
                                  {isPergolaLineItemDescription(
                                    item.description,
                                  ) && !parsedPergola ? (
                                    <div className={styles.metaWarning}>
                                      This row is using manual pergola text.
                                      Return to the structured editor after the
                                      text matches the supported pergola format.
                                    </div>
                                  ) : null}
                                </>
                              )}
                            </div>
                          ) : (
                            <div className={styles.readonlyBlock}>
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td>
                          {detail.status === "DRAFT" ? (
                            <input
                              className={styles.numberInput}
                              value={String(item.qty)}
                              onChange={(e) =>
                                setDraftItems((prev) =>
                                  prev.map((entry, i) =>
                                    i === idx
                                      ? {
                                          ...entry,
                                          qty: parseQtyInput(e.target.value),
                                        }
                                      : entry,
                                  ),
                                )
                              }
                            />
                          ) : (
                            <div>{item.qty}</div>
                          )}
                        </td>
                        <td>
                          {detail.status === "DRAFT" ? (
                            <input
                              className={styles.numberInput}
                              value={unitInputValue}
                              inputMode="decimal"
                              onPointerDown={(e) => {
                                if (e.currentTarget === document.activeElement)
                                  return;
                                e.preventDefault();
                                e.currentTarget.focus();
                                e.currentTarget.select();
                              }}
                              onChange={(e) =>
                                setUnitInputDrafts((prev) => ({
                                  ...prev,
                                  [item.id]: sanitizeMoneyInput(e.target.value),
                                }))
                              }
                              onFocus={(e) => {
                                const inputEl = e.currentTarget;
                                setActiveUnitInputId(item.id);
                                setUnitInputDrafts((prev) => {
                                  if (typeof prev[item.id] === "string")
                                    return prev;
                                  return {
                                    ...prev,
                                    [item.id]: formatMoneyInputValue(
                                      item.unitPriceIncGstCents,
                                    ),
                                  };
                                });
                                window.requestAnimationFrame(() => {
                                  if (
                                    !inputEl.isConnected ||
                                    document.activeElement !== inputEl
                                  )
                                    return;
                                  inputEl.select();
                                });
                              }}
                              onBlur={(e) => {
                                setActiveUnitInputId((prev) =>
                                  prev === item.id ? null : prev,
                                );
                                commitUnitPriceDraft(item.id, e.target.value);
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                e.preventDefault();
                                commitUnitPriceDraft(
                                  item.id,
                                  e.currentTarget.value,
                                );
                                e.currentTarget.blur();
                              }}
                            />
                          ) : (
                            <div>
                              {formatMoneyFromCents(item.unitPriceIncGstCents)}
                            </div>
                          )}
                        </td>
                        <td>{formatMoneyFromCents(lineTotal)}</td>
                        {detail.status === "DRAFT" ? (
                          <td className={styles.rowActions}>
                            <button
                              type="button"
                              className={styles.rowButton}
                              onClick={() => handleMoveRow(idx, -1)}
                            >
                              Up
                            </button>
                            <button
                              type="button"
                              className={styles.rowButton}
                              onClick={() => handleMoveRow(idx, 1)}
                            >
                              Down
                            </button>
                            <button
                              type="button"
                              className={styles.rowButtonDanger}
                              onClick={() => handleDeleteRow(idx)}
                            >
                              Delete
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                  {!draftItems.length ? (
                    <tr>
                      <td
                        colSpan={detail.status === "DRAFT" ? 5 : 4}
                        className={styles.emptyRow}
                      >
                        No line items.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

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
