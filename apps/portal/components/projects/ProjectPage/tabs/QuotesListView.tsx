"use client";

import type { Dispatch, SetStateAction } from "react";
import { DataStatePanel } from "@/components/ui/foundation/FoundationFeedback";
import { QuoteStatusBadge } from "@/components/ui/foundation/SanctuaryStatus";
import type { EstimateMeta } from "@/lib/estimates/types";
import { getAliasedLocalFirstEntitySyncState } from "@/lib/localFirst/store";
import {
  buildQuoteEntityKey,
  isLocalQuoteId,
} from "@/lib/localFirst/portalEntities";
import { quotePdfUrl } from "@/lib/quotes/quotesRepo";
import type { QuoteVersion } from "@/lib/quotes/types";
import styles from "./QuotesTab.module.css";
import QuoteModal from "./QuoteWorkflowModal";
import {
  formatDateShort,
  formatMoneyFromCents,
  isExpired,
} from "./quotesTabModel";

type QuotesListViewProps = {
  quotes: QuoteVersion[];
  quotesLoading: boolean;
  quotesError: string | null;
  retryQuotes: () => void;
  openCreate: () => void;
  selectQuote: (quoteId: string) => void;
  prefetchQuoteDetail: (quoteId: string) => void;
  createOpen: boolean;
  closeCreate: () => void;
  createEstimateId: string;
  setCreateEstimateId: Dispatch<SetStateAction<string>>;
  estimatesLoading: boolean;
  estimates: EstimateMeta[];
  createQuote: () => void;
};

export default function QuotesListView({
  quotes,
  quotesLoading,
  quotesError,
  retryQuotes,
  openCreate,
  selectQuote,
  prefetchQuoteDetail,
  createOpen,
  closeCreate,
  createEstimateId,
  setCreateEstimateId,
  estimatesLoading,
  estimates,
  createQuote,
}: QuotesListViewProps) {
  return (
    <div
      className={styles.wrapper}
      role="region"
      aria-label="Quotes"
      data-quotes-view="list"
    >
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Quotes</h3>
          <p className={styles.subtitle}>Versioned quotes for this project.</p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={openCreate}
        >
          Create quote
        </button>
      </div>

      {quotesLoading ? <p className={styles.note}>Loading quotes…</p> : null}
      {quotesError ? (
        <DataStatePanel
          state={quotes.length ? "stale" : "error"}
          title={
            quotes.length
              ? "Showing saved quote versions"
              : "Could not load quote versions"
          }
          description={quotesError}
          onRetry={retryQuotes}
        />
      ) : null}

      {!quotesLoading && !quotes.length ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No quotes yet.</p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={openCreate}
          >
            Create quote from design
          </button>
        </div>
      ) : null}

      {quotes.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.listTable}>
            <thead>
              <tr>
                <th>Quote</th>
                <th>From design</th>
                <th>Issue date</th>
                <th>Expiry</th>
                <th>Status</th>
                <th>Amount (inc GST)</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => {
                const expired = isExpired(quote.expiresAt);
                const quoteSyncPending =
                  getAliasedLocalFirstEntitySyncState(
                    quote.id,
                    buildQuoteEntityKey,
                  ).pendingCount > 0;
                return (
                  <tr
                    key={quote.id}
                    className={styles.rowClickable}
                    tabIndex={0}
                    aria-label={`Open ${quote.quoteRef} version ${quote.versionNumber}`}
                    onClick={() => {
                      if (!isLocalQuoteId(quote.id))
                        prefetchQuoteDetail(quote.id);
                      selectQuote(quote.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      if (!isLocalQuoteId(quote.id))
                        prefetchQuoteDetail(quote.id);
                      selectQuote(quote.id);
                    }}
                    onMouseEnter={() => prefetchQuoteDetail(quote.id)}
                    onFocus={() => prefetchQuoteDetail(quote.id)}
                  >
                    <td>{`${quote.quoteRef} • v${quote.versionNumber}`}</td>
                    <td>{quote.sourceEstimateVersionLabel}</td>
                    <td>
                      {quote.status === "DRAFT"
                        ? "—"
                        : formatDateShort(quote.sentAt)}
                    </td>
                    <td>
                      {quote.expiresAt ? (
                        <span
                          className={expired ? styles.expiredText : undefined}
                        >
                          {quote.expiresAt}
                          {expired ? " (Expired)" : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <QuoteStatusBadge
                        status={quote.status}
                        detail={
                          quote.status === "DRAFT" &&
                          !quote.isCurrentDraft
                            ? quote.deliveryPreparedAt
                              ? "Delivery prepared"
                              : "Superseded"
                            : undefined
                        }
                      />
                    </td>
                    <td>
                      {formatMoneyFromCents(quote.totals.totalIncGstCents)}
                    </td>
                    <td>
                      {isLocalQuoteId(quote.id) || quoteSyncPending ? (
                        <span className={styles.linkMuted}>Syncing</span>
                      ) : quote.pdfFileId ? (
                        <a
                          href={quotePdfUrl(quote.id)}
                          onClick={(event) => event.stopPropagation()}
                        >
                          PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {createOpen ? (
        <QuoteModal label="Create quote" onClose={closeCreate}>
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>Create quote</h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeCreate}
            >
              Close
            </button>
          </div>
          <div className={styles.modalBody}>
            <label className={styles.metaLabel} htmlFor="estimateSelect">
              Select design version
            </label>
            <select
              id="estimateSelect"
              className={styles.metaInput}
              value={createEstimateId}
              onChange={(event) => setCreateEstimateId(event.target.value)}
              disabled={estimatesLoading}
            >
              {estimates.map((estimate) => (
                <option key={estimate.id} value={estimate.id}>
                  {estimate.isActiveDraft
                    ? "Current draft design"
                    : `Design ${estimate.versionLabel}`}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeCreate}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={createQuote}
            >
              Create quote
            </button>
          </div>
        </QuoteModal>
      ) : null}
    </div>
  );
}
