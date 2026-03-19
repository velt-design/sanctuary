'use client';

import { useSyncExternalStore } from 'react';
import { saveTracker } from '@/lib/sync/saveTracker';
import styles from './PortalHeader.module.css';

function labelFor(state: ReturnType<typeof saveTracker.getSnapshot>): string {
  if (state.status === 'saving') return 'Syncing...';
  if (state.status === 'offline') return 'Offline';
  if (state.status === 'conflict') return 'Needs review';
  if (state.status === 'error') return 'Error';
  return 'Saved';
}

function titleFor(state: ReturnType<typeof saveTracker.getSnapshot>): string | undefined {
  if (state.status === 'conflict') {
    return state.lastError ?? `${state.conflicts} change${state.conflicts === 1 ? '' : 's'} need review before syncing.`;
  }
  if (state.status === 'error') {
    return state.lastError ?? 'A change failed to sync and will retry.';
  }
  if (state.status === 'offline') {
    if (state.pending > 0) {
      return `${state.pending} change${state.pending === 1 ? '' : 's'} waiting to sync when the connection returns.`;
    }
    return 'Browser is offline.';
  }
  if (state.status === 'saving') {
    return `${state.pending} pending change${state.pending === 1 ? '' : 's'} syncing in the background.`;
  }
  if (state.lastSavedAt) {
    return `Last synced: ${new Date(state.lastSavedAt).toLocaleString()}`;
  }
  return undefined;
}

export default function SaveStatusPill() {
  const state = useSyncExternalStore(saveTracker.subscribe, saveTracker.getSnapshot, saveTracker.getSnapshot);
  const label = labelFor(state);
  const title = titleFor(state);

  return (
    <div className={styles.savePill} aria-label="Save status" title={title}>
      <span className={styles.saveDot} data-status={state.status} aria-hidden="true" />
      <span className={styles.saveLabel}>{label}</span>
    </div>
  );
}
