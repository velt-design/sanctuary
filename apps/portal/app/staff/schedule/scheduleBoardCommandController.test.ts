import { describe, expect, it, vi } from 'vitest';
import type { ScheduleItem } from '@/lib/types/scheduling';
import {
  applyScheduleBoardPlacement,
  createScheduleBoardCommandController,
  replayScheduleBoardPlacements,
} from './scheduleBoardCommandController';

function item(id: string, projectId: string, installerId: string, sortIndex: number): ScheduleItem {
  return {
    id,
    projectId,
    estimateId: `estimate-${projectId}`,
    installerId,
    sortIndex,
    scheduleStatus: 'TENTATIVE',
    locked: false,
    updatedAt: '2026-04-07T00:00:00.000Z',
    itemType: 'job',
    forecastStart: null,
    forecastEndExclusive: null,
    forecastDurationDays: 1,
    durationHoursOverride: 8,
    mode: 'floating',
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

describe('scheduleBoardCommandController', () => {
  it('runs disjoint crew changes concurrently while preserving FIFO order for one lane', async () => {
    const controller = createScheduleBoardCommandController();
    const first = deferred<'settled'>();
    const second = deferred<'settled'>();
    const independent = deferred<'settled'>();
    const starts: number[] = [];

    controller.enqueue({ id: 1, resources: ['lane:a'], execute: () => { starts.push(1); return first.promise; } });
    controller.enqueue({ id: 2, resources: ['lane:a'], execute: () => { starts.push(2); return second.promise; } });
    controller.enqueue({ id: 3, resources: ['lane:b'], execute: () => { starts.push(3); return independent.promise; } });

    expect(starts).toEqual([1, 3]);
    independent.resolve('settled');
    await independent.promise;
    await Promise.resolve();
    expect(starts).toEqual([1, 3]);

    first.resolve('settled');
    await first.promise;
    await Promise.resolve();
    expect(starts).toEqual([1, 3, 2]);
    second.resolve('settled');
    await second.promise;
    await Promise.resolve();
    expect(controller.getSnapshot().pendingIds).toEqual([]);
  });

  it('blocks only conflicted resources and resumes their queue after recovery', async () => {
    const controller = createScheduleBoardCommandController();
    const sameLane = vi.fn(async () => 'settled' as const);
    const otherLane = vi.fn(async () => 'settled' as const);

    controller.enqueue({ id: 1, resources: ['project:p1', 'lane:a'], execute: async () => 'blocked' });
    await Promise.resolve();
    controller.enqueue({ id: 2, resources: ['lane:a'], execute: sameLane });
    controller.enqueue({ id: 3, resources: ['lane:b'], execute: otherLane });
    await Promise.resolve();

    expect(controller.getSnapshot().blockedResources).toEqual(new Set(['project:p1', 'lane:a']));
    expect(sameLane).not.toHaveBeenCalled();
    expect(otherLane).toHaveBeenCalledTimes(1);

    controller.resolve(1);
    await Promise.resolve();
    expect(sameLane).toHaveBeenCalledTimes(1);
  });

  it('replays later same-lane intent over an earlier authoritative response without visual rewind', () => {
    const initial = {
      scheduleItems: [item('a', 'p-a', 'crew-a', 0), item('b', 'p-b', 'crew-a', 1), item('c', 'p-c', 'crew-a', 2)],
      unscheduledJobsSeed: [],
    };
    const firstIntent = { projectId: 'p-a', scheduleItemId: 'a', destinationLaneId: 'crew-a', insertionIndex: 2 };
    const secondIntent = { projectId: 'p-b', scheduleItemId: 'b', destinationLaneId: 'crew-a', insertionIndex: 2 };
    const optimistic = replayScheduleBoardPlacements(initial, [firstIntent, secondIntent]);
    expect(optimistic.scheduleItems.sort((a, b) => a.sortIndex - b.sortIndex).map((entry) => entry.id)).toEqual(['c', 'a', 'b']);

    const firstServerResponse = applyScheduleBoardPlacement(initial, firstIntent);
    const rebased = replayScheduleBoardPlacements(firstServerResponse, [secondIntent]);
    expect(rebased.scheduleItems.sort((a, b) => a.sortIndex - b.sortIndex).map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
  });

  it('uses project identity to rebase a queued move when a temporary assignment receives its server id', () => {
    const temporary = item('tmp-1', 'p-new', 'crew-a', 1);
    const assigned = applyScheduleBoardPlacement(
      { scheduleItems: [item('a', 'p-a', 'crew-a', 0)], unscheduledJobsSeed: [] },
      { projectId: 'p-new', destinationLaneId: 'crew-a', insertionIndex: 1, itemTemplate: temporary },
    );
    expect(assigned.scheduleItems.some((entry) => entry.id === 'tmp-1')).toBe(true);

    const authoritative = {
      scheduleItems: [item('a', 'p-a', 'crew-a', 0), item('server-1', 'p-new', 'crew-a', 1)],
      unscheduledJobsSeed: [],
    };
    const moved = applyScheduleBoardPlacement(authoritative, {
      projectId: 'p-new',
      scheduleItemId: 'tmp-1',
      destinationLaneId: 'crew-a',
      insertionIndex: 0,
    });
    expect(moved.scheduleItems.sort((a, b) => a.sortIndex - b.sortIndex).map((entry) => entry.id)).toEqual(['server-1', 'a']);
  });
});
