type ScheduleBoardOrderChange = {
  sourceIds: string[];
  destinationIds: string[];
  insertionIndex: number;
  changed: boolean;
};

export function clampScheduleBoardInsertionIndex(requestedIndex: number, destinationLength: number): number {
  const safeLength = Math.max(0, Math.trunc(destinationLength));
  if (!Number.isFinite(requestedIndex)) return safeLength;
  return Math.max(0, Math.min(Math.trunc(requestedIndex), safeLength));
}

/**
 * Resolves the visual insertion cue into the exact ordered lane arrays used by
 * optimistic state and Schedule V2 commands. The insertion index is always
 * measured after removing the active card from its source lane.
 */
export function resolveScheduleBoardOrderChange(input: {
  activeId: string;
  sourceIds: string[];
  destinationIds: string[];
  requestedIndex: number;
  sameLane: boolean;
}): ScheduleBoardOrderChange {
  const sourceIds = input.sourceIds.filter((id) => id !== input.activeId);
  const destinationBase = input.sameLane
    ? sourceIds.slice()
    : input.destinationIds.filter((id) => id !== input.activeId);
  const insertionIndex = clampScheduleBoardInsertionIndex(input.requestedIndex, destinationBase.length);
  const destinationIds = destinationBase.slice();
  destinationIds.splice(insertionIndex, 0, input.activeId);

  return {
    sourceIds,
    destinationIds,
    insertionIndex,
    changed: input.sameLane
      ? destinationIds.some((id, index) => id !== input.sourceIds[index]) || destinationIds.length !== input.sourceIds.length
      : true,
  };
}
