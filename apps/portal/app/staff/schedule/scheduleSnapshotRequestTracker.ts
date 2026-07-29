type ScheduleSnapshotRequestTracker = {
  track<T extends object>(load: () => T | Promise<T>): Promise<T>;
  rejectStartedThroughCurrent(): void;
  shouldReject(snapshot: object): boolean;
  markApplied(snapshot: object): void;
};

export function createScheduleSnapshotRequestTracker(): ScheduleSnapshotRequestTracker {
  let latestStartedEpoch = 0;
  let rejectThroughEpoch = 0;
  let latestAppliedEpoch = 0;
  const requestEpochBySnapshot = new WeakMap<object, number>();

  return {
    async track<T extends object>(load: () => T | Promise<T>): Promise<T> {
      const requestEpoch = latestStartedEpoch + 1;
      latestStartedEpoch = requestEpoch;
      const snapshot = await load();
      requestEpochBySnapshot.set(snapshot, requestEpoch);
      return snapshot;
    },

    rejectStartedThroughCurrent(): void {
      rejectThroughEpoch = Math.max(rejectThroughEpoch, latestStartedEpoch);
    },

    shouldReject(snapshot: object): boolean {
      const requestEpoch = requestEpochBySnapshot.get(snapshot);
      if (requestEpoch === undefined) return false;
      return requestEpoch <= rejectThroughEpoch || requestEpoch < latestAppliedEpoch;
    },

    markApplied(snapshot: object): void {
      const requestEpoch = requestEpochBySnapshot.get(snapshot);
      if (requestEpoch === undefined) return;
      latestAppliedEpoch = Math.max(latestAppliedEpoch, requestEpoch);
    },
  };
}
