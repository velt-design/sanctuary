import { beforeEach, describe, expect, it, vi } from 'vitest';

const from = vi.fn();

vi.mock('@/lib/supabaseClient', () => ({
  supabaseServiceRole: { from: (...args: unknown[]) => from(...args) },
}));

import { nextPortalBusinessDueAt } from './taskPersistence';

function calendarResults(
  holidays: Array<{ date: string; name: string; scope: 'national' | 'regional'; region: string | null }> = [],
  closures: Array<{ date: string; name: string; region: string | null }> = [],
) {
  from.mockImplementation((table: string) => ({
    select: vi.fn().mockResolvedValue(table === 'nz_holidays'
      ? { data: holidays, error: null }
      : { data: closures, error: null }),
  }));
}

describe('automation business due dates', () => {
  beforeEach(() => from.mockReset());

  it('sets the new-lead SLA to 5pm Auckland on the next weekday', async () => {
    calendarResults();
    await expect(nextPortalBusinessDueAt(1, new Date('2026-07-17T00:00:00.000Z')))
      .resolves.toBe('2026-07-20T05:00:00.000Z');
  });

  it('skips national holidays, Auckland holidays and company closures', async () => {
    calendarResults(
      [
        { date: '2026-07-20', name: 'National test holiday', scope: 'national', region: null },
        { date: '2026-07-21', name: 'Auckland test holiday', scope: 'regional', region: 'Auckland' },
      ],
      [{ date: '2026-07-22', name: 'Company closure', region: null }],
    );
    await expect(nextPortalBusinessDueAt(1, new Date('2026-07-17T00:00:00.000Z')))
      .resolves.toBe('2026-07-23T05:00:00.000Z');
  });

  it('uses the summer Auckland offset across daylight saving', async () => {
    calendarResults();
    await expect(nextPortalBusinessDueAt(1, new Date('2026-01-09T00:00:00.000Z')))
      .resolves.toBe('2026-01-12T04:00:00.000Z');
  });
});
