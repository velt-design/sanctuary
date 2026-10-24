"use client";

import { useLayoutEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";
import QuotesListSurface, { type QuotesListBinding, type QuotesListEvidence } from './QuotesListSurface';
import { useCommercialListScroll, useCommercialListState } from './useCommercialListState';
import { DataStatePanel } from "@/components/ui/foundation/FoundationFeedback";
import { Badge, Button, ButtonLink, Card, EmptyState, Input, OverflowMenu } from "@/components/ui/foundation";
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
import { selectAuthoritativeAcceptedVersions } from "@/lib/commercial/authoritativeAcceptedVersions";
import { estimateDisplayName } from './estimateListPresentation';
import { useProjectCommercialContext } from '../ProjectCommercialContext';

type QuotesListViewProps = {
  projectId: string;
  listSurface?: QuotesListBinding;
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
  projectId,
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
  listSurface,
}: QuotesListViewProps) {
  const commercial = useProjectCommercialContext();
  const createEstimate = estimates.find((estimate) => estimate.id === createEstimateId);
  const sharedCreateName = createMode === 'estimate' && createEstimate
    ? quotes.find((quote) => (quote.commercialScopeId ?? null) === (createEstimate.commercialScopeId ?? null) && quote.internalName)?.internalName
    : null;
  const [savedQuery, setQuery] = useCommercialListState(projectId, 'quotes-search', '');
  const query = listSurface?.controls.query ?? savedQuery;
  const [savedHistory, setShowHistory] = useCommercialListState(projectId, 'quotes-history', false);
  const showHistory = listSurface?.controls.showHistory ?? savedHistory;
  const restoreScroll = useRef(!listSurface?.controls.interacted && !listSurface?.controls.historyEdited);
  useCommercialListScroll(projectId, 'quotes', !quotesLoading, restoreScroll.current);
  if(listSurface?.controls.interacted)restoreScroll.current=false;
  const adopted = listSurface?.controls.adopted;
  useLayoutEffect(() => { if(!quotesLoading)adopted?.(); }, [adopted,quotesLoading]);
  useLayoutEffect(() => {
    if (!listSurface) return;
    if (listSurface.controls.edited) { if (query !== savedQuery) setQuery(query); }
    else listSurface.controls.adoptSavedQuery(savedQuery);
    if (listSurface.controls.historyEdited) { if (showHistory !== savedHistory) setShowHistory(showHistory); }
    else listSurface.controls.adoptSavedHistory(savedHistory);
  }, [listSurface, query, savedQuery, savedHistory, showHistory, setQuery, setShowHistory]);
  const currentAcceptedIds = useMemo(() => new Set(
    selectAuthoritativeAcceptedVersions(quotes.map((quote) => ({
      ...quote,
      familyKey: quote.quoteId,
      acceptedAt: quote.acceptedAt ?? null,
      createdAt: quote.createdAt,
    }))).map((quote) => quote.id),
  ), [quotes]);
  const isHistorical = (quote: QuoteVersion) => quote.status === 'SUPERSEDED'
    || quote.status === 'DECLINED'
    || (quote.status === 'ACCEPTED' && !currentAcceptedIds.has(quote.id))
    || (quote.status === 'DRAFT' && !quote.isCurrentDraft && !quote.deliveryPreparedAt);
  const historicalCount = quotes.filter(isHistorical).length;
  // Search always includes history. Older SENT versions remain available until
  // explicitly retired; a newer draft must not silently replace their status.


  const evidence: QuotesListEvidence = {
    pending:quotesLoading,
    closed: commercial.closed,
    headerActions: commercial.actionsAvailable ? <button type="button" className={styles.primaryButton} onClick={openCreate}>Create quote</button> : null,
    accepted: <>
      {currentAcceptedIds.size > 0 ? (
        <Card title={commercial.closed ? "Recorded accepted agreement" : quotesError ? "Saved accepted work" : "Current accepted work"} padding="compact" headingLevel={4}>
          {commercial.closed && <p>The acceptance is part of the project history. Review any remaining commercial obligations before billing or preparing work.</p>}
          {quotes.filter((quote) => currentAcceptedIds.has(quote.id)).map((quote) => (
            <div key={quote.id} className={styles.acceptedSummary}>
              <div>
                <strong>{quote.internalName || (quote.commercialScopeKind === 'add_on' ? 'Accepted add-on' : 'Accepted base agreement')}</strong>
                <p>{quote.quoteRef} v{quote.versionNumber}</p>
                <strong className={styles.acceptedAmount}>{formatMoneyFromCents(quote.totals.totalIncGstCents)} <small>inc GST</small></strong>
              </div>
              <Button variant="secondary" size="small" onClick={() => selectQuote(quote.id)}>Open {quote.quoteRef} v{quote.versionNumber}</Button>
            </div>
          ))}
        </Card>
      ) : null}

    </>,
    status: <>

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
          {commercial.actionsAvailable && <button
            type="button"
            className={styles.primaryButton}
            onClick={openCreate}
          >
            Create quote from design
          </button>}
        </div>
      ) : null}

      {quotesLoading&&quotes.length>0&&<p role="status">Updating quote versions. Earlier verified versions remain below.</p>}
    </>,
    historicalLabel: quotesLoading && !quotes.length ? 'Reading…' : quotesError && !quotes.length ? 'Unavailable' : historicalCount,
    dialogs: <>
      {createOpen ? (
        <QuoteModal label="Create quote" onClose={closeCreate}>
          <div className={styles.modalHeader}>
            <h4 className={styles.cardTitle}>Create quote</h4>
            <button
              type="button"
              className={styles.modalClose}
              onClick={closeCreate}
              disabled={createBusy}
            >
              Close
            </button>
          </div>
          <div className={styles.modalBody}>
            {isAdmin ? (
              <div className={styles.modalModeSwitch} aria-label="Quote source">
                <button type="button" disabled={createBusy} className={createMode === "estimate" ? styles.modalModeButtonActive : styles.modalModeButton} onClick={() => setCreateMode("estimate")}>From estimate</button>
                <button type="button" disabled={createBusy} className={createMode === "manual" ? styles.modalModeButtonActive : styles.modalModeButton} onClick={() => setCreateMode("manual")}>Manual quote</button>
              </div>
            ) : null}
            {createMode === "estimate" ? (
              <>
                <label className={styles.metaLabel} htmlFor="estimateSelect">Select design version</label>
                <select
                  id="estimateSelect"
                  className={styles.metaInput}
                  value={createEstimateId}
                  disabled={createBusy || estimatesLoading}
                  onChange={(event) => {
                    setCreateEstimateId(event.target.value);
                    const estimate = estimates.find((item) => item.id === event.target.value);
                    const family = quotes.find((quote) =>
                      (quote.commercialScopeId ?? null) === (estimate?.commercialScopeId ?? null),
                    );
                    setCreateInternalName(family?.internalName ?? estimate?.internalName ?? "");
                  }}
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
                <Input label="First line item" disabled={createBusy} value={manualDescription} onChange={(event) => setManualDescription(event.target.value)} placeholder="e.g. Supply and install additional post" />
                <Input label="Quantity" disabled={createBusy} type="number" min="0.01" step="0.01" value={manualQty} onChange={(event) => setManualQty(event.target.value)} />
                <Input label="Unit price (inc GST)" disabled={createBusy} type="number" min="0.01" step="0.01" value={manualPrice} onChange={(event) => setManualPrice(event.target.value)} helperText="Add more lines and edit payment terms after creation." />
              </div>
            )}
            {sharedCreateName ? (
              <div>
                <span className={styles.metaLabel}>Internal quote name</span>
                <p className={styles.metaValue}>{sharedCreateName}</p>
                <p className={styles.muted}>Shared by all versions. Use Rename in the quote list to change it.</p>
              </div>
            ) : <Input
              label="Internal quote name (optional)"
              value={createInternalName}
              disabled={createBusy}
              onChange={(event) => setCreateInternalName(event.target.value)}
              placeholder="e.g. Front deck pergola"
              maxLength={COMMERCIAL_INTERNAL_NAME_MAX_LENGTH}
              helperText="For staff use only; customer documents keep the quote reference."
            />}
          </div>
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={closeCreate}
              disabled={createBusy}
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
    </>,
    render: (query, showHistory) => {
      const matchingQuotes = (() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return quotes;
    return quotes.filter((quote) => [
      quote.internalName,
      quote.quoteRef,
      `v${quote.versionNumber}`,
      quote.sourceEstimateVersionLabel,
    ].some((value) => String(value ?? "").toLocaleLowerCase().includes(needle)));
      })();
      const visibleQuotes = query.trim() || showHistory ? matchingQuotes : matchingQuotes.filter((quote) => !isHistorical(quote));
      return { noMatches: <>
      {!quotesLoading && quotes.length && !visibleQuotes.length ? (
        <EmptyState
          title={query.trim() ? "No matching quotes" : "Only historical versions"}
          description={query.trim() ? "Try a different internal name, reference, or version." : "Show historical versions to review earlier quotes, or create a new quote."}
        />
      ) : null}

      </>, rows: <>
              {quotesLoading&&!quotes.length&&<tr><td colSpan={5} role="status">Reading quote versions…</td></tr>}
              {quotesError&&!quotes.length&&<tr><td colSpan={5}>Quote versions unavailable. Retry the read.</td></tr>}
              {visibleQuotes.map((quote) => {
                const expired = quote.status !== "ACCEPTED" && isExpired(quote.expiresAt);
                const quoteSyncPending =
                  getAliasedLocalFirstEntitySyncState(
                    quote.id,
                    buildQuoteEntityKey,
                  ).pendingCount > 0;
                const canDelete = quote.status === "DRAFT" && quote.isCurrentDraft;
                const canSupersede = quote.status === "SENT" || quote.status === "ACCEPTED";
                const isHistoricalAcceptance = quote.status === "ACCEPTED" && !currentAcceptedIds.has(quote.id);
                const quoteRefLabel = quote.quoteRef || "Pending reference";
                const sourceEstimate = estimates.find((estimate) => estimate.id === quote.sourceEstimateVersionId);
                const quoteIdentity = quote.internalName
                  || (quote.commercialScopeKind === "add_on" ? "Add-on quote" : quoteRefLabel);
                return (
                  <tr
                    key={quote.id}
                    className={styles.rowClickable}
                    data-historical={isHistorical(quote) ? 'true' : undefined}
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
                    <span className={styles.documentSource} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                      {quote.sourceEstimateVersionId ? <ButtonLink variant="tertiary" size="small" href={`/staff/projects/${encodeURIComponent(quote.projectId)}?tab=estimates&estimateId=${encodeURIComponent(quote.sourceEstimateVersionId)}`}>
                        {sourceEstimate ? estimateDisplayName(sourceEstimate, estimates) : quote.sourceEstimateVersionLabel}
                      </ButtonLink> : 'No source estimate'}
                    </span>
                    </td>
                    <td data-label="Dates"><div className={styles.documentIdentity}><span>Issued{' '}
                      {quote.status === "DRAFT"
                        ? "—"
                        : formatDateShort(quote.sentAt)}
                    </span><small>{quote.status === 'ACCEPTED' ? 'Original expiry: ' : 'Expires: '}
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
                    </small></div></td>
                    <td data-label="Status">
                      <QuoteStatusBadge
                        status={quote.status}
                        detail={
                          isHistoricalAcceptance
                            ? "Historical acceptance"
                            : quote.status === "DRAFT" &&
                          !quote.isCurrentDraft
                            ? quote.deliveryPreparedAt
                              ? "Delivery prepared"
                              : "Superseded"
                            : undefined
                        }
                      />
                    </td>
                    <td data-label="Amount inc GST">
                      {formatMoneyFromCents(quote.totals.totalIncGstCents)}
                    </td>
                    <td
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                    <span className={styles.documentSource}>
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
                    </span>
                      <OverflowMenu
                        label={`Actions for ${quote.quoteRef} version ${quote.versionNumber}`}
                        menuLabel={`${quote.quoteRef} v${quote.versionNumber}`}
                        items={[
                          {
                            label: "Rename quote",
                            onSelect: () => renameQuote(quote),
                            disabled: quotesLoading||Boolean(quotesError)||!commercial.actionsAvailable||isLocalQuoteId(quote.id) || quoteSyncPending,
                          },
                          ...(isAdmin && canDelete ? [{
                            label: "Delete draft quote",
                            destructive: true,
                            onSelect: () => deleteQuote({ id: quote.id, quoteRef: quote.quoteRef, versionNumber: quote.versionNumber }),
                            disabled: quotesLoading||Boolean(quotesError)||!commercial.actionsAvailable||isLocalQuoteId(quote.id) || quoteSyncPending,
                          }] : []),
                          ...(isAdmin && canSupersede ? [{
                            label: supersedePendingId === quote.id ? "Marking superseded..." : "Mark superseded",
                            onSelect: () => supersedeQuote({ id: quote.id, quoteRef: quote.quoteRef, versionNumber: quote.versionNumber }),
                            disabled: quotesLoading||Boolean(quotesError)||!commercial.actionsAvailable||supersedePendingId !== null,
                          }] : []),
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
      </> };
    },
  };
  const publish = listSurface?.publish;
  useLayoutEffect(() => { publish?.(evidence); }, [publish, evidence]);
  useLayoutEffect(() => () => publish?.(null), [publish]);
  return listSurface ? null : <QuotesListSurface query={query} onQueryChange={setQuery} showHistory={showHistory}
    onHistoryChange={setShowHistory} evidence={evidence} />;
}
