import { describe, expect, it } from 'vitest';

import {
  axisSpanPx,
  buildGanttAxis,
  formatGanttWeekRangeLabel,
  snapAxisDayDeltaForPixelDelta,
  todayYmdInTimeZone,
} from './ganttAxis';

describe('ganttAxis', () => {
  it('formats same-month and cross-month week labels', () => {
    expect(formatGanttWeekRangeLabel('2026-02-09')).toBe('09–15 Feb');
    expect(formatGanttWeekRangeLabel('2026-02-23')).toBe('23 Feb–01 Mar');
  });

  it('builds month spans from week-start months', () => {
    const axis = buildGanttAxis({
      rangeStart: '2026-02-16',
      rangeDays: 28,
      baseDayPx: 18,
      weekendWeight: 0.5,
    });

    expect(axis.weeks.length).toBe(4);
    expect(axis.months).toHaveLength(2);
    expect(axis.months[0]?.label).toBe('Feb 2026');
    expect(axis.months[0]?.startWeekIndex).toBe(0);
    expect(axis.months[0]?.endWeekIndexExclusive).toBe(2);
    expect(axis.months[1]?.label).toBe('Mar 2026');
  });

  it('computes weighted spans with compressed weekends', () => {
    const axis = buildGanttAxis({
      rangeStart: '2026-02-09',
      rangeDays: 7,
      baseDayPx: 18,
      weekendWeight: 0.5,
    });

    expect(axis.totalWidth).toBe(108);

    const weekdaySpan = axisSpanPx(axis, '2026-02-09', '2026-02-13');
    expect(weekdaySpan.widthPx).toBe(90);

    const fullWeek = axisSpanPx(axis, '2026-02-09', '2026-02-15');
    expect(fullWeek.widthPx).toBe(108);
  });

  it('snaps pixel drag deltas on weighted boundaries', () => {
    const plusThree = snapAxisDayDeltaForPixelDelta({
      startDate: '2026-02-13',
      deltaPx: 36,
      baseDayPx: 18,
      weekendWeight: 0.5,
    });
    expect(plusThree).toBe(3);

    const minusTwo = snapAxisDayDeltaForPixelDelta({
      startDate: '2026-02-16',
      deltaPx: -18,
      baseDayPx: 18,
      weekendWeight: 0.5,
    });
    expect(minusTwo).toBe(-2);
  });

  it('derives today in Pacific/Auckland deterministically', () => {
    const value = todayYmdInTimeZone('Pacific/Auckland', new Date('2026-02-13T12:00:00.000Z'));
    expect(value).toBe('2026-02-14');
  });
});
