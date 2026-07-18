import { saveTracker } from '@/lib/sync/saveTracker';
import { startLocalFirstQueueRuntime, stopLocalFirstQueueRuntime } from './queue';
import {
  bindLocalFirstStoreOwner,
  clearLocalFirstStoreOwner,
  createEmptyLocalFirstState,
  ensureLocalFirstStoreReady,
  getLocalFirstStoreOwner,
  getLocalFirstStoreSnapshot,
  subscribeToLocalFirstStore,
  summarizeLocalFirstStoreState,
} from './store';

let runtimeStarted = false;
let runtimeOwnerId: string | null = null;
let unsubscribeStore: (() => void) | null = null;
let handleOnline: (() => void) | null = null;
let handleOffline: (() => void) | null = null;

function publishSummary() {
  const snapshot = getLocalFirstStoreSnapshot();
  saveTracker.setLocalFirstSummary(summarizeLocalFirstStoreState(snapshot.state));
}

function removeRuntimeListeners() {
  if (typeof window !== 'undefined') {
    if (handleOnline) window.removeEventListener('online', handleOnline);
    if (handleOffline) window.removeEventListener('offline', handleOffline);
  }
  handleOnline = null;
  handleOffline = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
}

export async function startLocalFirstRuntime(ownerId: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (runtimeStarted && runtimeOwnerId === ownerId) return;
  if (runtimeStarted) stopLocalFirstRuntime({ clearOwner: true });

  bindLocalFirstStoreOwner(ownerId);
  runtimeStarted = true;
  runtimeOwnerId = ownerId;

  saveTracker.setOnline(window.navigator.onLine !== false);
  handleOnline = () => saveTracker.setOnline(true);
  handleOffline = () => saveTracker.setOnline(false);
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  unsubscribeStore = subscribeToLocalFirstStore(publishSummary);
  await ensureLocalFirstStoreReady();
  if (!runtimeStarted || runtimeOwnerId !== ownerId || getLocalFirstStoreOwner() !== ownerId) return;
  publishSummary();
  await startLocalFirstQueueRuntime();
}

export function stopLocalFirstRuntime(options: { clearOwner?: boolean } = {}): void {
  runtimeStarted = false;
  runtimeOwnerId = null;
  stopLocalFirstQueueRuntime();
  removeRuntimeListeners();
  saveTracker.setLocalFirstSummary(summarizeLocalFirstStoreState(createEmptyLocalFirstState()));
  if (options.clearOwner) clearLocalFirstStoreOwner();
}
