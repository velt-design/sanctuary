import { get, set, del } from 'idb-keyval';
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client';

export function createIDBPersister(key: IDBValidKey = 'sanctuary-portal-react-query'): Persister {
  return {
    persistClient: async (client: PersistedClient) => set(key, client),
    restoreClient: async () => get<PersistedClient>(key),
    removeClient: async () => del(key),
  };
}
