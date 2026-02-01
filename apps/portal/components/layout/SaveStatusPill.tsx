'use client';

import { useSyncExternalStore } from 'react';
import { saveTracker } from '@/lib/sync/saveTracker';
import styles from './PortalHeader.module.css';

function labelFor(status: ReturnType<typeof saveTracker.getSnapshot>['status']): string {
  if (status === 'saving') return 'Saving…';
  if (status === 'offline') return 'Offline';
  if (status === 'error') return 'Error';
  return 'Saved';
}

export default function SaveStatusPill() {
  const state = useSyncExternalStore(saveTracker.subscribe, saveTracker.getSnapshot, saveTracker.getSnapshot);
  const label = labelFor(state.status);
  const title =
    state.status === 'error' && state.lastError
      ? state.lastError
      : state.status === 'offline'
        ? 'Browser is offline.'
        : state.lastSavedAt
          ? `Last saved: ${new Date(state.lastSavedAt).toLocaleString()}`
          : undefined;

  return (
    <div className={styles.savePill} aria-label="Save status" title={title}>
      <span className={styles.saveDot} data-status={state.status} aria-hidden="true" />
      <span className={styles.saveLabel}>{label}</span>
    </div>
  );
}

