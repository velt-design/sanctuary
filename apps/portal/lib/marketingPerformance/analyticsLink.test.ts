import { expect, it } from 'vitest';
import { analyticsReportLink } from './analyticsLink';
it('hands only calendar dates to the existing authenticated Analytics entry', () => {
  const url = new URL(analyticsReportLink('2026-10-01', '2026-10-20'));
  expect(url.origin + url.pathname).toBe('https://velt.systems/analytics');
  expect([...url.searchParams]).toEqual([['start', '2026-10-01'], ['end', '2026-10-20']]);
  expect(analyticsReportLink('private@example.test', '2026-10-20')).toBe('https://velt.systems/analytics');
});
