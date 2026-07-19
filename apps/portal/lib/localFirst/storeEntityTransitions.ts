import type { LocalFirstEntityKey, LocalFirstPersistedState } from './types';

type SuccessfulWorkingCopyOptions = {
  confirmedWorkingCopy?: unknown;
  clearWorkingCopy?: boolean;
  clearWorkingCopyIfMatches?: unknown;
};

function sameSerializableValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

export function applySuccessfulWorkingCopyTransition(
  state: LocalFirstPersistedState,
  entityKey: LocalFirstEntityKey,
  pendingCount: number,
  options: SuccessfulWorkingCopyOptions,
  updatedAt: string,
) {
  if (options.clearWorkingCopy) {
    delete state.workingCopies[entityKey];
    return;
  }

  if (
    options.clearWorkingCopyIfMatches !== undefined &&
    pendingCount === 0 &&
    sameSerializableValue(state.workingCopies[entityKey]?.data, options.clearWorkingCopyIfMatches)
  ) {
    delete state.workingCopies[entityKey];
    return;
  }

  if (options.confirmedWorkingCopy !== undefined) {
    state.workingCopies[entityKey] = {
      entityKey,
      data: options.confirmedWorkingCopy,
      updatedAt,
    };
  }
}

export function prepareEntityQueueForRetry(
  state: LocalFirstPersistedState,
  entityKey: LocalFirstEntityKey,
  updatedAt: string,
): boolean {
  const items = state.queue.filter((item) => item.entityKey === entityKey);
  if (!items.length || items.some((item) => item.status === 'syncing')) return false;

  for (const item of items) {
    item.status = 'queued';
    item.updatedAt = updatedAt;
    item.attempts = 0;
    delete item.lastError;
    delete item.nextRetryAt;
  }
  delete state.conflicts[entityKey];
  return true;
}
