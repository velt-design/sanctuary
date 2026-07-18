import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PersistedClient } from '@tanstack/react-query-persist-client';
import { portalQueryStorageKey } from './persistence';

const { database, getMock, setMock, delMock } = vi.hoisted(() => {
  const values = new Map<unknown, unknown>();
  return {
    database: values,
    getMock: vi.fn(async (key: unknown) => values.get(key)),
    setMock: vi.fn(async (key: unknown, value: unknown) => { values.set(key, value); }),
    delMock: vi.fn(async (key: unknown) => { values.delete(key); }),
  };
});

vi.mock('idb-keyval', () => ({ get: getMock, set: setMock, del: delMock }));

import { createIDBPersister } from './idbPersister';

describe('query cache owner isolation', () => {
  beforeEach(() => {
    database.clear();
    getMock.mockClear();
    setMock.mockClear();
    delMock.mockClear();
  });

  it('does not hydrate user A cache through user B persister', async () => {
    const userA = createIDBPersister(portalQueryStorageKey('user-a'));
    const userB = createIDBPersister(portalQueryStorageKey('user-b'));
    const persisted = {
      timestamp: 1,
      buster: 'v3',
      clientState: { mutations: [], queries: [] },
    } as unknown as PersistedClient;

    await userA.persistClient(persisted);

    await expect(userB.restoreClient()).resolves.toBeUndefined();
    await expect(userA.restoreClient()).resolves.toEqual(persisted);
    expect(getMock).not.toHaveBeenCalledWith('sanctuary-portal-react-query');
  });
});
