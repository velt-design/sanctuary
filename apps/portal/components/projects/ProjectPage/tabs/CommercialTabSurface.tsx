'use client';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import styles from './CommercialTab.module.css';
export type CommercialView = 'estimates' | 'quotes' | 'invoices';
export function useCommercialListControls(projectId: string) {
  const currentProject = useRef(projectId); currentProject.current = projectId;
  const [state, setState] = useState({ projectId, query: '', edited: false, interacted: false });
  const current = state.projectId === projectId ? state : { projectId, query: '', edited: false, interacted: false };
  const setQuery = useCallback((query: string) => setState((prior) => currentProject.current !== projectId ? prior : ({
    ...(prior.projectId === projectId ? prior : { projectId }), query, edited: true, interacted: true,
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

export type CommercialTabChrome = {
  view: CommercialView; onSelect: (view: CommercialView) => void; onIntent: (view: CommercialView) => void;
  notice: ReactNode; quoteViews: ReactNode; quoteDetail: boolean; inert: boolean;
};
export default function CommercialTabSurface({ view, calculatorWorkspace, onSelect, onIntent, quoteViews, children }: {
  view: CommercialView; calculatorWorkspace?: boolean; onSelect: (view: CommercialView) => void;
  onIntent?: (view: CommercialView) => void; quoteViews?: ReactNode; children: ReactNode;
}) {
  return <div className={`${styles.container} ${calculatorWorkspace ? styles.containerCalculatorWorkspace : ''}`}
    data-project-commercial-view={view} data-commercial-calculator-workspace={calculatorWorkspace ? 'true' : undefined}>
    {!calculatorWorkspace ? <div className={styles.toolbar}>
      <TabNavigation items={[{ key: 'estimates', label: 'Estimates' }, { key: 'quotes', label: 'Quotes' }, { key: 'invoices', label: 'Invoices' }]}
        selectedKey={view} onSelect={onSelect} onIntent={onIntent} ariaLabel="Commercial sections" />
      {quoteViews}
    </div> : null}
    {children}
  </div>;
}
