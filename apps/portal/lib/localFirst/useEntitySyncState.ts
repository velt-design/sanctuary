'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ensureLocalFirstStoreReady, getLocalFirstEntitySyncState, getLocalFirstStoreSnapshot, subscribeToLocalFirstStore } from './store';
import type { LocalFirstEntityKey, LocalFirstEntitySyncState } from './types';

export function useEntitySyncState(entityKey: LocalFirstEntityKey): LocalFirstEntitySyncState {
  const snapshot = useSyncExternalStore(subscribeToLocalFirstStore, getLocalFirstStoreSnapshot, getLocalFirstStoreSnapshot);

  useEffect(() => {
    void ensureLocalFirstStoreReady();
  }, []);

  if (!snapshot.hydrated) {
    return {
      entityKey,
      status: 'idle',
      pendingCount: 0,
      updatedAt: new Date(0).toISOString(),
    };
  }

  return getLocalFirstEntitySyncState(entityKey);
}
