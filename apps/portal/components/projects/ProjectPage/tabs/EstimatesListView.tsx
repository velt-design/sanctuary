'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import EstimatesListSurface, { type EstimatesListEvidence, type EstimatesListBinding } from './EstimatesListSurface';
import { useCommercialListScroll, useCommercialListState } from './useCommercialListState';

import {
  Badge,
  Button,
  ButtonLink,
  DataStatePanel,
  EmptyState,
  OverflowMenu,
  TableCell,
  TableRow,
  type BadgeTone,
} from '@/components/ui/foundation';
import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteVersion } from '@/lib/quotes/types';
import { acceptedEstimateQuoteIds, estimateDisplayName, quotesForEstimate } from './estimateListPresentation';
import { formatPortalDateTime } from '@/lib/format/portalDateTime';
import styles from './EstimatesListView.module.css';
import { useProjectCommercialContext } from '../ProjectCommercialContext';

function estimateStatus(estimate: EstimateMeta): { label: string; tone: BadgeTone } {
  if (estimate.status === 'archived') return { label: 'Archived', tone: 'neutral' };
  if (estimate.isActiveDraft) return { label: 'Active draft', tone: 'info' };
  if (estimate.hasSentQuote) return { label: 'Quoted', tone: 'info' };
  return { label: 'Historical', tone: 'neutral' };
}

export default function EstimatesListView({
  projectId,
  estimates,
  quotes,
  quoteReadState,
  loading,
  error,
  onRetry,
  onCreate,
  onCreateAddOn,
  onOpen,
  onDuplicate,
  onRename,
  listSurface,
}: {
  projectId: string;
  estimates: EstimateMeta[];
  quotes?: QuoteVersion[];
  quoteReadState: 'loading' | 'unavailable' | 'ready';
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onCreate: () => void;
  onCreateAddOn: () => void;
  onOpen: (estimateId: string) => void;
  onDuplicate: (estimateId: string) => void;
  onRename: (estimate: EstimateMeta) => void;
  listSurface?: EstimatesListBinding;
}) {
  const commercial = useProjectCommercialContext();
  const [savedQuery, setSavedQuery] = useCommercialListState(projectId, 'estimates', '');
  const query = listSurface?.controls.query ?? savedQuery;
  const restoreScroll = useRef(!listSurface?.controls.interacted);
  useCommercialListScroll(projectId, 'estimates', !loading, restoreScroll.current);
  if(listSurface?.controls.interacted)restoreScroll.current=false;
  const adopted = listSurface?.controls.adopted;
  useLayoutEffect(() => { if(!loading)adopted?.(); }, [adopted,loading]);
  useLayoutEffect(() => {
    if (!listSurface) return;
    if (listSurface.controls.edited) {
      if (savedQuery !== query) setSavedQuery(query);
    } else listSurface.controls.adoptSavedQuery(savedQuery);
  }, [listSurface, savedQuery, query, setSavedQuery]);
  const accepted = useMemo(() => acceptedEstimateQuoteIds(quotes ?? []), [quotes]);
  const evidence = useMemo<EstimatesListEvidence>(() => ({
    pending:loading,
    notice: listSurface?.notice,
    onSelect: listSurface?.onSelect, onIntent: listSurface?.onIntent,
    inert: listSurface?.inert,
    headerActions: commercial.actionsAvailable ? <div className={styles.headerActions}>
      <Button variant="secondary" onClick={onCreateAddOn}>Create add-on estimate</Button>
      <Button onClick={onCreate}>Create estimate</Button>
    </div> : null,
    statusTitle: error ? (estimates.length ? 'Showing saved estimates' : 'Could not load estimates') : undefined,
    statusAction: error ? <Button variant="secondary" onClick={onRetry}>Retry</Button> : undefined,
    status: error ? <DataStatePanel state={estimates.length ? 'stale' : 'error'}
      title={estimates.length ? 'Showing saved estimates' : 'Could not load estimates'}
      description={error} onRetry={onRetry} /> : null,
    render: (query) => {
      const needle = query.trim().toLocaleLowerCase();
      const visibleEstimates = !needle ? estimates : estimates.filter((estimate) => [
        estimate.internalName, estimate.versionLabel, estimate.createdBy,
      ].some((value) => String(value ?? '').toLocaleLowerCase().includes(needle)));
      return {
        empty: !loading && !error && !estimates.length ? <EmptyState title="No estimates yet"
          description={commercial.closed ? 'No estimates were saved for this closed project.' : 'Create the first estimate to start pricing this project.'}
          action={commercial.actionsAvailable ? <Button onClick={onCreate}>Create estimate</Button> : undefined} /> : null,
        noMatches: !loading && estimates.length && !visibleEstimates.length ? <EmptyState title="No matching estimates"
            description="Try a different internal name or version."
            action={<Button variant="secondary" onClick={() => (listSurface?.controls.setQuery ?? setSavedQuery)('')}>Clear search</Button>} /> : null,
        rows: <>
          {loading && !estimates.length && <TableRow><TableCell colSpan={5}><span role="status">Reading estimates…</span></TableCell></TableRow>}
          {error && !estimates.length && <TableRow><TableCell colSpan={5}>Estimates unavailable. Retry the read.</TableCell></TableRow>}
            {visibleEstimates.map((estimate) => {
              const status = estimateStatus(estimate);
              const name = estimateDisplayName(estimate, estimates);
              const linkedQuotes = quotesForEstimate(estimate.id, quotes ?? [], accepted);
              const openLabel = estimate.isActiveDraft ? 'Edit in calculator' : 'Open in calculator';
              const open = () => onOpen(estimate.id);
              return (
                <TableRow
                  key={estimate.id}
                  className={styles.row}
                  data-estimate-id={estimate.id}
                  tabIndex={0}
                  aria-label={`${openLabel}: ${name}`}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    open();
                  }}
                >
                  <TableCell>
                    <span className={styles.estimateIdentity}>
                      <strong>{name}</strong>
                      {estimate.internalName ? <small>Estimate {estimate.versionLabel}</small> : null}
                      {estimate.commercialScopeKind === 'add_on' ? <Badge tone="info">Add-on</Badge> : null}
                    </span>
                  </TableCell>
                  <TableCell data-label="Created">{formatPortalDateTime(estimate.createdAt, { fallback: '-' })}</TableCell>
                  <TableCell data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></TableCell>
                  <TableCell data-label="Linked quotes" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}>
                    <div className={styles.estimateIdentity}>
                      {quoteReadState !== 'ready' ? <span>{quoteReadState === 'loading' ? 'Loading quote links…' : 'Quote links unavailable'}</span> : linkedQuotes.length ? linkedQuotes.map((quote) => (
                        <div key={quote.id}>
                          <ButtonLink variant="tertiary" size="small" href={`/staff/projects/${encodeURIComponent(estimate.projectId)}?tab=quotes&quoteId=${encodeURIComponent(quote.id)}`}>
                            {quote.quoteRef} v{quote.versionNumber}
                          </ButtonLink>
                          <span>{accepted.has(quote.id) ? commercial.closed ? ' Recorded accepted agreement' : ' Current accepted agreement' : quote.status === 'ACCEPTED' ? ' Historical acceptance' : ` ${quote.status.toLowerCase()}`}</span>
                        </div>
                      )) : <span>No linked quote</span>}
                    </div>
                  </TableCell>
                  <TableCell
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation(); }}
                  >
                    <div className={styles.actions}>
                      <Button size="small" variant="secondary" onClick={open}>{openLabel}</Button>
                      <OverflowMenu label={`Actions for ${name}`} menuLabel={name} items={[
                        { label: 'Rename', disabled:loading||Boolean(error)||!commercial.actionsAvailable,onSelect: () => onRename(estimate) },
                        { label: 'Duplicate', disabled: loading||Boolean(error)||!commercial.actionsAvailable, onSelect: () => onDuplicate(estimate.id) },
                      ]} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
        </>,
      };
    },
  }), [accepted, commercial, error, estimates, listSurface, loading, onCreate, onCreateAddOn, onDuplicate, onOpen, onRename, onRetry, quoteReadState, quotes, setSavedQuery]);
  useLayoutEffect(() => {
    if (!listSurface) return;
    listSurface.publish(evidence);
  }, [listSurface, evidence]);
  const publish = listSurface?.publish;
  useLayoutEffect(() => () => publish?.(null), [publish]);
  return listSurface ? null : <EstimatesListSurface query={query} onQueryChange={setSavedQuery} evidence={evidence} />;
}
