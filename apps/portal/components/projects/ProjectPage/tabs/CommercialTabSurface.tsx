'use client';
import type { ReactNode } from 'react';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import styles from './CommercialTab.module.css';
export type CommercialView = 'estimates' | 'quotes' | 'invoices';
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
