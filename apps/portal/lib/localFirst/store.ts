import { get, set } from 'idb-keyval';
import type {
  LocalFirstConflictState,
  LocalFirstEnqueueMutationInput,
  LocalFirstEntityKey,
  LocalFirstEntityStatus,
  LocalFirstEntitySyncState,
  LocalFirstPersistedState,
  LocalFirstQueueItem,
  LocalFirstStoreSnapshot,
  LocalFirstStoreSummary,
  LocalFirstWriteWorkingCopyInput,
  LocalFirstWorkingCopy,
} from './types';

const LOCAL_FIRST_STORAGE_KEY_PREFIX = 'sanctuary-portal-local-first:v2:';

type Listener = () => void;

type LocalFirstStorageAdapter = {
  get: (ownerId: string) => Promise<LocalFirstPersistedState | undefined>;
  set: (state: LocalFirstPersistedState, ownerId: string) => Promise<void>;
};

export function localFirstStorageKey(ownerId: string): string {
  const normalized = ownerId.trim();
  if (!normalized) throw new Error('A portal user id is required for local-first storage.');
  return `${LOCAL_FIRST_STORAGE_KEY_PREFIX}${normalized}`;
}

const defaultStorageAdapter: LocalFirstStorageAdapter = {
  async get(ownerId) {
    const value = await get<unknown>(localFirstStorageKey(ownerId));
    return normalizePersistedState(value);
  },
  async set(state, ownerId) {
    await set(localFirstStorageKey(ownerId), state);
  },
};

let storageAdapter: LocalFirstStorageAdapter = defaultStorageAdapter;
let activeOwnerId: string | null = null;
let ownerGeneration = 0;
let snapshot: LocalFirstStoreSnapshot = { hydrated: false, state: createEmptyLocalFirstState() };
let hydratePromise: Promise<void> | null = null;
let mutationChain: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();

function storageOwnerId(): string {
  if (activeOwnerId) return activeOwnerId;
  if (storageAdapter !== defaultStorageAdapter) return '__local_first_test_owner__';
  throw new Error('Local-first storage cannot hydrate before an authenticated portal user is bound.');
}

function ownerToken(): string {
  const ownerId = activeOwnerId ?? (storageAdapter !== defaultStorageAdapter ? '__local_first_test_owner__' : '__unbound__');
  return `${ownerId}::${ownerGeneration}`;
}

function resetInMemoryState() {
  snapshot = { hydrated: false, state: createEmptyLocalFirstState() };
  hydratePromise = null;
  mutationChain = Promise.resolve();
  emit();
}

export function bindLocalFirstStoreOwner(ownerId: string): void {
  const normalized = ownerId.trim();
  if (!normalized) throw new Error('A portal user id is required before starting local-first sync.');
  if (activeOwnerId === normalized) return;
  activeOwnerId = normalized;
  ownerGeneration += 1;
  resetInMemoryState();
}

export function clearLocalFirstStoreOwner(): void {
  activeOwnerId = null;
  ownerGeneration += 1;
  resetInMemoryState();
}

export function getLocalFirstStoreOwner(): string | null {
  return activeOwnerId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneState(state: LocalFirstPersistedState): LocalFirstPersistedState {
  if (typeof structuredClone === 'function') {
    return structuredClone(state);
  }
  return JSON.parse(JSON.stringify(state)) as LocalFirstPersistedState;
}

function resolveLocalFirstIdInState(state: LocalFirstPersistedState, id: string): string {
  let current = id;
  const seen = new Set<string>();

  while (current && !seen.has(current)) {
    seen.add(current);
    const next = state.idAliases[current];
    if (!next || next === current) break;
    current = next;
  }

  return current;
}

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

async function persistSnapshot(state: LocalFirstPersistedState): Promise<void> {
  const ownerId = storageOwnerId();
  await storageAdapter.set(state, ownerId).catch((error) => {
    console.error('[localFirst] Failed to persist local-first state.', error);
  });
}

function isoNow(): string {
  return new Date().toISOString();
}

function maxIso(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

function ensureEntityStateShape(entityKey: LocalFirstEntityKey, current?: LocalFirstEntitySyncState): LocalFirstEntitySyncState {
  if (current) return current;
  return {
    entityKey,
    status: 'idle',
    pendingCount: 0,
    updatedAt: isoNow(),
  };
}

function pendingCountForEntity(state: LocalFirstPersistedState, entityKey: LocalFirstEntityKey): number {
  return state.queue.filter((item) => item.entityKey === entityKey).length;
}

function nextEntityStatusForPendingItems(
  state: LocalFirstPersistedState,
  entityKey: LocalFirstEntityKey,
  fallback: LocalFirstEntityStatus,
): LocalFirstEntityStatus {
  if (state.conflicts[entityKey]) return 'conflict';
  const items = state.queue.filter((item) => item.entityKey === entityKey);
  if (items.some((item) => item.status === 'syncing')) return 'syncing';
  if (items.length > 0) return fallback;
  return 'synced';
}

function updateEntityState(
  state: LocalFirstPersistedState,
  entityKey: LocalFirstEntityKey,
  next: Partial<LocalFirstEntitySyncState> & Pick<LocalFirstEntitySyncState, 'status'>,
) {
  const current = ensureEntityStateShape(entityKey, state.entityStates[entityKey]);
  state.entityStates[entityKey] = {
    ...current,
    ...next,
    entityKey,
    pendingCount: pendingCountForEntity(state, entityKey),
    updatedAt: next.updatedAt ?? isoNow(),
  };
}

function latestStateMessage(states: LocalFirstEntitySyncState[]): { lastError?: string; conflictId?: string; nextRetryAt?: string } {
  const ordered = states
    .filter((state) => state.lastError || state.conflictId || state.nextRetryAt)
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const latest = ordered[0];
  if (!latest) return {};
  return {
    lastError: latest.lastError,
    conflictId: latest.conflictId,
    nextRetryAt: latest.nextRetryAt,
  };
}

function mergeEntityStates(
  entityKey: LocalFirstEntityKey,
  states: LocalFirstEntitySyncState[],
): LocalFirstEntitySyncState {
  if (!states.length) return ensureEntityStateShape(entityKey);

  const pendingCount = states.reduce((sum, state) => sum + Math.max(0, state.pendingCount), 0);
  const updatedAt = states.reduce((latest, state) => maxIso(latest, state.updatedAt) ?? state.updatedAt, states[0]?.updatedAt);
  const lastSyncedAt = states.reduce((latest, state) => maxIso(latest, state.lastSyncedAt), undefined as string | undefined);
  const { lastError, conflictId, nextRetryAt } = latestStateMessage(states);

  let status: LocalFirstEntityStatus = 'idle';
  if (states.some((state) => state.status === 'conflict')) status = 'conflict';
  else if (states.some((state) => state.status === 'syncing')) status = 'syncing';
  else if (states.some((state) => state.status === 'offline')) status = 'offline';
  else if (states.some((state) => state.status === 'error')) status = 'error';
  else if (pendingCount > 0 || states.some((state) => state.status === 'queued')) status = 'queued';
  else if (states.some((state) => state.status === 'synced')) status = 'synced';

  return {
    entityKey,
    status,
    pendingCount,
    updatedAt: updatedAt ?? isoNow(),
    lastSyncedAt,
    lastError,
    nextRetryAt,
    conflictId,
  };
}

function collectAliasedIdsForEntity(state: LocalFirstPersistedState, entityId: string): string[] {
  const canonicalId = resolveLocalFirstIdInState(state, entityId);
  const ids = new Set<string>([entityId, canonicalId]);

  for (const aliasId of Object.keys(state.idAliases)) {
    if (resolveLocalFirstIdInState(state, aliasId) === canonicalId) {
      ids.add(aliasId);
    }
  }

  return Array.from(ids);
}

function createQueueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `lf_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function normalizeWorkingCopy(entry: unknown, entityKey: string): LocalFirstWorkingCopy | undefined {
  if (!isRecord(entry)) return undefined;
  const data = 'data' in entry ? entry.data : undefined;
  const updatedAt = typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined;
  if (!updatedAt) return undefined;
  return {
    entityKey,
    data,
    updatedAt,
    baseUpdatedAt: typeof entry.baseUpdatedAt === 'string' ? entry.baseUpdatedAt : undefined,
  };
}

function normalizeQueueItem(entry: unknown): LocalFirstQueueItem | undefined {
  if (!isRecord(entry)) return undefined;
  if (
    typeof entry.id !== 'string' ||
    typeof entry.entityKey !== 'string' ||
    typeof entry.mutationKey !== 'string' ||
    typeof entry.enqueuedAt !== 'string' ||
    typeof entry.updatedAt !== 'string'
  ) {
    return undefined;
  }
  const status = entry.status;
  if (status !== 'queued' && status !== 'syncing' && status !== 'paused_conflict') {
    return undefined;
  }
  return {
    id: entry.id,
    entityKey: entry.entityKey,
    mutationKey: entry.mutationKey,
    payload: entry.payload,
    status,
    enqueuedAt: entry.enqueuedAt,
    updatedAt: entry.updatedAt,
    attempts: typeof entry.attempts === 'number' ? entry.attempts : 0,
    nextRetryAt: typeof entry.nextRetryAt === 'string' ? entry.nextRetryAt : undefined,
    lastError: typeof entry.lastError === 'string' ? entry.lastError : undefined,
  };
}

function isQueueItem(entry: LocalFirstQueueItem | undefined): entry is LocalFirstQueueItem {
  return Boolean(entry);
}

function normalizeEntityState(entry: unknown, entityKey: string): LocalFirstEntitySyncState | undefined {
  if (!isRecord(entry)) return undefined;
  const status = entry.status;
  if (
    status !== 'idle' &&
    status !== 'queued' &&
    status !== 'syncing' &&
    status !== 'synced' &&
    status !== 'offline' &&
    status !== 'error' &&
    status !== 'conflict'
  ) {
    return undefined;
  }
  return {
    entityKey,
    status,
    pendingCount: typeof entry.pendingCount === 'number' ? entry.pendingCount : 0,
    updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : isoNow(),
    lastSyncedAt: typeof entry.lastSyncedAt === 'string' ? entry.lastSyncedAt : undefined,
    lastError: typeof entry.lastError === 'string' ? entry.lastError : undefined,
    nextRetryAt: typeof entry.nextRetryAt === 'string' ? entry.nextRetryAt : undefined,
    conflictId: typeof entry.conflictId === 'string' ? entry.conflictId : undefined,
  };
}

function normalizeConflict(entry: unknown, entityKey: string): LocalFirstConflictState | undefined {
  if (!isRecord(entry)) return undefined;
  if (typeof entry.id !== 'string' || typeof entry.queueItemId !== 'string' || typeof entry.message !== 'string') {
    return undefined;
  }
  return {
    id: entry.id,
    entityKey,
    queueItemId: entry.queueItemId,
    message: entry.message,
    detectedAt: typeof entry.detectedAt === 'string' ? entry.detectedAt : isoNow(),
    serverSnapshot: entry.serverSnapshot,
    clientSnapshot: entry.clientSnapshot,
  };
}

function normalizePersistedState(value: unknown): LocalFirstPersistedState {
  if (!isRecord(value)) return createEmptyLocalFirstState();

  const workingCopies: LocalFirstPersistedState['workingCopies'] = {};
  if (isRecord(value.workingCopies)) {
    for (const [entityKey, entry] of Object.entries(value.workingCopies)) {
      const normalized = normalizeWorkingCopy(entry, entityKey);
      if (normalized) workingCopies[entityKey] = normalized;
    }
  }

  const queue = Array.isArray(value.queue) ? value.queue.map(normalizeQueueItem).filter(isQueueItem) : [];

  const entityStates: LocalFirstPersistedState['entityStates'] = {};
  if (isRecord(value.entityStates)) {
    for (const [entityKey, entry] of Object.entries(value.entityStates)) {
      const normalized = normalizeEntityState(entry, entityKey);
      if (normalized) entityStates[entityKey] = normalized;
    }
  }

  const conflicts: LocalFirstPersistedState['conflicts'] = {};
  if (isRecord(value.conflicts)) {
    for (const [entityKey, entry] of Object.entries(value.conflicts)) {
      const normalized = normalizeConflict(entry, entityKey);
      if (normalized) conflicts[entityKey] = normalized;
    }
  }

  const idAliases: LocalFirstPersistedState['idAliases'] = {};
  if (isRecord(value.idAliases)) {
    for (const [fromId, toId] of Object.entries(value.idAliases)) {
      if (typeof toId === 'string' && toId.trim()) {
        idAliases[fromId] = toId;
      }
    }
  }

  return {
    version: 1,
    workingCopies,
    queue,
    entityStates,
    conflicts,
    idAliases,
  };
}

export function createEmptyLocalFirstState(): LocalFirstPersistedState {
  return {
    version: 1,
    workingCopies: {},
    queue: [],
    entityStates: {},
    conflicts: {},
    idAliases: {},
  };
}

export function getLocalFirstStoreSnapshot(): LocalFirstStoreSnapshot {
  return snapshot;
}

export function subscribeToLocalFirstStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function ensureLocalFirstStoreReady(): Promise<void> {
  if (snapshot.hydrated) return;
  if (!hydratePromise) {
    const scope = ownerToken();
    const ownerId = storageOwnerId();
    hydratePromise = (async () => {
      const hydratedState = (await storageAdapter.get(ownerId)) ?? createEmptyLocalFirstState();
      if (scope !== ownerToken()) return;
      snapshot = { hydrated: true, state: hydratedState };
      emit();
    })().finally(() => {
      hydratePromise = null;
    });
  }
  await hydratePromise;
}

async function mutateLocalFirstState<T>(recipe: (draft: LocalFirstPersistedState) => T | Promise<T>): Promise<T> {
  const scope = ownerToken();
  const operation = mutationChain.then(async () => {
    await ensureLocalFirstStoreReady();
    if (scope !== ownerToken()) throw new Error('Local-first owner changed before the mutation started.');
    const draft = cloneState(snapshot.state);
    const result = await recipe(draft);
    if (scope !== ownerToken()) throw new Error('Local-first owner changed while a mutation was running.');
    snapshot = { hydrated: true, state: draft };
    emit();
    await persistSnapshot(draft);
    return result;
  });

  mutationChain = operation.then(
    () => undefined,
    () => undefined,
  );

  return operation;
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
    lastSyncedAt = maxIso(lastSyncedAt, entityState.lastSyncedAt);
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

export async function writeLocalFirstWorkingCopy<TData>(
  input: LocalFirstWriteWorkingCopyInput<TData>,
): Promise<LocalFirstWorkingCopy<TData>> {
  const updatedAt = input.updatedAt ?? isoNow();
  return mutateLocalFirstState((draft) => {
    const workingCopy: LocalFirstWorkingCopy<TData> = {
      entityKey: input.entityKey,
      data: input.data,
      updatedAt,
      baseUpdatedAt: input.baseUpdatedAt,
    };
    draft.workingCopies[input.entityKey] = workingCopy;
    return workingCopy;
  });
}

export async function clearLocalFirstWorkingCopy(entityKey: LocalFirstEntityKey): Promise<void> {
  await mutateLocalFirstState((draft) => {
    delete draft.workingCopies[entityKey];
  });
}

export async function enqueueLocalFirstMutation<TPayload>(
  input: LocalFirstEnqueueMutationInput<TPayload>,
): Promise<LocalFirstQueueItem<TPayload>> {
  const enqueuedAt = isoNow();
  return mutateLocalFirstState((draft) => {
    const item: LocalFirstQueueItem<TPayload> = {
      id: input.id ?? createQueueId(),
      entityKey: input.entityKey,
      mutationKey: input.mutationKey,
      payload: input.payload,
      status: 'queued',
      enqueuedAt,
      updatedAt: enqueuedAt,
      attempts: 0,
    };
    draft.queue.push(item);
    updateEntityState(draft, input.entityKey, {
      status: 'queued',
      lastError: undefined,
      nextRetryAt: undefined,
      conflictId: undefined,
    });
    return item;
  });
}

export function getNextLocalFirstQueueItemForEntity(
  entityKey: LocalFirstEntityKey,
  now: string = isoNow(),
): LocalFirstQueueItem | null {
  const items = snapshot.state.queue.filter((item) => item.entityKey === entityKey && item.status === 'queued');
  const ready = items.find((item) => !item.nextRetryAt || item.nextRetryAt <= now);
  return ready ?? null;
}

export function listLocalFirstPendingEntityKeys(): LocalFirstEntityKey[] {
  return Array.from(new Set(snapshot.state.queue.map((item) => item.entityKey)));
}

export async function requeueSyncingLocalFirstItems(status: 'queued' | 'offline'): Promise<void> {
  await mutateLocalFirstState((draft) => {
    const now = isoNow();
    for (const item of draft.queue) {
      if (item.status === 'syncing') {
        item.status = 'queued';
        item.updatedAt = now;
      }
    }

    for (const entityKey of listEntityKeysWithPendingWork(draft)) {
      updateEntityState(draft, entityKey, {
        status,
        lastError: status === 'offline' ? 'Changes are waiting to sync when the connection returns.' : undefined,
      });
    }
  });
}

function listEntityKeysWithPendingWork(state: LocalFirstPersistedState): LocalFirstEntityKey[] {
  return Array.from(new Set(state.queue.map((item) => item.entityKey)));
}

export async function markLocalFirstPendingEntitiesOffline(): Promise<void> {
  await mutateLocalFirstState((draft) => {
    for (const entityKey of listEntityKeysWithPendingWork(draft)) {
      updateEntityState(draft, entityKey, {
        status: 'offline',
        lastError: 'Changes are waiting to sync when the connection returns.',
      });
    }
  });
}

export async function markLocalFirstPendingEntitiesQueued(): Promise<void> {
  await mutateLocalFirstState((draft) => {
    for (const entityKey of listEntityKeysWithPendingWork(draft)) {
      if (draft.conflicts[entityKey]) {
        updateEntityState(draft, entityKey, {
          status: 'conflict',
          conflictId: draft.conflicts[entityKey]?.id,
          lastError: draft.conflicts[entityKey]?.message,
        });
        continue;
      }

      const current = draft.entityStates[entityKey];
      updateEntityState(draft, entityKey, {
        status: nextEntityStatusForPendingItems(draft, entityKey, 'queued'),
        lastError: current?.status === 'error' ? current.lastError : undefined,
        nextRetryAt: current?.nextRetryAt,
      });
    }
  });
}

export async function markLocalFirstQueueItemSyncing(itemId: string): Promise<LocalFirstQueueItem | null> {
  return mutateLocalFirstState((draft) => {
    const item = draft.queue.find((entry) => entry.id === itemId);
    if (!item) return null;

    item.status = 'syncing';
    item.attempts += 1;
    item.updatedAt = isoNow();
    item.lastError = undefined;

    updateEntityState(draft, item.entityKey, {
      status: 'syncing',
      lastError: undefined,
      nextRetryAt: undefined,
      conflictId: undefined,
    });

    return item;
  });
}

export async function resolveLocalFirstQueueItemSuccess(
  itemId: string,
  options: {
    lastSyncedAt?: string;
    confirmedWorkingCopy?: unknown;
    clearWorkingCopy?: boolean;
  } = {},
): Promise<void> {
  await mutateLocalFirstState((draft) => {
    const index = draft.queue.findIndex((entry) => entry.id === itemId);
    if (index < 0) return;
    const item = draft.queue[index];
    draft.queue.splice(index, 1);

    delete draft.conflicts[item.entityKey];

    if (options.clearWorkingCopy) {
      delete draft.workingCopies[item.entityKey];
    } else if (options.confirmedWorkingCopy !== undefined) {
      draft.workingCopies[item.entityKey] = {
        entityKey: item.entityKey,
        data: options.confirmedWorkingCopy,
        updatedAt: isoNow(),
      };
    }

    const pendingCount = pendingCountForEntity(draft, item.entityKey);
    updateEntityState(draft, item.entityKey, {
      status: pendingCount > 0 ? nextEntityStatusForPendingItems(draft, item.entityKey, 'queued') : 'synced',
      lastSyncedAt: options.lastSyncedAt ?? isoNow(),
      lastError: undefined,
      nextRetryAt: undefined,
      conflictId: undefined,
    });
  });
}

export async function resolveLocalFirstQueueItemRetry(
  itemId: string,
  options: {
    message?: string;
    retryAt?: string;
    status: 'queued' | 'offline' | 'error';
  },
): Promise<void> {
  await mutateLocalFirstState((draft) => {
    const item = draft.queue.find((entry) => entry.id === itemId);
    if (!item) return;

    item.status = 'queued';
    item.updatedAt = isoNow();
    item.lastError = options.message;
    item.nextRetryAt = options.retryAt;

    updateEntityState(draft, item.entityKey, {
      status: options.status,
      lastError: options.message,
      nextRetryAt: options.retryAt,
    });
  });
}

export async function resolveLocalFirstQueueItemConflict(
  itemId: string,
  options: {
    message: string;
    serverSnapshot?: unknown;
    clientSnapshot?: unknown;
  },
): Promise<void> {
  await mutateLocalFirstState((draft) => {
    const item = draft.queue.find((entry) => entry.id === itemId);
    if (!item) return;

    item.status = 'paused_conflict';
    item.updatedAt = isoNow();
    item.lastError = options.message;

    const conflictId = `conflict:${item.id}`;
    draft.conflicts[item.entityKey] = {
      id: conflictId,
      entityKey: item.entityKey,
      queueItemId: item.id,
      message: options.message,
      detectedAt: isoNow(),
      serverSnapshot: options.serverSnapshot,
      clientSnapshot: options.clientSnapshot,
    };

    updateEntityState(draft, item.entityKey, {
      status: 'conflict',
      conflictId,
      lastError: options.message,
      nextRetryAt: undefined,
    });
  });
}

export async function discardLocalFirstEntityQueue(entityKey: LocalFirstEntityKey): Promise<void> {
  await mutateLocalFirstState((draft) => {
    draft.queue = draft.queue.filter((item) => item.entityKey !== entityKey);
    delete draft.conflicts[entityKey];
    updateEntityState(draft, entityKey, {
      status: 'synced',
      conflictId: undefined,
      lastError: undefined,
      nextRetryAt: undefined,
    });
  });
}

export async function discardAllLocalFirstState(): Promise<void> {
  await mutateLocalFirstState((draft) => {
    const empty = createEmptyLocalFirstState();
    draft.version = empty.version;
    draft.workingCopies = empty.workingCopies;
    draft.queue = empty.queue;
    draft.entityStates = empty.entityStates;
    draft.conflicts = empty.conflicts;
    draft.idAliases = empty.idAliases;
  });
}

export function getLocalFirstEntitySyncState(entityKey: LocalFirstEntityKey): LocalFirstEntitySyncState {
  return ensureEntityStateShape(entityKey, snapshot.state.entityStates[entityKey]);
}

export function getAliasedLocalFirstEntitySyncState(
  entityId: string,
  buildEntityKey: (id: string) => LocalFirstEntityKey,
  fallbackEntityKey?: LocalFirstEntityKey,
): LocalFirstEntitySyncState {
  const primaryEntityKey = fallbackEntityKey ?? buildEntityKey(entityId);
  if (!entityId) return ensureEntityStateShape(primaryEntityKey);

  const uniqueKeys = listAliasedLocalFirstEntityKeys(entityId, buildEntityKey, primaryEntityKey);
  const states = uniqueKeys
    .map((entityKey) => snapshot.state.entityStates[entityKey])
    .filter((state): state is LocalFirstEntitySyncState => Boolean(state));

  return mergeEntityStates(primaryEntityKey, states);
}

export function listAliasedLocalFirstEntityKeys(
  entityId: string,
  buildEntityKey: (id: string) => LocalFirstEntityKey,
  fallbackEntityKey?: LocalFirstEntityKey,
): LocalFirstEntityKey[] {
  const primaryEntityKey = fallbackEntityKey ?? buildEntityKey(entityId);
  if (!entityId) return [primaryEntityKey];
  const aliasedEntityKeys = collectAliasedIdsForEntity(snapshot.state, entityId).map((id) => buildEntityKey(id));
  return Array.from(new Set([primaryEntityKey, ...aliasedEntityKeys]));
}

export function getLocalFirstConflictState(entityKey: LocalFirstEntityKey): LocalFirstConflictState | null {
  return snapshot.state.conflicts[entityKey] ?? null;
}

export function getLocalFirstWorkingCopy<TData>(entityKey: LocalFirstEntityKey): LocalFirstWorkingCopy<TData> | null {
  return (snapshot.state.workingCopies[entityKey] as LocalFirstWorkingCopy<TData> | undefined) ?? null;
}

export function resolveLocalFirstId(id: string): string {
  return resolveLocalFirstIdInState(snapshot.state, id);
}

export async function registerLocalFirstIdAlias(fromId: string, toId: string): Promise<void> {
  if (!fromId || !toId || fromId === toId) return;

  await mutateLocalFirstState((draft) => {
    draft.idAliases[fromId] = toId;

    for (const [aliasFrom, aliasTo] of Object.entries(draft.idAliases)) {
      if (aliasTo === fromId) {
        draft.idAliases[aliasFrom] = toId;
      }
    }
  });
}

export function __setLocalFirstStorageAdapterForTests(adapter: LocalFirstStorageAdapter | null): void {
  storageAdapter = adapter ?? defaultStorageAdapter;
}

export function __resetLocalFirstStoreForTests(): void {
  activeOwnerId = null;
  ownerGeneration += 1;
  snapshot = { hydrated: false, state: createEmptyLocalFirstState() };
  hydratePromise = null;
  mutationChain = Promise.resolve();
  listeners.clear();
}
