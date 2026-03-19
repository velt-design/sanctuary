'use client';

import type { LocalFirstStoreSummary } from '@/lib/localFirst/types';

type SaveStatus = 'saved' | 'saving' | 'offline' | 'error' | 'conflict';

export type SaveState = {
  status: SaveStatus;
  pending: number;
  networkPending: number;
  queued: number;
  syncing: number;
  conflicts: number;
  errors: number;
  offline: number;
  lastSavedAt?: string;
  lastError?: string;
};

type Listener = () => void;

type LegacySaveState = {
  status: Exclude<SaveStatus, 'conflict'>;
  pending: number;
  lastSavedAt?: string;
  lastError?: string;
};

type InternalState = {
  legacy: LegacySaveState;
  online: boolean;
  localFirst: LocalFirstStoreSummary;
};

const EMPTY_LOCAL_FIRST_SUMMARY: LocalFirstStoreSummary = {
  queuedCount: 0,
  syncingCount: 0,
  conflictCount: 0,
  errorCount: 0,
  offlineCount: 0,
  entityCount: 0,
  pendingCount: 0,
};

const listeners = new Set<Listener>();

let state: InternalState = {
  legacy: { status: 'saved', pending: 0 },
  online: true,
  localFirst: EMPTY_LOCAL_FIRST_SUMMARY,
};

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

function maxIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function isSummaryEqual(a: LocalFirstStoreSummary, b: LocalFirstStoreSummary): boolean {
  return (
    a.queuedCount === b.queuedCount &&
    a.syncingCount === b.syncingCount &&
    a.conflictCount === b.conflictCount &&
    a.errorCount === b.errorCount &&
    a.offlineCount === b.offlineCount &&
    a.entityCount === b.entityCount &&
    a.pendingCount === b.pendingCount &&
    a.lastSyncedAt === b.lastSyncedAt &&
    a.issueMessage === b.issueMessage
  );
}

function toExternalState(current: InternalState): SaveState {
  const pending = current.legacy.pending + current.localFirst.pendingCount;
  const lastSavedAt = maxIso(current.legacy.lastSavedAt, current.localFirst.lastSyncedAt);

  let status: SaveStatus = 'saved';
  let lastError = current.legacy.lastError;

  if (current.localFirst.conflictCount > 0) {
    status = 'conflict';
    lastError = current.localFirst.issueMessage ?? 'A change needs review before it can sync.';
  } else if (current.localFirst.errorCount > 0 || current.legacy.status === 'error') {
    status = 'error';
    lastError = current.localFirst.issueMessage ?? current.legacy.lastError;
  } else if (
    current.localFirst.offlineCount > 0 ||
    current.legacy.status === 'offline' ||
    (!current.online && pending > 0)
  ) {
    status = 'offline';
    lastError = current.localFirst.issueMessage ?? current.legacy.lastError;
  } else if (pending > 0 || current.legacy.status === 'saving') {
    status = 'saving';
    lastError = undefined;
  }

  return {
    status,
    pending,
    networkPending: current.legacy.pending,
    queued: current.localFirst.queuedCount,
    syncing: current.localFirst.syncingCount,
    conflicts: current.localFirst.conflictCount,
    errors: current.localFirst.errorCount,
    offline: current.localFirst.offlineCount,
    lastSavedAt,
    lastError,
  };
}

export const saveTracker = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): SaveState {
    return toExternalState(state);
  },
  setOnline(online: boolean) {
    if (state.online === online) return;
    state = {
      ...state,
      online,
    };
    emit();
  },
  setLocalFirstSummary(summary: LocalFirstStoreSummary) {
    if (isSummaryEqual(state.localFirst, summary)) return;
    state = {
      ...state,
      localFirst: summary,
    };
    emit();
  },
  async track<T>(fn: () => Promise<T>): Promise<T> {
    state = {
      ...state,
      legacy: {
        status: 'saving',
        pending: state.legacy.pending + 1,
        lastSavedAt: state.legacy.lastSavedAt,
        lastError: undefined,
      },
    };
    emit();

    try {
      const res = await fn();
      const nextPending = Math.max(0, state.legacy.pending - 1);
      state = {
        ...state,
        legacy: {
          status: nextPending === 0 ? 'saved' : 'saving',
          pending: nextPending,
          lastSavedAt: new Date().toISOString(),
          lastError: undefined,
        },
      };
      emit();
      return res;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed';
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      const nextPending = Math.max(0, state.legacy.pending - 1);
      state = {
        ...state,
        legacy: {
          status: offline ? 'offline' : 'error',
          pending: nextPending,
          lastSavedAt: state.legacy.lastSavedAt,
          lastError: message,
        },
      };
      emit();
      throw error;
    }
  },
};

export function __resetSaveTrackerForTests(): void {
  listeners.clear();
  state = {
    legacy: { status: 'saved', pending: 0 },
    online: true,
    localFirst: EMPTY_LOCAL_FIRST_SUMMARY,
  };
}
