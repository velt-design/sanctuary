'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  clearLocalFirstWorkingCopy,
  ensureLocalFirstStoreReady,
  getLocalFirstStoreSnapshot,
  getLocalFirstWorkingCopy,
  subscribeToLocalFirstStore,
  writeLocalFirstWorkingCopy,
} from './store';
import type { LocalFirstEntityKey, LocalFirstWorkingCopy } from './types';

export function useLocalWorkingCopy<TData>(entityKey: LocalFirstEntityKey, initialData: TData): {
  hydrated: boolean;
  hasLocalCopy: boolean;
  value: TData;
  workingCopy: LocalFirstWorkingCopy<TData> | null;
  setWorkingCopy: (next: TData | ((current: TData) => TData), options?: { baseUpdatedAt?: string }) => Promise<void>;
  clearWorkingCopy: () => Promise<void>;
} {
  const snapshot = useSyncExternalStore(subscribeToLocalFirstStore, getLocalFirstStoreSnapshot, getLocalFirstStoreSnapshot);

  useEffect(() => {
    void ensureLocalFirstStoreReady();
  }, []);

  const workingCopy = snapshot.hydrated ? getLocalFirstWorkingCopy<TData>(entityKey) : null;
  const value = workingCopy?.data ?? initialData;

  const setWorkingCopy = useCallback(
    async (next: TData | ((current: TData) => TData), options?: { baseUpdatedAt?: string }) => {
      const current = getLocalFirstWorkingCopy<TData>(entityKey)?.data ?? initialData;
      const data = typeof next === 'function' ? (next as (current: TData) => TData)(current) : next;
      await writeLocalFirstWorkingCopy({
        entityKey,
        data,
        baseUpdatedAt: options?.baseUpdatedAt,
      });
    },
    [entityKey, initialData],
  );

  const clearWorkingCopyState = useCallback(async () => {
    await clearLocalFirstWorkingCopy(entityKey);
  }, [entityKey]);

  return {
    hydrated: snapshot.hydrated,
    hasLocalCopy: Boolean(workingCopy),
    value,
    workingCopy,
    setWorkingCopy,
    clearWorkingCopy: clearWorkingCopyState,
  };
}
