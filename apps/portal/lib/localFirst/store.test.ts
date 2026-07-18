import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  bindLocalFirstStoreOwner,
  clearLocalFirstStoreOwner,
  createEmptyLocalFirstState,
  discardLocalFirstEntityQueue,
  enqueueLocalFirstMutation,
  ensureLocalFirstStoreReady,
  getAliasedLocalFirstEntitySyncState,
  getLocalFirstConflictState,
  registerLocalFirstIdAlias,
  getLocalFirstStoreSnapshot,
  getLocalFirstWorkingCopy,
  localFirstStorageKey,
  resolveLocalFirstId,
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

  it('can discard queued and conflicted work for an entity without dropping the draft copy', async () => {
    await ensureLocalFirstStoreReady();

    await writeLocalFirstWorkingCopy({
      entityKey: 'contact:draft:1',
      data: { displayName: 'Jordan' },
    });

    const item = await enqueueLocalFirstMutation({
      entityKey: 'contact:1',
      mutationKey: 'contact.save',
      payload: { displayName: 'Jordan' },
    });

    await resolveLocalFirstQueueItemConflict(item.id, {
      message: 'Contact name is required.',
    });

    await discardLocalFirstEntityQueue('contact:1');

    expect(getLocalFirstStoreSnapshot().state.queue).toHaveLength(0);
    expect(getLocalFirstConflictState('contact:1')).toBeNull();
    expect(getLocalFirstStoreSnapshot().state.entityStates['contact:1']?.status).toBe('synced');
    expect(getLocalFirstWorkingCopy<{ displayName: string }>('contact:draft:1')?.data.displayName).toBe('Jordan');
  });

  it('resolves local id aliases transitively after sync', async () => {
    await ensureLocalFirstStoreReady();

    await registerLocalFirstIdAlias('local-estimate:1', 'est_1');
    await registerLocalFirstIdAlias('local-quote:1', 'qv_1');
    await registerLocalFirstIdAlias('est_1', 'est_1_final');

    expect(resolveLocalFirstId('local-estimate:1')).toBe('est_1_final');
    expect(resolveLocalFirstId('local-quote:1')).toBe('qv_1');
    expect(getLocalFirstStoreSnapshot().state.idAliases).toMatchObject({
      'local-estimate:1': 'est_1_final',
      'local-quote:1': 'qv_1',
      est_1: 'est_1_final',
    });
  });

  it('merges sync state across provisional and resolved entity ids', async () => {
    await ensureLocalFirstStoreReady();

    await enqueueLocalFirstMutation({
      entityKey: 'quote:detail:local-quote:1',
      mutationKey: 'quote.create',
      payload: { estimateId: 'est_1' },
    });
    await registerLocalFirstIdAlias('local-quote:1', 'qv_1');

    const merged = getAliasedLocalFirstEntitySyncState('qv_1', (id) => `quote:detail:${id}`);
    expect(merged.pendingCount).toBe(1);
    expect(merged.status).toBe('queued');
  });

  it('isolates persisted drafts and queues by authenticated owner', async () => {
    const byOwner = new Map<string, LocalFirstPersistedState>();
    __setLocalFirstStorageAdapterForTests({
      get: async (ownerId) => structuredClone(byOwner.get(ownerId)),
      set: async (state, ownerId) => {
        byOwner.set(ownerId, structuredClone(state));
      },
    });
    __resetLocalFirstStoreForTests();

    bindLocalFirstStoreOwner('user-a');
    await writeLocalFirstWorkingCopy({ entityKey: 'estimate:a', data: { customer: 'A' } });
    await enqueueLocalFirstMutation({ entityKey: 'estimate:a', mutationKey: 'estimate.save', payload: { total: 1 } });
    clearLocalFirstStoreOwner();

    bindLocalFirstStoreOwner('user-b');
    await ensureLocalFirstStoreReady();
    expect(getLocalFirstWorkingCopy('estimate:a')).toBeNull();
    expect(getLocalFirstStoreSnapshot().state.queue).toEqual([]);
    await writeLocalFirstWorkingCopy({ entityKey: 'estimate:b', data: { customer: 'B' } });
    clearLocalFirstStoreOwner();

    bindLocalFirstStoreOwner('user-a');
    await ensureLocalFirstStoreReady();
    expect(getLocalFirstWorkingCopy<{ customer: string }>('estimate:a')?.data.customer).toBe('A');
    expect(getLocalFirstWorkingCopy('estimate:b')).toBeNull();
    expect(getLocalFirstStoreSnapshot().state.queue).toHaveLength(1);
    expect(localFirstStorageKey('user-a')).toBe('sanctuary-portal-local-first:v2:user-a');
    expect(localFirstStorageKey('user-a')).not.toContain('sanctuary-portal-local-first-v1');
  });
});
