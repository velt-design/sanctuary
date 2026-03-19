import { describe, expect, it } from 'vitest';
import { __resetSaveTrackerForTests, saveTracker } from './saveTracker';

describe('saveTracker', () => {
  it('combines local-first pending work into the global save state', () => {
    __resetSaveTrackerForTests();

    saveTracker.setLocalFirstSummary({
      queuedCount: 2,
      syncingCount: 1,
      conflictCount: 0,
      errorCount: 0,
      offlineCount: 0,
      entityCount: 2,
      pendingCount: 3,
      lastSyncedAt: '2026-03-19T12:00:00.000Z',
    });

    const snapshot = saveTracker.getSnapshot();
    expect(snapshot.status).toBe('saving');
    expect(snapshot.pending).toBe(3);
    expect(snapshot.queued).toBe(2);
    expect(snapshot.syncing).toBe(1);
    expect(snapshot.lastSavedAt).toBe('2026-03-19T12:00:00.000Z');
  });

  it('surfaces local-first conflicts ahead of normal save state', () => {
    __resetSaveTrackerForTests();

    saveTracker.setLocalFirstSummary({
      queuedCount: 0,
      syncingCount: 0,
      conflictCount: 1,
      errorCount: 0,
      offlineCount: 0,
      entityCount: 1,
      pendingCount: 0,
      issueMessage: 'Estimate changed on another screen.',
    });

    const snapshot = saveTracker.getSnapshot();
    expect(snapshot.status).toBe('conflict');
    expect(snapshot.conflicts).toBe(1);
    expect(snapshot.lastError).toBe('Estimate changed on another screen.');
  });

  it('keeps offline state when there is pending work and the browser disconnects', () => {
    __resetSaveTrackerForTests();

    saveTracker.setLocalFirstSummary({
      queuedCount: 1,
      syncingCount: 0,
      conflictCount: 0,
      errorCount: 0,
      offlineCount: 0,
      entityCount: 1,
      pendingCount: 1,
    });
    saveTracker.setOnline(false);

    const snapshot = saveTracker.getSnapshot();
    expect(snapshot.status).toBe('offline');
    expect(snapshot.pending).toBe(1);
  });
});
