import { describe, expect, it, vi } from 'vitest';
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


it('preserves exact fixed-format output, invalid values and custom fallbacks across Auckland DST', () => {
  const formats = [
    [formatPortalDate, { year: 'numeric', month: 'short', day: 'numeric' }],
    [formatPortalDateTime, { year: 'numeric', month: '2-digit', day: '2-digit', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }],
    [formatPortalTime, { hour: 'numeric', minute: '2-digit', hour12: true }],
  ] as const;
  for (const value of ['2026-04-04T13:59:59Z', '2026-04-04T14:00:00Z', '2026-09-26T13:59:59Z', '2026-09-26T14:00:00Z', 0, new Date('2026-10-25T11:00:00Z')]) {
    for (const [format, options] of formats) {
      expect(format(value)).toBe(new Intl.DateTimeFormat(PORTAL_LOCALE, { timeZone: PORTAL_TIME_ZONE, ...options }).format(new Date(value)));
    }
  }
  for (const [format] of formats) {
    for (const value of [null, undefined, '', NaN, new Date(NaN)]) expect(format(value, { fallback: 'Not recorded' })).toBe('Not recorded');
    expect(format('invalid', { fallback: 'Not recorded' })).toBe('invalid');
  }
});

it('reads the current Auckland date anew after midnight without caching date values', () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  try {
    vi.setSystemTime(new Date('2026-10-25T10:59:59Z'));
    expect(portalTodayYmd()).toBe('2026-10-25');
    vi.setSystemTime(new Date('2026-10-25T11:00:00Z'));
    expect(portalTodayYmd()).toBe('2026-10-26');
    expect(portalTodayYmd('invalid')).toBe('2026-10-26');
  } finally { vi.useRealTimers(); }
});
