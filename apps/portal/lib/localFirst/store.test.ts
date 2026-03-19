import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  createEmptyLocalFirstState,
  enqueueLocalFirstMutation,
  ensureLocalFirstStoreReady,
  getLocalFirstConflictState,
  getLocalFirstStoreSnapshot,
  getLocalFirstWorkingCopy,
  resolveLocalFirstQueueItemConflict,
  summarizeLocalFirstStoreState,
  writeLocalFirstWorkingCopy,
} from './store';
import type { LocalFirstPersistedState } from './types';

describe('localFirst store', () => {
  let persisted: LocalFirstPersistedState;

  beforeEach(() => {
    persisted = createEmptyLocalFirstState();
    __setLocalFirstStorageAdapterForTests({
      get: async () => structuredClone(persisted),
      set: async (state) => {
        persisted = structuredClone(state);
      },
    });
    __resetLocalFirstStoreForTests();
  });

  it('persists working copies and queued mutations', async () => {
    await ensureLocalFirstStoreReady();

    await writeLocalFirstWorkingCopy({
      entityKey: 'estimate:1',
      data: { name: 'Draft estimate' },
    });

    await enqueueLocalFirstMutation({
      entityKey: 'estimate:1',
      mutationKey: 'estimate.save',
      payload: { total: 1234 },
    });

    const snapshot = getLocalFirstStoreSnapshot();
    expect(getLocalFirstWorkingCopy<{ name: string }>('estimate:1')?.data.name).toBe('Draft estimate');
    expect(snapshot.state.queue).toHaveLength(1);
    expect(snapshot.state.entityStates['estimate:1']?.status).toBe('queued');
    expect(persisted.queue).toHaveLength(1);
    expect(persisted.workingCopies['estimate:1']?.data).toEqual({ name: 'Draft estimate' });

    const summary = summarizeLocalFirstStoreState(snapshot.state);
    expect(summary.pendingCount).toBe(1);
    expect(summary.queuedCount).toBe(1);
  });

  it('rehydrates persisted state on boot', async () => {
    persisted = {
      ...createEmptyLocalFirstState(),
      workingCopies: {
        'quote:1': {
          entityKey: 'quote:1',
          data: { subject: 'Preview me' },
          updatedAt: '2026-03-19T00:00:00.000Z',
        },
      },
    };

    await ensureLocalFirstStoreReady();

    expect(getLocalFirstWorkingCopy<{ subject: string }>('quote:1')?.data.subject).toBe('Preview me');
  });

  it('tracks conflict metadata separately from the queue', async () => {
    await ensureLocalFirstStoreReady();

    const item = await enqueueLocalFirstMutation({
      entityKey: 'estimate:2',
      mutationKey: 'estimate.save',
      payload: { total: 2000 },
    });

    await resolveLocalFirstQueueItemConflict(item.id, {
      message: 'This estimate changed on another screen.',
      serverSnapshot: { rowVersion: 'server-v2' },
      clientSnapshot: { rowVersion: 'client-v1' },
    });

    const conflict = getLocalFirstConflictState('estimate:2');
    expect(conflict?.message).toBe('This estimate changed on another screen.');
    expect(getLocalFirstStoreSnapshot().state.entityStates['estimate:2']?.status).toBe('conflict');

    const summary = summarizeLocalFirstStoreState(getLocalFirstStoreSnapshot().state);
    expect(summary.conflictCount).toBe(1);
    expect(summary.issueMessage).toBe('This estimate changed on another screen.');
  });
});
