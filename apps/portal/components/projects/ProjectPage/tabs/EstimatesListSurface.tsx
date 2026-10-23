'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { SearchFilterBar } from '@/components/ui/foundation/SearchFilterBar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/foundation/FoundationSurfaces';
import type { CommercialView } from './CommercialTabSurface';
import styles from './EstimatesListView.module.css';

export function useEstimatesListControls(projectId: string) {
  const currentProject = useRef(projectId); currentProject.current = projectId;
  const [state, setState] = useState({ projectId, query: '', edited: false, interacted: false });
  const current = state.projectId === projectId ? state : { projectId, query: '', edited: false, interacted: false };
  const setQuery = useCallback((query: string) => setState((prior) => currentProject.current !== projectId ? prior : ({
    ...(prior.projectId === projectId ? prior : { projectId }), query, edited: true, interacted: prior.projectId === projectId && prior.interacted,
  })), [projectId]);
  const adoptSavedQuery = useCallback((query: string) => setState((prior) => {
    if (currentProject.current !== projectId || prior.projectId === projectId && (prior.edited || prior.query === query)) return prior;
    return { projectId, query, edited: false, interacted: prior.projectId === projectId && prior.interacted };
  }), [projectId]);
  const markInteracted = useCallback(() => setState((prior) => currentProject.current !== projectId ? prior : ({
    ...(prior.projectId === projectId ? prior : { projectId, query: '', edited: false }), interacted: true,
  })), [projectId]);
  const adopted = useCallback(() => setState((prior) => currentProject.current !== projectId || prior.projectId !== projectId || !prior.interacted ? prior : { ...prior, interacted: false }), [projectId]);
  return useMemo(() => ({ query: current.query, edited: current.edited, interacted: current.interacted,
    setQuery, adoptSavedQuery, adopted, markInteracted }), [current.query, current.edited, current.interacted, setQuery, adoptSavedQuery, adopted, markInteracted]);
}

export type EstimatesListControls = ReturnType<typeof useEstimatesListControls>;
export type EstimatesListEvidence = {
  headerActions: ReactNode; status: ReactNode;
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
    if (evidence || !onInteraction) return;
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
      {evidence?.headerActions}
    </div>
    {evidence?.status}
    {content?.empty}
    <SearchFilterBar query={query} onQueryChange={changeQuery}
      queryPlaceholder="Search estimate names or versions" searchId="estimate-search"
      filters={[]} onClearAll={() => changeQuery('')} />
    {content?.noMatches}
    <Table aria-label="Project estimates" className={styles.table}>
      <TableHeader><TableRow>
        <TableHead>Estimate</TableHead><TableHead>Created</TableHead><TableHead>Status</TableHead>
        <TableHead>Linked quotes</TableHead><TableHead>Actions</TableHead>
      </TableRow></TableHeader>
      <TableBody>{content ? content.rows : <TableRow><TableCell colSpan={5}>
        {unavailable ? 'Estimates unavailable. Retry the read.' : <span role="status">Reading estimates…</span>}
      </TableCell></TableRow>}</TableBody>
    </Table>
  </div>;
}
