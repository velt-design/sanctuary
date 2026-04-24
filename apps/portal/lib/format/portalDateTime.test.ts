import { describe, expect, it } from 'vitest';
import {
  PORTAL_LOCALE,
  PORTAL_TIME_ZONE,
  formatPortalDate,
  formatPortalDateTime,
  formatPortalTime,
  portalTodayYmd,
} from './portalDateTime';

describe('portalDateTime', () => {
  it('formats date-time values deterministically for the portal locale and timezone', () => {
    const expected = new Intl.DateTimeFormat(PORTAL_LOCALE, {
      timeZone: PORTAL_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(new Date('2026-04-06T01:30:08.000Z'));

    expect(formatPortalDateTime('2026-04-06T01:30:08.000Z')).toBe(expected);
    expect(formatPortalDateTime('2026-04-06T01:30:08.000Z')).toBe(formatPortalDateTime('2026-04-06T01:30:08.000Z'));
  });

  it('falls back consistently for empty or invalid values', () => {
    expect(formatPortalDateTime('')).toBe('—');
    expect(formatPortalDate('')).toBe('—');
    expect(formatPortalTime('')).toBe('—');
    expect(formatPortalDateTime('not-a-date')).toBe('not-a-date');
  });

  it('keeps portal today aligned to Pacific/Auckland boundaries', () => {
    expect(portalTodayYmd('2026-04-05T11:59:59.000Z')).toBe('2026-04-05');
    expect(portalTodayYmd('2026-04-05T12:00:00.000Z')).toBe('2026-04-06');
  });
});
