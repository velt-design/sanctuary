import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  bindLocalFirstStoreOwner,
  clearLocalFirstStoreOwner,
  createEmptyLocalFirstState,
  enqueueLocalFirstMutation,
  ensureLocalFirstStoreReady,
} from './store';
import {
  installPortalRetainedWorkResponder,
  queryPortalOwnerRetainedWork,
} from './portalRetainedWorkBoundary';

class TestBroadcastChannel {
  static instances = new Set<TestBroadcastChannel>();
  private readonly listeners = new Set<(event: MessageEvent) => void>();

  constructor(readonly name: string) {
    TestBroadcastChannel.instances.add(this);
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  postMessage(data: unknown) {
    queueMicrotask(() => {
      for (const instance of TestBroadcastChannel.instances) {
        if (instance === this || instance.name !== this.name) continue;
        for (const listener of instance.listeners) listener({ data } as MessageEvent);
      }
    });
  }

  close() {
    TestBroadcastChannel.instances.delete(this);
  }
}

describe('cross-tab retained-work boundary', () => {
  beforeEach(() => {
    vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
    __setLocalFirstStorageAdapterForTests({
      get: async () => createEmptyLocalFirstState(),
      set: async () => undefined,
    });
    __resetLocalFirstStoreForTests();
    bindLocalFirstStoreOwner('user-a');
  });

  afterEach(() => {
    clearLocalFirstStoreOwner();
    TestBroadcastChannel.instances.clear();
    vi.unstubAllGlobals();
  });

  it('reports retained work from another live tab before logout can purge it', async () => {
    await ensureLocalFirstStoreReady();
    await enqueueLocalFirstMutation({
      entityKey: 'estimate:one',
      mutationKey: 'estimate.save',
      payload: { total: 42 },
    });
    const stop = installPortalRetainedWorkResponder();

    await expect(queryPortalOwnerRetainedWork('user-a', 25)).resolves.toBe('retained');
    stop();
  });

  it('reports clear only after at least one hydrated owner tab responds', async () => {
    await ensureLocalFirstStoreReady();
    const stop = installPortalRetainedWorkResponder();

    await expect(queryPortalOwnerRetainedWork('user-a', 25)).resolves.toBe('clear');
    stop();
  });

  it('fails closed when no live owner tab can answer', async () => {
    await expect(queryPortalOwnerRetainedWork('user-a', 25)).resolves.toBe('unknown');
  });
});
