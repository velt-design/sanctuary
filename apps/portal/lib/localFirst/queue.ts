import type { LocalFirstEntityKey, LocalFirstMutationHandler, LocalFirstMutationResult, LocalFirstQueueItem } from './types';
import {
  enqueueLocalFirstMutation,
  ensureLocalFirstStoreReady,
  getNextLocalFirstQueueItemForEntity,
  getLocalFirstStoreOwner,
  listLocalFirstPendingEntityKeys,
  markLocalFirstPendingEntitiesOffline,
  markLocalFirstPendingEntitiesQueued,
  markLocalFirstQueueItemSyncing,
  requeueSyncingLocalFirstItems,
  resolveLocalFirstQueueItemConflict,
  resolveLocalFirstQueueItemRetry,
  resolveLocalFirstQueueItemSuccess,
} from './store';

const handlers = new Map<string, LocalFirstMutationHandler>();
const runningEntities = new Set<string>();
const retryTimers = new Map<LocalFirstEntityKey, number>();

let runtimeStarted = false;
let onlineListenerAttached = false;
let handleOnline: (() => void) | null = null;
let handleOffline: (() => void) | null = null;

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function computeBackoffMs(attempt: number): number {
  const safeAttempt = Math.max(1, attempt);
  return Math.min(30_000, 1_000 * 2 ** (safeAttempt - 1));
}

function scheduleEntityRetry(entityKey: LocalFirstEntityKey, retryAt?: string) {
  if (!runtimeStarted || typeof window === 'undefined') return;
  const existing = retryTimers.get(entityKey);
  if (typeof existing === 'number') {
    window.clearTimeout(existing);
  }
  const delay = retryAt ? Math.max(0, new Date(retryAt).getTime() - Date.now()) : 0;
  const handle = window.setTimeout(() => {
    retryTimers.delete(entityKey);
    void processLocalFirstEntityQueue(entityKey);
  }, delay);
  retryTimers.set(entityKey, handle);
}

function clearRetryTimers() {
  if (typeof window === 'undefined') return;
  for (const handle of retryTimers.values()) {
    window.clearTimeout(handle);
  }
  retryTimers.clear();
}

function detachOnlineListeners() {
  if (typeof window !== 'undefined') {
    if (handleOnline) window.removeEventListener('online', handleOnline);
    if (handleOffline) window.removeEventListener('offline', handleOffline);
  }
  handleOnline = null;
  handleOffline = null;
  onlineListenerAttached = false;
}

async function processHandlerResult(item: LocalFirstQueueItem, result: LocalFirstMutationResult): Promise<'continue' | 'stop'> {
  if (!result || result.kind === 'success') {
    await resolveLocalFirstQueueItemSuccess(item.id, {
      lastSyncedAt: result?.lastSyncedAt,
      confirmedWorkingCopy: result?.confirmedWorkingCopy,
      clearWorkingCopy: result?.clearWorkingCopy,
    });
    return 'continue';
  }

  if (result.kind === 'conflict') {
    await resolveLocalFirstQueueItemConflict(item.id, {
      message: result.message,
      serverSnapshot: result.serverSnapshot,
      clientSnapshot: result.clientSnapshot,
    });
    return 'stop';
  }

  const retryAt = result.retryAt ?? new Date(Date.now() + computeBackoffMs(item.attempts + 1)).toISOString();
  await resolveLocalFirstQueueItemRetry(item.id, {
    status: result.status ?? (isOnline() ? 'error' : 'offline'),
    message: result.message,
    retryAt,
  });
  scheduleEntityRetry(item.entityKey, retryAt);
  return 'stop';
}

function handlerFor(item: LocalFirstQueueItem): LocalFirstMutationHandler | null {
  return handlers.get(item.mutationKey) ?? null;
}

async function processSingleItem(item: LocalFirstQueueItem): Promise<'continue' | 'stop'> {
  const handler = handlerFor(item);
  if (!handler) return 'stop';

  const syncingItem = await markLocalFirstQueueItemSyncing(item.id);
  if (!syncingItem) return 'continue';

  try {
    const result = await handler(syncingItem, {
      attempt: syncingItem.attempts,
      entityKey: syncingItem.entityKey,
    });
    if (!runtimeStarted) return 'stop';
    return processHandlerResult(syncingItem, result);
  } catch (error) {
    if (!runtimeStarted) return 'stop';
    const message = error instanceof Error ? error.message : 'Sync failed.';
    const retryAt = new Date(Date.now() + computeBackoffMs(syncingItem.attempts)).toISOString();
    const status = isOnline() ? 'error' : 'offline';
    await resolveLocalFirstQueueItemRetry(syncingItem.id, {
      status,
      message,
      retryAt,
    });
    if (status === 'offline') {
      await markLocalFirstPendingEntitiesOffline();
    }
    scheduleEntityRetry(syncingItem.entityKey, retryAt);
    return 'stop';
  }
}

async function processLocalFirstEntityQueue(entityKey: LocalFirstEntityKey): Promise<void> {
  const runKey = `${getLocalFirstStoreOwner() ?? '__test__'}::${entityKey}`;
  if (!runtimeStarted || runningEntities.has(runKey)) return;
  runningEntities.add(runKey);

  try {
    while (true) {
      if (!runtimeStarted) break;
      if (!isOnline()) {
        await markLocalFirstPendingEntitiesOffline();
        break;
      }

      const item = getNextLocalFirstQueueItemForEntity(entityKey);
      if (!item) break;

      const outcome = await processSingleItem(item);
      if (outcome === 'stop') break;
    }
  } finally {
    runningEntities.delete(runKey);
  }
}

async function processAllLocalFirstQueues(): Promise<void> {
  await ensureLocalFirstStoreReady();
  if (!isOnline()) {
    await markLocalFirstPendingEntitiesOffline();
    return;
  }
  const entityKeys = listLocalFirstPendingEntityKeys();
  await Promise.all(entityKeys.map((entityKey) => processLocalFirstEntityQueue(entityKey)));
}

function attachOnlineListeners() {
  if (onlineListenerAttached || typeof window === 'undefined') return;
  onlineListenerAttached = true;

  handleOnline = () => {
    void markLocalFirstPendingEntitiesQueued().then(() => processAllLocalFirstQueues());
  };

  handleOffline = () => {
    void markLocalFirstPendingEntitiesOffline();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
}

export async function startLocalFirstQueueRuntime(): Promise<void> {
  if (runtimeStarted) return;
  runtimeStarted = true;
  attachOnlineListeners();
  await ensureLocalFirstStoreReady();
  await requeueSyncingLocalFirstItems(isOnline() ? 'queued' : 'offline');
  if (isOnline()) {
    await markLocalFirstPendingEntitiesQueued();
    await processAllLocalFirstQueues();
  } else {
    await markLocalFirstPendingEntitiesOffline();
  }
}

export function stopLocalFirstQueueRuntime(): void {
  runtimeStarted = false;
  clearRetryTimers();
  detachOnlineListeners();
}

export function registerLocalFirstMutationHandler(mutationKey: string, handler: LocalFirstMutationHandler): () => void {
  handlers.set(mutationKey, handler);
  if (runtimeStarted) {
    void processAllLocalFirstQueues();
  }
  return () => {
    if (handlers.get(mutationKey) === handler) {
      handlers.delete(mutationKey);
    }
  };
}

export async function enqueueAndProcessLocalFirstMutation<TPayload>(input: {
  id?: string;
  entityKey: LocalFirstEntityKey;
  mutationKey: string;
  payload: TPayload;
}): Promise<LocalFirstQueueItem<TPayload>> {
  const item = await enqueueLocalFirstMutation(input);
  if (runtimeStarted) {
    void processLocalFirstEntityQueue(item.entityKey);
  }
  return item;
}

export function __resetLocalFirstQueueForTests(): void {
  stopLocalFirstQueueRuntime();
  handlers.clear();
  runningEntities.clear();
}
