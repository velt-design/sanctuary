import { saveTracker } from '@/lib/sync/saveTracker';
import { startLocalFirstQueueRuntime } from './queue';
import { ensureLocalFirstStoreReady, getLocalFirstStoreSnapshot, subscribeToLocalFirstStore, summarizeLocalFirstStoreState } from './store';

let runtimeStarted = false;

function publishSummary() {
  const snapshot = getLocalFirstStoreSnapshot();
  saveTracker.setLocalFirstSummary(summarizeLocalFirstStoreState(snapshot.state));
}

export async function startLocalFirstRuntime(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (runtimeStarted) return;
  runtimeStarted = true;

  saveTracker.setOnline(window.navigator.onLine !== false);
  window.addEventListener('online', () => saveTracker.setOnline(true));
  window.addEventListener('offline', () => saveTracker.setOnline(false));

  subscribeToLocalFirstStore(publishSummary);
  await ensureLocalFirstStoreReady();
  publishSummary();
  await startLocalFirstQueueRuntime();
}

export function __resetLocalFirstRuntimeForTests(): void {
  runtimeStarted = false;
}
