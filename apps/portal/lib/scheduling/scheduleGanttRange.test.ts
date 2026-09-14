import { describe, expect, it } from 'vitest';
import { resolveDefaultScheduleGanttRange } from './scheduleGanttRange';

describe('Schedule history range', () => {
  it('includes four complete past weeks and preserves twelve forward weeks', () => {
    expect(resolveDefaultScheduleGanttRange('2026-09-08')).toEqual({
      rangeStart: '2026-08-10', rangeEnd: '2026-11-29',
    });
  });
  it('keeps history Monday-aligned across a year boundary', () => {
    expect(resolveDefaultScheduleGanttRange('2026-01-01')).toEqual({
      rangeStart: '2025-12-01', rangeEnd: '2026-03-22',
    });
  });
});
