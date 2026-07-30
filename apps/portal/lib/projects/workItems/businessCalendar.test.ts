import { describe, expect, it } from 'vitest';
import { aucklandLocalDate } from './businessCalendar';

describe('Auckland local date', () => {
  it('uses the Auckland date across UTC and daylight-saving boundaries', () => {
    expect(aucklandLocalDate('2026-01-11T11:30:00.000Z')).toBe('2026-01-12');
    expect(aucklandLocalDate('2026-07-11T12:30:00.000Z')).toBe('2026-07-12');
  });

  it('returns an empty date for invalid input', () => {
    expect(aucklandLocalDate('not-a-date')).toBe('');
  });
});
