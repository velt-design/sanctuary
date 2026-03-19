import { beforeEach, describe, expect, it } from 'vitest';
import { __resetLocalFirstQueueForTests, enqueueAndProcessLocalFirstMutation, registerLocalFirstMutationHandler, startLocalFirstQueueRuntime } from './queue';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  createEmptyLocalFirstState,
  getLocalFirstConflictState,
  getLocalFirstEntitySyncState,
  getLocalFirstStoreSnapshot,
} from './store';
import type { LocalFirstPersistedState } from './types';

async function waitUntil(assertion: () => void, timeoutMs: number = 1000): Promise<void> {
  const timeoutAt = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (Date.now() < timeoutAt) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Timed out waiting for assertion.');
}

describe('localFirst queue', () => {
  let persisted: LocalFirstPersistedState;

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    persisted = createEmptyLocalFirstState();
    __setLocalFirstStorageAdapterForTests({
      get: async () => structuredClone(persisted),
      set: async (state) => {
        persisted = structuredClone(state);
      },
    });

    __resetLocalFirstQueueForTests();
    __resetLocalFirstStoreForTests();
  });

  it('processes queued mutations to completion', async () => {
    registerLocalFirstMutationHandler('estimate.save', async () => ({
      kind: 'success',
      lastSyncedAt: '2026-03-19T12:00:00.000Z',
    }));

    await startLocalFirstQueueRuntime();
    await enqueueAndProcessLocalFirstMutation({
      entityKey: 'estimate:3',
      mutationKey: 'estimate.save',
      payload: { total: 3333 },
    });

    await waitUntil(() => {
      expect(getLocalFirstStoreSnapshot().state.queue).toHaveLength(0);
      expect(getLocalFirstEntitySyncState('estimate:3').status).toBe('synced');
    });
  });

  it('pauses on handler conflicts', async () => {
    registerLocalFirstMutationHandler('quote.save', async () => ({
      kind: 'conflict',
      message: 'Quote changed on the server.',
      serverSnapshot: { version: 2 },
      clientSnapshot: { version: 1 },
    }));

    await startLocalFirstQueueRuntime();
    await enqueueAndProcessLocalFirstMutation({
      entityKey: 'quote:7',
      mutationKey: 'quote.save',
      payload: { subject: 'Draft quote' },
    });

    await waitUntil(() => {
      expect(getLocalFirstEntitySyncState('quote:7').status).toBe('conflict');
      expect(getLocalFirstConflictState('quote:7')?.message).toBe('Quote changed on the server.');
    });
  });
});
