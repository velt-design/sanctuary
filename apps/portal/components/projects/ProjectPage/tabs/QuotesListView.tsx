"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { DataStatePanel } from "@/components/ui/foundation/FoundationFeedback";
import { Badge, EmptyState, Input, OverflowMenu, SearchFilterBar } from "@/components/ui/foundation";
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
import type { QuoteDeleteTarget } from "./useQuoteDeletion";
import type { QuoteSupersedeTarget } from "./useQuoteSuperseding";
import {
  formatDateShort,
  formatMoneyFromCents,
  isExpired,
} from "./quotesTabModel";
import CommercialInternalNameDialog from "./CommercialInternalNameDialog";
import { COMMERCIAL_INTERNAL_NAME_MAX_LENGTH } from "@/lib/commercial/internalName";

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
  createInternalName: string;
  setCreateInternalName: Dispatch<SetStateAction<string>>;
  estimatesLoading: boolean;
  estimates: EstimateMeta[];
  createQuote: () => void;
  createMode: "estimate" | "manual";
  setCreateMode: Dispatch<SetStateAction<"estimate" | "manual">>;
  manualDescription: string;
  setManualDescription: Dispatch<SetStateAction<string>>;
  manualQty: string;
  setManualQty: Dispatch<SetStateAction<string>>;
  manualPrice: string;
  setManualPrice: Dispatch<SetStateAction<string>>;
  createBusy: boolean;
  isAdmin: boolean;
  deleteQuote: (quote: QuoteDeleteTarget) => void;
  supersedeQuote: (quote: QuoteSupersedeTarget) => void;
  supersedePendingId: string | null;
  renameTarget: QuoteVersion | null;
  renamePending: boolean;
  renameQuote: (quote: QuoteVersion) => void;
  closeRename: () => void;
  saveRename: (internalName: string | null) => void | Promise<void>;
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
  createInternalName,
  setCreateInternalName,
  estimatesLoading,
  estimates,
  createQuote,
  createMode,
  setCreateMode,
  manualDescription,
  setManualDescription,
  manualQty,
  setManualQty,
  manualPrice,
  setManualPrice,
  createBusy,
  isAdmin,
  deleteQuote,
  supersedeQuote,
  supersedePendingId,
  renameTarget,
  renamePending,
  renameQuote,
  closeRename,
  saveRename,
}: QuotesListViewProps) {
  const [query, setQuery] = useState("");
  const visibleQuotes = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return quotes;
    return quotes.filter((quote) => [
      quote.internalName,
      quote.quoteRef,
      `v${quote.versionNumber}`,
      quote.sourceEstimateVersionLabel,
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(needle)));
  }, [query, quotes]);

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

      {!quotesLoading && !quotesError && !quotes.length ? (
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
        <SearchFilterBar
          query={query}
          onQueryChange={setQuery}
          queryPlaceholder="Search quote names or references"
          searchId="quote-search"
          filters={[]}
          onClearAll={() => setQuery("")}
        />
      ) : null}

      {!quotesLoading && quotes.length && !visibleQuotes.length ? (
        <EmptyState
          title="No matching quotes"
          description="Try a different internal name, reference, or version."
        />
      ) : null}

      {visibleQuotes.length ? (
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuotes.map((quote) => {
                const expired = isExpired(quote.expiresAt);
                const quoteSyncPending =
                  getAliasedLocalFirstEntitySyncState(
                    quote.id,
                    buildQuoteEntityKey,
                  ).pendingCount > 0;
                const canDelete = quote.status === "DRAFT" && quote.isCurrentDraft;
                const canSupersede = quote.status === "SENT" || quote.status === "ACCEPTED";
                const quoteRefLabel = quote.quoteRef || "Pending reference";
                const quoteIdentity = quote.internalName
                  || (quote.commercialScopeKind === "add_on" ? "Add-on quote" : quoteRefLabel);
                return (
                  <tr
                    key={quote.id}
                    className={styles.rowClickable}
                    tabIndex={0}
                    aria-label={`Open ${quoteIdentity}, ${quoteRefLabel} version ${quote.versionNumber}`}
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
                    <td>
                      <span className={styles.documentIdentity}>
                        <strong>{quoteIdentity}</strong>
                        <small>{`${quoteRefLabel} · v${quote.versionNumber}`}</small>
                        {quote.commercialScopeKind === "add_on" ? <Badge tone="info">Add-on</Badge> : null}
                      </span>
                    </td>
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
                    <td
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <OverflowMenu
                        label={`Actions for ${quote.quoteRef} version ${quote.versionNumber}`}
                        menuLabel={`${quote.quoteRef} v${quote.versionNumber}`}
                        items={[
                          {
                            label: "Rename quote",
                            onSelect: () => renameQuote(quote),
                            disabled: isLocalQuoteId(quote.id) || quoteSyncPending,
                          },
                          ...(isAdmin && canDelete ? [{
                            label: "Delete draft quote",
                            destructive: true,
                            onSelect: () => deleteQuote({ id: quote.id, quoteRef: quote.quoteRef, versionNumber: quote.versionNumber }),
                            disabled: isLocalQuoteId(quote.id) || quoteSyncPending,
                          }] : []),
                          ...(isAdmin && canSupersede ? [{
                            label: supersedePendingId === quote.id ? "Marking superseded..." : "Mark superseded",
                            onSelect: () => supersedeQuote({ id: quote.id, quoteRef: quote.quoteRef, versionNumber: quote.versionNumber }),
                            disabled: supersedePendingId !== null,
                          }] : []),
                        ]}
                      />
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
            {isAdmin ? (
              <div className={styles.modalModeSwitch} aria-label="Quote source">
                <button type="button" className={createMode === "estimate" ? styles.modalModeButtonActive : styles.modalModeButton} onClick={() => setCreateMode("estimate")}>From estimate</button>
                <button type="button" className={createMode === "manual" ? styles.modalModeButtonActive : styles.modalModeButton} onClick={() => setCreateMode("manual")}>Manual quote</button>
              </div>
            ) : null}
            {createMode === "estimate" ? (
              <>
                <label className={styles.metaLabel} htmlFor="estimateSelect">Select design version</label>
                <select
                  id="estimateSelect"
                  className={styles.metaInput}
                  value={createEstimateId}
                  onChange={(event) => {
                    setCreateEstimateId(event.target.value);
                    const estimate = estimates.find((item) => item.id === event.target.value);
                    const family = quotes.find((quote) =>
                      (quote.commercialScopeId ?? null) === (estimate?.commercialScopeId ?? null),
                    );
                    setCreateInternalName(family?.internalName ?? estimate?.internalName ?? "");
                  }}
                  disabled={estimatesLoading}
                >
                  {!estimates.length ? <option value="">No estimates available</option> : null}
                  {estimates.map((estimate) => (
                    <option key={estimate.id} value={estimate.id}>
                      {estimate.internalName || (estimate.isActiveDraft
                        ? "Current draft design"
                        : `Design ${estimate.versionLabel}`)}{estimate.commercialScopeKind === "add_on" ? " · Add-on" : ""}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div className={styles.manualQuoteFields}>
                <Input label="First line item" value={manualDescription} onChange={(event) => setManualDescription(event.target.value)} placeholder="e.g. Supply and install additional post" />
                <Input label="Quantity" type="number" min="0.01" step="0.01" value={manualQty} onChange={(event) => setManualQty(event.target.value)} />
                <Input label="Unit price (inc GST)" type="number" min="0.01" step="0.01" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} helperText="Add more lines and edit payment terms after creation." />
              </div>
            )}
            <Input
              label="Internal quote name (optional)"
              value={createInternalName}
              onChange={(event) => setCreateInternalName(event.target.value)}
              placeholder="e.g. Front deck pergola"
              maxLength={COMMERCIAL_INTERNAL_NAME_MAX_LENGTH}
              helperText="For staff use only; customer documents keep the quote reference."
            />
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
              disabled={createBusy || (createMode === "estimate" ? !createEstimateId : !manualDescription.trim() || Number(manualQty) <= 0 || Number(manualPrice) <= 0)}
            >
              {createBusy ? "Creating..." : "Create quote"}
            </button>
          </div>
        </QuoteModal>
      ) : null}

      <CommercialInternalNameDialog
        open={Boolean(renameTarget)}
        title="Rename quote"
        description="This updates the staff-only name across every version of this quote."
        initialValue={renameTarget?.internalName}
        submitLabel="Save name"
        pending={renamePending}
        onClose={closeRename}
        onSubmit={saveRename}
      />
    </div>
  );
}
