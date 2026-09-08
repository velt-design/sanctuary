import { describe, expect, it } from 'vitest';
import { addDaysYmd, isWorkday } from '@/lib/scheduling/date';

import {
  axisSpanPx,
  buildGanttAxis,
  formatGanttWeekRangeLabel,
  snapAxisDayDeltaForPixelDelta,
  todayYmdInTimeZone,
} from './ganttAxis';

describe('ganttAxis', () => {
  it.each([18, 27, 54])('resizes from the visible Friday edge when the stored end is a hidden weekend at %ipx', (baseDayPx) => {
    for (const startDate of ['2026-08-07', '2026-08-08', '2026-08-09']) {
      for (const [days, target] of [[1, '2026-08-10'], [2, '2026-08-11'], [-1, '2026-08-06'], [-2, '2026-08-05']] as const) {
        const delta = snapAxisDayDeltaForPixelDelta({ startDate, edge: 'end', deltaPx: days * baseDayPx, baseDayPx, weekendWeight: 0 });
        expect(addDaysYmd(startDate, delta)).toBe(target);
      }
      expect(snapAxisDayDeltaForPixelDelta({ startDate, edge: 'end', deltaPx: 0, baseDayPx, weekendWeight: 0 })).toBe(0);
    }
  });
  it.each([18, 27, 54])('round trips displayed working-day positions in both directions at %ipx', (baseDayPx) => {
    const axis = buildGanttAxis({ rangeStart: '2026-09-07', rangeDays: 28, baseDayPx, weekendWeight: 0 });
    for (let from = 0; from < 28; from += 1) {
      const startDate = addDaysYmd('2026-09-07', from);
      if (!isWorkday(startDate)) continue;
      for (let to = 0; to < 28; to += 1) {
        const targetDate = addDaysYmd('2026-09-07', to);
        if (!isWorkday(targetDate)) continue;
        const deltaPx = axis.boundaryPx[to] - axis.boundaryPx[from];
        const delta = snapAxisDayDeltaForPixelDelta({ startDate, deltaPx, baseDayPx, weekendWeight: 0 });
        expect(addDaysYmd(startDate, delta), `${startDate} to ${targetDate}`).toBe(targetDate);
      }
    }
  });
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
