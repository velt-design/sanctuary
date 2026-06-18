'use client';

import { useEffect, useSyncExternalStore } from 'react';
import {
  ensureLocalFirstStoreReady,
  getAliasedLocalFirstEntitySyncState,
  getLocalFirstEntitySyncState,
  getLocalFirstStoreSnapshot,
  subscribeToLocalFirstStore,
} from './store';
import type { LocalFirstEntityKey, LocalFirstEntitySyncState } from './types';

export function useAliasedEntitySyncState(
  entityId: string | null | undefined,
  buildEntityKey: (id: string) => LocalFirstEntityKey,
  fallbackEntityKey: LocalFirstEntityKey,
): LocalFirstEntitySyncState {
  const snapshot = useSyncExternalStore(subscribeToLocalFirstStore, getLocalFirstStoreSnapshot, getLocalFirstStoreSnapshot);

  useEffect(() => {
    void ensureLocalFirstStoreReady();
  }, []);

  if (!snapshot.hydrated) {
    return {
      entityKey: fallbackEntityKey,
      status: 'idle',
      pendingCount: 0,
      updatedAt: new Date(0).toISOString(),
    };
  }

  if (!entityId) {
    return getLocalFirstEntitySyncState(fallbackEntityKey);
  }

  return getAliasedLocalFirstEntitySyncState(entityId, buildEntityKey, fallbackEntityKey);
}
