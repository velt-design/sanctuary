import { describe, expect, it } from 'vitest';
import { createScheduleSnapshotRequestTracker } from './scheduleSnapshotRequestTracker';

describe('scheduleSnapshotRequestTracker', () => {
  it('rejects a read that started before a mutation settled', async () => {
    const tracker = createScheduleSnapshotRequestTracker();
    let resolveSnapshot!: (value: { generatedAt: string }) => void;
    const pendingSnapshot = new Promise<{ generatedAt: string }>((resolve) => {
      resolveSnapshot = resolve;
    });
    const tracked = tracker.track(() => pendingSnapshot);

    tracker.rejectStartedThroughCurrent();
    resolveSnapshot({ generatedAt: 'old' });
    const snapshot = await tracked;

    expect(tracker.shouldReject(snapshot)).toBe(true);
  });

  it('accepts a reconciliation read started after the mutation boundary', async () => {
    const tracker = createScheduleSnapshotRequestTracker();
    const stale = await tracker.track(async () => ({ generatedAt: 'old' }));

    tracker.rejectStartedThroughCurrent();
    const authoritative = await tracker.track(async () => ({ generatedAt: 'new' }));

    expect(tracker.shouldReject(stale)).toBe(true);
    expect(tracker.shouldReject(authoritative)).toBe(false);
  });

  it('does not allow an older request to replace a newer applied snapshot', async () => {
    const tracker = createScheduleSnapshotRequestTracker();
    let resolveOlder!: (value: { generatedAt: string }) => void;
    const olderTask = tracker.track(
      () =>
        new Promise<{ generatedAt: string }>((resolve) => {
          resolveOlder = resolve;
        }),
    );
    const newer = await tracker.track(async () => ({ generatedAt: 'newer' }));

    tracker.markApplied(newer);
    resolveOlder({ generatedAt: 'older' });
    const older = await olderTask;

    expect(tracker.shouldReject(older)).toBe(true);
  });
});
