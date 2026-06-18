export type LocalFirstEntityKey = string;

export type LocalFirstEntityStatus = 'idle' | 'queued' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict';

type LocalFirstQueueItemStatus = 'queued' | 'syncing' | 'paused_conflict';

export type LocalFirstWorkingCopy<TData = unknown> = {
  entityKey: LocalFirstEntityKey;
  data: TData;
  updatedAt: string;
  baseUpdatedAt?: string;
};

export type LocalFirstConflictState<TServer = unknown, TClient = unknown> = {
  id: string;
  entityKey: LocalFirstEntityKey;
  queueItemId: string;
  message: string;
  detectedAt: string;
  serverSnapshot?: TServer;
  clientSnapshot?: TClient;
};

export type LocalFirstQueueItem<TPayload = unknown> = {
  id: string;
  entityKey: LocalFirstEntityKey;
  mutationKey: string;
  payload: TPayload;
  status: LocalFirstQueueItemStatus;
  enqueuedAt: string;
  updatedAt: string;
  attempts: number;
  nextRetryAt?: string;
  lastError?: string;
};

export type LocalFirstEntitySyncState = {
  entityKey: LocalFirstEntityKey;
  status: LocalFirstEntityStatus;
  pendingCount: number;
  updatedAt: string;
  lastSyncedAt?: string;
  lastError?: string;
  nextRetryAt?: string;
  conflictId?: string;
};

export type LocalFirstPersistedState = {
  version: 1;
  workingCopies: Record<LocalFirstEntityKey, LocalFirstWorkingCopy>;
  queue: LocalFirstQueueItem[];
  entityStates: Record<LocalFirstEntityKey, LocalFirstEntitySyncState>;
  conflicts: Record<LocalFirstEntityKey, LocalFirstConflictState>;
  idAliases: Record<string, string>;
};

export type LocalFirstStoreSnapshot = {
  hydrated: boolean;
  state: LocalFirstPersistedState;
};

export type LocalFirstStoreSummary = {
  queuedCount: number;
  syncingCount: number;
  conflictCount: number;
  errorCount: number;
  offlineCount: number;
  entityCount: number;
  pendingCount: number;
  lastSyncedAt?: string;
  issueMessage?: string;
};

type LocalFirstMutationSuccessResult<TData = unknown> = {
  kind: 'success';
  lastSyncedAt?: string;
  confirmedWorkingCopy?: TData;
  clearWorkingCopy?: boolean;
};

type LocalFirstMutationRetryResult = {
  kind: 'retry';
  message?: string;
  retryAt?: string;
  status?: 'queued' | 'offline' | 'error';
};

type LocalFirstMutationConflictResult<TServer = unknown, TClient = unknown> = {
  kind: 'conflict';
  message: string;
  serverSnapshot?: TServer;
  clientSnapshot?: TClient;
};

export type LocalFirstMutationResult<TData = unknown, TServer = unknown, TClient = unknown> =
  | void
  | LocalFirstMutationSuccessResult<TData>
  | LocalFirstMutationRetryResult
  | LocalFirstMutationConflictResult<TServer, TClient>;

type LocalFirstMutationHandlerContext = {
  attempt: number;
  entityKey: LocalFirstEntityKey;
};

export type LocalFirstMutationHandler = (
  item: LocalFirstQueueItem,
  context: LocalFirstMutationHandlerContext,
) => Promise<LocalFirstMutationResult>;

export type LocalFirstEnqueueMutationInput<TPayload = unknown> = {
  id?: string;
  entityKey: LocalFirstEntityKey;
  mutationKey: string;
  payload: TPayload;
};

export type LocalFirstWriteWorkingCopyInput<TData = unknown> = {
  entityKey: LocalFirstEntityKey;
  data: TData;
  updatedAt?: string;
  baseUpdatedAt?: string;
};
