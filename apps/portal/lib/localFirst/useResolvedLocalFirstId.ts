'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { ensureLocalFirstStoreReady, getLocalFirstStoreSnapshot, resolveLocalFirstId, subscribeToLocalFirstStore } from './store';

export function useResolvedLocalFirstId(id: string | null | undefined): string | null {
  const snapshot = useSyncExternalStore(subscribeToLocalFirstStore, getLocalFirstStoreSnapshot, getLocalFirstStoreSnapshot);

  useEffect(() => {
    void ensureLocalFirstStoreReady();
  }, []);

  if (!id) return null;
  if (!snapshot.hydrated) return id;
  return resolveLocalFirstId(id);
}
