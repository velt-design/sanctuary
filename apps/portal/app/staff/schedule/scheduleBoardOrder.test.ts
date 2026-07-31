import { describe, expect, it } from 'vitest';
import { clampScheduleBoardInsertionIndex, resolveScheduleBoardOrderChange } from './scheduleBoardOrder';

describe('Schedule Board order owner', () => {
  it.each([
    { requestedIndex: 0, expected: ['moving', 'a', 'b', 'c'] },
    { requestedIndex: 1, expected: ['a', 'moving', 'b', 'c'] },
    { requestedIndex: 2, expected: ['a', 'b', 'moving', 'c'] },
    { requestedIndex: 3, expected: ['a', 'b', 'c', 'moving'] },
  ])('inserts an unscheduled card at exact destination index $requestedIndex', ({ requestedIndex, expected }) => {
    expect(resolveScheduleBoardOrderChange({
      activeId: 'moving',
      sourceIds: [],
      destinationIds: ['a', 'b', 'c'],
      requestedIndex,
      sameLane: false,
    })).toMatchObject({ destinationIds: expected, insertionIndex: requestedIndex, changed: true });
  });

  it.each([
    { requestedIndex: 0, expected: ['moving', 'a', 'b', 'c'] },
    { requestedIndex: 1, expected: ['a', 'moving', 'b', 'c'] },
    { requestedIndex: 2, expected: ['a', 'b', 'moving', 'c'] },
    { requestedIndex: 3, expected: ['a', 'b', 'c', 'moving'] },
  ])('moves a card across crews to exact destination index $requestedIndex', ({ requestedIndex, expected }) => {
    expect(resolveScheduleBoardOrderChange({
      activeId: 'moving',
      sourceIds: ['source-a', 'moving', 'source-b'],
      destinationIds: ['a', 'b', 'c'],
      requestedIndex,
      sameLane: false,
    })).toEqual({
      sourceIds: ['source-a', 'source-b'],
      destinationIds: expected,
      insertionIndex: requestedIndex,
      changed: true,
    });
  });

  it.each([
    { requestedIndex: 0, expected: ['moving', 'a', 'b', 'c'] },
    { requestedIndex: 1, expected: ['a', 'moving', 'b', 'c'] },
    { requestedIndex: 2, expected: ['a', 'b', 'moving', 'c'] },
    { requestedIndex: 3, expected: ['a', 'b', 'c', 'moving'] },
  ])('reorders within a crew to exact post-removal index $requestedIndex', ({ requestedIndex, expected }) => {
    expect(resolveScheduleBoardOrderChange({
      activeId: 'moving',
      sourceIds: ['a', 'moving', 'b', 'c'],
      destinationIds: ['a', 'moving', 'b', 'c'],
      requestedIndex,
      sameLane: true,
    })).toMatchObject({ destinationIds: expected, insertionIndex: requestedIndex });
  });

  it('recognises a same-lane no-op and clamps malformed or stale indexes', () => {
    expect(resolveScheduleBoardOrderChange({
      activeId: 'moving',
      sourceIds: ['a', 'moving', 'b'],
      destinationIds: ['a', 'moving', 'b'],
      requestedIndex: 1,
      sameLane: true,
    }).changed).toBe(false);
    expect(clampScheduleBoardInsertionIndex(-4, 3)).toBe(0);
    expect(clampScheduleBoardInsertionIndex(99, 3)).toBe(3);
    expect(clampScheduleBoardInsertionIndex(Number.NaN, 3)).toBe(3);
  });
});
