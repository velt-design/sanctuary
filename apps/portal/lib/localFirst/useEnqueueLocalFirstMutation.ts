'use client';

import { useCallback, useEffect } from 'react';
import { enqueueAndProcessLocalFirstMutation } from './queue';
import { ensureLocalFirstStoreReady } from './store';
import type { LocalFirstEnqueueMutationInput, LocalFirstQueueItem } from './types';

export function useEnqueueLocalFirstMutation<TPayload>() {
  useEffect(() => {
    void ensureLocalFirstStoreReady();
  }, []);

  return useCallback(
    async (input: LocalFirstEnqueueMutationInput<TPayload>): Promise<LocalFirstQueueItem<TPayload>> =>
      enqueueAndProcessLocalFirstMutation(input),
    [],
  );
}
