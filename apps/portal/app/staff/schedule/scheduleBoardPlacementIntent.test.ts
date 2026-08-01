import { describe, expect, it } from 'vitest';
import type { ScheduleV2Snapshot } from '@/lib/queries/schedule';
import { scheduleSnapshotMatchesBoardPlacement } from './scheduleBoardPlacementIntent';

function snapshot(): ScheduleV2Snapshot {
  return {
    generatedAt: '2026-08-01T00:00:00.000Z',
    installers: [],
    projects: [],
    scheduleItems: [
      { id: 'sch_a', projectId: 'proj_a', estimateId: 'est_a', installerId: 'crew_alpha', sortIndex: 0, updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'sch_b', projectId: 'proj_b', estimateId: 'est_b', installerId: 'crew_alpha', sortIndex: 1, updatedAt: '2026-08-01T00:00:00.000Z' },
      { id: 'sch_c', projectId: 'proj_c', estimateId: 'est_c', installerId: 'crew_bravo', sortIndex: 0, updatedAt: '2026-08-01T00:00:00.000Z' },
    ],
    conflicts: [],
    nextAvailableByInstallerId: {},
    unscheduledJobs: [{ projectId: 'proj_d', estimateId: 'est_d', projectName: 'Delta', status: 'READY', durationDays: 1 }],
    holidays: [],
    closures: [],
  };
}

describe('scheduleSnapshotMatchesBoardPlacement', () => {
  it('matches exact beginning, middle and end positions', () => {
    const value = snapshot();
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_a', scheduleItemId: 'sch_a', laneId: 'crew_alpha', insertionIndex: 0 })).toBe(true);
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_b', scheduleItemId: 'sch_b', laneId: 'crew_alpha', insertionIndex: 1 })).toBe(true);
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_b', scheduleItemId: 'sch_b', laneId: 'crew_alpha', insertionIndex: 0 })).toBe(false);
  });

  it('matches cross-crew, newly assigned and unscheduled truth by project identity', () => {
    const value = snapshot();
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_c', scheduleItemId: 'sch_c', laneId: 'crew_bravo', insertionIndex: 0 })).toBe(true);
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_c', scheduleItemId: 'sch_c', laneId: 'crew_alpha', insertionIndex: 0 })).toBe(false);
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_d', laneId: null, insertionIndex: null })).toBe(true);
  });

  it('rejects duplicate or absent placement truth', () => {
    const value = snapshot();
    value.scheduleItems.push({ ...value.scheduleItems[0], id: 'sch_duplicate' });
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_a', laneId: 'crew_alpha', insertionIndex: 0 })).toBe(false);
    expect(scheduleSnapshotMatchesBoardPlacement(value, { projectId: 'proj_missing', laneId: null, insertionIndex: null })).toBe(false);
  });
});
