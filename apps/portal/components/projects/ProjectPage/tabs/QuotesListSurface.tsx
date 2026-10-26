"use client";
import { useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { SearchFilterBar } from '@/components/ui/foundation/SearchFilterBar';
import { useCommercialListControls } from './CommercialTabSurface';
import type { EstimatesListBinding } from './EstimatesListSurface';
import styles from './QuotesTab.module.css';
import ReadStatus from '@/components/page-state/ReadStatus';
import { Card } from '@/components/ui/foundation/FoundationSurfaces';
export function useQuotesListControls(projectId: string) {
  const query = useCommercialListControls(projectId);
  const current = useRef(projectId); current.current = projectId;
  const [history, setHistory] = useState({ projectId, value: false, edited: false });
  const setShowHistory = useCallback((value: boolean) => { query.markInteracted(); setHistory(prior => current.current !== projectId ? prior : { projectId, value, edited: true }); }, [projectId,query.markInteracted]);
  const adoptSavedHistory = useCallback((value: boolean) => setHistory(prior => current.current !== projectId || prior.projectId === projectId && (prior.edited || prior.value === value) ? prior : { projectId, value, edited: false }), [projectId]);
  return useMemo(() => ({ ...query, showHistory: history.projectId === projectId && history.value,
    historyEdited: history.projectId === projectId && history.edited, setShowHistory, adoptSavedHistory }), [query, history, projectId, setShowHistory, adoptSavedHistory]);
}
export type QuotesListEvidence = {
  pending?:boolean; closed: boolean; headerActions: ReactNode; accepted: ReactNode; status: ReactNode; statusTitle?:string; statusAction?:ReactNode; hasAccepted?:boolean;
  historicalLabel: ReactNode; dialogs: ReactNode;
  render: (query: string, showHistory: boolean) => { noMatches: ReactNode; rows: ReactNode };
};
export type QuotesListBinding = Omit<EstimatesListBinding, 'controls' | 'publish'> & {
  controls: ReturnType<typeof useQuotesListControls>; publish: (value: QuotesListEvidence | null) => void;
};
export default function QuotesListSurface({ query, onQueryChange, showHistory, onHistoryChange, evidence, unavailable = false, onInteraction }: {
  query: string; onQueryChange: (query: string) => void; showHistory: boolean; onHistoryChange: (value: boolean) => void;
  evidence: QuotesListEvidence | null; unavailable?: boolean; onInteraction?:()=>void;
}) {
  useEffect(()=>{if(evidence&&!evidence.pending||!onInteraction)return;const start=window.scrollY;const onScroll=()=>{if(window.scrollY!==start)onInteraction();};window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll);},[evidence,onInteraction]);
  const content = evidence?.render(query, showHistory);
  return <div className={styles.wrapper} role="region" aria-label="Quotes" data-quotes-view="list">
    <div className={styles.header}><div><h3 className={styles.title}>Quotes</h3>
      <p className={styles.subtitle}>{evidence?.closed ? 'Recorded agreements and quote history' : 'Agreed scope first'} · all amounts NZD inc GST</p></div>
      <div className={styles.listHeaderActionSlot}>{evidence?.headerActions}</div></div>
    <ReadStatus title={evidence?.statusTitle ?? (unavailable ? 'Quotes unavailable' : evidence?.pending || !evidence ? 'Reading quotes…' : 'Quotes current')}
      tone={unavailable ? 'error' : evidence?.statusTitle ? 'warning' : 'neutral'}
      action={evidence?.statusAction}
      details={evidence?.status} />
    <div className={styles.acceptedWork} role="region" aria-label="Accepted work" tabIndex={0}>
      {evidence?.hasAccepted && !unavailable ? evidence.accepted : <><Card title="Accepted work" padding="compact" headingLevel={4}><p role={!unavailable && (!evidence || evidence.pending) ? 'status' : undefined}>{unavailable || evidence?.statusTitle ? 'Accepted work unavailable. Retry the quote read.' : !evidence || evidence.pending ? 'Reading accepted work…' : 'No accepted work recorded.'}</p></Card></>}
    </div>
    <SearchFilterBar query={query} onQueryChange={onQueryChange} queryPlaceholder="Search quote names or references"
      searchId="quote-search" filters={[]} onClearAll={() => onQueryChange('')} />
    <label className={styles.historyToggle}><input type="checkbox" checked={showHistory} onChange={event => onHistoryChange(event.target.checked)} /> Show historical versions ({evidence?.historicalLabel ?? (unavailable ? 'Unavailable' : 'Reading…')}){query.trim() ? <span>Search includes history</span> : null}</label>
    <div className={styles.tableWrap}><table className={styles.listTable}>
      <colgroup>{[26, 18, 18, 16, 22].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <thead><tr>
      <th>Quote</th><th>Dates</th><th>Status</th><th>Amount (inc GST)</th><th>Actions</th>
    </tr></thead><tbody>{content?.noMatches ? <tr><td colSpan={5}>{content.noMatches}</td></tr> : null}{content ? content.rows : <tr><td colSpan={5} role={unavailable ? undefined : 'status'}>{unavailable ? 'Quote versions unavailable. Retry the read.' : 'Reading quote versions…'}</td></tr>}</tbody></table></div>
    {evidence?.dialogs}
  </div>;
}
