'use client';

import { Button } from '@/components/ui/foundation/FoundationControls';
import { AlertBanner } from '@/components/ui/foundation/FoundationFeedback';
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
      action={<Button variant="secondary" onClick={onRetry}>Retry</Button>}
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
      action={<Button variant="secondary" onClick={onDismiss}>Dismiss</Button>}
    >
      <span className={styles.errorCopy}>{error}</span>
    </AlertBanner>
  );
}
