import { describe, expect, it } from 'vitest';
import { dateRanges, matchingPreset, presetDates } from './dateRanges';
import { comparisonRows, validPeriod } from './contract';
import { fixtureReport } from '../../app/qa/marketing-performance-fixture/fixtures';

describe('Auckland reporting shortcuts', () => {
  const now = new Date('2026-09-21T13:30:00Z'); // 22 September in Auckland
  it.each([
    ['7d', '2026-09-16', '2026-09-22'], ['30d', '2026-08-24', '2026-09-22'],
    ['90d', '2026-06-25', '2026-09-22'], ['12m', '2025-09-23', '2026-09-22'],
    ['ytd', '2026-01-01', '2026-09-22'], ['previous-ytd', '2025-01-01', '2025-09-22'],
  ] as const)('%s uses inclusive calendar dates', (key, start, end) => {
    expect(presetDates(key, now)).toEqual({ start, end });
    expect(matchingPreset(start, end, now)).toBe(key);
    expect(validPeriod(start, end, '2026-09-22')).toBe(true);
  });
  it('handles leap-day and year boundaries without overflowing February', () => {
    expect(presetDates('previous-ytd', new Date('2024-02-29T00:00:00Z'))).toEqual({ start: '2023-01-01', end: '2023-02-28' });
    expect(presetDates('12m', new Date('2024-02-29T00:00:00Z'))).toEqual({ start: '2023-03-01', end: '2024-02-29' });
    expect(presetDates('7d', new Date('2026-01-01T00:00:00Z'))).toEqual({ start: '2025-12-26', end: '2026-01-01' });
  });
  it('keeps every shortcut within the RPC limit through DST and leap years', () => {
    for (const instant of ['2024-12-31T00:00:00Z', '2026-09-27T00:00:00Z', '2025-03-01T00:00:00Z']) {
      for (const [key] of dateRanges) {
        const { start, end } = presetDates(key, new Date(instant));
        expect(validPeriod(start, end, instant.slice(0, 10))).toBe(true);
      }
    }
    expect(matchingPreset('2026-09-01', '2026-09-12', now)).toBeUndefined();
  });
});

it('sorts by verified outcomes/rates while retaining group totals and unavailable denominators', () => {
  const rows = fixtureReport.rows;
  const groups = comparisonRows(rows, 'winRate');
  expect(groups.reduce((n, group) => n + group.summary.enquiries, 0)).toBe(rows.length);
  expect(groups.reduce((n, group) => n + group.summary.won, 0)).toBe(2);
  const scores = groups.map(group => group.summary.origins ? group.summary.won / group.summary.origins : -1);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  for (const sort of ['won', 'qualified', 'enquiries'] as const) {
    const values = comparisonRows(rows, sort).map(group => group.summary[sort]);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  }
});
