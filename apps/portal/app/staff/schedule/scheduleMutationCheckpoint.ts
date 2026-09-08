// A save receipt is irreversible from the browser's point of view. A later
// cache, callback or refresh failure must never roll the accepted edit back.
export type SchedulePreviewKind = false | 'committed' | 'pending';
export function schedulePreviewRecoveryMessage(kind: SchedulePreviewKind): string {
  if (kind === 'pending') return 'The save could not be verified. Your unconfirmed preview remains visible and the request is retained for review. Refresh to check the saved schedule.';
  if (kind === 'committed') return 'The change was saved, but the latest schedule could not be loaded. The saved preview remains visible; refresh to verify the full crew schedule.';
  return 'The latest saved schedule could not be loaded. The last trusted copy remains visible; refresh to try again.';
}

export function createScheduleMutationCheckpoint() {
  let rollbackOptimistic: (() => void) | undefined;
  let rolledBack = false;
  let accepted = false;
  return {
    prepare(rollback: (() => void) | void) {
      if (typeof rollback === 'function') rollbackOptimistic = rollback;
    },
    accept() { accepted = true; },
    get accepted() { return accepted; },
    rollback() {
      if (rolledBack || accepted) return;
      rolledBack = true;
      rollbackOptimistic?.();
    },
  };
}
