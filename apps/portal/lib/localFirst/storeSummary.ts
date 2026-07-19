import type { LocalFirstPersistedState, LocalFirstStoreSummary } from './types';

function latestIso(left?: string, right?: string): string | undefined {
  if (!left) return right;
  if (!right) return left;
  return left > right ? left : right;
}

export function summarizeLocalFirstStoreState(state: LocalFirstPersistedState): LocalFirstStoreSummary {
  let queuedCount = 0;
  let syncingCount = 0;

  for (const item of state.queue) {
    if (item.status === 'syncing') syncingCount += 1;
    else if (item.status === 'queued') queuedCount += 1;
  }

  let conflictCount = 0;
  let errorCount = 0;
  let offlineCount = 0;
  let lastSyncedAt: string | undefined;
  let issueMessage: string | undefined;
  let issueUpdatedAt: string | undefined;

  for (const entityState of Object.values(state.entityStates)) {
    lastSyncedAt = latestIso(lastSyncedAt, entityState.lastSyncedAt);
    if (entityState.status === 'conflict') conflictCount += 1;
    if (entityState.status === 'error') errorCount += 1;
    if (entityState.status === 'offline') offlineCount += 1;

    if (
      entityState.lastError &&
      (entityState.status === 'conflict' || entityState.status === 'error' || entityState.status === 'offline') &&
      (!issueUpdatedAt || entityState.updatedAt > issueUpdatedAt)
    ) {
      issueUpdatedAt = entityState.updatedAt;
      issueMessage = entityState.lastError;
    }
  }

  return {
    queuedCount,
    syncingCount,
    conflictCount,
    errorCount,
    offlineCount,
    entityCount: Object.keys(state.entityStates).length,
    workingCopyCount: Object.keys(state.workingCopies).length,
    pendingCount: queuedCount + syncingCount,
    lastSyncedAt,
    issueMessage,
  };
}
