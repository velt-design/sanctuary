import { describe, expect, it } from 'vitest';
import {
  clampWorkQueuePage,
  paginateWorkQueueEntries,
  workQueueTotalPages,
} from './workQueuePagination';

describe('work queue pagination', () => {
  it('keeps the queue usable when the rollout exceeds the old 500-row cap', () => {
    const entries = Array.from({ length: 821 }, (_, index) => index + 1);
    expect(workQueueTotalPages(entries.length)).toBe(9);
    expect(paginateWorkQueueEntries(entries, 6)).toMatchObject({
      page: 6,
      totalPages: 9,
      rangeStart: 501,
      rangeEnd: 600,
    });
  });

  it('clamps stale pages after the queue shrinks', () => {
    expect(clampWorkQueuePage(9, 24)).toBe(1);
    expect(paginateWorkQueueEntries([1, 2], -2)).toMatchObject({
      page: 1,
      rangeStart: 1,
      rangeEnd: 2,
    });
  });
});
