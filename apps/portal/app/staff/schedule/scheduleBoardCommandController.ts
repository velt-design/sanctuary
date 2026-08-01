import type { ScheduleItem } from '@/lib/types/scheduling';
import type { SchedulableJob } from './ScheduleClientModel';

export type ScheduleBoardPlacementOperation = {
  projectId: string;
  scheduleItemId?: string;
  destinationLaneId: string | null;
  insertionIndex: number | null;
  itemTemplate?: ScheduleItem;
  unscheduledJob?: SchedulableJob;
};

type ScheduleBoardPlacementState = {
  scheduleItems: ScheduleItem[];
  unscheduledJobsSeed: SchedulableJob[];
};

function normalizeLane(items: ScheduleItem[], laneId: string, updatedAt: string): ScheduleItem[] {
  const lane = items
    .filter((item) => item.installerId === laneId)
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));
  const laneIds = new Set(lane.map((item) => item.id));
  return [
    ...items.filter((item) => !laneIds.has(item.id)),
    ...lane.map((item, index) => ({ ...item, sortIndex: index, updatedAt })),
  ];
}

function findPlacementItem(items: ScheduleItem[], operation: ScheduleBoardPlacementOperation): ScheduleItem | null {
  if (operation.scheduleItemId) {
    const byId = items.find((item) => item.id === operation.scheduleItemId);
    if (byId) return byId;
  }
  return items.find((item) => item.itemType === 'job' && item.projectId === operation.projectId) ?? null;
}

export function applyScheduleBoardPlacement(
  state: ScheduleBoardPlacementState,
  operation: ScheduleBoardPlacementOperation,
  updatedAt = new Date().toISOString(),
): ScheduleBoardPlacementState {
  const moving = findPlacementItem(state.scheduleItems, operation) ?? operation.itemTemplate ?? null;
  const sourceLaneId = moving?.installerId ?? null;
  let nextItems = moving
    ? state.scheduleItems.filter((item) => item.id !== moving.id && !(item.itemType === 'job' && item.projectId === operation.projectId))
    : state.scheduleItems.slice();
  let nextUnscheduled = state.unscheduledJobsSeed.filter((job) => job.projectId !== operation.projectId);

  if (operation.destinationLaneId && moving) {
    const destinationLane = nextItems
      .filter((item) => item.installerId === operation.destinationLaneId)
      .slice()
      .sort((a, b) => a.sortIndex - b.sortIndex || a.updatedAt.localeCompare(b.updatedAt));
    const insertionIndex = Math.max(
      0,
      Math.min(operation.insertionIndex ?? destinationLane.length, destinationLane.length),
    );
    destinationLane.splice(insertionIndex, 0, {
      ...moving,
      installerId: operation.destinationLaneId,
      sortIndex: insertionIndex,
      updatedAt,
    });
    const positionedDestination = destinationLane.map((item, index) => ({
      ...item,
      installerId: operation.destinationLaneId!,
      sortIndex: index,
      updatedAt,
    }));
    const destinationIds = new Set(positionedDestination.map((item) => item.id));
    nextItems = [
      ...nextItems.filter(
        (item) => item.installerId !== operation.destinationLaneId && !destinationIds.has(item.id),
      ),
      ...positionedDestination,
    ];
  } else if (!operation.destinationLaneId && operation.unscheduledJob) {
    nextUnscheduled = [...nextUnscheduled, operation.unscheduledJob].sort((a, b) =>
      a.projectName.localeCompare(b.projectName),
    );
  }

  if (sourceLaneId) nextItems = normalizeLane(nextItems, sourceLaneId, updatedAt);
  if (operation.destinationLaneId && operation.destinationLaneId !== sourceLaneId) {
    nextItems = normalizeLane(nextItems, operation.destinationLaneId, updatedAt);
  }

  return { scheduleItems: nextItems, unscheduledJobsSeed: nextUnscheduled };
}

export function replayScheduleBoardPlacements(
  state: ScheduleBoardPlacementState,
  operations: readonly ScheduleBoardPlacementOperation[],
  updatedAt = new Date().toISOString(),
): ScheduleBoardPlacementState {
  return operations.reduce(
    (current, operation) => applyScheduleBoardPlacement(current, operation, updatedAt),
    state,
  );
}

type ScheduleBoardCommandOutcome = 'settled' | 'blocked';

type ScheduleBoardCommand = {
  id: number;
  resources: readonly string[];
  execute: () => Promise<ScheduleBoardCommandOutcome>;
};

type ScheduleBoardCommandSnapshot = {
  pendingIds: readonly number[];
  runningIds: readonly number[];
  blockedIds: readonly number[];
  blockedResources: ReadonlySet<string>;
};

type CommandEntry = ScheduleBoardCommand & { status: 'queued' | 'running' | 'blocked' };

const EMPTY_SNAPSHOT: ScheduleBoardCommandSnapshot = {
  pendingIds: [],
  runningIds: [],
  blockedIds: [],
  blockedResources: new Set(),
};

export function createScheduleBoardCommandController() {
  const entries: CommandEntry[] = [];
  const listeners = new Set<() => void>();
  let snapshot = EMPTY_SNAPSHOT;

  const publish = () => {
    snapshot = {
      pendingIds: entries.map((entry) => entry.id),
      runningIds: entries.filter((entry) => entry.status === 'running').map((entry) => entry.id),
      blockedIds: entries.filter((entry) => entry.status === 'blocked').map((entry) => entry.id),
      blockedResources: new Set(
        entries.filter((entry) => entry.status === 'blocked').flatMap((entry) => [...entry.resources]),
      ),
    };
    listeners.forEach((listener) => listener());
  };

  const resourcesOverlap = (left: readonly string[], right: readonly string[]) => {
    const rightSet = new Set(right);
    return left.some((resource) => rightSet.has(resource));
  };

  const schedule = () => {
    const active = entries.filter((entry) => entry.status !== 'queued');
    const starting: CommandEntry[] = [];
    for (const entry of entries) {
      if (entry.status !== 'queued') continue;
      const entryIndex = entries.indexOf(entry);
      const waitsForEarlier = entries
        .slice(0, entryIndex)
        .some((earlier) => earlier.status === 'queued' && resourcesOverlap(earlier.resources, entry.resources));
      const resourceBusy = [...active, ...starting].some((other) => resourcesOverlap(other.resources, entry.resources));
      if (waitsForEarlier || resourceBusy) continue;
      entry.status = 'running';
      starting.push(entry);
    }
    if (!starting.length) return;
    publish();
    for (const entry of starting) {
      void entry.execute()
        .then((outcome) => {
          const current = entries.find((candidate) => candidate.id === entry.id);
          if (!current) return;
          if (outcome === 'blocked') current.status = 'blocked';
          else entries.splice(entries.indexOf(current), 1);
          publish();
          schedule();
        })
        .catch(() => {
          const current = entries.find((candidate) => candidate.id === entry.id);
          if (!current) return;
          entries.splice(entries.indexOf(current), 1);
          publish();
          schedule();
        });
    }
  };

  return {
    enqueue(command: ScheduleBoardCommand) {
      if (entries.some((entry) => entry.id === command.id)) throw new Error(`Duplicate Board command ${command.id}.`);
      entries.push({ ...command, status: 'queued' });
      publish();
      schedule();
    },
    resolve(id: number) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry) return;
      entries.splice(entries.indexOf(entry), 1);
      publish();
      schedule();
    },
    retry(id: number) {
      const entry = entries.find((candidate) => candidate.id === id);
      if (!entry || entry.status !== 'blocked') return;
      entry.status = 'queued';
      publish();
      schedule();
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
