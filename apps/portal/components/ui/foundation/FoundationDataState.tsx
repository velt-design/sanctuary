import { AlertCircle, Clock3, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from './FoundationControls';
import styles from './FoundationFeedback.module.css';

export type DataStateKind = 'empty' | 'filtered-empty' | 'error' | 'unavailable' | 'stale' | 'conflict';
const DATA_STATE_COPY: Record<DataStateKind, { title: string; description: string }> = {
  empty: { title: 'Nothing here yet', description: 'Create the first record to begin.' },
  'filtered-empty': { title: 'No matching results', description: 'Clear or adjust the active filters.' },
  error: { title: 'Could not load data', description: 'The last request failed. Your existing work is unchanged.' },
  unavailable: { title: 'Data unavailable', description: 'Your account cannot access this data, or the service is unavailable.' },
  stale: { title: 'Showing saved data', description: 'The latest refresh failed. You can continue with the cached copy.' },
  conflict: { title: 'Changes need review', description: 'A newer saved version exists. Review it before replacing data.' },
};

export function DataStatePanel({ state, title, description, onRetry, onClear }: {
  state: DataStateKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onClear?: () => void;
}) {
  const copy = DATA_STATE_COPY[state];
  const Icon = state === 'stale' ? Clock3 : state === 'unavailable' ? CloudOff : AlertCircle;
  return (
    <div className={styles.dataState} data-state={state} role={state === 'error' || state === 'conflict' ? 'alert' : 'status'}>
      <Icon aria-hidden="true" />
      <div><strong>{title ?? copy.title}</strong><p>{description ?? copy.description}</p></div>
      {onRetry ? <Button variant="secondary" leadingIcon={<RefreshCw aria-hidden="true" />} onClick={onRetry}>Retry</Button> : null}
      {onClear ? <Button variant="tertiary" onClick={onClear}>Clear filters</Button> : null}
    </div>
  );
}
