import { describe, expect, it } from 'vitest';
import { addWorkingDays, buildWorkingDayIndex, isWorkingDay } from './workingDays';

describe('scheduling.workingDays', () => {
  it('treats weekends as non-working', () => {
    const index = buildWorkingDayIndex();
    expect(isWorkingDay('2026-02-07', 'Auckland', index)).toBe(false); // Sat
    expect(isWorkingDay('2026-02-08', 'Auckland', index)).toBe(false); // Sun
    expect(isWorkingDay('2026-02-09', 'Auckland', index)).toBe(true); // Mon
  });

  it('treats national holidays as non-working', () => {
    const index = buildWorkingDayIndex([{ date: '2026-02-06', name: 'Waitangi Day', scope: 'national' }]);
    expect(isWorkingDay('2026-02-06', 'Auckland', index)).toBe(false);
  });

  it('treats regional holidays as non-working only for matching region', () => {
    const index = buildWorkingDayIndex([{ date: '2026-02-10', name: 'Auckland Day', scope: 'regional', region: 'Auckland' }]);
    expect(isWorkingDay('2026-02-10', 'Auckland', index)).toBe(false);
    expect(isWorkingDay('2026-02-10', 'Wellington', index)).toBe(true);
  });

  it('addWorkingDays skips weekends and holidays deterministically', () => {
    const index = buildWorkingDayIndex([{ date: '2026-02-06', name: 'Waitangi Day', scope: 'national' }]);
    expect(addWorkingDays('2026-02-05', 1, 'Auckland', index)).toBe('2026-02-09'); // Thu + 1 workday -> Mon (Fri holiday + weekend)
    expect(addWorkingDays('2026-02-05', 2, 'Auckland', index)).toBe('2026-02-10'); // Thu + 2 workdays -> Tue
  });
});
