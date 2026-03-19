import { beforeEach, describe, expect, it } from 'vitest';
import { __resetLocalFirstQueueForTests, enqueueAndProcessLocalFirstMutation, registerLocalFirstMutationHandler, startLocalFirstQueueRuntime } from './queue';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  createEmptyLocalFirstState,
  getLocalFirstConflictState,
  getLocalFirstEntitySyncState,
  getLocalFirstStoreSnapshot,
  registerLocalFirstIdAlias,
  resolveLocalFirstId,
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

  it('retries dependent mutations until a local id alias resolves', async () => {
    registerLocalFirstMutationHandler('estimate.create', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await registerLocalFirstIdAlias('local-estimate:1', 'est_1');
      return { kind: 'success' } as const;
    });

    registerLocalFirstMutationHandler('quote.create', async () => {
      const resolvedEstimateId = resolveLocalFirstId('local-estimate:1');
      if (resolvedEstimateId.startsWith('local-estimate:')) {
        return {
          kind: 'retry',
          status: 'queued',
          retryAt: new Date(Date.now() + 20).toISOString(),
        } as const;
      }

      return { kind: 'success' } as const;
    });

    await startLocalFirstQueueRuntime();
    await enqueueAndProcessLocalFirstMutation({
      entityKey: 'estimate:detail:local-estimate:1',
      mutationKey: 'estimate.create',
      payload: { total: 3333 },
    });
    await enqueueAndProcessLocalFirstMutation({
      entityKey: 'quote:detail:local-quote:1',
      mutationKey: 'quote.create',
      payload: { estimateId: 'local-estimate:1' },
    });

    await waitUntil(() => {
      expect(getLocalFirstStoreSnapshot().state.queue).toHaveLength(0);
      expect(getLocalFirstEntitySyncState('quote:detail:local-quote:1').status).toBe('synced');
      expect(resolveLocalFirstId('local-estimate:1')).toBe('est_1');
    });
  });

  it('retries local quote draft updates until the synced quote id is available', async () => {
    registerLocalFirstMutationHandler('quote.create', async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      await registerLocalFirstIdAlias('local-quote:1', 'qv_1');
      return { kind: 'success' } as const;
    });

    registerLocalFirstMutationHandler('quote.update', async (item) => {
      const payload = item.payload as { quoteVersionId: string };
      const resolvedQuoteId = resolveLocalFirstId(payload.quoteVersionId);
      if (resolvedQuoteId.startsWith('local-quote:')) {
        return {
          kind: 'retry',
          status: 'queued',
          retryAt: new Date(Date.now() + 20).toISOString(),
        } as const;
      }

      expect(resolvedQuoteId).toBe('qv_1');
      return { kind: 'success' } as const;
    });

    await startLocalFirstQueueRuntime();
    await enqueueAndProcessLocalFirstMutation({
      entityKey: 'quote:detail:local-quote:1',
      mutationKey: 'quote.create',
      payload: { estimateId: 'est_1' },
    });
    await enqueueAndProcessLocalFirstMutation({
      entityKey: 'quote:detail:local-quote:1',
      mutationKey: 'quote.update',
      payload: { quoteVersionId: 'local-quote:1', patch: { reference: 'REF' } },
    });

    await waitUntil(() => {
      expect(getLocalFirstStoreSnapshot().state.queue).toHaveLength(0);
      expect(getLocalFirstEntitySyncState('quote:detail:local-quote:1').status).toBe('synced');
      expect(resolveLocalFirstId('local-quote:1')).toBe('qv_1');
    });
  });
});
