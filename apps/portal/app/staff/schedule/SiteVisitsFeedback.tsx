'use client';

import { AlertActionButton, AlertBanner } from '@/components/ui/foundation/FoundationAlert';
import styles from './SiteVisitsFeedback.module.css';

export function SiteVisitsRefreshFeedback({
  error,
  hasSnapshot,
  onRetry,
}: {
  error: unknown;
  hasSnapshot: boolean;
  onRetry: () => void;
}) {
  if (!error) return null;
  return (
    <AlertBanner
      tone={hasSnapshot ? 'warning' : 'error'}
      title={hasSnapshot ? 'Site visits refresh failed' : 'Site visits unavailable'}
      action={<AlertActionButton onClick={onRetry}>Retry</AlertActionButton>}
    >
      {hasSnapshot ? 'Showing the last saved schedule. Retry when the connection is available.' : 'No site visit data could be loaded.'}
    </AlertBanner>
  );
}

export function SiteVisitsActionError({ error, onDismiss }: { error: string | null; onDismiss: () => void }) {
  if (!error) return null;
  return (
    <AlertBanner
      tone="error"
      title="Booking error"
      action={<AlertActionButton onClick={onDismiss}>Dismiss</AlertActionButton>}
    >
      <span className={styles.errorCopy}>{error}</span>
    </AlertBanner>
  );
}
