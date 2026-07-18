import type { LocalFirstEntityKey } from '@/lib/localFirst/types';
import {
  ensureLocalFirstStoreReady,
  getLocalFirstStoreOwner,
  getLocalFirstWorkingCopy,
  writeLocalFirstWorkingCopy,
} from '@/lib/localFirst/store';
import { calculatorSessionStorageKey } from '@/lib/localFirst/sessionBoundary';
import { isCalculatorInputsV2 } from '@/lib/types/calculator';
import type { CalculatorDraftSessionSnapshot } from './calculatorInputs';

export type CalculatorDraftRestoreSource = 'working-copy' | 'session';

export type CalculatorDraftRestoreResult = {
  snapshot: CalculatorDraftSessionSnapshot;
  source: CalculatorDraftRestoreSource;
};

export type CalculatorDraftWriteResult = {
  sessionStored: boolean;
  workingCopyStored: boolean;
};

export type CalculatorDraftPersistence = {
  restore: (input: {
    entityKey: LocalFirstEntityKey;
    sessionKey: string;
  }) => Promise<CalculatorDraftRestoreResult | null>;
  persist: (input: {
    entityKey: LocalFirstEntityKey;
    sessionKey: string;
    snapshot: CalculatorDraftSessionSnapshot;
  }) => Promise<CalculatorDraftWriteResult>;
};

export type CalculatorDraftPersistenceServices = {
  ensureStoreReady: () => Promise<void>;
  readWorkingCopy: (entityKey: LocalFirstEntityKey) => CalculatorDraftSessionSnapshot | null;
  writeWorkingCopy: (input: {
    entityKey: LocalFirstEntityKey;
    data: CalculatorDraftSessionSnapshot;
  }) => Promise<unknown>;
  getSessionStorage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
};

const defaultServices: CalculatorDraftPersistenceServices = {
  ensureStoreReady: ensureLocalFirstStoreReady,
  readWorkingCopy(entityKey) {
    return getLocalFirstWorkingCopy<CalculatorDraftSessionSnapshot>(entityKey)?.data ?? null;
  },
  writeWorkingCopy: writeLocalFirstWorkingCopy,
  getSessionStorage() {
    const ownerId = getLocalFirstStoreOwner();
    if (typeof window === 'undefined' || !ownerId) return null;
    const storage = window.sessionStorage;
    return {
      getItem: (key: string) => storage.getItem(calculatorSessionStorageKey(ownerId, key)),
      setItem: (key: string, value: string) => storage.setItem(calculatorSessionStorageKey(ownerId, key), value),
      removeItem: (key: string) => storage.removeItem(calculatorSessionStorageKey(ownerId, key)),
    };
  },
};

function isCalculatorDraftSnapshot(value: unknown): value is CalculatorDraftSessionSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<CalculatorDraftSessionSnapshot>;
  return isCalculatorInputsV2(snapshot.values);
}

export function createCalculatorDraftPersistence(
  services: CalculatorDraftPersistenceServices = defaultServices,
): CalculatorDraftPersistence {
  return {
    async restore({ entityKey, sessionKey }) {
      try {
        await services.ensureStoreReady();
        const workingCopy = services.readWorkingCopy(entityKey);
        if (isCalculatorDraftSnapshot(workingCopy)) {
          return { snapshot: workingCopy, source: 'working-copy' };
        }
      } catch {
        // Session storage remains a valid fallback when IndexedDB is unavailable.
      }

      const sessionStorage = services.getSessionStorage();
      if (!sessionStorage) return null;

      try {
        const raw = sessionStorage.getItem(sessionKey);
        if (!raw) return null;
        const snapshot = JSON.parse(raw) as unknown;
        if (!isCalculatorDraftSnapshot(snapshot)) {
          sessionStorage.removeItem(sessionKey);
          return null;
        }
        return { snapshot, source: 'session' };
      } catch {
        try {
          sessionStorage.removeItem(sessionKey);
        } catch {
          // A blocked storage implementation may reject both reads and cleanup.
        }
        return null;
      }
    },

    async persist({ entityKey, sessionKey, snapshot }) {
      let sessionStored = false;
      let workingCopyStored = false;
      const sessionStorage = services.getSessionStorage();

      if (sessionStorage) {
        try {
          sessionStorage.setItem(sessionKey, JSON.stringify(snapshot));
          sessionStored = true;
        } catch {
          sessionStored = false;
        }
      }

      try {
        await services.writeWorkingCopy({ entityKey, data: snapshot });
        workingCopyStored = true;
      } catch {
        workingCopyStored = false;
      }

      return { sessionStored, workingCopyStored };
    },
  };
}

export const calculatorDraftPersistence = createCalculatorDraftPersistence();
