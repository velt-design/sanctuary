import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, Clock3, CloudOff, Info, RefreshCw } from 'lucide-react';
import { Button } from './FoundationControls';
import styles from './FoundationFeedback.module.css';

export type AlertTone = 'info' | 'warning' | 'error' | 'blocking';
export function AlertBanner({ tone = 'info', title, children, action }: {
  tone?: AlertTone;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'info' ? Info : tone === 'warning' ? AlertTriangle : AlertCircle;
  return (
    <aside className={styles.alert} data-tone={tone} role={tone === 'error' || tone === 'blocking' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div><strong>{title}</strong>{children ? <div>{children}</div> : null}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </aside>
  );
}

export type DataStateKind = 'empty' | 'filtered-empty' | 'error' | 'unavailable' | 'stale' | 'conflict';
const DATA_STATE_COPY: Record<DataStateKind, { title: string; description: string }> = {
  empty: { title: 'Nothing here yet', description: 'Create the first record to begin.' },
  'filtered-empty': { title: 'No matching results', description: 'Clear or adjust the active filters.' },
  error: { title: 'Could not load data', description: 'The last request failed. Your existing work is unchanged.' },
  unavailable: { title: 'Data unavailable', description: 'Your account cannot access this data, or the service is unavailable.' },
  stale: { title: 'Showing saved data', description: 'The latest refresh failed. You can continue with the cached copy.' },
  conflict: { title: 'Changes need review', description: 'A newer saved version exists. Review it before replacing data.' },
};

export function DataStatePanel({ state, onRetry, onClear }: {
  state: DataStateKind;
  onRetry?: () => void;
  onClear?: () => void;
}) {
  const copy = DATA_STATE_COPY[state];
  const Icon = state === 'stale' ? Clock3 : state === 'unavailable' ? CloudOff : AlertCircle;
  return (
    <div className={styles.dataState} data-state={state} role={state === 'error' || state === 'conflict' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div><strong>{copy.title}</strong><p>{copy.description}</p></div>
      {onRetry ? <Button variant="secondary" leadingIcon={<RefreshCw aria-hidden="true" />} onClick={onRetry}>Retry</Button> : null}
      {onClear ? <Button variant="tertiary" onClick={onClear}>Clear filters</Button> : null}
    </div>
  );
}

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
