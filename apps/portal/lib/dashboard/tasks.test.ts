import { describe, expect, it } from 'vitest';
import {
  isDashboardTaskVisibleToday,
  normalizeDashboardTaskTitle,
  portalBusinessDayStartIso,
} from './tasks';

describe('dashboard tasks', () => {
  it('normalizes task titles', () => {
    expect(normalizeDashboardTaskTitle('  Call client  ')).toBe('Call client');
    expect(normalizeDashboardTaskTitle('')).toBeNull();
    expect(normalizeDashboardTaskTitle('x'.repeat(241))).toBeNull();
  });

  it('keeps incomplete and today-completed tasks visible', () => {
    const now = '2026-05-30T02:00:00.000Z';

    expect(isDashboardTaskVisibleToday({ completedAt: null }, now)).toBe(true);
    expect(isDashboardTaskVisibleToday({ completedAt: '2026-05-30T01:00:00.000Z' }, now)).toBe(true);
    expect(isDashboardTaskVisibleToday({ completedAt: '2026-05-28T23:00:00.000Z' }, now)).toBe(false);
  });

  it('calculates the Auckland business-day start as a UTC instant', () => {
    expect(portalBusinessDayStartIso('2026-05-30T02:00:00.000Z')).toBe('2026-05-29T12:00:00.000Z');
  });
});
