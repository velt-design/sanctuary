'use client';

import { useEffect, type ReactNode } from 'react';
import { SearchFilterBar } from '@/components/ui/foundation/SearchFilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation/FoundationSurfaces';
import type { CommercialView } from './CommercialTabSurface';
import styles from './EstimatesListView.module.css';
import ReadStatus from '../ProjectReadFeedback';

export { useCommercialListControls as useEstimatesListControls } from './CommercialTabSurface';
import type { useCommercialListControls } from './CommercialTabSurface';
export type EstimatesListControls = ReturnType<typeof useCommercialListControls>;
export type EstimatesListEvidence = {
  pending?:boolean; headerActions: ReactNode; status: ReactNode; statusTitle?:string; statusAction?:ReactNode;
  onSelect?: (view: CommercialView) => void; onIntent?: (view: CommercialView) => void; notice?: ReactNode; inert?: boolean;
  render: (query: string) => { empty: ReactNode; noMatches: ReactNode; rows: ReactNode };
};
export type EstimatesListBinding = {
  controls: EstimatesListControls;
  publish: (evidence: EstimatesListEvidence | null) => void;
  notice?: ReactNode; inert?: boolean;
  onSelect?: (view: CommercialView) => void; onIntent?: (view: CommercialView) => void;
};

/** The actual list owner is independent of authority; record slots are not. */
export default function EstimatesListSurface({ query, onQueryChange, evidence, unavailable = false, onInteraction }: {
  query: string; onQueryChange: (query: string) => void;
  evidence: EstimatesListEvidence | null; unavailable?: boolean; onInteraction?: () => void;
}) {
  useEffect(() => {
    if (evidence && !evidence.pending || !onInteraction) return;
    const initial = window.scrollY;
    const onScroll = () => { if (window.scrollY !== initial) onInteraction(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [evidence, onInteraction]);
  const changeQuery = (next: string) => { if (!evidence) onInteraction?.(); onQueryChange(next); };
  const content = evidence?.render(query);
  return <div className={styles.wrapper} role="region" aria-label="Estimates" data-estimates-view="list">
    <div className={styles.header}>
      <div><h3 className={styles.title}>Estimates</h3>
        <p className={styles.subtitle}>Working designs · accepted quotes remain the agreement.</p></div>
      <div className={styles.headerActionSlot}>{evidence?.headerActions}<ReadStatus title={evidence?.statusTitle ?? (unavailable ? 'Estimates unavailable' : evidence?.pending || !evidence ? 'Reading estimates…' : 'Estimates current')}
      tone={unavailable ? 'error' : evidence?.status ? 'warning' : 'neutral'} action={evidence?.statusAction} details={evidence?.status} /></div>
    </div>

    <SearchFilterBar query={query} onQueryChange={changeQuery}
      queryPlaceholder="Search estimate names or versions" searchId="estimate-search"
      filters={[]} onClearAll={() => changeQuery('')} />
    <Table aria-label="Project estimates" className={styles.table} viewportClassName={styles.listViewport}>
      <colgroup>{[34, 17, 16, 19, 14].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup>
      <TableHeader><TableRow>
        <TableHead>Estimate</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead>
        <TableHead>Linked quotes</TableHead><TableHead>Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>{content && (content.empty || content.noMatches) ? <TableRow><TableCell colSpan={5}>{content.empty || content.noMatches}</TableCell></TableRow> : null}{content ? content.rows : <TableRow><TableCell colSpan={5}>
        {unavailable ? 'Estimates unavailable. Retry the read.' : <span role="status">Reading estimates…</span>}
      </TableCell></TableRow>}</TableBody>
    </Table>
  </div>;
}
