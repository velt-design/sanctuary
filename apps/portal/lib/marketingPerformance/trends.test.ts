import { expect, it } from 'vitest';
import { previousPeriod, countChange, weeklyEnquiries } from './trends';
import { fixtureReport } from '../../app/qa/marketing-performance-fixture/fixtures';

it('compares adjacent equal inclusive periods without overlap through DST/leap day', () => {
  expect(previousPeriod('2026-09-01', '2026-09-22')).toEqual({ start: '2026-08-10', end: '2026-08-31', days: 22 });
  expect(previousPeriod('2024-03-01', '2024-03-01')).toEqual({ start: '2024-02-29', end: '2024-02-29', days: 1 });
  expect(previousPeriod('2026-09-27', '2026-10-03')).toEqual({ start: '2026-09-20', end: '2026-09-26', days: 7 });
});
it('never invents percentage growth from a zero baseline', () => {
  expect(countChange(12, 4)).toBe('+8 (+200%)');
  expect(countChange(0, 4)).toBe('-4 (-100%)');
  expect(countChange(4, 0)).toBe('+4 · no previous records');
  expect(countChange(0, 0)).toBe('No change in recorded count');
});
it('reconciles weekly buckets to receipts with zero weeks and exact partial-day denominators', () => {
  const weeks = weeklyEnquiries(fixtureReport.rows, '2026-09-01', '2026-09-22');
  expect(weeks.map(week => week.days)).toEqual([6, 7, 7, 2]);
  expect(weeks.reduce((sum, week) => sum + week.enquiries, 0)).toBe(12);
  expect(weeks.reduce((sum, week) => sum + week.days, 0)).toBe(22);
  expect(weeks[3]).toMatchObject({ start: '2026-09-21', end: '2026-09-22', enquiries: 0 });
  expect(weeklyEnquiries([], '2026-09-22', '2026-09-22')).toEqual([{ start: '2026-09-22', end: '2026-09-22', days: 1, enquiries: 0, dailyAverage: 0 }]);
});
it('assigns receipts by Auckland day at the boundary and excludes out-of-period records', () => {
  const row = fixtureReport.rows[0];
  const weeks = weeklyEnquiries([
    { ...row, receivedAt: '2026-09-20T12:00:00Z' }, // Monday in Auckland
    { ...row, receivedAt: '2026-09-20T11:59:59Z' }, // Sunday outside selection
    { ...row, receivedAt: '2026-09-22T12:00:00Z' }, // Wednesday outside selection
  ], '2026-09-21', '2026-09-22');
  expect(weeks[0]).toMatchObject({ enquiries: 1, days: 2, dailyAverage: 0.5 });
});
