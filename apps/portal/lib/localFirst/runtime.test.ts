import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetLocalFirstStoreForTests,
  __setLocalFirstStorageAdapterForTests,
  createEmptyLocalFirstState,
  getLocalFirstStoreOwner,
} from './store';
import type { LocalFirstPersistedState } from './types';

const startQueueMock = vi.fn();
const stopQueueMock = vi.fn();

vi.mock('./queue', () => ({
  startLocalFirstQueueRuntime: () => startQueueMock(),
  stopLocalFirstQueueRuntime: () => stopQueueMock(),
}));

import { startLocalFirstRuntime, stopLocalFirstRuntime } from './runtime';

describe('local-first runtime lifecycle', () => {
  let persisted: LocalFirstPersistedState;

  beforeEach(() => {
    persisted = createEmptyLocalFirstState();
    __setLocalFirstStorageAdapterForTests({
      get: async () => structuredClone(persisted),
      set: async (state) => { persisted = structuredClone(state); },
    });
    __resetLocalFirstStoreForTests();
    startQueueMock.mockReset();
    stopQueueMock.mockReset();
  });

  afterEach(() => {
    stopLocalFirstRuntime({ clearOwner: true });
    vi.restoreAllMocks();
  });

  it('owns online listeners and removes them when the user boundary stops', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    await startLocalFirstRuntime('user-a');
    expect(getLocalFirstStoreOwner()).toBe('user-a');
    expect(startQueueMock).toHaveBeenCalledTimes(1);
    expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function));

    stopLocalFirstRuntime({ clearOwner: true });
    expect(getLocalFirstStoreOwner()).toBeNull();
    expect(stopQueueMock).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('stops the old owner before starting a new owner', async () => {
    await startLocalFirstRuntime('user-a');
    await startLocalFirstRuntime('user-b');

    expect(getLocalFirstStoreOwner()).toBe('user-b');
    expect(startQueueMock).toHaveBeenCalledTimes(2);
    expect(stopQueueMock).toHaveBeenCalled();
  });
});
