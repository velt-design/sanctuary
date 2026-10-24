import type { ReactNode } from 'react';
import { Button } from './FoundationControls';
import { AlertBanner } from './FoundationAlert';
import styles from './FoundationFeedback.module.css';

export { AlertBanner, type AlertTone } from './FoundationAlert';

export { DataStatePanel, type DataStateKind } from './FoundationDataState';

export type CalculatorNoticeTone = 'information' | 'warning' | 'blocking';
export function CalculatorNotice({ tone, title, children }: { tone: CalculatorNoticeTone; title: string; children: ReactNode }) {
  return <AlertBanner tone={tone === 'information' ? 'info' : tone} title={title}>{children}</AlertBanner>;
}

const nzdCurrency = new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-NZ', { style: 'percent', maximumFractionDigits: 1 });
export function FinancialSummary({ revenue, cost }: { revenue: number; cost: number }) {
  const grossProfit = revenue - cost;
  const margin = revenue === 0 ? 0 : grossProfit / revenue;
  const metrics = [
    ['Revenue', nzdCurrency.format(revenue)],
    ['Cost', nzdCurrency.format(cost)],
    ['Gross profit', nzdCurrency.format(grossProfit)],
    ['Margin', percent.format(margin)],
  ];
  return (
    <dl className={styles.financial} aria-label="Financial summary">
      {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

export function PermissionBlockedControl({ label, reason }: { label: string; reason: string }) {
  return <div className={styles.permission}><Button disabled>{label}</Button><span role="note">{reason}</span></div>;
}

export function TaskScheduleFeedback({ state, children }: { state: 'saving' | 'saved' | 'blocked' | 'retry'; children: ReactNode }) {
  return <div className={styles.task} data-state={state} role={state === 'blocked' ? 'alert' : 'status'}><span aria-hidden="true" /> <strong>{children}</strong></div>;
}
