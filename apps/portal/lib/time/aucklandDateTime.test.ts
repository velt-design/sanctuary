import { describe, expect, it } from 'vitest';
import {
  formatAucklandDateTimeLocal,
  parseAucklandDateTimeLocal,
} from './aucklandDateTime';

describe('Auckland datetime-local conversion', () => {
  it('is independent of the browser or server timezone', () => {
    const iso = parseAucklandDateTimeLocal('2026-07-29T09:30');
    expect(iso).toBe('2026-07-28T21:30:00.000Z');
    expect(formatAucklandDateTimeLocal(iso)).toBe('2026-07-29T09:30');
  });

  it('uses the summer daylight-saving offset', () => {
    expect(parseAucklandDateTimeLocal('2026-01-29T09:30')).toBe(
      '2026-01-28T20:30:00.000Z',
    );
  });

  it('rejects malformed and impossible daylight-saving wall-clock values', () => {
    expect(parseAucklandDateTimeLocal('not-a-date')).toBeNull();
    expect(parseAucklandDateTimeLocal('2026-09-27T02:30')).toBeNull();
    expect(formatAucklandDateTimeLocal('not-a-date')).toBe('');
  });
});
